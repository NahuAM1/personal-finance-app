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
import { AmountWithCurrencyInput } from '@/components/currency/amount-with-currency-input';
import { useCurrency } from '@/hooks/use-currency';
import {
  emptyMoneyInput,
  formatRateInput,
  moneyInputToFields,
  type MoneyInputState,
} from '@/lib/currency/money-input';
import { toast } from 'sonner';
import { format } from 'date-fns';

type ServiceInsert = Database['public']['Tables']['services']['Insert'];

interface ServiceFormProps {
  initialData?: Service;
  onSubmit: (data: Omit<ServiceInsert, 'user_id'>) => Promise<void>;
  onCancel: () => void;
}

interface FormState {
  name: string;
  due_day: string;
  mode: 'automatic' | 'manual' | '';
  notes: string;
  is_active: boolean;
}

// Money state for an existing service: its original amount, currency and provisional rate.
function serviceMoney(service: Service | undefined, baseCurrency: string): MoneyInputState {
  if (!service) return emptyMoneyInput();
  const foreign = service.currency !== baseCurrency;
  return {
    amount: service.original_amount.toString(),
    currency: foreign ? service.currency : null,
    rate: foreign ? formatRateInput(service.exchange_rate) : '',
    rateSource: service.rate_source,
  };
}

export function ServiceForm({ initialData, onSubmit, onCancel }: ServiceFormProps): React.JSX.Element {
  const { baseCurrency } = useCurrency();
  const [money, setMoney] = useState<MoneyInputState>(() => serviceMoney(initialData, baseCurrency));
  const [form, setForm] = useState<FormState>({
    name: initialData?.name ?? '',
    due_day: initialData?.due_day.toString() ?? '',
    mode: initialData?.mode ?? '',
    notes: initialData?.notes ?? '',
    is_active: initialData?.is_active ?? true,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setMoney(serviceMoney(initialData, baseCurrency));
      setForm({
        name: initialData.name,
        due_day: initialData.due_day.toString(),
        mode: initialData.mode,
        notes: initialData.notes ?? '',
        is_active: initialData.is_active,
      });
    }
  }, [initialData, baseCurrency]);

  const isValid =
    form.name.trim().length > 0 &&
    Number.parseFloat(money.amount) > 0 &&
    Number.parseInt(form.due_day, 10) >= 1 &&
    Number.parseInt(form.due_day, 10) <= 31 &&
    (form.mode === 'automatic' || form.mode === 'manual');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!isValid || submitting) return;
    if (form.mode !== 'automatic' && form.mode !== 'manual') return;

    const moneyFields = moneyInputToFields(money, baseCurrency);
    if (!moneyFields) {
      toast.error('Ingresá un monto y una cotización válidos');
      return;
    }

    setSubmitting(true);
    try {
      // The rate saved here is provisional: each payment is converted at its own date.
      const payload: Omit<ServiceInsert, 'user_id'> = {
        name: form.name.trim(),
        ...moneyFields,
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

      <AmountWithCurrencyInput
        idPrefix='service'
        label='Monto esperado'
        value={money}
        onChange={setMoney}
        date={format(new Date(), 'yyyy-MM-dd')}
        autoFetch={!initialData || (money.currency ?? baseCurrency) !== initialData.currency}
      />

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
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
