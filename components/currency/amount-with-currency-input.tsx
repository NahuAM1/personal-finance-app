'use client';

import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CurrencySelect } from '@/components/currency/currency-select';
import { useCurrency } from '@/hooks/use-currency';
import { fetchRate } from '@/lib/exchange-rates/client';
import { roundAmount } from '@/lib/currency/money';
import {
  formatRateInput,
  parseDecimal,
  type MoneyInputState,
} from '@/lib/currency/money-input';

interface AmountWithCurrencyInputProps {
  value: MoneyInputState;
  onChange: (next: MoneyInputState) => void;
  /** Movement date (YYYY-MM-DD): the rate is looked up for this day. */
  date: string;
  /** Prefix for element ids, e.g. "expense" -> "expense-amount". */
  idPrefix: string;
  label?: string;
  disabled?: boolean;
  /**
   * When false the stored rate is never re-fetched (edit dialogs that must keep the
   * rate the row was saved with).
   */
  autoFetch?: boolean;
  /** Hides the currency selector and keeps the given currency (used by pay dialogs). */
  lockCurrency?: boolean;
  allowNegative?: boolean;
}

type Notice = 'stale' | 'fallback' | 'manual-required' | null;

const RATE_FILTER = /[^0-9.,]/g;

export function AmountWithCurrencyInput({
  value,
  onChange,
  date,
  idPrefix,
  label = 'Monto',
  disabled,
  autoFetch = true,
  lockCurrency = false,
  allowNegative = false,
}: AmountWithCurrencyInputProps) {
  const { baseCurrency, rateType, format, isReconverting } = useCurrency();
  const currency = value.currency ?? baseCurrency;
  const foreign = currency !== baseCurrency;
  const isDisabled = disabled || isReconverting;

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [retry, setRetry] = useState(0);

  // Latest props for the async effect without re-triggering it.
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
        onChangeRef.current({
          ...valueRef.current,
          rate: formatRateInput(result.rate),
          rateSource: 'auto',
        });
        setNotice(result.stale ? 'stale' : result.fallback ? 'fallback' : null);
      })
      .catch(() => {
        if (id !== requestId.current) return;
        onChangeRef.current({ ...valueRef.current, rate: '', rateSource: 'auto' });
        setNotice('manual-required');
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });

    return () => {
      // Invalidate in-flight requests when inputs change or the form unmounts.
      requestId.current++;
    };
  }, [foreign, autoFetch, isAuto, date, currency, baseCurrency, rateType, retry]);

  const amountNumber = parseDecimal(value.amount);
  const rateNumber = parseDecimal(value.rate);
  const equivalent =
    foreign && Number.isFinite(amountNumber) && Number.isFinite(rateNumber) && rateNumber > 0
      ? roundAmount(amountNumber * rateNumber)
      : null;

  const handleCurrencyChange = (next: string) => {
    onChange({
      ...value,
      currency: next === baseCurrency ? null : next,
      rate: '',
      rateSource: 'auto',
    });
  };

  const handleRateChange = (raw: string) => {
    onChange({ ...value, rate: raw.replace(RATE_FILTER, '').replace(',', '.'), rateSource: 'manual' });
    setNotice(null);
  };

  const restoreAutoRate = () => {
    onChange({ ...value, rate: '', rateSource: 'auto' });
    setRetry((n) => n + 1);
  };

  const amountId = `${idPrefix}-amount`;
  const rateId = `${idPrefix}-rate`;

  return (
    <div className='space-y-2 min-w-0'>
      <Label htmlFor={amountId}>{label}</Label>
      <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-2'>
        <Input
          id={amountId}
          name={amountId}
          type='number'
          inputMode='decimal'
          placeholder='0.00'
          value={value.amount}
          onChange={(e) => onChange({ ...value, amount: e.target.value })}
          required
          min={allowNegative ? undefined : 0}
          step='0.01'
          autoComplete='off'
          disabled={isDisabled}
          className='min-w-0 tabular-nums'
        />
        {!lockCurrency && (
          <CurrencySelect
            id={`${idPrefix}-currency`}
            value={currency}
            onChange={handleCurrencyChange}
            disabled={isDisabled}
            className='w-[104px]'
            aria-label='Moneda del monto'
          />
        )}
      </div>

      {foreign && (
        <div className='space-y-1.5 rounded-md border bg-muted/30 p-2.5'>
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
              onChange={(e) => handleRateChange(e.target.value)}
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
                onClick={restoreAutoRate}
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
      )}
    </div>
  );
}
