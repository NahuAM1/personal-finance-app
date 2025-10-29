'use client';

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
import { format, differenceInDays } from 'date-fns';
import type { Investment } from '@/types/database';
import { TrendingUp } from 'lucide-react';

interface InvestmentFormProps {
  onSubmit: (investment: Omit<Investment, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => void;
}

const investmentTypes = [
  { value: 'plazo_fijo', label: 'Plazo Fijo' },
  { value: 'fci', label: 'FCI' },
  { value: 'bonos', label: 'Bonos' },
  { value: 'acciones', label: 'Acciones' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'letras', label: 'Letras' },
  { value: 'cedears', label: 'CEDEARs' },
  { value: 'cauciones', label: 'Cauciones' },
  { value: 'fondos_comunes_inversion', label: 'Fondos Comunes de Inversión' },
];

export function InvestmentForm({ onSubmit }: InvestmentFormProps) {
  const [description, setDescription] = useState('');
  const [investmentType, setInvestmentType] = useState('');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [maturityDate, setMaturityDate] = useState('');
  const [annualRate, setAnnualRate] = useState('');

  // Calculate estimated return
  const calculateEstimatedReturn = () => {
    if (!amount || !annualRate || !startDate || !maturityDate) return 0;

    const principal = Number.parseFloat(amount);
    const rate = Number.parseFloat(annualRate) / 100;
    const days = differenceInDays(new Date(maturityDate), new Date(startDate));

    if (days <= 0) return 0;

    // Simple interest calculation: I = P * r * (days/365)
    const estimatedReturn = principal * rate * (days / 365);
    return estimatedReturn;
  };

  const estimatedReturn = calculateEstimatedReturn();
  const totalReturn = estimatedReturn + (amount ? Number.parseFloat(amount) : 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!description || !investmentType || !amount || !startDate) return;

    const investment: Omit<Investment, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
      description,
      investment_type: investmentType as Investment['investment_type'],
      amount: Number.parseFloat(amount),
      start_date: startDate,
      maturity_date: maturityDate || null,
      annual_rate: annualRate ? Number.parseFloat(annualRate) : null,
      estimated_return: estimatedReturn,
      is_liquidated: false,
      liquidation_date: null,
      actual_return: null,
      transaction_id: null,
    };

    onSubmit(investment);

    // Reset form
    setDescription('');
    setInvestmentType('');
    setAmount('');
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setMaturityDate('');
    setAnnualRate('');
  };

  return (
    <div className='space-y-6'>
      <Card className='bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'>
        <CardHeader>
          <CardTitle className='text-green-800 dark:text-green-200'>
            ¿Cómo funciona?
          </CardTitle>
          <CardDescription>
            Registra una inversión y el dinero quedará "congelado" hasta que la liquides.
            Al liquidar, se creará automáticamente un ingreso con el capital + ganancias.
          </CardDescription>
        </CardHeader>
      </Card>

      <form onSubmit={handleSubmit} className='space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor='investment-description'>Descripción</Label>
          <Textarea
            id='investment-description'
            placeholder='Ej: Plazo fijo Banco Galicia 28 días'
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div className='space-y-2'>
          <Label htmlFor='investment-type'>Tipo de Inversión</Label>
          <Select value={investmentType} onValueChange={setInvestmentType} required>
            <SelectTrigger>
              <SelectValue placeholder='Selecciona el tipo' />
            </SelectTrigger>
            <SelectContent>
              {investmentTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='grid gap-4 md:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='investment-amount'>Monto a Invertir</Label>
            <Input
              id='investment-amount'
              type='number'
              step='0.01'
              placeholder='0.00'
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='annual-rate'>TNA % (opcional)</Label>
            <Input
              id='annual-rate'
              type='number'
              step='0.01'
              placeholder='45.00'
              value={annualRate}
              onChange={(e) => setAnnualRate(e.target.value)}
            />
          </div>
        </div>

        <div className='grid gap-4 md:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='start-date'>Fecha de Inicio</Label>
            <Input
              id='start-date'
              type='date'
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='maturity-date'>Fecha de Vencimiento (opcional)</Label>
            <Input
              id='maturity-date'
              type='date'
              value={maturityDate}
              onChange={(e) => setMaturityDate(e.target.value)}
            />
          </div>
        </div>

        {estimatedReturn > 0 && (
          <Card className='bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'>
            <CardContent className='pt-6'>
              <div className='space-y-3'>
                <div className='flex items-center justify-between text-sm'>
                  <span className='text-blue-700 dark:text-blue-300'>Capital invertido:</span>
                  <span className='font-semibold text-blue-900 dark:text-blue-100'>
                    ${Number.parseFloat(amount).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className='flex items-center justify-between text-sm'>
                  <span className='text-blue-700 dark:text-blue-300'>Ganancia estimada:</span>
                  <span className='font-semibold text-green-600 dark:text-green-400'>
                    +${estimatedReturn.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className='pt-3 border-t border-blue-200 dark:border-blue-800'>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1'>
                      <TrendingUp className='h-4 w-4' />
                      Total al vencimiento:
                    </span>
                    <span className='text-xl font-bold text-blue-900 dark:text-blue-100'>
                      ${totalReturn.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {maturityDate && startDate && (
                  <div className='text-xs text-blue-600 dark:text-blue-400 text-center'>
                    Plazo: {differenceInDays(new Date(maturityDate), new Date(startDate))} días
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Button type='submit' className='w-full bg-green-600 hover:bg-green-700'>
          <TrendingUp className='h-4 w-4 mr-2' />
          Registrar Inversión
        </Button>
      </form>
    </div>
  );
}
