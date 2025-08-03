'use client';

import { useState } from 'react';
import { useTransactions } from '@/hooks/use-transactions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function History() {
  const { toast } = useToast();
  const { transactions, loading, error, deleteTransaction } = useTransactions();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!transactionToDelete) return;
    
    try {
      await deleteTransaction(transactionToDelete);
      toast({
        title: 'Éxito',
        description: 'Transacción eliminada correctamente',
      });
      setDeleteDialogOpen(false);
      setTransactionToDelete(null);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la transacción',
        variant: 'destructive',
      });
      console.error('Error deleting transaction:', err);
    }
  };

  const openDeleteDialog = (id: string) => {
    setTransactionToDelete(id);
    setDeleteDialogOpen(true);
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'income':
        return 'Ingreso';
      case 'expense':
        return 'Gasto';
      case 'credit':
        return 'Cr�dito';
      default:
        return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'income':
        return 'text-green-600';
      case 'expense':
        return 'text-red-600';
      case 'credit':
        return 'text-blue-600';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historial de Transacciones</CardTitle>
          <CardDescription>Cargando transacciones...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historial de Transacciones</CardTitle>
          <CardDescription className='text-red-600'>{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Historial de Transacciones</CardTitle>
          <CardDescription>
            {transactions.length === 0
              ? 'No hay transacciones registradas'
              : `${transactions.length} transacciones encontradas`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className='flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50'
              >
                <div className='flex-1'>
                  <div className='flex items-center gap-2'>
                    <span
                      className={`font-semibold ${getTypeColor(
                        transaction.type
                      )}`}
                    >
                      {getTypeLabel(transaction.type)}
                    </span>
                    <span className='text-gray-500'>|</span>
                    <span className='text-sm text-gray-600'>
                      {transaction.category}
                    </span>
                  </div>
                  <p className='text-sm text-gray-700 mt-1'>
                    {transaction.description}
                  </p>
                  <p className='text-xs text-gray-500 mt-1'>
                    {format(
                      new Date(transaction.date),
                      "dd 'de' MMMM 'de' yyyy",
                      { locale: es }
                    )}
                  </p>
                  {transaction.installments && (
                    <p className='text-xs text-gray-500'>
                      Cuota {transaction.current_installment} de{' '}
                      {transaction.installments}
                    </p>
                  )}
                </div>
                <div className='flex items-center gap-4'>
                  <span
                    className={`font-bold text-lg ${getTypeColor(
                      transaction.type
                    )}`}
                  >
                    {transaction.type === 'expense' ? '-' : '+'} $
                    {transaction.amount.toFixed(2)}
                  </span>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={() => openDeleteDialog(transaction.id)}
                    className='text-red-600 hover:text-red-700 hover:bg-red-50'
                  >
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente esta transacción de tu historial.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
