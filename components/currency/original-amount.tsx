'use client';

import { useCurrency } from '@/hooks/use-currency';
import { cn } from '@/lib/utils';

interface OriginalAmountProps {
  /** Amount in the movement's original currency. */
  originalAmount: number;
  /** Original currency of the movement. */
  currency: string;
  className?: string;
  /** Hides the value (dashboard "hide amounts" toggle). */
  masked?: boolean;
  /** Currency the amount is compared against. Defaults to the user base currency. */
  targetCurrency?: string;
}

/** Shows the original amount and currency of a movement, only when it differs from the base. */
export function OriginalAmount({ originalAmount, currency, className, masked = false, targetCurrency }: OriginalAmountProps) {
  const { baseCurrency, format } = useCurrency();
  if (currency === (targetCurrency ?? baseCurrency)) return null;
  return (
    <span className={cn('block text-xs font-normal text-muted-foreground tabular-nums', className)}>
      {masked ? `${currency} ****` : format(originalAmount, currency)}
    </span>
  );
}
