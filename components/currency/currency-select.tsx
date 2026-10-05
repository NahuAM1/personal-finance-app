'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CURRENCY_LABELS,
  SUPPORTED_CURRENCIES,
  isSupportedCurrency,
} from '@/lib/currency/currencies';

interface CurrencySelectProps {
  value: string;
  onChange: (currency: string) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Restricts the options (defaults to every supported currency). */
  currencies?: readonly string[];
  'aria-label'?: string;
}

export function CurrencySelect({
  value,
  onChange,
  disabled,
  id,
  className,
  currencies = SUPPORTED_CURRENCIES,
  'aria-label': ariaLabel,
}: CurrencySelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (isSupportedCurrency(next)) onChange(next);
      }}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className} aria-label={ariaLabel ?? 'Moneda'}>
        <SelectValue placeholder='Moneda' />
      </SelectTrigger>
      <SelectContent>
        {currencies.map((code) => (
          <SelectItem key={code} value={code}>
            <span className='font-medium'>{code}</span>
            {isSupportedCurrency(code) && (
              <span className='ml-2 text-muted-foreground'>{CURRENCY_LABELS[code]}</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
