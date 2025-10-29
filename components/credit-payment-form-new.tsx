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
import { CheckCircle2, Calendar, CreditCard } from 'lucide-react';

interface CreditInstallmentWithPurchase {
  id: string;
  credit_purchase_id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  paid: boolean;
  paid_date: string | null;
  transaction_id: string | null;
  created_at: string;
  updated_at: string;
  credit_purchase: {
    id: string;
    user_id: string;
    description: string;
    category: string;
    total_amount: number;
    installments: number;
    monthly_amount: number;
    start_date: string;
    created_at: string;
    updated_at: string;
  };
}

interface CreditPaymentFormProps {
  installments: CreditInstallmentWithPurchase[];
  onPayInstallment: (installmentId: string) => void;
}

export function CreditPaymentFormNew({ installments, onPayInstallment }: CreditPaymentFormProps) {
  const [selectedInstallment, setSelectedInstallment] = useState('');

  // Filter only unpaid installments
  const unpaidInstallments = installments.filter((inst) => !inst.paid);

  // Group installments by purchase
  const groupedInstallments = unpaidInstallments.reduce((acc, installment) => {
    const purchaseId = installment.credit_purchase_id;
    if (!acc[purchaseId]) {
      acc[purchaseId] = {
        purchase: installment.credit_purchase,
        installments: [],
      };
    }
    acc[purchaseId].installments.push(installment);
    return acc;
  }, {} as Record<string, { purchase: CreditInstallmentWithPurchase['credit_purchase']; installments: CreditInstallmentWithPurchase[] }>);

  const handlePayment = () => {
    if (!selectedInstallment) return;
    onPayInstallment(selectedInstallment);
    setSelectedInstallment('');
  };

  const selectedInstallmentData = unpaidInstallments.find(
    (inst) => inst.id === selectedInstallment
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
            Al marcar una cuota como pagada, se creará automáticamente la transacción en tu historial
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
              {Object.entries(groupedInstallments).map(([purchaseId, data]) => {
                return (
                  <div key={purchaseId}>
                    <div className='px-2 py-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800'>
                      {data.purchase.description}
                    </div>
                    {data.installments
                      .sort((a, b) => a.installment_number - b.installment_number)
                      .map((installment) => {
                        const isOverdue = new Date(installment.due_date) < new Date();

                        return (
                          <SelectItem key={installment.id} value={installment.id}>
                            <div className='flex items-center justify-between gap-4 w-full'>
                              <span>
                                Cuota {installment.installment_number}/{data.purchase.installments}
                              </span>
                              <span className='font-semibold'>${installment.amount.toFixed(2)}</span>
                              <span className={`text-xs ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                                {format(new Date(installment.due_date), 'dd/MM/yyyy')}
                                {isOverdue && ' ⚠️'}
                              </span>
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

        {selectedInstallmentData && (
          <Card className='bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'>
            <CardContent className='pt-6'>
              <div className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm text-blue-700 dark:text-blue-300'>
                    Compra:
                  </span>
                  <span className='font-medium text-blue-900 dark:text-blue-100'>
                    {selectedInstallmentData.credit_purchase.description}
                  </span>
                </div>

                <div className='flex items-center justify-between'>
                  <span className='text-sm text-blue-700 dark:text-blue-300 flex items-center gap-1'>
                    <CreditCard className='h-4 w-4' />
                    Cuota:
                  </span>
                  <span className='font-medium text-blue-900 dark:text-blue-100'>
                    {selectedInstallmentData.installment_number} de {selectedInstallmentData.credit_purchase.installments}
                  </span>
                </div>

                <div className='flex items-center justify-between'>
                  <span className='text-sm text-blue-700 dark:text-blue-300 flex items-center gap-1'>
                    <Calendar className='h-4 w-4' />
                    Vencimiento:
                  </span>
                  <span className='font-medium text-blue-900 dark:text-blue-100'>
                    {format(new Date(selectedInstallmentData.due_date), "dd 'de' MMMM, yyyy", { locale: es })}
                  </span>
                </div>

                <div className='pt-3 border-t border-blue-200 dark:border-blue-800'>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm font-semibold text-blue-700 dark:text-blue-300'>
                      Monto a pagar:
                    </span>
                    <span className='text-2xl font-bold text-blue-900 dark:text-blue-100'>
                      ${selectedInstallmentData.amount.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className='text-xs text-blue-600 dark:text-blue-400'>
                  Categoría: {selectedInstallmentData.credit_purchase.category}
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
          Marcar como Pagada y Crear Transacción
        </Button>
      </div>
    </div>
  );
}
