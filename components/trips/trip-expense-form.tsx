'use client';

import { useMemo, useState } from 'react';
import { Info, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import type { Trip, TripMember } from '@/types/database';
import {
  TRIP_EXPENSE_CATEGORIES,
  computeShares,
  formatTripMoney,
  type SplitMethod,
  type TripExpenseWithShares,
} from '@/lib/trips';
import * as tripsApi from '@/lib/trips-api';
import { useToast } from '@/hooks/use-toast';

const NO_CATEGORY = '__none__';

interface TripExpenseFormProps {
  trip: Trip;
  members: TripMember[];
  currentMember: TripMember | null;
  currentUserId: string;
  expense?: TripExpenseWithShares | null;
  onClose: () => void;
  onSaved: () => void;
}

function initialInputs(
  expense: TripExpenseWithShares | null | undefined
): Record<string, string> {
  if (!expense || expense.split_method === 'equal') return {};
  const amount = Number(expense.amount);
  const result: Record<string, string> = {};
  for (const share of expense.trip_expense_shares || []) {
    const value = Number(share.share_amount);
    result[share.member_id] =
      expense.split_method === 'percentage'
        ? String(Math.round((value / amount) * 10000) / 100)
        : String(value);
  }
  return result;
}

export function TripExpenseForm({
  trip,
  members,
  currentMember,
  currentUserId,
  expense,
  onClose,
  onSaved,
}: TripExpenseFormProps): React.JSX.Element {
  const { toast } = useToast();
  const acceptedMembers = useMemo(
    () => members.filter((m) => m.invite_status === 'accepted'),
    [members]
  );

  const [description, setDescription] = useState(expense?.description ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [paidBy, setPaidBy] = useState(
    expense?.paid_by_member_id ?? currentMember?.id ?? acceptedMembers[0]?.id ?? ''
  );
  const [category, setCategory] = useState(expense?.category ?? NO_CATEGORY);
  const [expenseDate, setExpenseDate] = useState(
    expense?.expense_date ?? new Date().toISOString().split('T')[0]
  );
  const [splitMethod, setSplitMethod] = useState<SplitMethod>(expense?.split_method ?? 'equal');
  const [participants, setParticipants] = useState<string[]>(() =>
    expense && expense.split_method === 'equal'
      ? (expense.trip_expense_shares || []).map((s) => s.member_id)
      : acceptedMembers.map((m) => m.id)
  );
  const [inputs, setInputs] = useState<Record<string, string>>(() => initialInputs(expense));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const categories: string[] = useMemo(() => {
    const base: string[] = [...TRIP_EXPENSE_CATEGORIES];
    if (expense?.category && !base.includes(expense.category)) base.unshift(expense.category);
    return base;
  }, [expense]);

  const parsedAmount = Number.parseFloat(amount.replace(',', '.'));
  const payerIsMe = acceptedMembers.find((m) => m.id === paidBy)?.user_id === currentUserId;

  const toggleParticipant = (memberId: string): void => {
    setParticipants((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const equalPreview =
    splitMethod === 'equal' && participants.length > 0 && parsedAmount > 0
      ? parsedAmount / participants.length
      : null;

  const handleSave = async (): Promise<void> => {
    setError(null);
    if (!description.trim()) {
      setError('Ingresá una descripción');
      return;
    }
    if (!paidBy) {
      setError('Elegí quién pagó');
      return;
    }
    if (!expenseDate) {
      setError('Elegí una fecha');
      return;
    }

    // Keep member order stable so the rounding remainder is deterministic.
    const memberIds =
      splitMethod === 'equal'
        ? acceptedMembers.filter((m) => participants.includes(m.id)).map((m) => m.id)
        : acceptedMembers.map((m) => m.id);
    const result = computeShares(parsedAmount, splitMethod, memberIds, inputs);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    const input: tripsApi.TripExpenseInput = {
      paid_by_member_id: paidBy,
      description: description.trim(),
      amount: Math.round(parsedAmount * 100) / 100,
      category: category === NO_CATEGORY ? null : category,
      expense_date: expenseDate,
      split_method: splitMethod,
    };

    setSaving(true);
    try {
      if (expense) {
        await tripsApi.updateTripExpense({
          trip,
          expense,
          input,
          shares: result.shares,
          members,
          currentUserId,
        });
        toast({ title: 'Gasto actualizado' });
      } else {
        await tripsApi.createTripExpense({
          trip,
          input,
          shares: result.shares,
          members,
          currentUserId,
        });
        toast({
          title: 'Gasto agregado',
          description: `${formatTripMoney(input.amount, trip.currency)} entre ${result.shares.length} persona${result.shares.length === 1 ? '' : 's'}`,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el gasto');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className='max-w-md max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{expense ? 'Editar gasto' : 'Agregar gasto'}</DialogTitle>
          <DialogDescription>Registrá un gasto del viaje y elegí cómo dividirlo.</DialogDescription>
        </DialogHeader>

        <div className='space-y-4 pt-2'>
          <div className='space-y-2'>
            <Label htmlFor='trip-expense-desc'>Descripción</Label>
            <Input
              id='trip-expense-desc'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='ej: Cena en el centro'
              maxLength={120}
            />
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div className='space-y-2 min-w-0'>
              <Label htmlFor='trip-expense-amount'>Monto ({trip.currency})</Label>
              <Input
                id='trip-expense-amount'
                type='number'
                inputMode='decimal'
                step='0.01'
                min='0'
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder='0.00'
              />
            </div>
            <div className='space-y-2 min-w-0'>
              <Label htmlFor='trip-expense-date'>Fecha</Label>
              <Input
                id='trip-expense-date'
                type='date'
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </div>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div className='space-y-2 min-w-0'>
              <Label htmlFor='trip-expense-payer'>Pagó</Label>
              <Select value={paidBy} onValueChange={setPaidBy}>
                <SelectTrigger id='trip-expense-payer'>
                  <SelectValue placeholder='¿Quién pagó?' />
                </SelectTrigger>
                <SelectContent>
                  {acceptedMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.display_name}{m.user_id === currentUserId ? ' (vos)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-2 min-w-0'>
              <Label htmlFor='trip-expense-category'>Categoría</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id='trip-expense-category'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CATEGORY}>Sin categoría</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className='flex items-start gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-3 text-xs text-emerald-800 dark:text-emerald-200'>
            <Info className='h-4 w-4 shrink-0 mt-0.5' aria-hidden='true' />
            <p>
              {payerIsMe
                ? 'Como pagaste vos, también se registra como gasto (categoría "Viaje") en tus transacciones.'
                : 'Como lo pagó otra persona, no se agrega a sus transacciones personales. Solo se registra automáticamente cuando quien pagó carga el gasto desde su cuenta.'}
            </p>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='trip-expense-split'>Cómo dividir</Label>
            <Select value={splitMethod} onValueChange={(v) => setSplitMethod(v as SplitMethod)}>
              <SelectTrigger id='trip-expense-split'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='equal'>En partes iguales</SelectItem>
                <SelectItem value='custom'>Montos personalizados</SelectItem>
                <SelectItem value='percentage'>Por porcentaje</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {splitMethod === 'equal' ? (
            <div className='space-y-2'>
              <p className='text-sm text-muted-foreground'>¿Entre quiénes?</p>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                {acceptedMembers.map((m) => (
                  <label
                    key={m.id}
                    className='flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer min-w-0'
                  >
                    <input
                      type='checkbox'
                      className='h-4 w-4 accent-emerald-600 shrink-0'
                      checked={participants.includes(m.id)}
                      onChange={() => toggleParticipant(m.id)}
                    />
                    <span className='truncate'>{m.display_name}</span>
                  </label>
                ))}
              </div>
              {equalPreview !== null && (
                <p className='text-sm text-emerald-700 dark:text-emerald-300 tabular-nums'>
                  Cada persona: {formatTripMoney(equalPreview, trip.currency)}
                </p>
              )}
            </div>
          ) : (
            <div className='space-y-2'>
              <p className='text-sm text-muted-foreground'>
                {splitMethod === 'percentage'
                  ? 'Porcentaje de cada persona (deben sumar 100%). Dejá vacío a quien no participa.'
                  : 'Monto de cada persona (deben sumar el total). Dejá vacío a quien no participa.'}
              </p>
              {acceptedMembers.map((m) => (
                <div key={m.id} className='flex items-center gap-3 min-w-0'>
                  <span className='text-sm flex-1 min-w-0 truncate'>{m.display_name}</span>
                  <Input
                    type='number'
                    inputMode='decimal'
                    step='0.01'
                    min='0'
                    className='w-28 shrink-0'
                    placeholder={splitMethod === 'percentage' ? '%' : '0.00'}
                    aria-label={`${splitMethod === 'percentage' ? 'Porcentaje' : 'Monto'} de ${m.display_name}`}
                    value={inputs[m.id] ?? ''}
                    onChange={(e) => setInputs({ ...inputs, [m.id]: e.target.value })}
                  />
                  <span className='text-xs text-muted-foreground w-8 shrink-0'>
                    {splitMethod === 'percentage' ? '%' : trip.currency}
                  </span>
                </div>
              ))}
            </div>
          )}

          {error && <p className='text-sm text-red-600'>{error}</p>}

          <div className='flex flex-col-reverse sm:flex-row sm:justify-end gap-2'>
            <Button type='button' variant='outline' onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className='bg-emerald-600 hover:bg-emerald-700 text-white'
            >
              {saving && <Loader2 className='h-4 w-4 mr-2 animate-spin' aria-hidden='true' />}
              {expense ? 'Guardar cambios' : 'Agregar gasto'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
