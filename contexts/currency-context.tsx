'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '@/contexts/auth-context';
import {
  DEFAULT_ARS_RATE_TYPE,
  DEFAULT_BASE_CURRENCY,
  isArsRateType,
} from '@/lib/currency/currencies';
import { formatMoney, type FormatMoneyOptions } from '@/lib/currency/format';
import { getUserSettings, updateArsRateType } from '@/lib/user-settings-api';
import type { ArsRateType, UserSettings } from '@/types/database';

export interface ReconversionState {
  status: 'idle' | 'running' | 'failed';
  pendingBase: string | null;
  error: string | null;
}

interface CurrencyContextType {
  /** Currency that every stored `amount` is expressed in. */
  baseCurrency: string;
  /** ARS rate type (oficial, blue, bolsa, tarjeta) used for new lookups. */
  rateType: ArsRateType;
  reconversion: ReconversionState;
  /** True while a base-currency reconversion is running or failed (forms are disabled). */
  isReconverting: boolean;
  loading: boolean;
  /** Formats an amount; defaults to the base currency. */
  format: (amount: number, currency?: string, options?: FormatMoneyOptions) => string;
  setRateType: (type: ArsRateType) => Promise<void>;
  refresh: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

const IDLE: ReconversionState = { status: 'idle', pendingBase: null, error: null };

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setSettings(null);
      return;
    }
    setLoading(true);
    try {
      setSettings(await getUserSettings(userId));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const baseCurrency = settings?.base_currency ?? DEFAULT_BASE_CURRENCY;
  const rateType: ArsRateType =
    settings && isArsRateType(settings.ars_rate_type)
      ? settings.ars_rate_type
      : DEFAULT_ARS_RATE_TYPE;

  const reconversion = useMemo<ReconversionState>(
    () =>
      settings && settings.reconversion_status !== 'idle'
        ? {
            status: settings.reconversion_status,
            pendingBase: settings.pending_base_currency,
            error: settings.reconversion_error,
          }
        : IDLE,
    [settings]
  );

  const format = useCallback(
    (amount: number, currency?: string, options?: FormatMoneyOptions) =>
      formatMoney(amount, currency ?? baseCurrency, options),
    [baseCurrency]
  );

  const setRateType = useCallback(
    async (type: ArsRateType) => {
      if (!userId) return;
      await updateArsRateType(userId, type);
      setSettings((prev) => (prev ? { ...prev, ars_rate_type: type } : prev));
      await refresh();
    },
    [userId, refresh]
  );

  const value = useMemo<CurrencyContextType>(
    () => ({
      baseCurrency,
      rateType,
      reconversion,
      isReconverting: reconversion.status !== 'idle',
      loading,
      format,
      setRateType,
      refresh,
    }),
    [baseCurrency, rateType, reconversion, loading, format, setRateType, refresh]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrencyContext(): CurrencyContextType {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
