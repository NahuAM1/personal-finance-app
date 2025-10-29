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
import { format, addMonths } from 'date-fns';
import type { CreditPurchase, CreditInstallment } from '@/types/database';

interface CreditCardFormProps {
  onSubmit: (data: {
    purchase: Omit<CreditPurchase, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
    installments: Omit<CreditInstallment, 'id' | 'credit_purchase_id' | 'created_at' | 'updated_at'>[];
  }) => void;
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

    const numInstallments = Number.parseInt(installments);
    const totalAmountValue = Number.parseFloat(totalAmount);
    const monthlyAmountValue = Number.parseFloat(monthlyAmount);
    const today = new Date();

    // Create the purchase object
    const purchase: Omit<CreditPurchase, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
      description,
      category,
      total_amount: totalAmountValue,
      installments: numInstallments,
      monthly_amount: monthlyAmountValue,
      start_date: format(today, 'yyyy-MM-dd'),
    };

    // Create array of installments
    const installmentsData: Omit<CreditInstallment, 'id' | 'credit_purchase_id' | 'created_at' | 'updated_at'>[] = Array.from(
      { length: numInstallments },
      (_, index) => {
        const installmentNumber = index + 1;
        const dueDate = addMonths(today, index);

        return {
          installment_number: installmentNumber,
          due_date: format(dueDate, 'yyyy-MM-dd'),
          amount: monthlyAmountValue,
          paid: false,
          paid_date: null,
          transaction_id: null,
        };
      }
    );

    onSubmit({ purchase, installments: installmentsData });

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
            Registra una compra en cuotas y se crearán automáticamente todas las cuotas futuras.
            Luego podrás marcar manualmente cada cuota como pagada desde la pestaña "Pagar Cuota".
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
