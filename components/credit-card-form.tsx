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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { format } from 'date-fns';
import type { Transaction } from '@/types/database';

interface CreditCardFormProps {
  onSubmit: (
    transaction: Omit<
      Transaction,
      'id' | 'user_id' | 'created_at' | 'updated_at'
    >
  ) => void;
}

const creditCategories = [
  'Tecnología',
  'Electrodomésticos',
  'Muebles',
  'Ropa',
  'Viajes',
  'Educación',
  'Salud',
  'Otros',
];

export function CreditCardForm({ onSubmit }: CreditCardFormProps) {
  const [totalAmount, setTotalAmount] = useState('');
  const [installments, setInstallments] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  const monthlyAmount =
    totalAmount && installments
      ? (
          Number.parseFloat(totalAmount) / Number.parseInt(installments)
        ).toFixed(2)
      : '0.00';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!totalAmount || !installments || !category || !description) return;

    onSubmit({
      type: 'credit',
      amount: Number.parseFloat(monthlyAmount),
      category,
      description: `${description} - Cuota 1/${installments}`,
      date: format(new Date(), 'yyyy-MM-dd'),
      is_recurring: true,
      installments: Number.parseInt(installments),
      current_installment: 1,
    });

    setTotalAmount('');
    setInstallments('');
    setCategory('');
    setDescription('');
  };

  return (
    <div className='space-y-6'>
      <Card className='bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'>
        <CardHeader>
          <CardTitle className='text-blue-800 dark:text-blue-200'>
            ¿Cómo funciona?
          </CardTitle>
          <CardDescription>
            Los gastos con tarjeta de crédito se registran como cuotas mensuales
            que se cargarán automáticamente cada mes hasta completar el total de
            cuotas.
          </CardDescription>
        </CardHeader>
      </Card>

      <form onSubmit={handleSubmit} className='space-y-4'>
        <div className='grid gap-4 md:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='total-amount'>Monto Total</Label>
            <Input
              id='total-amount'
              type='number'
              placeholder='0.00'
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              required
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='installments'>Cantidad de Cuotas</Label>
            <Select
              value={installments}
              onValueChange={setInstallments}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder='Selecciona cuotas' />
              </SelectTrigger>
              <SelectContent>
                {[3, 6, 9, 12, 18, 24, 36].map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    {num} cuotas
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className='space-y-2'>
          <Label htmlFor='credit-category'>Categoría</Label>
          <Select value={category} onValueChange={setCategory} required>
            <SelectTrigger>
              <SelectValue placeholder='Selecciona una categoría' />
            </SelectTrigger>
            <SelectContent>
              {creditCategories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-2'>
          <Label htmlFor='credit-description'>Descripción</Label>
          <Textarea
            id='credit-description'
            placeholder='Describe la compra...'
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        {totalAmount && installments && (
          <Card className='bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'>
            <CardContent className='pt-6'>
              <div className='text-center'>
                <div className='text-sm text-green-700 dark:text-green-300'>
                  Cuota mensual
                </div>
                <div className='text-2xl font-bold text-green-800 dark:text-green-200'>
                  ${monthlyAmount}
                </div>
                <div className='text-sm text-green-600 dark:text-green-400'>
                  durante {installments} meses
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Button type='submit' className='w-full bg-blue-600 hover:bg-blue-700'>
          Registrar Compra en Cuotas
        </Button>
      </form>
    </div>
  );
}
