'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useChartPreferences, type ChartPreferences } from '@/contexts/chart-preferences-context';

interface ChartPreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CHART_LABELS: { key: keyof ChartPreferences; label: string }[] = [
  { key: 'gastosPorCategoria', label: 'Gastos por Categoría' },
  { key: 'distribucionGastos', label: 'Distribución de Gastos' },
  { key: 'tendenciaMensual', label: 'Tendencia Mensual' },
  { key: 'distribucionPresupuesto', label: 'Distribución del Presupuesto' },
  { key: 'evolucionBalance', label: 'Evolución del Balance' },
  { key: 'ingresosVsGastos', label: 'Ingresos vs Gastos' },
];

export function ChartPreferencesDialog({ open, onOpenChange }: ChartPreferencesDialogProps) {
  const { preferences, updatePreference, resetPreferences } = useChartPreferences();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Preferencias de Gráficos</DialogTitle>
          <DialogDescription>
            Seleccioná qué gráficos querés ver en el dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {CHART_LABELS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <Label htmlFor={`chart-${key}`} className="text-sm font-medium cursor-pointer">
                {label}
              </Label>
              <Switch
                id={`chart-${key}`}
                checked={preferences[key]}
                onCheckedChange={(checked) => updatePreference(key, checked)}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={resetPreferences}>
            Restablecer todo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
