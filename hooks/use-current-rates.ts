'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCurrency } from '@/hooks/use-currency';
import { fetchRate } from '@/lib/exchange-rates/client';

/**
 * Current rate (today) from each given currency to the user's base currency. The base currency
 * itself is always 1. Currencies whose lookup fails are absent, so callers can skip them
 * instead of showing a wrong number.
 */
export function useCurrentRates(currencies: string[]): Record<string, number> {
  const { baseCurrency, rateType } = useCurrency();
  const [rates, setRates] = useState<Record<string, number>>({});

  // Stable key so a new array with the same contents does not refetch.
  const key = useMemo(
    () => Array.from(new Set(currencies.filter((c) => c !== baseCurrency))).sort().join(','),
    [currencies, baseCurrency]
  );

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const today = new Date().toISOString().split('T')[0];
    for (const currency of key.split(',')) {
      fetchRate(currency, baseCurrency, today, rateType)
        .then((result) => {
          if (!cancelled) setRates((prev) => ({ ...prev, [`${currency}>${baseCurrency}`]: result.rate }));
        })
        .catch(() => {
          // No rate: the currency is simply left out.
        });
    }
    return () => {
      cancelled = true;
    };
  }, [key, baseCurrency, rateType]);

  return useMemo(() => {
    const result: Record<string, number> = { [baseCurrency]: 1 };
    for (const currency of currencies) {
      const rate = rates[`${currency}>${baseCurrency}`];
      if (rate !== undefined) result[currency] = rate;
    }
    return result;
  }, [rates, currencies, baseCurrency]);
}
