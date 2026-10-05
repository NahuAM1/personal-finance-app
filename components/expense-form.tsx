'use client';

import type React from 'react';

import { Button } from '@/components/ui/button';
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
import type { Transaction, OmitNew } from '@/types/database';
import { expenseCategories } from '@/public/constants';
import { TransactionsTypes } from '@/public/enums';
import { useFormContext } from '@/contexts/form-context';
import { useCurrency } from '@/hooks/use-currency';
import { AmountWithCurrencyInput } from '@/components/currency/amount-with-currency-input';
import { moneyInputToFields } from '@/lib/currency/money-input';
import { toast } from 'sonner';

interface ExpenseFormProps {
  onSubmit: (
    transaction: OmitNew<
      Transaction,
      'id' | 'user_id' | 'created_at' | 'updated_at'
    >
  ) => void;
}

export function ExpenseForm({ onSubmit }: ExpenseFormProps) {
  const {
    expenseForm,
    setExpenseMoney,
    setExpenseCategory,
    setExpenseDescription,
    resetExpenseForm,
  } = useFormContext();
  const { baseCurrency } = useCurrency();
  const today = format(new Date(), 'yyyy-MM-dd');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !expenseForm.amount ||
      !expenseForm.category ||
      !expenseForm.description
    ) {
      return;
    }

    const money = moneyInputToFields(expenseForm, baseCurrency);
    if (!money) {
      toast.error('Ingresá un monto y una cotización válidos');
      return;
    }

    const transaction = {
      type: TransactionsTypes.EXPENSE,
      ...money,
      category: expenseForm.category,
      description: expenseForm.description,
      date: today,
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
      <AmountWithCurrencyInput
        idPrefix='expense'
        value={expenseForm}
        onChange={setExpenseMoney}
        date={today}
      />

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
        <Label htmlFor='expense-description'>Descripción</Label>
        <Textarea
          id='expense-description'
          name='expense-description'
          placeholder='Describe el gasto…'
          value={expenseForm.description}
          onChange={(e) => setExpenseDescription(e.target.value)}
          required
          autoComplete='off'
        />
      </div>

      <Button type='submit' className='w-full'>
        Registrar Gasto
      </Button>
    </form>
  );
}
