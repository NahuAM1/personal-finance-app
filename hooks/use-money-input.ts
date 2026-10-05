'use client';

import { useCallback, useState } from 'react';
import { useCurrency } from '@/hooks/use-currency';
import type { MoneyFields } from '@/lib/currency/money';
import {
  emptyMoneyInput,
  moneyInputToFields,
  type MoneyInputState,
} from '@/lib/currency/money-input';

/** Local form state for an amount in any currency, plus the persistable money fields. */
export function useMoneyInput(initial?: Partial<MoneyInputState>) {
  const { baseCurrency } = useCurrency();
  const [state, setState] = useState<MoneyInputState>({ ...emptyMoneyInput(), ...initial });

  const toFields = useCallback(
    (): MoneyFields | null => moneyInputToFields(state, baseCurrency),
    [state, baseCurrency]
  );

  const reset = useCallback(() => setState(emptyMoneyInput()), []);

  return { state, setState, toFields, reset, baseCurrency };
}
