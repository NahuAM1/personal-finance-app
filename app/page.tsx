'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Dashboard } from '@/components/dashboard';
import { QuickActions } from '@/components/quick-actions';
import { ExpenseForm } from '@/components/expense-form';
import { IncomeForm } from '@/components/income-form';
import { CreditCardForm } from '@/components/credit-card-form';
import { Savings } from '@/components/savings';
import { ExpensePlans } from '@/components/expense-plans';
import {
  BarChart3,
  PlusCircle,
  CreditCard,
  PiggyBank,
  MapPin,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { AuthGuard } from '@/components/auth-guard';
import * as api from '@/lib/database-api';
import { useToast } from '@/hooks/use-toast';

import type { Transaction, SavingsGoal, ExpensePlan } from '@/types/database';

function FinanceAppContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [expensePlans, setExpensePlans] = useState<ExpensePlan[]>([]);

  // Load initial data from Supabase
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const [transactionsData, savingsData, plansData] = await Promise.all([
          api.getTransactions(user.id),
          api.getSavingsGoals(user.id),
          api.getExpensePlans(user.id),
        ]);

        setTransactions(transactionsData || []);
        setSavingsGoals(savingsData || []);
        setExpensePlans(plansData || []);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los datos',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, toast]);

  const addTransaction = async (
    transaction: Omit<
      Transaction,
      'id' | 'user_id' | 'created_at' | 'updated_at'
    >
  ) => {
    console.log('addTransaction called with:', transaction);
    console.log('Current user:', user);

    if (!user) {
      console.log('No user found, returning');
      return;
    }

    try {
      const newTransaction = await api.addTransaction({
        ...transaction,
        user_id: user.id,
        is_recurring: transaction.is_recurring || null,
        installments: transaction.installments || null,
        current_installment: transaction.current_installment || null,
      });
      console.log('Transaction created:', newTransaction);
      setTransactions((prev) => [newTransaction, ...prev]);
      toast({
        title: 'Éxito',
        description: 'Transacción agregada correctamente',
      });
    } catch (error) {
      console.error('Error in addTransaction:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'No se pudo agregar la transacción',
        variant: 'destructive',
      });
    }
  };

  const addSavingsGoal = async (
    goal: Omit<SavingsGoal, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ) => {
    if (!user) return;

    try {
      const newGoal = await api.addSavingsGoal({
        ...goal,
        user_id: user.id,
        current_amount: goal.current_amount || 0,
      });
      setSavingsGoals((prev) => [...prev, newGoal]);
      toast({
        title: 'Éxito',
        description: 'Meta de ahorro agregada correctamente',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo agregar la meta de ahorro',
        variant: 'destructive',
      });
    }
  };

  const updateSavingsGoal = async (id: string, amount: number) => {
    const goal = savingsGoals.find((g) => g.id === id);
    if (!goal) return;

    try {
      const newAmount = Math.min(
        goal.current_amount + amount,
        goal.target_amount
      );
      const updatedGoal = await api.updateSavingsGoal(id, {
        current_amount: newAmount,
      });
      setSavingsGoals((prev) =>
        prev.map((g) => (g.id === id ? updatedGoal : g))
      );
      toast({
        title: 'Éxito',
        description: 'Meta de ahorro actualizada correctamente',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la meta de ahorro',
        variant: 'destructive',
      });
    }
  };

  const addExpensePlan = async (
    plan: Omit<ExpensePlan, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ) => {
    if (!user) return;

    try {
      const newPlan = await api.addExpensePlan({
        ...plan,
        user_id: user.id,
        current_amount: plan.current_amount || 0,
      });
      setExpensePlans((prev) => [...prev, newPlan]);
      toast({
        title: 'Éxito',
        description: 'Plan de gasto agregado correctamente',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo agregar el plan de gasto',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto'></div>
          <p className='mt-4 text-gray-600 dark:text-gray-400'>
            Cargando datos...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800'>
      <div className='container mx-auto p-4 max-w-7xl'>
        <div className='mb-6'>
          <h1 className='text-3xl font-bold text-gray-900 dark:text-white mb-2'>
            Finanzas Personales
          </h1>
          <p className='text-gray-600 dark:text-gray-300'>
            Gestiona tus ingresos, gastos y ahorros de manera inteligente
          </p>
        </div>

        <Tabs defaultValue='dashboard' className='space-y-6'>
          <TabsList className='grid w-full grid-cols-6 lg:w-fit lg:grid-cols-6'>
            <TabsTrigger value='dashboard' className='flex items-center gap-2'>
              <BarChart3 className='h-4 w-4' />
              <span className='hidden sm:inline'>Dashboard</span>
            </TabsTrigger>

            <TabsTrigger value='expenses' className='flex items-center gap-2'>
              <PlusCircle className='h-4 w-4' />
              <span className='hidden sm:inline'>Gastos</span>
            </TabsTrigger>
            <TabsTrigger value='credit' className='flex items-center gap-2'>
              <CreditCard className='h-4 w-4' />
              <span className='hidden sm:inline'>Tarjetas</span>
            </TabsTrigger>
            <TabsTrigger value='savings' className='flex items-center gap-2'>
              <PiggyBank className='h-4 w-4' />
              <span className='hidden sm:inline'>Ahorros</span>
            </TabsTrigger>
            <TabsTrigger value='plans' className='flex items-center gap-2'>
              <MapPin className='h-4 w-4' />
              <span className='hidden sm:inline'>Planes</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value='dashboard'>
            <Dashboard
              transactions={transactions}
              savingsGoals={savingsGoals}
              expensePlans={expensePlans}
            />
          </TabsContent>

          <TabsContent value='expenses'>
            <div className='grid gap-6 md:grid-cols-2'>
              <Card>
                <CardHeader>
                  <CardTitle>Registrar Gasto</CardTitle>
                  <CardDescription>
                    Agrega un nuevo gasto a tu registro
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ExpenseForm onSubmit={addTransaction} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Registrar Ingreso</CardTitle>
                  <CardDescription>
                    Agrega un nuevo ingreso a tu registro
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <IncomeForm onSubmit={addTransaction} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value='credit'>
            <Card>
              <CardHeader>
                <CardTitle>Gastos con Tarjeta de Crédito</CardTitle>
                <CardDescription>
                  Registra compras en cuotas que se cargarán automáticamente
                  cada mes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CreditCardForm onSubmit={addTransaction} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value='savings'>
            <Savings
              savingsGoals={savingsGoals}
              onAddGoal={addSavingsGoal}
              onUpdateGoal={updateSavingsGoal}
            />
          </TabsContent>

          <TabsContent value='plans'>
            <ExpensePlans
              expensePlans={expensePlans}
              onAddPlan={addExpensePlan}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function FinanceApp() {
  return (
    <AuthGuard>
      <FinanceAppContent />
    </AuthGuard>
  );
}
