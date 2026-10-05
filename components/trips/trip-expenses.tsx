'use client';

import { useState } from 'react';
import { Lock, Pencil, PlusCircle, Receipt, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import type { Trip, TripMember } from '@/types/database';
import { OriginalAmount } from '@/components/currency/original-amount';
import { formatTripMoney, type TripExpenseWithShares } from '@/lib/trips';
import * as tripsApi from '@/lib/trips-api';
import { useToast } from '@/hooks/use-toast';
import { TripExpenseForm } from './trip-expense-form';

interface TripExpensesProps {
  trip: Trip;
  members: TripMember[];
  expenses: TripExpenseWithShares[];
  currentMember: TripMember | null;
  currentUserId: string;
  onChanged: () => void;
}

export function TripExpenses({
  trip,
  members,
  expenses,
  currentMember,
  currentUserId,
  onChanged,
}: TripExpensesProps): React.JSX.Element {
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TripExpenseWithShares | null>(null);
  const [toDelete, setToDelete] = useState<TripExpenseWithShares | null>(null);
  const [deleting, setDeleting] = useState(false);

  const nameOf = (memberId: string) =>
    members.find((m) => m.id === memberId)?.display_name || 'Desconocido';

  const canAdd = members.some((m) => m.invite_status === 'accepted');

  const handleDelete = async (): Promise<void> => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await tripsApi.deleteTripExpense({ expense: toDelete, members, currentUserId });
      toast({ title: 'Gasto eliminado' });
      setToDelete(null);
      onChanged();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo eliminar el gasto',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className='space-y-4'>
      <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2'>
        <p className='text-sm text-muted-foreground'>
          {expenses.length === 0
            ? 'Todavía no hay gastos'
            : `${expenses.length} gasto${expenses.length === 1 ? '' : 's'}`}
        </p>
        <Button
          onClick={() => { setEditing(null); setFormOpen(true); }}
          disabled={!canAdd}
          className='bg-emerald-600 hover:bg-emerald-700 text-white'
        >
          <PlusCircle className='h-4 w-4 mr-2' />
          Agregar gasto
        </Button>
      </div>

      {expenses.length === 0 ? (
        <Card>
          <CardContent className='py-10 text-center'>
            <Receipt className='h-10 w-10 text-emerald-400 mx-auto mb-3' aria-hidden='true' />
            <p className='text-sm text-muted-foreground'>
              Registrá el primer gasto del viaje.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className='grid grid-cols-1 gap-3'>
          {expenses.map((expense) => {
            const locked = tripsApi.hasSettledShares(expense);
            return (
              <Card key={expense.id} className='min-w-0'>
                <CardContent className='p-4 flex flex-col sm:flex-row sm:items-center gap-3'>
                  <div className='min-w-0 flex-1 space-y-1'>
                    <div className='flex items-center gap-2 min-w-0'>
                      <p className='font-medium truncate'>{expense.description}</p>
                      {expense.category && (
                        <Badge variant='secondary' className='shrink-0 hidden sm:inline-flex'>
                          {expense.category}
                        </Badge>
                      )}
                    </div>
                    <p className='text-xs text-muted-foreground truncate'>
                      {format(parseISO(expense.expense_date), "d 'de' MMM", { locale: es })}
                      {' · '}pagó {nameOf(expense.paid_by_member_id)}
                      {' · '}{expense.trip_expense_shares?.length || 0} persona
                      {(expense.trip_expense_shares?.length || 0) === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className='flex items-center justify-between sm:justify-end gap-2'>
                    <span className='font-semibold tabular-nums text-right'>
                      {formatTripMoney(Number(expense.amount), trip.currency)}
                      <OriginalAmount
                        originalAmount={Number(expense.original_amount)}
                        currency={expense.currency}
                        className='text-right'
                        targetCurrency={trip.currency}
                      />
                    </span>
                    <div className='flex items-center'>
                      {locked ? (
                        <span
                          className='p-2 text-muted-foreground'
                          title='Tiene deudas saldadas: no se puede editar ni eliminar'
                        >
                          <Lock className='h-4 w-4' aria-label='Gasto con deudas saldadas' />
                        </span>
                      ) : (
                        <>
                          <Button
                            variant='ghost'
                            size='icon'
                            aria-label='Editar gasto'
                            onClick={() => { setEditing(expense); setFormOpen(true); }}
                          >
                            <Pencil className='h-4 w-4' />
                          </Button>
                          <Button
                            variant='ghost'
                            size='icon'
                            aria-label='Eliminar gasto'
                            className='text-red-600 hover:text-red-700'
                            onClick={() => setToDelete(expense)}
                          >
                            <Trash2 className='h-4 w-4' />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {formOpen && (
        <TripExpenseForm
          trip={trip}
          members={members}
          currentMember={currentMember}
          currentUserId={currentUserId}
          expense={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); onChanged(); }}
        />
      )}

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => { if (!open) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar gasto</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que querés eliminar &quot;{toDelete?.description}&quot;?
              {toDelete?.transaction_id &&
                toDelete && members.find((m) => m.id === toDelete.paid_by_member_id)?.user_id === currentUserId &&
                ' También se eliminará el gasto asociado en tus transacciones.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className='bg-red-600 hover:bg-red-700 text-white'
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
