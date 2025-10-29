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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Investment } from '@/types/database';
import { TrendingUp, Calendar, DollarSign, Percent } from 'lucide-react';

interface InvestmentLiquidateFormProps {
  investments: Investment[];
  onLiquidate: (investmentId: string, actualReturn: number) => void;
}

const investmentTypeLabels: Record<string, string> = {
  plazo_fijo: 'Plazo Fijo',
  fci: 'FCI',
  bonos: 'Bonos',
  acciones: 'Acciones',
  crypto: 'Crypto',
  letras: 'Letras',
  cedears: 'CEDEARs',
  cauciones: 'Cauciones',
  fondos_comunes_inversion: 'Fondos Comunes de Inversión',
};

export function InvestmentLiquidateForm({ investments, onLiquidate }: InvestmentLiquidateFormProps) {
  const [selectedInvestment, setSelectedInvestment] = useState('');
  const [actualReturn, setActualReturn] = useState('');

  const activeInvestments = investments.filter((inv) => !inv.is_liquidated);

  const handleLiquidate = () => {
    if (!selectedInvestment || !actualReturn) return;
    onLiquidate(selectedInvestment, Number.parseFloat(actualReturn));
    setSelectedInvestment('');
    setActualReturn('');
  };

  const selectedInvestmentData = activeInvestments.find(
    (inv) => inv.id === selectedInvestment
  );

  if (activeInvestments.length === 0) {
    return (
      <Card className='bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'>
        <CardContent className='pt-6'>
          <div className='text-center py-8'>
            <TrendingUp className='h-12 w-12 text-blue-600 dark:text-blue-400 mx-auto mb-4' />
            <h3 className='text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2'>
              No hay inversiones activas
            </h3>
            <p className='text-blue-600 dark:text-blue-400'>
              Crea una inversión desde la pestaña "Nueva Inversión"
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-6'>
      <Card className='bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800'>
        <CardHeader>
          <CardTitle className='text-amber-800 dark:text-amber-200'>
            Liquidar Inversión
          </CardTitle>
          <CardDescription>
            Al liquidar, se creará automáticamente un ingreso con el capital + ganancias
          </CardDescription>
        </CardHeader>
      </Card>

      <div className='space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor='investment-select'>Selecciona la inversión a liquidar</Label>
          <Select
            value={selectedInvestment}
            onValueChange={setSelectedInvestment}
          >
            <SelectTrigger id='investment-select'>
              <SelectValue placeholder='Elige la inversión' />
            </SelectTrigger>
            <SelectContent>
              {activeInvestments.map((investment) => {
                const daysElapsed = differenceInDays(
                  new Date(),
                  new Date(investment.start_date)
                );
                const isMatured = investment.maturity_date
                  ? new Date() >= new Date(investment.maturity_date)
                  : false;

                return (
                  <SelectItem key={investment.id} value={investment.id}>
                    <div className='flex items-center justify-between gap-4 w-full'>
                      <span className='font-medium'>{investment.description}</span>
                      <span className='text-xs text-gray-500'>
                        {investmentTypeLabels[investment.investment_type]}
                      </span>
                      <span className='font-semibold'>
                        ${investment.amount.toLocaleString('es-AR')}
                      </span>
                      {isMatured && <span className='text-xs text-green-600 font-semibold'>✓ Vencida</span>}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {selectedInvestmentData && (
          <Card className='bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'>
            <CardContent className='pt-6'>
              <div className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-blue-700 dark:text-blue-300'>
                    Inversión:
                  </span>
                  <span className='font-medium text-blue-900 dark:text-blue-100'>
                    {selectedInvestmentData.description}
                  </span>
                </div>

                <div className='flex items-center justify-between'>
                  <span className='text-sm text-blue-700 dark:text-blue-300'>
                    Tipo:
                  </span>
                  <span className='font-medium text-blue-900 dark:text-blue-100'>
                    {investmentTypeLabels[selectedInvestmentData.investment_type]}
                  </span>
                </div>

                <div className='flex items-center justify-between'>
                  <span className='text-sm text-blue-700 dark:text-blue-300 flex items-center gap-1'>
                    <DollarSign className='h-4 w-4' />
                    Capital:
                  </span>
                  <span className='font-medium text-blue-900 dark:text-blue-100'>
                    ${selectedInvestmentData.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className='flex items-center justify-between'>
                  <span className='text-sm text-blue-700 dark:text-blue-300 flex items-center gap-1'>
                    <Calendar className='h-4 w-4' />
                    Inicio:
                  </span>
                  <span className='font-medium text-blue-900 dark:text-blue-100'>
                    {format(new Date(selectedInvestmentData.start_date), "dd 'de' MMMM, yyyy", { locale: es })}
                  </span>
                </div>

                {selectedInvestmentData.maturity_date && (
                  <div className='flex items-center justify-between'>
                    <span className='text-sm text-blue-700 dark:text-blue-300 flex items-center gap-1'>
                      <Calendar className='h-4 w-4' />
                      Vencimiento:
                    </span>
                    <span className='font-medium text-blue-900 dark:text-blue-100'>
                      {format(new Date(selectedInvestmentData.maturity_date), "dd 'de' MMMM, yyyy", { locale: es })}
                    </span>
                  </div>
                )}

                {selectedInvestmentData.annual_rate && (
                  <div className='flex items-center justify-between'>
                    <span className='text-sm text-blue-700 dark:text-blue-300 flex items-center gap-1'>
                      <Percent className='h-4 w-4' />
                      TNA:
                    </span>
                    <span className='font-medium text-blue-900 dark:text-blue-100'>
                      {selectedInvestmentData.annual_rate}%
                    </span>
                  </div>
                )}

                <div className='pt-3 border-t border-blue-200 dark:border-blue-800'>
                  <div className='flex items-center justify-between text-sm'>
                    <span className='text-blue-700 dark:text-blue-300'>
                      Ganancia estimada:
                    </span>
                    <span className='font-semibold text-green-600 dark:text-green-400'>
                      ${selectedInvestmentData.estimated_return.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className='text-xs text-blue-600 dark:text-blue-400'>
                  Días transcurridos: {differenceInDays(new Date(), new Date(selectedInvestmentData.start_date))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedInvestment && (
          <div className='space-y-2'>
            <Label htmlFor='actual-return'>Ganancia Real Obtenida</Label>
            <Input
              id='actual-return'
              type='number'
              step='0.01'
              placeholder='0.00'
              value={actualReturn}
              onChange={(e) => setActualReturn(e.target.value)}
              required
            />
            <p className='text-xs text-gray-500'>
              Ingresa la ganancia real que obtuviste (puede diferir de la estimada)
            </p>
          </div>
        )}

        <Button
          onClick={handleLiquidate}
          disabled={!selectedInvestment || !actualReturn}
          className='w-full bg-green-600 hover:bg-green-700'
        >
          <TrendingUp className='h-4 w-4 mr-2' />
          Liquidar Inversión y Crear Ingreso
        </Button>
      </div>
    </div>
  );
}
