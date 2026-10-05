'use client';

import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCurrency } from '@/hooks/use-currency';
import { fetchRate } from '@/lib/exchange-rates/client';
import { roundAmount } from '@/lib/currency/money';
import { formatRateInput, parseDecimal } from '@/lib/currency/money-input';
import type { RateSource } from '@/lib/currency/money';

export interface RateInputValue {
  rate: string;
  rateSource: RateSource;
}

interface RateInputProps {
  /** Original currency of the movement. Renders nothing when it equals the base currency. */
  currency: string;
  value: RateInputValue;
  onChange: (next: RateInputValue) => void;
  /** Movement date (YYYY-MM-DD): the rate is looked up for this day. */
  date: string;
  /** Amount in the original currency, used to show the base equivalent. */
  amount: number | null;
  idPrefix: string;
  disabled?: boolean;
  /** When false the stored rate is never re-fetched (edit dialogs keep the saved rate). */
  autoFetch?: boolean;
  /** Hides the "Equivale a" line when the caller shows its own derived value. */
  hideEquivalent?: boolean;
}

type Notice = 'stale' | 'fallback' | 'manual-required' | null;

const RATE_FILTER = /[^0-9.,]/g;

/**
 * Shows "1 USD = X ARS" with the base equivalent. The rate is prefilled for the movement date
 * while its source is "auto"; editing it switches the source to "manual".
 */
export function RateInput({
  currency,
  value,
  onChange,
  date,
  amount,
  idPrefix,
  disabled,
  autoFetch = true,
  hideEquivalent = false,
}: RateInputProps) {
  const { baseCurrency, rateType, format, isReconverting } = useCurrency();
  const foreign = currency !== baseCurrency;
  const isDisabled = disabled || isReconverting;

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [retry, setRetry] = useState(0);

  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const requestId = useRef(0);

  const isAuto = value.rateSource === 'auto';

  useEffect(() => {
    if (!foreign || !autoFetch || !isAuto || !date) {
      setLoading(false);
      if (!foreign) setNotice(null);
      return;
    }

    const id = ++requestId.current;
    setLoading(true);
    setNotice(null);

    fetchRate(currency, baseCurrency, date, rateType)
      .then((result) => {
        if (id !== requestId.current) return;
        onChangeRef.current({ rate: formatRateInput(result.rate), rateSource: 'auto' });
        setNotice(result.stale ? 'stale' : result.fallback ? 'fallback' : null);
      })
      .catch(() => {
        if (id !== requestId.current) return;
        onChangeRef.current({ rate: '', rateSource: 'auto' });
        setNotice('manual-required');
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });

    return () => {
      // Invalidate in-flight requests when inputs change or the component unmounts.
      requestId.current++;
    };
  }, [foreign, autoFetch, isAuto, date, currency, baseCurrency, rateType, retry]);

  if (!foreign) return null;

  const rateNumber = parseDecimal(value.rate);
  const equivalent =
    amount !== null && Number.isFinite(amount) && Number.isFinite(rateNumber) && rateNumber > 0
      ? roundAmount(amount * rateNumber)
      : null;

  const rateId = `${idPrefix}-rate`;

  return (
    <div className='min-w-0 space-y-1.5 rounded-md border bg-muted/30 p-2.5'>
      <Label htmlFor={rateId} className='text-xs text-muted-foreground'>
        Cotización
      </Label>
      <div className='flex min-w-0 items-center gap-2 text-sm'>
        <span className='shrink-0 whitespace-nowrap'>1 {currency} =</span>
        <Input
          id={rateId}
          name={rateId}
          type='text'
          inputMode='decimal'
          placeholder={loading ? 'Buscando…' : '0.00'}
          value={value.rate}
          onChange={(e) => {
            onChange({
              rate: e.target.value.replace(RATE_FILTER, '').replace(',', '.'),
              rateSource: 'manual',
            });
            setNotice(null);
          }}
          disabled={isDisabled}
          autoComplete='off'
          className='h-8 min-w-0 flex-1 tabular-nums'
          aria-describedby={`${rateId}-help`}
        />
        <span className='shrink-0'>{baseCurrency}</span>
      </div>
      <div
        id={`${rateId}-help`}
        className='flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-muted-foreground'
        aria-live='polite'
      >
        <span className='min-w-0 truncate'>
          {loading
            ? 'Buscando cotización…'
            : hideEquivalent
              ? ''
              : equivalent !== null
              ? `Equivale a ${format(equivalent, baseCurrency)}`
              : 'Ingresá monto y cotización'}
        </span>
        {value.rateSource === 'manual' && autoFetch && (
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='h-6 px-1.5 text-xs'
            onClick={() => {
              onChange({ rate: '', rateSource: 'auto' });
              setRetry((n) => n + 1);
            }}
            disabled={isDisabled}
          >
            <RotateCcw className='mr-1 h-3 w-3' />
            Restaurar cotización automática
          </Button>
        )}
      </div>
      {notice === 'stale' && (
        <p className='text-xs text-amber-600 dark:text-amber-400' role='status'>
          No pudimos actualizar la cotización: usamos la última disponible. Revisala antes de guardar.
        </p>
      )}
      {notice === 'fallback' && (
        <p className='text-xs text-amber-600 dark:text-amber-400' role='status'>
          No había cotización exacta para esa fecha o tipo: usamos una alternativa. Podés editarla.
        </p>
      )}
      {notice === 'manual-required' && (
        <p className='text-xs text-red-600 dark:text-red-400' role='alert'>
          No pudimos obtener la cotización. Ingresala manualmente para poder guardar.
        </p>
      )}
    </div>
  );
}
