'use client';

import React, {
  createContext,
  useRef,
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
import {
  getUserSettings,
  startReconversion,
  stepReconversion,
  updateArsRateType,
} from '@/lib/user-settings-api';
import { emitDataChanged } from '@/lib/app-events';
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
  /** Progress of the reconversion run driven by this tab (null when none). */
  reconversionProgress: { total: number; remaining: number } | null;
  /** Last error of the run driven by this tab. */
  reconversionRunError: string | null;
  /** Starts the base-currency reconversion and drives it to completion. */
  startBaseChange: (target: string) => Promise<void>;
  /** Resumes a failed or interrupted reconversion. */
  resumeReconversion: () => Promise<void>;
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
  const [progress, setProgress] = useState<{ total: number; remaining: number } | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const running = useRef(false);

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

  // Client-driven loop: each step converts one batch server side and is safe to retry.
  const drive = useCallback(
    async (total: number) => {
      if (running.current) return;
      running.current = true;
      setRunError(null);
      setProgress({ total, remaining: total });
      try {
        for (;;) {
          const result = await stepReconversion();
          setProgress({ total: Math.max(total, result.remaining), remaining: result.remaining });
          if (result.done) break;
        }
        setProgress(null);
        await refresh();
        emitDataChanged();
      } catch (error) {
        setRunError(error instanceof Error ? error.message : 'Error desconocido');
        await refresh();
      } finally {
        running.current = false;
      }
    },
    [refresh]
  );

  const startBaseChange = useCallback(
    async (target: string) => {
      if (running.current) return;
      setRunError(null);
      try {
        const total = await startReconversion(target);
        await refresh();
        await drive(total);
      } catch (error) {
        setRunError(error instanceof Error ? error.message : 'Error desconocido');
      }
    },
    [drive, refresh]
  );

  const resumeReconversion = useCallback(async () => {
    const target = settings?.pending_base_currency;
    if (!target || running.current) return;
    try {
      const total = await startReconversion(target);
      await drive(total);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'Error desconocido');
    }
  }, [drive, settings]);

  const value = useMemo<CurrencyContextType>(
    () => ({
      baseCurrency,
      rateType,
      reconversion,
      isReconverting: reconversion.status !== 'idle',
      loading,
      format,
      reconversionProgress: progress,
      reconversionRunError: runError,
      startBaseChange,
      resumeReconversion,
      setRateType,
      refresh,
    }),
    [baseCurrency, rateType, reconversion, loading, format, progress, runError, startBaseChange, resumeReconversion, setRateType, refresh]
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
