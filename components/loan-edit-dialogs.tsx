'use client';

import type React from 'react';
import { useState } from 'react';
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
import { computeLoanTotal } from '@/lib/loans';
import type { LoanEditableFields } from '@/lib/database-api';
import type { Loan, LoanPayment } from '@/types/database';

// ---- Edit loan ----

interface EditLoanDialogProps {
  loan: Loan;
  onClose: () => void;
  onSave: (loanId: string, fields: LoanEditableFields) => Promise<void>;
}

export function EditLoanDialog({ loan, onClose, onSave }: EditLoanDialogProps): React.JSX.Element {
  const isPlan = loan.loan_type === 'payment_plan';
  const [form, setForm] = useState({
    counterpartyName: loan.counterparty_name,
    description: loan.description,
    principalAmount: loan.principal_amount.toString(),
    interestRate: loan.interest_rate.toString(),
    startDate: loan.start_date,
    dueDate: loan.due_date ?? '',
  });
  const [saving, setSaving] = useState(false);

  const principal = Number.parseFloat(form.principalAmount);
  const rate = Number.parseFloat(form.interestRate) || 0;
  const isValid = form.counterpartyName.trim() !== '' && principal > 0 && rate >= 0 && form.startDate !== '';
  const total = isValid ? computeLoanTotal(principal, rate) : 0;

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    try {
      await onSave(loan.id, {
        counterparty_name: form.counterpartyName.trim(),
        description: form.description,
        principal_amount: principal,
        interest_rate: rate,
        start_date: form.startDate,
        due_date: form.dueDate || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className='max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{isPlan ? 'Editar plan de pago' : 'Editar prestamo'}</DialogTitle>
          <DialogDescription>
            Si cambia el total, la diferencia se reparte entre las cuotas no pagadas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='edit-counterparty'>{isPlan ? 'Vendedor / Institución' : 'Contraparte'}</Label>
            <Input
              id='edit-counterparty'
              value={form.counterpartyName}
              onChange={(e) => setForm({ ...form, counterpartyName: e.target.value })}
              required
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='edit-description'>Descripcion</Label>
            <Input
              id='edit-description'
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='edit-principal'>Monto Principal</Label>
              <Input
                id='edit-principal'
                type='number'
                inputMode='decimal'
                min={0}
                step='0.01'
                value={form.principalAmount}
                onChange={(e) => setForm({ ...form, principalAmount: e.target.value })}
                className='tabular-nums'
                required
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='edit-rate'>Tasa de Interes (%)</Label>
              <Input
                id='edit-rate'
                type='number'
                inputMode='decimal'
                min={0}
                step='0.01'
                value={form.interestRate}
                onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
                className='tabular-nums'
              />
            </div>
          </div>

          {total > 0 && (
            <div className='flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 text-sm'>
              <span className='text-amber-700 dark:text-amber-300'>Nuevo total:</span>
              <span className='font-bold tabular-nums text-amber-800 dark:text-amber-200'>
                ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='edit-start'>Fecha de Inicio</Label>
              <Input
                id='edit-start'
                type='date'
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                required
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='edit-due'>Fecha de Vencimiento (opcional)</Label>
              <Input
                id='edit-due'
                type='date'
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
          </div>

          <div className='flex gap-3'>
            <Button type='submit' className='flex-1' disabled={!isValid || saving}>
              Guardar cambios
            </Button>
            <Button type='button' variant='ghost' onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Edit installment ----

interface EditLoanPaymentDialogProps {
  payment: LoanPayment & { loan: Loan };
  onClose: () => void;
  onSave: (paymentId: string, fields: Pick<LoanPayment, 'amount' | 'due_date'>) => Promise<void>;
}

export function EditLoanPaymentDialog({ payment, onClose, onSave }: EditLoanPaymentDialogProps): React.JSX.Element {
  const [amount, setAmount] = useState(payment.amount.toString());
  const [dueDate, setDueDate] = useState(payment.due_date);
  const [saving, setSaving] = useState(false);

  const parsedAmount = Number.parseFloat(amount);
  const isValid = parsedAmount > 0 && dueDate !== '';

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!isValid) return;
    setSaving(true);
    try {
      await onSave(payment.id, { amount: parsedAmount, due_date: dueDate });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Editar cuota {payment.payment_number}/{payment.loan.installments_count}
          </DialogTitle>
          <DialogDescription>
            {payment.loan.counterparty_name} — {payment.loan.description}.
            {payment.paid
              ? ' La cuota ya está pagada: también se actualizará su transacción.'
              : ' El total del préstamo pasará a ser la suma de sus cuotas.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='edit-payment-amount'>Monto</Label>
            <Input
              id='edit-payment-amount'
              type='number'
              inputMode='decimal'
              min={0.01}
              step='0.01'
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className='tabular-nums'
              autoFocus
              required
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='edit-payment-due'>Vencimiento</Label>
            <Input
              id='edit-payment-due'
              type='date'
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>
          <div className='flex gap-3'>
            <Button type='submit' className='flex-1' disabled={!isValid || saving}>
              Guardar cambios
            </Button>
            <Button type='button' variant='ghost' onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
