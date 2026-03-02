'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Plus,
  UserPlus,
  Loader2,
  Trash2,
  ArrowRightLeft,
  Users,
  Receipt,
} from 'lucide-react';
import type {
  SplitGroup,
  SplitGroupMember,
  SplitExpense,
  SplitExpenseShare,
} from '@/types/database';
import * as smartpocketApi from '@/lib/smartpocket-api';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { SplitAddExpense } from './split-add-expense';
import { SplitInviteDialog } from './split-invite-dialog';
import { SplitSettlements } from './split-settlements';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface SplitGroupDetailProps {
  group: SplitGroup;
  onBack: () => void;
  onUpdate: () => void;
}

type ExpenseWithShares = SplitExpense & { split_expense_shares: SplitExpenseShare[] };

export function SplitGroupDetail({ group, onBack, onUpdate }: SplitGroupDetailProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<SplitGroupMember[]>([]);
  const [expenses, setExpenses] = useState<ExpenseWithShares[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [activeView, setActiveView] = useState<'expenses' | 'settlements'>('expenses');

  const loadData = async () => {
    try {
      setLoading(true);
      const [membersData, expensesData] = await Promise.all([
        smartpocketApi.getGroupMembers(group.id),
        smartpocketApi.getGroupExpenses(group.id),
      ]);
      setMembers(membersData || []);
      setExpenses((expensesData || []) as ExpenseWithShares[]);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos del grupo',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [group.id]);

  const currentMember = useMemo(
    () => members.find((m) => m.user_id === user?.id),
    [members, user]
  );

  const isGroupAdmin = useMemo(
    () => group.created_by === user?.id || currentMember?.is_admin,
    [group, user, currentMember]
  );

  // Calculate balance per member
  const memberBalances = useMemo(() => {
    const balances = new Map<string, number>();
    for (const member of members) {
      balances.set(member.id, 0);
    }

    for (const expense of expenses) {
      // Payer gets positive balance
      const payerBalance = balances.get(expense.paid_by_member_id) || 0;
      balances.set(expense.paid_by_member_id, payerBalance + expense.amount);

      // Each share holder gets negative balance
      for (const share of expense.split_expense_shares) {
        if (!share.is_settled) {
          const currentBalance = balances.get(share.member_id) || 0;
          balances.set(share.member_id, currentBalance - share.share_amount);
        }
      }
    }

    return balances;
  }, [members, expenses]);

  const totalGroupSpending = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  );

  const settlements = useMemo(
    () => smartpocketApi.calculateSettlements(members, expenses),
    [members, expenses]
  );

  const getMemberName = (memberId: string) =>
    members.find((m) => m.id === memberId)?.display_name || 'Desconocido';

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      await smartpocketApi.deleteSplitExpense(expenseId);
      setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
      toast({
        title: 'Eliminado',
        description: 'Gasto eliminado correctamente',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el gasto',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card className="border-purple-200 dark:border-purple-800">
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{group.name}</h2>
        <Badge variant="outline">{group.currency}</Badge>
      </div>

      {/* Members & Balances */}
      <Card className="border-purple-200 dark:border-purple-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-600" />
              Miembros ({members.length})
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInvite(true)}
              className="border-purple-200"
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Invitar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {members.map((member) => {
              const balance = memberBalances.get(member.id) || 0;
              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-purple-100 dark:border-purple-800"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-sm font-bold text-purple-700 dark:text-purple-300">
                      {member.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{member.display_name}</p>
                      {member.invite_status === 'pending' && (
                        <Badge variant="outline" className="text-xs py-0">Pendiente</Badge>
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      balance > 0.01
                        ? 'text-green-600'
                        : balance < -0.01
                        ? 'text-red-600'
                        : 'text-gray-500'
                    }`}
                  >
                    {balance > 0.01
                      ? `+$${balance.toFixed(2)}`
                      : balance < -0.01
                      ? `-$${Math.abs(balance).toFixed(2)}`
                      : '$0.00'}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Total & Action buttons */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Badge className="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 border-0 text-sm py-1 px-3">
            Total: ${totalGroupSpending.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </Badge>
          <div className="flex gap-1">
            <Button
              variant={activeView === 'expenses' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveView('expenses')}
              className={activeView === 'expenses' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'border-purple-200'}
            >
              <Receipt className="h-4 w-4 mr-1" />
              Gastos
            </Button>
            <Button
              variant={activeView === 'settlements' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveView('settlements')}
              className={activeView === 'settlements' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'border-purple-200'}
            >
              <ArrowRightLeft className="h-4 w-4 mr-1" />
              Deudas
            </Button>
          </div>
        </div>
        <Button
          onClick={() => setShowAddExpense(true)}
          className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Agregar Gasto
        </Button>
      </div>

      {/* Expenses List or Settlements */}
      {activeView === 'expenses' ? (
        <Card className="border-purple-200 dark:border-purple-800">
          <CardContent className="pt-6">
            {expenses.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Receipt className="h-10 w-10 mx-auto mb-3 text-purple-300" />
                <p>No hay gastos en este grupo todavía</p>
              </div>
            ) : (
              <div className="space-y-3">
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-purple-100 dark:border-purple-800"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {expense.description}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                        <span>Pagó: {getMemberName(expense.paid_by_member_id)}</span>
                        <span>-</span>
                        <span>
                          {format(new Date(expense.expense_date + 'T12:00:00'), 'dd MMM', { locale: es })}
                        </span>
                        {expense.category && (
                          <Badge variant="outline" className="text-xs py-0">
                            {expense.category}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs py-0">
                          {expense.split_method === 'equal' ? 'Equitativo' : expense.split_method === 'percentage' ? 'Porcentaje' : 'Personalizado'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-purple-700 dark:text-purple-300">
                        ${expense.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteExpense(expense.id)}
                        className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <SplitSettlements
          settlements={settlements}
          members={members}
          onSettle={loadData}
        />
      )}

      {/* Add Expense Dialog */}
      {showAddExpense && (
        <SplitAddExpense
          group={group}
          members={members}
          currentMember={currentMember || null}
          onClose={() => setShowAddExpense(false)}
          onExpenseAdded={() => {
            loadData();
            setShowAddExpense(false);
          }}
        />
      )}

      {/* Invite Dialog */}
      {showInvite && (
        <SplitInviteDialog
          group={group}
          onClose={() => setShowInvite(false)}
          onInviteSent={loadData}
        />
      )}
    </div>
  );
}
