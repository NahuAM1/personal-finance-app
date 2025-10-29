'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format, isPast, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, Clock, AlertCircle, CreditCard, Calendar, Trash2, Edit2 } from 'lucide-react';

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
  onDelete: (purchaseId: string) => void;
  onUpdate: (purchaseId: string, updates: Partial<CreditPurchaseData>) => void;
}

export function CreditCardOverviewNew({ purchases, installments, onDelete, onUpdate }: CreditCardOverviewNewProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState<string | null>(null);
  const [purchaseToEdit, setPurchaseToEdit] = useState<CreditPurchaseData | null>(null);

  // Edit form state
  const [editDescription, setEditDescription] = useState('');
  const [editTotalAmount, setEditTotalAmount] = useState('');

  const handleDeleteClick = (purchase: CreditPurchaseData) => {
    setPurchaseToDelete(purchase.id);
    setDeleteDialogOpen(true);
  };

  const handleEditClick = (purchase: CreditPurchaseData) => {
    setPurchaseToEdit(purchase);
    setEditDescription(purchase.description);
    setEditTotalAmount(purchase.total_amount.toString());
    setEditDialogOpen(true);
  };

  const confirmDelete = () => {
    if (purchaseToDelete) {
      onDelete(purchaseToDelete);
      setDeleteDialogOpen(false);
      setPurchaseToDelete(null);
    }
  };

  const confirmEdit = () => {
    if (!purchaseToEdit) return;

    const newTotalAmount = Number.parseFloat(editTotalAmount);
    const newMonthlyAmount = newTotalAmount / purchaseToEdit.installments;

    const updates: Partial<CreditPurchaseData> = {
      description: editDescription,
      total_amount: newTotalAmount,
      monthly_amount: newMonthlyAmount,
    };

    onUpdate(purchaseToEdit.id, updates);
    setEditDialogOpen(false);
    setPurchaseToEdit(null);
  };

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
                <div className='flex items-start justify-between gap-2'>
                  <div className='flex-1'>
                    <CardTitle className='text-lg mb-1'>
                      {data.purchase.description}
                    </CardTitle>
                    <CardDescription className='flex items-center gap-1'>
                      <span>{data.purchase.category}</span>
                    </CardDescription>
                  </div>
                  <div className='flex items-center gap-2'>
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
                    {!data.isCompleted && (
                      <>
                        {data.paidCount === 0 && (
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => handleEditClick(data.purchase)}
                          >
                            <Edit2 className='h-4 w-4' />
                          </Button>
                        )}
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => handleDeleteClick(data.purchase)}
                        >
                          <Trash2 className='h-4 w-4 text-red-600' />
                        </Button>
                      </>
                    )}
                  </div>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La compra y todas sus cuotas serán eliminadas permanentemente.
              {purchaseToDelete && (() => {
                const purchase = purchases.find(p => p.id === purchaseToDelete);
                const relatedInstallments = installments.filter(i => i.credit_purchase_id === purchaseToDelete);
                const paidCount = relatedInstallments.filter(i => i.paid).length;
                return paidCount > 0 ? ` Las ${paidCount} transacciones pagadas también serán eliminadas.` : '';
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className='bg-red-600 hover:bg-red-700'
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className='sm:max-w-[500px]'>
          <DialogHeader>
            <DialogTitle>Editar Compra</DialogTitle>
            <DialogDescription>
              Modifica los detalles de la compra. El monto mensual se recalculará automáticamente.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='edit-description'>Descripción</Label>
              <Input
                id='edit-description'
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='edit-total'>Monto Total</Label>
              <Input
                id='edit-total'
                type='number'
                step='0.01'
                value={editTotalAmount}
                onChange={(e) => setEditTotalAmount(e.target.value)}
              />
              {purchaseToEdit && editTotalAmount && (
                <p className='text-xs text-gray-500'>
                  Cuota mensual: ${(Number.parseFloat(editTotalAmount) / purchaseToEdit.installments).toFixed(2)}
                </p>
              )}
            </div>

            <div className='p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded'>
              <p className='text-xs text-amber-800 dark:text-amber-200'>
                <strong>Nota:</strong> Solo puedes editar compras que no tengan cuotas pagadas.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmEdit} className='bg-blue-600 hover:bg-blue-700'>
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
