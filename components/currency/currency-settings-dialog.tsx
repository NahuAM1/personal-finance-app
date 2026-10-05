'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CurrencySelect } from '@/components/currency/currency-select';
import { useCurrency } from '@/hooks/use-currency';
import { ReconversionProgress } from '@/components/currency/reconversion-progress';
import {
  ARS_RATE_TYPES,
  ARS_RATE_TYPE_LABELS,
  isArsRateType,
  isSupportedCurrency,
} from '@/lib/currency/currencies';

interface CurrencySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CurrencySettingsDialog({ open, onOpenChange }: CurrencySettingsDialogProps) {
  const { baseCurrency, rateType, setRateType, isReconverting, startBaseChange } = useCurrency();
  const [pendingBase, setPendingBase] = useState<string | null>(null);
  const [savingRateType, setSavingRateType] = useState(false);

  const handleBaseChange = (next: string) => {
    if (!isSupportedCurrency(next) || next === baseCurrency) return;
    setPendingBase(next);
  };

  const handleRateTypeChange = async (next: string) => {
    if (!isArsRateType(next) || next === rateType) return;
    setSavingRateType(true);
    try {
      await setRateType(next);
      toast.success('Tipo de cotización actualizado');
    } catch {
      toast.error('No se pudo actualizar el tipo de cotización');
    } finally {
      setSavingRateType(false);
    }
  };

  const confirmBaseChange = () => {
    const target = pendingBase;
    setPendingBase(null);
    if (target) void startBaseChange(target);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Moneda</DialogTitle>
            <DialogDescription>
              Elegí la moneda en la que ves tus totales y cómo se cotizan los pesos.
            </DialogDescription>
          </DialogHeader>

          <ReconversionProgress />

          <div className='grid grid-cols-1 gap-5 py-2'>
            <div className='min-w-0 space-y-2'>
              <Label htmlFor='base-currency'>Moneda base</Label>
              <CurrencySelect
                id='base-currency'
                value={baseCurrency}
                onChange={handleBaseChange}
                disabled={isReconverting}
                className='w-full'
                aria-label='Moneda base'
              />
              <p className='text-xs text-muted-foreground'>
                Todos tus totales, balances y gráficos se muestran en esta moneda. Los movimientos
                en otras monedas conservan su monto original.
              </p>
            </div>

            <div className='min-w-0 space-y-2'>
              <Label htmlFor='ars-rate-type'>Tipo de cotización del dólar</Label>
              <Select
                value={rateType}
                onValueChange={handleRateTypeChange}
                disabled={savingRateType || isReconverting}
              >
                <SelectTrigger id='ars-rate-type' className='w-full'>
                  <SelectValue placeholder='Tipo de cotización' />
                </SelectTrigger>
                <SelectContent>
                  {ARS_RATE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {ARS_RATE_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className='text-xs text-muted-foreground'>
                Se usa para convertir desde y hacia pesos en los movimientos nuevos. No modifica
                lo que ya registraste.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingBase !== null} onOpenChange={(o) => !o && setPendingBase(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar la moneda base a {pendingBase}?</AlertDialogTitle>
            <AlertDialogDescription>
              Vamos a reconvertir todo tu historial a {pendingBase} usando la cotización de cada
              fecha. Los montos originales no se modifican, pero los montos en {baseCurrency}{' '}
              se van a recalcular y puede tardar unos minutos. Mientras dure, no vas a poder
              cargar movimientos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBaseChange}>Cambiar moneda base</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
