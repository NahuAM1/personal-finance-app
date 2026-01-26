'use client';

import { useState, useMemo } from 'react';
import { useTransactions } from '@/hooks/use-transactions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
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
import type { Investment } from '@/types/database';

interface HistoryProps {
  onTransactionDeleted?: () => void;
  investments?: Investment[];
}

export function History({ onTransactionDeleted, investments = [] }: HistoryProps = {}) {
  const { toast } = useToast();
  const { transactions, loading, error, deleteTransaction } = useTransactions();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const groupedTransactions = useMemo(() => {
    const groups: Record<string, typeof transactions> = {};
    
    transactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .forEach((transaction) => {
        const date = format(parseISO(transaction.date), 'yyyy-MM-dd');
        if (!groups[date]) {
          groups[date] = [];
        }
        groups[date].push(transaction);
      });
    
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [transactions]);

  const totalPages = Math.ceil(groupedTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedGroups = groupedTransactions.slice(startIndex, endIndex);

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

      // Call the callback to reload credit installments data
      if (onTransactionDeleted) {
        onTransactionDeleted();
      }
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
          <div className='space-y-6'>
            {paginatedGroups.map(([dateKey, dayTransactions]) => (
              <div key={dateKey} className='space-y-3'>
                <div className='flex items-center gap-4'>
                  <div className='h-px bg-gray-200 flex-1'></div>
                  <h3 className='font-semibold text-gray-700 px-4 py-2 bg-gray-50 rounded-lg'>
                    {format(parseISO(dateKey), "d 'de' MMMM 'de' yyyy", { locale: es })}
                  </h3>
                  <div className='h-px bg-gray-200 flex-1'></div>
                </div>
                
                <div className='space-y-2'>
                  {dayTransactions.map((transaction) => {
                    // Calculate liquid balance (Balance Total - Active Investments at that point)
                    const transactionDate = new Date(transaction.date);
                    const activeInvestmentsAtTransaction = investments
                      .filter((inv) => {
                        const invStartDate = new Date(inv.start_date);
                        const invEndDate = inv.liquidation_date ? new Date(inv.liquidation_date) : new Date();
                        return invStartDate <= transactionDate && transactionDate <= invEndDate && !inv.is_liquidated;
                      })
                      .reduce((sum, inv) => sum + inv.amount, 0);

                    const liquidBalanceAtTransaction = transaction.balance_total !== null
                      ? transaction.balance_total - activeInvestmentsAtTransaction
                      : null;

                    return (
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
                          {transaction.installments && (
                            <p className='text-xs text-gray-500 mt-1'>
                              Cuota {transaction.current_installment} de{' '}
                              {transaction.installments}
                            </p>
                          )}
                          <div className='text-xs text-gray-500 mt-2 flex items-center gap-3'>
                            {transaction.balance_total !== null ? (
                              <>
                                <span>
                                  Balance Total:{' '}
                                  <span className={`font-medium ${
                                    transaction.balance_total >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    ${transaction.balance_total.toLocaleString()}
                                  </span>
                                </span>
                                <span>•</span>
                                <span>
                                  Balance Líquido:{' '}
                                  <span className={`font-medium ${
                                    liquidBalanceAtTransaction! >= 0 ? 'text-blue-600' : 'text-red-600'
                                  }`}>
                                    ${liquidBalanceAtTransaction!.toLocaleString()}
                                  </span>
                                </span>
                              </>
                            ) : (
                              <span className='text-gray-400 dark:text-gray-600 italic'>
                                Balances no disponibles (transacción legacy)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className='flex items-center gap-4'>
                          <span
                            className={`font-bold text-lg ${getTypeColor(
                              transaction.type
                            )}`}
                          >
                            {transaction.type === 'expense' || transaction.type === 'credit' ? '-' : '+'} $
                            {transaction.amount.toLocaleString()}
                          </span>
                          <Button
                            variant='ghost'
                            size='icon'
                            onClick={() => openDeleteDialog(transaction.id)}
                            className='text-red-600 hover:text-red-700 hover:bg-red-50'
                            aria-label='Eliminar transacción'
                          >
                            <Trash2 className='h-4 w-4' aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            
            {groupedTransactions.length === 0 && (
              <div className='text-center text-gray-500 py-8'>
                No hay transacciones registradas
              </div>
            )}
          </div>
          
          {totalPages > 1 && (
            <div className='flex items-center justify-between mt-6 pt-4 border-t'>
              <div className='text-sm text-gray-600'>
                Página {currentPage} de {totalPages}
              </div>
              <div className='flex items-center gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  aria-label='Página anterior'
                >
                  <ChevronLeft className='h-4 w-4 mr-1' aria-hidden="true" />
                  Anterior
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  aria-label='Página siguiente'
                >
                  Siguiente
                  <ChevronRight className='h-4 w-4 ml-1' aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
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
