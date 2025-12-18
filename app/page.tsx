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
import { ExpenseForm } from '@/components/expense-form';
import { IncomeForm } from '@/components/income-form';
import { CreditCardForm } from '@/components/credit-card-form';
import { CreditPaymentFormNew } from '@/components/credit-payment-form-new';
import { CreditCardOverviewNew } from '@/components/credit-card-overview-new';
import { InvestmentForm } from '@/components/investment-form';
import { InvestmentLiquidateForm } from '@/components/investment-liquidate-form';
import { InvestmentsOverview } from '@/components/investments-overview';
import { Market } from '@/components/market';
import { Savings } from '@/components/savings';
import { ExpensePlans } from '@/components/expense-plans';
import { History } from '@/components/history';
import {
  BarChart3,
  PlusCircle,
  CreditCard,
  MapPin,
  ClipboardList,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { AuthGuard } from '@/components/auth-guard';
import * as api from '@/lib/database-api';
import { useToast } from '@/hooks/use-toast';

import type { Transaction, SavingsGoal, ExpensePlan, CreditPurchase, CreditInstallment, Investment } from '@/types/database';
import { UserProfile } from '@/components/user-profile';
import Image from 'next/image';
import Logo from '../assets/images/logo.svg';
import { useFormContext } from '@/contexts/form-context';
import VoiceChat from '@/components/voice-chat';
import { Loader } from '@/components/loader';

function FinanceAppContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [expensePlans, setExpensePlans] = useState<ExpensePlan[]>([]);
  const [creditPurchases, setCreditPurchases] = useState<CreditPurchase[]>([]);
  const [creditInstallments, setCreditInstallments] = useState<CreditInstallment[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);

  const {
    setIncomeAmount,
    setIncomeCategory,
    setIncomeDescription,
    setExpenseAmount,
    setExpenseCategory,
    setExpenseDescription,
  } = useFormContext();

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const [transactionsData, savingsData, plansData, purchasesData, installmentsData, investmentsData] = await Promise.all([
        api.getTransactions(user.id),
        api.getSavingsGoals(user.id),
        api.getExpensePlans(user.id),
        api.getCreditPurchases(user.id),
        api.getAllCreditInstallments(user.id),
        api.getInvestments(user.id),
      ]);

      setTransactions(transactionsData || []);
      setSavingsGoals(savingsData || []);
      setExpensePlans(plansData || []);
      setCreditPurchases(purchasesData || []);
      setCreditInstallments(installmentsData || []);
      setInvestments(investmentsData || []);
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

  useEffect(() => {
    loadData();
  }, [user]);

  const addTransaction = async (
    transaction: Omit<
      Transaction,
      'id' | 'user_id' | 'created_at' | 'updated_at'
    >
  ) => {
    if (!user) {
      return;
    }

    try {
      const newTransaction = await api.addTransaction({
        ...transaction,
        user_id: user.id,
        is_recurring: transaction.is_recurring || null,
        installments: transaction.installments || null,
        current_installment: transaction.current_installment || null,
        paid: transaction.paid || null,
        parent_transaction_id: transaction.parent_transaction_id || null,
        due_date: transaction.due_date || null,
      });
      setTransactions((prev) => [newTransaction, ...prev]);
      toast({
        title: 'Éxito',
        description: 'Transacción agregada correctamente',
      });
    } catch (error) {
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

  const addCreditPurchase = async (data: {
    purchase: Omit<CreditPurchase, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
    installments: Omit<CreditInstallment, 'id' | 'credit_purchase_id' | 'created_at' | 'updated_at'>[];
  }) => {
    if (!user) {
      return;
    }

    try {
      const purchaseWithUser = {
        ...data.purchase,
        user_id: user.id,
      };

      const result = await api.createCreditPurchase(purchaseWithUser, data.installments);

      setCreditPurchases((prev) => [result.purchase, ...prev]);
      setCreditInstallments((prev) => [...result.installments, ...prev]);

      toast({
        title: 'Éxito',
        description: `Compra en ${data.installments.length} cuotas registrada correctamente`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'No se pudo registrar la compra',
        variant: 'destructive',
      });
    }
  };

  const payCreditInstallment = async (installmentId: string) => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      await api.payCreditInstallment(installmentId, user.id, today);

      toast({
        title: 'Éxito',
        description: 'Cuota pagada y transacción creada correctamente',
      });

      // Reload all data to update dashboard and balance
      await loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'No se pudo pagar la cuota',
        variant: 'destructive',
      });
    }
  };

  const addInvestment = async (
    investment: Omit<Investment, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ) => {
    if (!user) return;

    try {
      const investmentWithUser = {
        ...investment,
        user_id: user.id,
      };

      const newInvestment = await api.createInvestment(investmentWithUser);
      setInvestments((prev) => [newInvestment, ...prev]);

      toast({
        title: 'Éxito',
        description: 'Inversión registrada correctamente',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'No se pudo registrar la inversión',
        variant: 'destructive',
      });
    }
  };

  const liquidateInvestment = async (investmentId: string, actualReturn: number) => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      await api.liquidateInvestment(investmentId, user.id, today, actualReturn);

      toast({
        title: 'Éxito',
        description: 'Inversión liquidada e ingreso creado correctamente',
      });

      // Reload all data to update dashboard and balance
      await loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'No se pudo liquidar la inversión',
        variant: 'destructive',
      });
    }
  };

  const sellCurrency = async (investmentId: string, unitsSold: number, sellExchangeRate: number) => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const result = await api.partialSellCurrency(investmentId, user.id, unitsSold, sellExchangeRate, today);

      toast({
        title: 'Éxito',
        description: result.isFullSale
          ? 'Venta total completada e ingreso creado correctamente'
          : 'Venta parcial completada. La inversión se ha actualizado con las unidades restantes.',
      });

      // Reload all data to update dashboard and balance
      await loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'No se pudo realizar la venta',
        variant: 'destructive',
      });
    }
  };

  const updateInvestment = async (investmentId: string, updates: Partial<Investment>) => {
    if (!user) return;

    try {
      const updatedInvestment = await api.updateInvestment(investmentId, user.id, updates);
      setInvestments((prev) =>
        prev.map((inv) => (inv.id === investmentId ? updatedInvestment : inv))
      );

      toast({
        title: 'Éxito',
        description: 'Inversión actualizada correctamente',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'No se pudo actualizar la inversión',
        variant: 'destructive',
      });
    }
  };

  const deleteInvestment = async (investmentId: string) => {
    if (!user) return;

    try {
      await api.deleteInvestment(investmentId, user.id);
      setInvestments((prev) => prev.filter((inv) => inv.id !== investmentId));

      toast({
        title: 'Éxito',
        description: 'Inversión eliminada correctamente',
      });

      // Reload data to update balance if a liquidated investment was deleted
      await loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'No se pudo eliminar la inversión',
        variant: 'destructive',
      });
    }
  };

  const updateCreditPurchase = async (purchaseId: string, updates: Partial<CreditPurchase>) => {
    if (!user) return;

    try {
      const updatedPurchase = await api.updateCreditPurchase(purchaseId, user.id, updates);
      setCreditPurchases((prev) =>
        prev.map((p) => (p.id === purchaseId ? updatedPurchase : p))
      );

      toast({
        title: 'Éxito',
        description: 'Compra actualizada correctamente',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'No se pudo actualizar la compra',
        variant: 'destructive',
      });
    }
  };

  const deleteCreditPurchase = async (purchaseId: string) => {
    if (!user) return;

    try {
      await api.deleteCreditPurchase(purchaseId, user.id);
      setCreditPurchases((prev) => prev.filter((p) => p.id !== purchaseId));

      toast({
        title: 'Éxito',
        description: 'Compra eliminada correctamente',
      });

      // Reload data to update balance and installments
      await loadData();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'No se pudo eliminar la compra',
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

  const transcriptionHandler = (rawResponse: any) => {
    const jsonMatch =
      rawResponse.match?.(/```json([\s\S]*?)```/) ||
      rawResponse.match?.(/```([\s\S]*?)```/);
    const cleanJson = jsonMatch ? jsonMatch[1].trim() : rawResponse;

    let response: {
      type: 'income' | 'expense';
      amount: number;
      category: string;
      description: string;
    };

    try {
      response =
        typeof cleanJson === 'string' ? JSON.parse(cleanJson) : cleanJson;
    } catch (error) {
      console.error('Error al parsear la respuesta:', error);
      return;
    }

    const { type, amount, category, description } = response;

    if (type === 'income') {
      setIncomeAmount(amount.toString());
      setIncomeCategory(category);
      setIncomeDescription(description);
    } else if (type === 'expense') {
      setExpenseAmount(amount.toString());
      setExpenseCategory(category);
      setExpenseDescription(description);
    }

    toast({
      title: 'Éxito',
      description:
        'Transacción generada con IA exitosamente. Ya puede registrarla.',
    });
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <div className='min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800'>
      <div className='container mx-auto p-4 max-w-7xl'>
        <div className='flex items-center justify-between py-3 px-6 mb-6 bg-white rounded-full shadow-md'>
          <div className='flex items-center justify-center gap-2'>
            <Image src={Logo} width={60} height={60} alt='Personal Wallet logo' />
            <h1 className='text-xl lg:text-3xl font-bold text-[#466E45] dark:text-white'>
              Personal Wallet
            </h1>
          </div>
          <UserProfile />
        </div>

        <Tabs defaultValue='dashboard' className='space-y-6'>
          <div className='flex items-center justify-center'>
            <TabsList className='w-full justify-around'>
              <TabsTrigger
                value='dashboard'
                className='flex items-center gap-2'
              >
                <BarChart3 className='h-4 w-4' />
                <span className='hidden sm:inline'>Dashboard</span>
              </TabsTrigger>
              <TabsTrigger value='expenses' className='flex items-center gap-2'>
                <PlusCircle className='h-4 w-4' />
                <span className='hidden sm:inline'>Transacciones</span>
              </TabsTrigger>
              <TabsTrigger value='credit' className='flex items-center gap-2'>
                <CreditCard className='h-4 w-4' />
                <span className='hidden sm:inline'>Tarjetas</span>
              </TabsTrigger>
              <TabsTrigger value='investments' className='flex items-center gap-2'>
                <TrendingUp className='h-4 w-4' />
                <span className='hidden sm:inline'>Inversiones</span>
              </TabsTrigger>
              <TabsTrigger value='plans' className='flex items-center gap-2'>
                <MapPin className='h-4 w-4' />
                <span className='hidden sm:inline'>Planes</span>
              </TabsTrigger>

              <TabsTrigger value='history' className='flex items-center gap-2'>
                <ClipboardList className='h-4 w-4' />
                <span className='hidden sm:inline'>Historial</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value='dashboard'>
            <Dashboard
              transactions={transactions}
              savingsGoals={savingsGoals}
              expensePlans={expensePlans}
              creditPurchases={creditPurchases}
              creditInstallments={creditInstallments}
              investments={investments}
            />
          </TabsContent>

          <TabsContent value='expenses'>
            {user?.id === "dbf7a94b-204a-482f-8e8c-f2d6a5e470b5" && <VoiceChat onResponse={(data) => transcriptionHandler(data)} />}
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
            <Tabs defaultValue='nueva' className='space-y-4'>
              <div className='flex items-center justify-center'>
                <TabsList >
                  <TabsTrigger value='nueva'>Nueva Compra</TabsTrigger>
                  <TabsTrigger value='pagar'>Pagar Cuota</TabsTrigger>
                  <TabsTrigger value='ver'>Ver Compras</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value='nueva'>
                <Card>
                  <CardHeader>
                    <CardTitle>Nueva Compra con Tarjeta</CardTitle>
                    <CardDescription>
                      Registra una nueva compra en cuotas
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CreditCardForm onSubmit={addCreditPurchase} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value='pagar'>
                <Card>
                  <CardHeader>
                    <CardTitle>Pagar Cuota Manualmente</CardTitle>
                    <CardDescription>
                      Selecciona y registra el pago de cuotas pendientes
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CreditPaymentFormNew
                      installments={creditInstallments
                        .filter(inst => !inst.paid) // ✅ Only show unpaid installments
                        .map(inst => {
                          const purchase = creditPurchases.find(p => p.id === inst.credit_purchase_id);
                          return purchase ? { ...inst, credit_purchase: purchase } : null;
                        }).filter(Boolean) as any}
                      onPayInstallment={payCreditInstallment}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value='ver'>
                <CreditCardOverviewNew
                  purchases={creditPurchases}
                  installments={creditInstallments}
                  onDelete={deleteCreditPurchase}
                  onUpdate={updateCreditPurchase}
                />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value='savings'>
            <Savings
              savingsGoals={savingsGoals}
              onAddGoal={addSavingsGoal}
              onUpdateGoal={updateSavingsGoal}
            />
          </TabsContent>

          <TabsContent value='investments'>
            <Tabs defaultValue='nueva' className='space-y-4'>
              <TabsList className='grid grid-cols-2 md:grid-cols-4 w-full h-auto p-[10px]'>
                <TabsTrigger value='nueva' >Nueva Inversión</TabsTrigger>
                <TabsTrigger value='liquidar' >Liquidar</TabsTrigger>
                <TabsTrigger value='ver' >Ver Inversiones</TabsTrigger>
                <TabsTrigger value='mercado' >Mercado</TabsTrigger>
              </TabsList>

              <TabsContent value='nueva'>
                <Card>
                  <CardHeader>
                    <CardTitle>Registrar Nueva Inversión</CardTitle>
                    <CardDescription>
                      El dinero quedará congelado hasta que liquides la inversión
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <InvestmentForm onSubmit={addInvestment} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value='liquidar'>
                <Card>
                  <CardHeader>
                    <CardTitle>Liquidar Inversión</CardTitle>
                    <CardDescription>
                      Registra la liquidación y crea el ingreso automáticamente
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <InvestmentLiquidateForm
                      investments={investments}
                      onLiquidate={liquidateInvestment}
                      onCurrencySale={sellCurrency}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value='ver'>
                <InvestmentsOverview
                  investments={investments}
                  onDelete={deleteInvestment}
                  onUpdate={updateInvestment}
                />
              </TabsContent>

              <TabsContent value='mercado'>
                <Market />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value='plans'>
            <ExpensePlans
              expensePlans={expensePlans}
              onAddPlan={addExpensePlan}
            />
          </TabsContent>

          <TabsContent value='history'>
            <History onTransactionDeleted={loadData} investments={investments} />
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
