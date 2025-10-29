'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Transaction } from '@/types/database';
import { CheckCircle2, Calendar, CreditCard } from 'lucide-react';

interface CreditPaymentFormProps {
  transactions: Transaction[];
  onPayInstallment: (installmentId: string) => void;
}

export function CreditPaymentForm({ transactions, onPayInstallment }: CreditPaymentFormProps) {
  const [selectedInstallment, setSelectedInstallment] = useState('');

  // Filter only unpaid credit transactions
  const unpaidInstallments = transactions.filter(
    (t) => t.type === 'credit' && t.paid === false
  );

  // Group installments by parent_transaction_id
  const groupedInstallments = unpaidInstallments.reduce((acc, transaction) => {
    const parentId = transaction.parent_transaction_id || transaction.id;
    if (!acc[parentId]) {
      acc[parentId] = [];
    }
    acc[parentId].push(transaction);
    return acc;
  }, {} as Record<string, Transaction[]>);

  const handlePayment = () => {
    if (!selectedInstallment) return;
    onPayInstallment(selectedInstallment);
    setSelectedInstallment('');
  };

  const selectedTransaction = unpaidInstallments.find(
    (t) => t.id === selectedInstallment
  );

  if (unpaidInstallments.length === 0) {
    return (
      <Card className='bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'>
        <CardContent className='pt-6'>
          <div className='text-center py-8'>
            <CheckCircle2 className='h-12 w-12 text-green-600 dark:text-green-400 mx-auto mb-4' />
            <h3 className='text-lg font-semibold text-green-800 dark:text-green-200 mb-2'>
              ¡No hay cuotas pendientes!
            </h3>
            <p className='text-green-600 dark:text-green-400'>
              Todas tus cuotas están al día
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
            Registro Manual de Pagos
          </CardTitle>
          <CardDescription>
            Selecciona la cuota que deseas marcar como pagada
          </CardDescription>
        </CardHeader>
      </Card>

      <div className='space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor='installment-select'>Selecciona una cuota</Label>
          <Select
            value={selectedInstallment}
            onValueChange={setSelectedInstallment}
          >
            <SelectTrigger id='installment-select'>
              <SelectValue placeholder='Elige la cuota a pagar' />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(groupedInstallments).map(([parentId, installments]) => {
                // Get base description (remove "- Cuota X/Y" part)
                const baseDescription = installments[0].description.split(' - Cuota ')[0];

                return (
                  <div key={parentId}>
                    <div className='px-2 py-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800'>
                      {baseDescription}
                    </div>
                    {installments.map((installment) => {
                      const isOverdue = installment.due_date && new Date(installment.due_date) < new Date();

                      return (
                        <SelectItem key={installment.id} value={installment.id}>
                          <div className='flex items-center justify-between gap-2'>
                            <span>
                              Cuota {installment.current_installment}/{installment.installments}
                            </span>
                            <span className='font-semibold'>${installment.amount.toFixed(2)}</span>
                            {installment.due_date && (
                              <span className={`text-xs ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                                {format(new Date(installment.due_date), 'dd/MM/yyyy')}
                                {isOverdue && ' ⚠️'}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </div>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {selectedTransaction && (
          <Card className='bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'>
            <CardContent className='pt-6'>
              <div className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-blue-700 dark:text-blue-300'>
                    Compra:
                  </span>
                  <span className='font-medium text-blue-900 dark:text-blue-100'>
                    {selectedTransaction.description.split(' - Cuota ')[0]}
                  </span>
                </div>

                <div className='flex items-center justify-between'>
                  <span className='text-sm text-blue-700 dark:text-blue-300 flex items-center gap-1'>
                    <CreditCard className='h-4 w-4' />
                    Cuota:
                  </span>
                  <span className='font-medium text-blue-900 dark:text-blue-100'>
                    {selectedTransaction.current_installment} de {selectedTransaction.installments}
                  </span>
                </div>

                <div className='flex items-center justify-between'>
                  <span className='text-sm text-blue-700 dark:text-blue-300 flex items-center gap-1'>
                    <Calendar className='h-4 w-4' />
                    Vencimiento:
                  </span>
                  <span className='font-medium text-blue-900 dark:text-blue-100'>
                    {selectedTransaction.due_date &&
                      format(new Date(selectedTransaction.due_date), "dd 'de' MMMM, yyyy", { locale: es })}
                  </span>
                </div>

                <div className='pt-3 border-t border-blue-200 dark:border-blue-800'>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm font-semibold text-blue-700 dark:text-blue-300'>
                      Monto a pagar:
                    </span>
                    <span className='text-2xl font-bold text-blue-900 dark:text-blue-100'>
                      ${selectedTransaction.amount.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className='text-xs text-blue-600 dark:text-blue-400'>
                  Categoría: {selectedTransaction.category}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Button
          onClick={handlePayment}
          disabled={!selectedInstallment}
          className='w-full bg-green-600 hover:bg-green-700'
        >
          <CheckCircle2 className='h-4 w-4 mr-2' />
          Marcar como Pagada
        </Button>
      </div>
    </div>
  );
}
