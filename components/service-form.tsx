'use client';

import type React from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { Service } from '@/types/database';
import type { Database } from '@/types/database';

type ServiceInsert = Database['public']['Tables']['services']['Insert'];

interface ServiceFormProps {
  initialData?: Service;
  onSubmit: (data: Omit<ServiceInsert, 'user_id'>) => Promise<void>;
  onCancel: () => void;
}

interface FormState {
  name: string;
  amount: string;
  due_day: string;
  mode: 'automatic' | 'manual' | '';
  notes: string;
  is_active: boolean;
}

export function ServiceForm({ initialData, onSubmit, onCancel }: ServiceFormProps): React.JSX.Element {
  const [form, setForm] = useState<FormState>({
    name: initialData?.name ?? '',
    amount: initialData?.amount.toString() ?? '',
    due_day: initialData?.due_day.toString() ?? '',
    mode: initialData?.mode ?? '',
    notes: initialData?.notes ?? '',
    is_active: initialData?.is_active ?? true,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name,
        amount: initialData.amount.toString(),
        due_day: initialData.due_day.toString(),
        mode: initialData.mode,
        notes: initialData.notes ?? '',
        is_active: initialData.is_active,
      });
    }
  }, [initialData]);

  const isValid =
    form.name.trim().length > 0 &&
    Number.parseFloat(form.amount) > 0 &&
    Number.parseInt(form.due_day, 10) >= 1 &&
    Number.parseInt(form.due_day, 10) <= 31 &&
    (form.mode === 'automatic' || form.mode === 'manual');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!isValid || submitting) return;
    if (form.mode !== 'automatic' && form.mode !== 'manual') return;

    setSubmitting(true);
    try {
      const payload: Omit<ServiceInsert, 'user_id'> = {
        name: form.name.trim(),
        amount: Number.parseFloat(form.amount),
        due_day: Number.parseInt(form.due_day, 10),
        mode: form.mode,
        notes: form.notes.trim() || null,
        is_active: form.is_active,
      };
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <div className='space-y-2'>
        <Label htmlFor='service-name'>Nombre del servicio</Label>
        <Input
          id='service-name'
          placeholder='ej. Internet, Luz, Netflix'
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <div className='space-y-2'>
          <Label htmlFor='service-amount'>Monto esperado</Label>
          <Input
            id='service-amount'
            type='number'
            inputMode='decimal'
            placeholder='0.00'
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
            min={0.01}
            step='0.01'
            autoComplete='off'
            className='tabular-nums'
          />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='service-due-day'>Día de vencimiento</Label>
          <Input
            id='service-due-day'
            type='number'
            inputMode='numeric'
            placeholder='ej. 10'
            value={form.due_day}
            onChange={(e) => setForm({ ...form, due_day: e.target.value })}
            required
            min={1}
            max={31}
            step={1}
            autoComplete='off'
            className='tabular-nums'
          />
        </div>
      </div>

      <div className='space-y-2'>
        <Label htmlFor='service-mode'>Modo de pago</Label>
        <Select
          value={form.mode}
          onValueChange={(value: 'automatic' | 'manual') =>
            setForm({ ...form, mode: value })
          }
          required
        >
          <SelectTrigger id='service-mode'>
            <SelectValue placeholder='Selecciona el modo' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='automatic'>
              Automático — se registra solo al abrir la app
            </SelectItem>
            <SelectItem value='manual'>
              Manual — vos confirmás el monto antes de registrar
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className='space-y-2'>
        <Label htmlFor='service-notes'>Notas (opcional)</Label>
        <Input
          id='service-notes'
          placeholder='ej. Incluye decodificador'
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </div>

      <div className='flex items-center gap-3'>
        <Switch
          id='service-active'
          checked={form.is_active}
          onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
        />
        <Label htmlFor='service-active' className='cursor-pointer'>
          Servicio activo
        </Label>
      </div>

      <div className='flex gap-3 pt-2'>
        <Button type='submit' className='flex-1' disabled={!isValid || submitting}>
          {initialData ? 'Guardar cambios' : 'Crear servicio'}
        </Button>
        <Button type='button' variant='ghost' onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
