'use client';

import { useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import {
  formatTripMoney,
  type DebtSettlement,
  type TripExpenseWithShares,
} from '@/lib/trips';
import * as tripsApi from '@/lib/trips-api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface TripSettlementsProps {
  trip: Trip;
  members: TripMember[];
  expenses: TripExpenseWithShares[];
  settlements: DebtSettlement[];
  balances: Map<string, number>;
  currentUserId: string;
  onSettled: () => void;
}

export function TripSettlements({
  trip,
  members,
  expenses,
  settlements,
  balances,
  currentUserId,
  onSettled,
}: TripSettlementsProps): React.JSX.Element {
  const { toast } = useToast();
  const [confirm, setConfirm] = useState<DebtSettlement | null>(null);
  const [settling, setSettling] = useState(false);

  const money = (n: number) => formatTripMoney(n, trip.currency);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.display_name || 'Desconocido';
  const currentMember = members.find((m) => m.user_id === currentUserId);

  const describeEffect = (s: DebtSettlement): string => {
    if (currentMember?.id === s.fromMemberId) {
      return `Se registrará un gasto de ${money(s.amount)} ("Saldo de deuda") en tus transacciones.`;
    }
    if (currentMember?.id === s.toMemberId) {
      return `Se registrará un ingreso de ${money(s.amount)} ("Cobro de deuda") en tus transacciones.`;
    }
    return 'Se marcará la deuda como saldada.';
  };

  const handleSettle = async (): Promise<void> => {
    if (!confirm) return;
    setSettling(true);
    try {
      await tripsApi.settleDebt({ trip, settlement: confirm, expenses, members, currentUserId });
      toast({ title: 'Deuda saldada', description: 'La transferencia quedó registrada' });
      setConfirm(null);
      onSettled();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo saldar la deuda',
        variant: 'destructive',
      });
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
      <Card className='min-w-0'>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base'>Balance de cada persona</CardTitle>
        </CardHeader>
        <CardContent className='space-y-2'>
          {members
            .filter((m) => balances.has(m.id))
            .map((m) => {
              const balance = balances.get(m.id) || 0;
              return (
                <div key={m.id} className='flex items-center justify-between gap-2 text-sm min-w-0'>
                  <span className='truncate'>{m.display_name}</span>
                  <span
                    className={cn(
                      'shrink-0 font-medium tabular-nums',
                      balance > 0.005 && 'text-emerald-600',
                      balance < -0.005 && 'text-red-600',
                      Math.abs(balance) <= 0.005 && 'text-muted-foreground'
                    )}
                  >
                    {balance > 0.005 ? 'le deben ' : balance < -0.005 ? 'debe ' : ''}
                    {Math.abs(balance) <= 0.005 ? 'al día' : money(Math.abs(balance))}
                  </span>
                </div>
              );
            })}
        </CardContent>
      </Card>

      <Card className='min-w-0'>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base'>Transferencias pendientes</CardTitle>
        </CardHeader>
        <CardContent>
          {settlements.length === 0 ? (
            <div className='py-6 text-center'>
              <CheckCircle2 className='h-10 w-10 text-emerald-500 mx-auto mb-2' aria-hidden='true' />
              <p className='text-sm text-muted-foreground'>No hay deudas pendientes</p>
            </div>
          ) : (
            <div className='space-y-3'>
              {settlements.map((s) => (
                <div
                  key={`${s.fromMemberId}-${s.toMemberId}`}
                  className='flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border p-3'
                >
                  <div className='flex items-center gap-2 min-w-0 flex-1 text-sm'>
                    <span className='font-medium truncate'>{nameOf(s.fromMemberId)}</span>
                    <ArrowRight className='h-4 w-4 shrink-0 text-emerald-600' aria-hidden='true' />
                    <span className='font-medium truncate'>{nameOf(s.toMemberId)}</span>
                  </div>
                  <div className='flex items-center justify-between sm:justify-end gap-3'>
                    <span className='font-semibold tabular-nums'>{money(s.amount)}</span>
                    <Button
                      size='sm'
                      onClick={() => setConfirm(s)}
                      disabled={settling}
                      className='bg-emerald-600 hover:bg-emerald-700 text-white'
                    >
                      Saldar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => { if (!open) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Saldar deuda</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm && (
                <>
                  {nameOf(confirm.fromMemberId)} le paga <strong>{money(confirm.amount)}</strong> a{' '}
                  {nameOf(confirm.toMemberId)}.
                  <br />
                  <br />
                  {describeEffect(confirm)}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={settling}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className='bg-emerald-600 hover:bg-emerald-700 text-white'
              disabled={settling}
              onClick={(e) => { e.preventDefault(); handleSettle(); }}
            >
              {settling && <Loader2 className='h-4 w-4 mr-2 animate-spin' aria-hidden='true' />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
