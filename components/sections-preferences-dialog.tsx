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

interface SectionsPreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SECTION_LABELS: { key: keyof ChartPreferences; label: string }[] = [
  { key: 'metasAhorros', label: 'Metas de Ahorros' },
  { key: 'proximosPagos', label: 'Próximos Pagos de Tarjeta' },
  { key: 'inversionesActivas', label: 'Inversiones Activas' },
  { key: 'prestamosActivos', label: 'Préstamos Activos' },
];

export function SectionsPreferencesDialog({ open, onOpenChange }: SectionsPreferencesDialogProps) {
  const { preferences, updatePreference, resetPreferences } = useChartPreferences();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Secciones del Dashboard</DialogTitle>
          <DialogDescription>
            Seleccioná qué secciones querés ver en el dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {SECTION_LABELS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <Label htmlFor={`section-${key}`} className="text-sm font-medium cursor-pointer">
                {label}
              </Label>
              <Switch
                id={`section-${key}`}
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
