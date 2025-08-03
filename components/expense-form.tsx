'use client';

import type React from 'react';

import { useState } from 'react';
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

interface ExpenseFormProps {
  onSubmit: (
    transaction: Omit<
      Transaction,
      'id' | 'user_id' | 'created_at' | 'updated_at'
    >
  ) => void;
}

const expenseCategories = [
  'Compras',
  'Servicios',
  'Salidas',
  'Delivery',
  'Auto',
  'Transporte',
  'Entretenimiento',
  'Salud',
  'Ropa',
  'Tecnología',
  'Educación',
  'Hogar',
  'Otros',
];

export function ExpenseForm({ onSubmit }: ExpenseFormProps) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || !category || !description) {
      return;
    }

    const transaction = {
      type: 'expense' as const,
      amount: Number.parseFloat(amount),
      category,
      description,
      date: format(new Date(), 'yyyy-MM-dd'),
    };

    onSubmit(transaction);

    setAmount('');
    setCategory('');
    setDescription('');
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <div className='space-y-2'>
        <Label htmlFor='amount'>Monto</Label>
        <Input
          id='amount'
          type='number'
          placeholder='0.00'
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>

      <div className='space-y-2'>
        <Label htmlFor='category'>Categoría</Label>
        <Select value={category} onValueChange={setCategory} required>
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
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </div>

      <Button type='submit' className='w-full'>
        Registrar Gasto
      </Button>
    </form>
  );
}
