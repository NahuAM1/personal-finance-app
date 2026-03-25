'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

export interface ChartPreferences {
  gastosPorCategoria: boolean;
  distribucionGastos: boolean;
  tendenciaMensual: boolean;
  distribucionPresupuesto: boolean;
  evolucionBalance: boolean;
  ingresosVsGastos: boolean;
}

const DEFAULT_PREFERENCES: ChartPreferences = {
  gastosPorCategoria: true,
  distribucionGastos: true,
  tendenciaMensual: true,
  distribucionPresupuesto: true,
  evolucionBalance: true,
  ingresosVsGastos: true,
};

const STORAGE_KEY = 'chartPreferences';

function loadPreferences(): ChartPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return DEFAULT_PREFERENCES;
  try {
    const parsed = JSON.parse(saved) as Partial<ChartPreferences>;
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

interface ChartPreferencesContextValue {
  preferences: ChartPreferences;
  updatePreference: (key: keyof ChartPreferences, value: boolean) => void;
  resetPreferences: () => void;
}

const ChartPreferencesContext = createContext<ChartPreferencesContextValue | null>(null);

export function ChartPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<ChartPreferences>(loadPreferences);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences]);

  const updatePreference = (key: keyof ChartPreferences, value: boolean) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const resetPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES);
  };

  return (
    <ChartPreferencesContext.Provider value={{ preferences, updatePreference, resetPreferences }}>
      {children}
    </ChartPreferencesContext.Provider>
  );
}

export function useChartPreferences(): ChartPreferencesContextValue {
  const ctx = useContext(ChartPreferencesContext);
  if (!ctx) throw new Error('useChartPreferences must be used within ChartPreferencesProvider');
  return ctx;
}
