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
import { incomeCategories } from '@/public/constants';
import { TransactionsTypes } from '@/public/enums';
import { useFormContext } from '@/contexts/form-context';
import { useCurrency } from '@/hooks/use-currency';
import { AmountWithCurrencyInput } from '@/components/currency/amount-with-currency-input';
import { moneyInputToFields } from '@/lib/currency/money-input';
import { toast } from 'sonner';

interface IncomeFormProps {
  onSubmit: (
    transaction: OmitNew<
      Transaction,
      'id' | 'user_id' | 'created_at' | 'updated_at'
    >
  ) => void;
}

export function IncomeForm({ onSubmit }: IncomeFormProps) {
  const {
    incomeForm,
    setIncomeMoney,
    setIncomeCategory,
    setIncomeDescription,
    resetIncomeForm,
  } = useFormContext();
  const { baseCurrency } = useCurrency();
  const today = format(new Date(), 'yyyy-MM-dd');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!incomeForm.amount || !incomeForm.category || !incomeForm.description)
      return;

    const money = moneyInputToFields(incomeForm, baseCurrency);
    if (!money) {
      toast.error('Ingresá un monto y una cotización válidos');
      return;
    }

    onSubmit({
      type: TransactionsTypes.INCOME,
      ...money,
      category: incomeForm.category,
      description: incomeForm.description,
      date: today,
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
      <AmountWithCurrencyInput
        idPrefix='income'
        value={incomeForm}
        onChange={setIncomeMoney}
        date={today}
      />

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
