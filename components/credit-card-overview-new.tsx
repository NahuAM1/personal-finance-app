'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { format, isPast, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, Clock, AlertCircle, CreditCard, Calendar } from 'lucide-react';

interface CreditPurchaseData {
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
}

interface CreditInstallmentData {
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
}

interface PurchaseWithInstallments {
  purchase: CreditPurchaseData;
  installments: CreditInstallmentData[];
}

interface CreditCardOverviewNewProps {
  purchases: CreditPurchaseData[];
  installments: CreditInstallmentData[];
}

export function CreditCardOverviewNew({ purchases, installments }: CreditCardOverviewNewProps) {
  // Group installments by purchase
  const purchasesWithInstallments: PurchaseWithInstallments[] = purchases.map(purchase => ({
    purchase,
    installments: installments.filter(inst => inst.credit_purchase_id === purchase.id)
      .sort((a, b) => a.installment_number - b.installment_number)
  }));

  // Calculate stats for each purchase
  const enrichedPurchases = purchasesWithInstallments.map(({ purchase, installments: purchaseInstallments }) => {
    const paidCount = purchaseInstallments.filter(inst => inst.paid).length;
    const totalPaid = purchaseInstallments
      .filter(inst => inst.paid)
      .reduce((sum, inst) => sum + inst.amount, 0);
    const totalPending = purchaseInstallments
      .filter(inst => !inst.paid)
      .reduce((sum, inst) => sum + inst.amount, 0);
    const nextUnpaid = purchaseInstallments.find(inst => !inst.paid);
    const hasOverdue = purchaseInstallments.some(
      inst => !inst.paid && isPast(new Date(inst.due_date)) && !isToday(new Date(inst.due_date))
    );
    const isCompleted = paidCount === purchase.installments;

    return {
      purchase,
      installments: purchaseInstallments,
      paidCount,
      totalPaid,
      totalPending,
      nextDueDate: nextUnpaid?.due_date || null,
      hasOverdue,
      isCompleted,
    };
  }).sort((a, b) => {
    // Completed purchases go last
    if (a.isCompleted && !b.isCompleted) return 1;
    if (!a.isCompleted && b.isCompleted) return -1;

    // Sort by next due date
    if (!a.nextDueDate) return 1;
    if (!b.nextDueDate) return -1;

    return new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime();
  });

  if (enrichedPurchases.length === 0) {
    return (
      <Card>
        <CardContent className='pt-6'>
          <div className='text-center py-12'>
            <CreditCard className='h-16 w-16 text-gray-400 dark:text-gray-600 mx-auto mb-4' />
            <h3 className='text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2'>
              No hay compras con tarjeta registradas
            </h3>
            <p className='text-gray-500 dark:text-gray-400'>
              Las compras en cuotas aparecerán aquí
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader>
          <CardTitle>Compras con Tarjeta de Crédito</CardTitle>
          <CardDescription>
            Visualiza el progreso de todas tus compras en cuotas
          </CardDescription>
        </CardHeader>
      </Card>

      <div className='grid gap-4 md:grid-cols-2'>
        {enrichedPurchases.map((data) => {
          const progressPercentage = (data.paidCount / data.purchase.installments) * 100;

          return (
            <Card
              key={data.purchase.id}
              className={`${
                data.isCompleted
                  ? 'border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950'
                  : data.hasOverdue
                  ? 'border-red-300 dark:border-red-800'
                  : ''
              }`}
            >
              <CardHeader>
                <div className='flex items-start justify-between'>
                  <div className='flex-1'>
                    <CardTitle className='text-lg mb-1'>
                      {data.purchase.description}
                    </CardTitle>
                    <CardDescription className='flex items-center gap-1'>
                      <span>{data.purchase.category}</span>
                    </CardDescription>
                  </div>
                  {data.isCompleted ? (
                    <Badge className='bg-green-600 hover:bg-green-700'>
                      <CheckCircle2 className='h-3 w-3 mr-1' />
                      Completado
                    </Badge>
                  ) : data.hasOverdue ? (
                    <Badge variant='destructive'>
                      <AlertCircle className='h-3 w-3 mr-1' />
                      Vencida
                    </Badge>
                  ) : (
                    <Badge variant='secondary'>
                      <Clock className='h-3 w-3 mr-1' />
                      En progreso
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className='space-y-4'>
                {/* Progress bar */}
                <div className='space-y-2'>
                  <div className='flex items-center justify-between text-sm'>
                    <span className='text-gray-600 dark:text-gray-400'>
                      Progreso
                    </span>
                    <span className='font-semibold'>
                      {data.paidCount}/{data.purchase.installments} cuotas
                    </span>
                  </div>
                  <Progress value={progressPercentage} className='h-2' />
                </div>

                {/* Financial summary */}
                <div className='grid grid-cols-3 gap-2 text-sm'>
                  <div className='text-center p-2 bg-gray-100 dark:bg-gray-800 rounded'>
                    <div className='text-xs text-gray-600 dark:text-gray-400 mb-1'>
                      Total
                    </div>
                    <div className='font-bold text-gray-900 dark:text-gray-100'>
                      ${data.purchase.total_amount.toFixed(2)}
                    </div>
                  </div>
                  <div className='text-center p-2 bg-green-100 dark:bg-green-900 rounded'>
                    <div className='text-xs text-green-700 dark:text-green-300 mb-1'>
                      Pagado
                    </div>
                    <div className='font-bold text-green-800 dark:text-green-200'>
                      ${data.totalPaid.toFixed(2)}
                    </div>
                  </div>
                  <div className='text-center p-2 bg-amber-100 dark:bg-amber-900 rounded'>
                    <div className='text-xs text-amber-700 dark:text-amber-300 mb-1'>
                      Pendiente
                    </div>
                    <div className='font-bold text-amber-800 dark:text-amber-200'>
                      ${data.totalPending.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Next installment info */}
                {!data.isCompleted && data.nextDueDate && (
                  <div className='flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded'>
                    <div className='flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300'>
                      <Calendar className='h-4 w-4' />
                      <span>Próxima cuota:</span>
                    </div>
                    <div className='text-sm font-semibold text-blue-900 dark:text-blue-100'>
                      {format(new Date(data.nextDueDate), "dd 'de' MMM", { locale: es })}
                    </div>
                  </div>
                )}

                {/* Installments list */}
                <details className='group'>
                  <summary className='cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'>
                    Ver detalle de cuotas
                  </summary>
                  <div className='mt-3 space-y-2 max-h-48 overflow-y-auto'>
                    {data.installments.map((installment) => {
                      const isOverdue =
                        !installment.paid &&
                        isPast(new Date(installment.due_date)) &&
                        !isToday(new Date(installment.due_date));

                      return (
                        <div
                          key={installment.id}
                          className={`flex items-center justify-between p-2 rounded text-xs ${
                            installment.paid
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                              : isOverdue
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                          }`}
                        >
                          <span className='flex items-center gap-1'>
                            {installment.paid ? (
                              <CheckCircle2 className='h-3 w-3' />
                            ) : isOverdue ? (
                              <AlertCircle className='h-3 w-3' />
                            ) : (
                              <Clock className='h-3 w-3' />
                            )}
                            Cuota {installment.installment_number}
                          </span>
                          <div className='flex items-center gap-2'>
                            <span className='font-semibold'>
                              ${installment.amount.toFixed(2)}
                            </span>
                            <span className='text-xs opacity-75'>
                              {format(new Date(installment.due_date), 'dd/MM/yy')}
                            </span>
                            {installment.paid && installment.paid_date && (
                              <span className='text-xs opacity-75'>
                                ✓ {format(new Date(installment.paid_date), 'dd/MM/yy')}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
