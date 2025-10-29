'use client';

import type React from 'react';

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
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import type { Transaction } from '@/types/database';
import { expenseCategories } from '@/public/constants';
import { TransactionsTypes } from '@/public/enums';
import { useFormContext } from '@/contexts/form-context';

interface ExpenseFormProps {
  onSubmit: (
    transaction: Omit<
      Transaction,
      'id' | 'user_id' | 'created_at' | 'updated_at'
    >
  ) => void;
}

export function ExpenseForm({ onSubmit }: ExpenseFormProps) {
  const {
    expenseForm,
    setExpenseAmount,
    setExpenseCategory,
    setExpenseDescription,
    resetExpenseForm,
  } = useFormContext();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !expenseForm.amount ||
      !expenseForm.category ||
      !expenseForm.description
    ) {
      return;
    }

    const transaction = {
      type: TransactionsTypes.EXPENSE,
      amount: Number.parseFloat(expenseForm.amount),
      category: expenseForm.category,
      description: expenseForm.description,
      date: format(new Date(), 'yyyy-MM-dd'),
      is_recurring: null,
      installments: null,
      current_installment: null,
      paid: null,
      parent_transaction_id: null,
      due_date: null,
    };

    onSubmit(transaction);

    resetExpenseForm();
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <div className='space-y-2'>
        <Label htmlFor='amount'>Monto</Label>
        <Input
          id='amount'
          type='number'
          placeholder='0.00'
          value={expenseForm.amount}
          onChange={(e) => setExpenseAmount(e.target.value)}
          required
        />
      </div>

      <div className='space-y-2'>
        <Label htmlFor='category'>Categoría</Label>
        <Select
          value={expenseForm.category}
          onValueChange={setExpenseCategory}
          required
        >
          <SelectTrigger>
            <SelectValue placeholder='Selecciona una categoría' />
          </SelectTrigger>
          <SelectContent>
            {expenseCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='space-y-2'>
        <Label htmlFor='description'>Descripción</Label>
        <Textarea
          id='description'
          placeholder='Describe el gasto...'
          value={expenseForm.description}
          onChange={(e) => setExpenseDescription(e.target.value)}
          required
        />
      </div>

      <Button type='submit' className='w-full'>
        Registrar Gasto
      </Button>
    </form>
  );
}
