'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { ArrowRight, ArrowRightLeft, CheckCircle2, Loader2 } from 'lucide-react';
import type { SplitGroupMember, SplitGroup, SplitExpense, SplitExpenseShare } from '@/types/database';
import * as smartpocketApi from '@/lib/smartpocket-api';
import { addTransaction } from '@/lib/database-api';
import { useToast } from '@/hooks/use-toast';

interface DebtSettlement {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}

type ExpenseWithShares = SplitExpense & { split_expense_shares: SplitExpenseShare[] };

interface SplitSettlementsProps {
  settlements: DebtSettlement[];
  members: SplitGroupMember[];
  expenses: ExpenseWithShares[];
  group: SplitGroup;
  currentUserId: string;
  onSettle: () => void;
}

export function SplitSettlements({ settlements, members, expenses, group, currentUserId, onSettle }: SplitSettlementsProps) {
  const { toast } = useToast();
  const [settlingIndex, setSettlingIndex] = useState<number | null>(null);
  const [confirmSettle, setConfirmSettle] = useState<{ settlement: DebtSettlement; index: number } | null>(null);

  const getMemberName = (memberId: string) =>
    members.find((m) => m.id === memberId)?.display_name || 'Desconocido';

  const currentMember = members.find((m) => m.user_id === currentUserId);

  const handleSettle = async (settlement: DebtSettlement, index: number) => {
    setSettlingIndex(index);
    setConfirmSettle(null);
    try {
      // Find all unsettled shares between these two members
      const sharesToSettle: string[] = [];
      for (const expense of expenses) {
        if (expense.paid_by_member_id === settlement.toMemberId) {
          for (const share of expense.split_expense_shares) {
            if (share.member_id === settlement.fromMemberId && !share.is_settled) {
              sharesToSettle.push(share.id);
            }
          }
        }
      }

      // Mark shares as settled
      await Promise.all(sharesToSettle.map((id) => smartpocketApi.settleShare(id)));

      // Create transaction ONLY for the current user
      if (currentMember) {
        const fromName = getMemberName(settlement.fromMemberId);
        const toName = getMemberName(settlement.toMemberId);
        const today = new Date().toISOString().split('T')[0];

        if (currentMember.id === settlement.fromMemberId) {
          // Current user is the debtor - record as expense
          await addTransaction({
            user_id: currentUserId,
            type: 'expense',
            amount: settlement.amount,
            category: 'Saldo de deuda',
            description: `Saldo deuda a ${toName} - ${group.name}`,
            date: today,
            is_recurring: false,
            installments: null,
            current_installment: null,
            paid: true,
            parent_transaction_id: null,
            due_date: null,
            balance_total: null,
            ticket_id: null,
          });
        } else if (currentMember.id === settlement.toMemberId) {
          // Current user is the creditor - record as income
          await addTransaction({
            user_id: currentUserId,
            type: 'income',
            amount: settlement.amount,
            category: 'Cobro de deuda',
            description: `Cobro deuda de ${fromName} - ${group.name}`,
            date: today,
            is_recurring: false,
            installments: null,
            current_installment: null,
            paid: true,
            parent_transaction_id: null,
            due_date: null,
            balance_total: null,
            ticket_id: null,
          });
        }
      }

      toast({ title: 'Deuda saldada', description: 'La transferencia fue registrada correctamente' });
      onSettle();
    } catch {
      toast({ title: 'Error', description: 'No se pudo saldar la deuda', variant: 'destructive' });
    } finally {
      setSettlingIndex(null);
    }
  };

  const getSettleDescription = (settlement: DebtSettlement): string => {
    if (!currentMember) return '';
    if (currentMember.id === settlement.fromMemberId) {
      return `Se registrará un gasto de $${settlement.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })} en tu billetera personal.`;
    }
    if (currentMember.id === settlement.toMemberId) {
      return `Se registrará un ingreso de $${settlement.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })} en tu billetera personal.`;
    }
    return 'Se marcará la deuda como saldada.';
  };

  if (settlements.length === 0) {
    return (
      <Card className="border-purple-200 dark:border-purple-800">
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" aria-hidden="true" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            Todas las deudas están saldadas
          </p>
          <p className="text-sm text-gray-500 mt-1">
            No hay transferencias pendientes
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-purple-200 dark:border-purple-800">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-purple-600" aria-hidden="true" />
            Transferencias para saldar deudas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            Mínimo de transferencias necesarias para saldar todas las deudas del grupo:
          </p>
          <div className="space-y-3">
            {settlements.map((settlement, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-4 rounded-xl border border-purple-100 dark:border-purple-800 bg-purple-50/30 dark:bg-purple-900/10"
              >
                <div className="flex-1 flex items-center gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-sm font-bold text-red-700 dark:text-red-300">
                      {getMemberName(settlement.fromMemberId).charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-sm truncate">
                      {getMemberName(settlement.fromMemberId)}
                    </span>
                  </div>

                  <ArrowRight className="h-4 w-4 text-purple-500 flex-shrink-0" aria-hidden="true" />

                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-sm font-bold text-green-700 dark:text-green-300">
                      {getMemberName(settlement.toMemberId).charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-sm truncate">
                      {getMemberName(settlement.toMemberId)}
                    </span>
                  </div>
                </div>

                <Badge className="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 border-0 text-sm tabular-nums">
                  ${settlement.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </Badge>

                <Button
                  size="sm"
                  onClick={() => setConfirmSettle({ settlement, index })}
                  disabled={settlingIndex !== null}
                  className="bg-green-600 hover:bg-green-700 text-white flex-shrink-0"
                >
                  {settlingIndex === index ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    'Saldar'
                  )}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Settle confirmation */}
      <AlertDialog open={confirmSettle !== null} onOpenChange={(open) => { if (!open) setConfirmSettle(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Saldar deuda</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmSettle && (
                <>
                  {getMemberName(confirmSettle.settlement.fromMemberId)} le paga{' '}
                  <strong>${confirmSettle.settlement.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>{' '}
                  a {getMemberName(confirmSettle.settlement.toMemberId)}.
                  <br /><br />
                  {getSettleDescription(confirmSettle.settlement)}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                if (confirmSettle) {
                  handleSettle(confirmSettle.settlement, confirmSettle.index);
                }
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
