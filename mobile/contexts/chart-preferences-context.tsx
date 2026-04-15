import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ChartPreferences {
  gastosPorCategoria: boolean;
  distribucionGastos: boolean;
  tendenciaMensual: boolean;
  distribucionPresupuesto: boolean;
  evolucionBalance: boolean;
  ingresosVsGastos: boolean;
  metasAhorros: boolean;
  proximosPagos: boolean;
  inversionesActivas: boolean;
  prestamosActivos: boolean;
}

const DEFAULT_PREFERENCES: ChartPreferences = {
  gastosPorCategoria: true,
  distribucionGastos: true,
  tendenciaMensual: true,
  distribucionPresupuesto: true,
  evolucionBalance: true,
  ingresosVsGastos: true,
  metasAhorros: true,
  proximosPagos: true,
  inversionesActivas: true,
  prestamosActivos: true,
};

const STORAGE_KEY = 'chartPreferences';

interface ChartPreferencesContextValue {
  preferences: ChartPreferences;
  updatePreference: (key: keyof ChartPreferences, value: boolean) => void;
  resetPreferences: () => void;
}

const ChartPreferencesContext = createContext<ChartPreferencesContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
}

export function ChartPreferencesProvider({ children }: ProviderProps): React.ReactElement {
  const [preferences, setPreferences] = useState<ChartPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed: Partial<ChartPreferences> = JSON.parse(saved);
          setPreferences({ ...DEFAULT_PREFERENCES, ...parsed });
        }
      } catch {
        // keep defaults
      }
    };
    load();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)).catch(() => {});
  }, [preferences]);

  const updatePreference = (key: keyof ChartPreferences, value: boolean): void => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const resetPreferences = (): void => setPreferences(DEFAULT_PREFERENCES);

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
