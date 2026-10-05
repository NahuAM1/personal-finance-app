'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Trip } from '@/types/database';
import { useCurrency } from '@/hooks/use-currency';

export const TRIP_CURRENCIES = ['ARS', 'USD', 'EUR', 'BRL', 'CLP', 'UYU'] as const;

export interface TripFormValues {
  name: string;
  destination: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  currency: string;
}

interface TripFormProps {
  open: boolean;
  trip?: Trip | null;
  onClose: () => void;
  onSubmit: (values: TripFormValues) => Promise<void>;
}

export function TripForm({ open, trip, onClose, onSubmit }: TripFormProps): React.JSX.Element {
  const [name, setName] = useState(trip?.name ?? '');
  const [destination, setDestination] = useState(trip?.destination ?? '');
  const [description, setDescription] = useState(trip?.description ?? '');
  const [startDate, setStartDate] = useState(trip?.start_date ?? '');
  const [endDate, setEndDate] = useState(trip?.end_date ?? '');
  const [budget, setBudget] = useState(trip?.budget != null ? String(trip.budget) : '');
  const { baseCurrency } = useCurrency();
  // New trips default to the user's base currency.
  const [currency, setCurrency] = useState(trip?.currency ?? baseCurrency);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const currencies: string[] = TRIP_CURRENCIES.includes(currency as (typeof TRIP_CURRENCIES)[number])
    ? [...TRIP_CURRENCIES]
    : [currency, ...TRIP_CURRENCIES];

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setError('La fecha de fin no puede ser anterior a la de inicio');
      return;
    }
    let parsedBudget: number | null = null;
    if (budget.trim()) {
      parsedBudget = Number.parseFloat(budget.replace(',', '.'));
      if (Number.isNaN(parsedBudget) || parsedBudget < 0) {
        setError('El presupuesto debe ser un número positivo');
        return;
      }
    }

    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        destination: destination.trim() || null,
        description: description.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
        budget: parsedBudget,
        currency,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el viaje');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className='max-w-md max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{trip ? 'Editar viaje' : 'Nuevo viaje'}</DialogTitle>
          <DialogDescription>
            {trip
              ? 'Actualizá los datos del viaje.'
              : 'Creá un viaje para registrar gastos compartidos con otras personas.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4 pt-2'>
          <div className='space-y-2'>
            <Label htmlFor='trip-name'>Nombre</Label>
            <Input
              id='trip-name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='ej: Vacaciones en Bariloche'
              maxLength={80}
              required
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='trip-destination'>Destino (opcional)</Label>
            <Input
              id='trip-destination'
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder='ej: Bariloche, Río Negro'
              maxLength={80}
            />
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div className='space-y-2 min-w-0'>
              <Label htmlFor='trip-start'>Desde</Label>
              <Input
                id='trip-start'
                type='date'
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className='space-y-2 min-w-0'>
              <Label htmlFor='trip-end'>Hasta</Label>
              <Input
                id='trip-end'
                type='date'
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div className='space-y-2 min-w-0'>
              <Label htmlFor='trip-budget'>Presupuesto (opcional)</Label>
              <Input
                id='trip-budget'
                type='number'
                inputMode='decimal'
                step='0.01'
                min='0'
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder='0.00'
              />
            </div>
            <div className='space-y-2 min-w-0'>
              <Label htmlFor='trip-currency'>Moneda</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id='trip-currency'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='trip-description'>Notas (opcional)</Label>
            <Textarea
              id='trip-description'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={300}
            />
          </div>

          {error && <p className='text-sm text-red-600'>{error}</p>}

          <div className='flex flex-col-reverse sm:flex-row sm:justify-end gap-2'>
            <Button type='button' variant='outline' onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              type='submit'
              disabled={saving}
              className='bg-emerald-600 hover:bg-emerald-700 text-white'
            >
              {saving && <Loader2 className='h-4 w-4 mr-2 animate-spin' aria-hidden='true' />}
              {trip ? 'Guardar cambios' : 'Crear viaje'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
