'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CurrencySelect } from '@/components/currency/currency-select';
import { RateInput } from '@/components/currency/rate-input';
import { useCurrency } from '@/hooks/use-currency';
import { parseDecimal, type MoneyInputState } from '@/lib/currency/money-input';

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
  /** Hides the currency selector (the currency is fixed by the caller). */
  lockCurrency?: boolean;
  allowNegative?: boolean;
  required?: boolean;
}

/**
 * Amount input with a currency selector. When the currency differs from the user's base
 * currency it also shows the editable exchange rate and the base-currency equivalent.
 */
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
  required = true,
}: AmountWithCurrencyInputProps) {
  const { baseCurrency, isReconverting } = useCurrency();
  const currency = value.currency ?? baseCurrency;
  const isDisabled = disabled || isReconverting;
  const amountId = `${idPrefix}-amount`;

  const amountNumber = parseDecimal(value.amount);

  return (
    <div className='min-w-0 space-y-2'>
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
          required={required}
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
            onChange={(next) =>
              onChange({
                ...value,
                currency: next === baseCurrency ? null : next,
                rate: '',
                rateSource: 'auto',
              })
            }
            disabled={isDisabled}
            className='w-[104px]'
            aria-label='Moneda del monto'
          />
        )}
      </div>

      <RateInput
        currency={currency}
        value={{ rate: value.rate, rateSource: value.rateSource }}
        onChange={(next) => onChange({ ...value, ...next })}
        date={date}
        amount={Number.isFinite(amountNumber) ? amountNumber : null}
        idPrefix={idPrefix}
        disabled={disabled}
        autoFetch={autoFetch}
      />
    </div>
  );
}
