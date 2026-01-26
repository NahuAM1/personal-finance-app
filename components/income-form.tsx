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
import { incomeCategories } from '@/public/constants';
import { TransactionsTypes } from '@/public/enums';
import { useFormContext } from '@/contexts/form-context';

interface IncomeFormProps {
  onSubmit: (
    transaction: Omit<
      Transaction,
      'id' | 'user_id' | 'created_at' | 'updated_at'
    >
  ) => void;
}

export function IncomeForm({ onSubmit }: IncomeFormProps) {
  const {
    incomeForm,
    setIncomeAmount,
    setIncomeCategory,
    setIncomeDescription,
    resetIncomeForm,
  } = useFormContext();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!incomeForm.amount || !incomeForm.category || !incomeForm.description)
      return;

    onSubmit({
      type: TransactionsTypes.INCOME,
      amount: Number.parseFloat(incomeForm.amount),
      category: incomeForm.category,
      description: incomeForm.description,
      date: format(new Date(), 'yyyy-MM-dd'),
      is_recurring: null,
      installments: null,
      current_installment: null,
      paid: null,
      parent_transaction_id: null,
      due_date: null,
    });

    resetIncomeForm();
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <div className='space-y-2'>
        <Label htmlFor='income-amount'>Monto</Label>
        <Input
          id='income-amount'
          name='income-amount'
          type='number'
          inputMode='decimal'
          placeholder='0.00'
          value={incomeForm.amount}
          onChange={(e) => setIncomeAmount(e.target.value)}
          required
          min={0}
          step='0.01'
          autoComplete='off'
          className='tabular-nums'
        />
      </div>

      <div className='space-y-2'>
        <Label htmlFor='income-category'>Categoría</Label>
        <Select
          value={incomeForm.category}
          onValueChange={setIncomeCategory}
          required
        >
          <SelectTrigger>
            <SelectValue placeholder='Selecciona una categoría' />
          </SelectTrigger>
          <SelectContent>
            {incomeCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='space-y-2'>
        <Label htmlFor='income-description'>Descripción</Label>
        <Textarea
          id='income-description'
          name='income-description'
          placeholder='Describe el ingreso…'
          value={incomeForm.description}
          onChange={(e) => setIncomeDescription(e.target.value)}
          required
          autoComplete='off'
        />
      </div>

      <Button type='submit' className='w-full bg-green-600 hover:bg-green-700'>
        Registrar Ingreso
      </Button>
    </form>
  );
}
