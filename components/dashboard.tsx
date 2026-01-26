'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  PiggyBank,
  ArrowUpCircle,
  ArrowDownCircle,
  Calendar,
  Eye,
  EyeOff,
} from 'lucide-react';
import { getMonth, getYear, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Transaction, SavingsGoal, ExpensePlan, CreditPurchase, CreditInstallment, Investment } from '@/types/database';

interface DashboardProps {
  transactions: Transaction[];
  savingsGoals: SavingsGoal[];
  expensePlans: ExpensePlan[];
  creditPurchases: CreditPurchase[];
  creditInstallments: CreditInstallment[];
  investments: Investment[];
}

export function Dashboard({
  transactions,
  savingsGoals,
  expensePlans,
  creditPurchases,
  creditInstallments,
  investments,
}: DashboardProps) {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(getMonth(currentDate));
  const [selectedYear, setSelectedYear] = useState(getYear(currentDate));
  const [showAmounts, setShowAmounts] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('showAmounts');
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem('showAmounts', JSON.stringify(showAmounts));
  }, [showAmounts]);

  const toggleAmounts = () => {
    setShowAmounts((prev: boolean) => !prev);
  };

  const formatAmount = (amount: number) => {
    return showAmounts ? `$${amount.toLocaleString()}` : '$****';
  };

  const months = [
    { value: 0, label: 'Enero' },
    { value: 1, label: 'Febrero' },
    { value: 2, label: 'Marzo' },
    { value: 3, label: 'Abril' },
    { value: 4, label: 'Mayo' },
    { value: 5, label: 'Junio' },
    { value: 6, label: 'Julio' },
    { value: 7, label: 'Agosto' },
    { value: 8, label: 'Septiembre' },
    { value: 9, label: 'Octubre' },
    { value: 10, label: 'Noviembre' },
    { value: 11, label: 'Diciembre' },
  ];

  const years = Array.from({ length: 10 }, (_, i) => getYear(currentDate) - 5 + i);

  const currentMonthTransactions = transactions.filter((t) => {
    const transactionDate = parseISO(t.date);
    return (
      getMonth(transactionDate) === selectedMonth &&
      getYear(transactionDate) === selectedYear
    );
  });

  const totalIncome = currentMonthTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = currentMonthTransactions
    .filter((t) => t.type === 'expense' || t.type === 'credit') 
    .reduce((sum, t) => sum + t.amount, 0);

  const cumulativeIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const cumulativeExpenses = transactions
    .filter((t) => t.type === 'expense' || t.type === 'credit') 
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = cumulativeIncome - cumulativeExpenses;

  // Calculate active investments (money that's locked up)
  const activeInvestmentsTotal = investments
    .filter((inv) => !inv.is_liquidated)
    .reduce((sum, inv) => sum + inv.amount, 0);

  // Liquid balance = Total balance - Active investments
  const liquidBalance = balance - activeInvestmentsTotal;

  const expensesByCategory = currentMonthTransactions
    .filter((t) => t.type === 'expense' || t.type === 'credit') 
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

  const categoryData = Object.entries(expensesByCategory).map(
    ([category, amount]) => ({
      category,
      amount,
    })
  );

  const pieData = Object.entries(expensesByCategory).map(
    ([category, amount]) => ({
      name: category,
      value: amount,
    })
  );

  // Get next 5 unpaid installments ordered by due date
  const upcomingInstallments = creditInstallments
    .filter((inst) => !inst.paid)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
    .slice(0, 5)
    .map((inst) => {
      const purchase = creditPurchases.find((p) => p.id === inst.credit_purchase_id);
      return {
        ...inst,
        purchase,
      };
    })
    .filter((inst) => inst.purchase); // Only include if purchase exists

  const totalSavings = savingsGoals.reduce(
    (sum, goal) => sum + goal.current_amount,
    0
  );

  return (
    <div className='space-y-8'>
      {/* Period Filter Card */}
      <Card className='bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200/50 dark:border-emerald-800/50'>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='flex items-center gap-3 text-emerald-800 dark:text-emerald-200'>
                <div className='p-2 bg-emerald-100 dark:bg-emerald-900 rounded-xl'>
                  <Calendar className='h-5 w-5 text-emerald-600 dark:text-emerald-400' aria-hidden="true" />
                </div>
                Filtrar por Período
              </CardTitle>
              <CardDescription className='mt-2'>
                Selecciona el mes y año para ver los datos específicos
              </CardDescription>
            </div>
            <button
              onClick={toggleAmounts}
              className='p-3 rounded-xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500'
              aria-label={showAmounts ? 'Ocultar montos' : 'Mostrar montos'}
              aria-pressed={showAmounts}
              type="button"
            >
              {showAmounts ? (
                <Eye className='h-5 w-5 text-emerald-600 dark:text-emerald-400' aria-hidden="true" />
              ) : (
                <EyeOff className='h-5 w-5 text-gray-400' aria-hidden="true" />
              )}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className='flex gap-4'>
            <div className='flex-1'>
              <label className='text-sm font-semibold mb-2 block text-gray-700 dark:text-gray-300'>Mes</label>
              <Select
                value={selectedMonth.toString()}
                onValueChange={(value) => setSelectedMonth(parseInt(value))}
              >
                <SelectTrigger className='h-12'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='flex-1'>
              <label className='text-sm font-semibold mb-2 block text-gray-700 dark:text-gray-300'>Año</label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger className='h-12'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className='grid gap-5 md:grid-cols-2 lg:grid-cols-4'>
        {/* Income Card */}
        <Card className='relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-0 shadow-lg shadow-emerald-500/20'>
          <div className='absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16' />
          <div className='absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12' />
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2 relative'>
            <CardTitle className='text-sm font-medium text-emerald-100'>
              Ingresos de {months[selectedMonth].label}
            </CardTitle>
            <div className='p-2 bg-white/20 rounded-xl backdrop-blur-sm'>
              <TrendingUp className='h-4 w-4' aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent className='relative'>
            <div className='text-3xl font-bold tabular-nums tracking-tight'>
              {formatAmount(totalIncome)}
            </div>
            <p className='text-xs text-emerald-200 mt-1'>
              {selectedYear}
            </p>
          </CardContent>
        </Card>

        {/* Expenses Card */}
        <Card className='relative overflow-hidden bg-gradient-to-br from-rose-500 to-pink-600 text-white border-0 shadow-lg shadow-rose-500/20'>
          <div className='absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16' />
          <div className='absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12' />
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2 relative'>
            <CardTitle className='text-sm font-medium text-rose-100'>
              Gastos de {months[selectedMonth].label}
            </CardTitle>
            <div className='p-2 bg-white/20 rounded-xl backdrop-blur-sm'>
              <TrendingDown className='h-4 w-4' aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent className='relative'>
            <div className='text-3xl font-bold tabular-nums tracking-tight'>
              {formatAmount(totalExpenses)}
            </div>
            <p className='text-xs text-rose-200 mt-1'>
              {selectedYear}
            </p>
          </CardContent>
        </Card>

        {/* Balance Card */}
        <Card className={`relative overflow-hidden border-0 shadow-lg ${
          balance >= 0
            ? 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-violet-500/20'
            : 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/20'
        } text-white`}>
          <div className='absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16' />
          <div className='absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12' />
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2 relative'>
            <CardTitle className='text-sm font-medium text-white/80'>Balance Total</CardTitle>
            <div className='p-2 bg-white/20 rounded-xl backdrop-blur-sm'>
              <DollarSign className='h-4 w-4' aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent className='relative'>
            <div className='text-3xl font-bold tabular-nums tracking-tight'>
              {formatAmount(balance)}
            </div>
            {activeInvestmentsTotal > 0 && (
              <p className='text-xs text-white/70 mt-1 tabular-nums'>
                {formatAmount(activeInvestmentsTotal)} invertido
              </p>
            )}
          </CardContent>
        </Card>

        {/* Liquid Balance Card */}
        <Card className='relative overflow-hidden bg-gradient-to-br from-cyan-500 to-blue-600 text-white border-0 shadow-lg shadow-cyan-500/20'>
          <div className='absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16' />
          <div className='absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12' />
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2 relative'>
            <CardTitle className='text-sm font-medium text-cyan-100'>Balance Líquido</CardTitle>
            <div className='p-2 bg-white/20 rounded-xl backdrop-blur-sm'>
              <DollarSign className='h-4 w-4' aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent className='relative'>
            <div className='text-3xl font-bold tabular-nums tracking-tight'>
              {formatAmount(liquidBalance)}
            </div>
            <p className='text-xs text-cyan-200 mt-1'>
              Dinero disponible para usar
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className='grid gap-6 md:grid-cols-2'>
        <Card className='shadow-lg'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <div className='w-1 h-6 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-full' />
              Gastos por Categoría
            </CardTitle>
            <CardDescription>
              Distribución de gastos de {months[selectedMonth].label} {selectedYear}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={300}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray='3 3' stroke='#e5e7eb' vertical={false} />
                <XAxis dataKey='category' axisLine={false} tickLine={false} fontSize={12} />
                <YAxis axisLine={false} tickLine={false} fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                  }}
                  formatter={(value) => [
                    `$${Number(value).toLocaleString()}`,
                    'Monto',
                  ]}
                />
                <Bar dataKey='amount' fill='url(#barGradient)' radius={[8, 8, 0, 0]} />
                <defs>
                  <linearGradient id='barGradient' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0%' stopColor='#10b981' />
                    <stop offset='100%' stopColor='#14b8a6' />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className='shadow-lg'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <div className='w-1 h-6 bg-gradient-to-b from-violet-500 to-purple-500 rounded-full' />
              Distribución de Gastos
            </CardTitle>
            <CardDescription>Porcentaje por categoría - {months[selectedMonth].label} {selectedYear}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={Math.max(200, pieData.length * 40)}>
              <BarChart data={pieData} layout='vertical' margin={{ left: 20, right: 40 }}>
                <CartesianGrid strokeDasharray='3 3' stroke='#e5e7eb' horizontal={true} vertical={false} />
                <XAxis type='number' hide />
                <YAxis
                  dataKey='name'
                  type='category'
                  width={100}
                  axisLine={false}
                  tickLine={false}
                  fontSize={12}
                />
                <Tooltip
                  formatter={(value) => [
                    `$${Number(value).toLocaleString()}`,
                    'Monto',
                  ]}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                  }}
                />
                <Bar
                  dataKey='value'
                  fill='url(#barGradient2)'
                  radius={[0, 8, 8, 0]}
                  label={{
                    position: 'right',
                    formatter: (value: number) => {
                      const total = pieData.reduce((sum, d) => sum + d.value, 0);
                      return `${((value / total) * 100).toFixed(0)}%`;
                    },
                    fontSize: 12,
                    fill: '#6b7280',
                  }}
                />
                <defs>
                  <linearGradient id='barGradient2' x1='0' y1='0' x2='1' y2='0'>
                    <stop offset='0%' stopColor='#8b5cf6' />
                    <stop offset='100%' stopColor='#a855f7' />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className='grid gap-6 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>Metas de Ahorro</CardTitle>
            <CardDescription>Progreso hacia tus objetivos</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {savingsGoals.map((goal) => {
              const progress = (goal.current_amount / goal.target_amount) * 100;
              return (
                <div key={goal.id} className='space-y-2'>
                  <div className='flex justify-between items-center'>
                    <span className='font-medium'>{goal.name}</span>
                    <Badge variant='outline'>
                      {formatAmount(goal.current_amount)} / {formatAmount(goal.target_amount)}
                    </Badge>
                  </div>
                  <Progress value={progress} className='h-2' />
                  <div className='text-sm text-gray-600'>
                    {progress.toFixed(1)}% completado
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximos Pagos de Tarjeta</CardTitle>
            <CardDescription>Próximas 5 cuotas por vencer</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-3'>
              {upcomingInstallments.length > 0 ? (
                upcomingInstallments.map((installment) => {
                  const isOverdue = new Date(installment.due_date) < new Date();

                  return (
                    <div
                      key={installment.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        isOverdue
                          ? 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'
                          : 'bg-gray-50 dark:bg-gray-800'
                      }`}
                    >
                      <div className='flex items-center gap-3'>
                        <CreditCard className={`h-4 w-4 ${isOverdue ? 'text-red-600' : 'text-blue-600'}`} aria-hidden="true" />
                        <div>
                          <div className='font-medium'>{installment.purchase!.description}</div>
                          <div className='text-sm text-gray-600'>
                            Cuota {installment.installment_number} de{' '}
                            {installment.purchase!.installments}
                          </div>
                        </div>
                      </div>
                      <div className='text-right'>
                        <div className='font-medium tabular-nums'>
                          {formatAmount(installment.amount)}
                        </div>
                        <div className={`text-sm flex items-center gap-1 tabular-nums ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                          <Calendar className='h-3 w-3' aria-hidden="true" />
                          {format(parseISO(installment.due_date), 'dd/MM/yyyy')}
                          {isOverdue && <span role="img" aria-label="Vencido"> ⚠️</span>}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className='text-center text-gray-500 py-4'>
                  No hay pagos pendientes
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transacciones Recientes</CardTitle>
          <CardDescription>
            Últimas 10 transacciones registradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-2'>
            {transactions.slice(0, 10).map((transaction) => {
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
                  className='flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
                >
                  <div className='flex items-center gap-3'>
                    {transaction.type === 'income' ? (
                      <ArrowUpCircle className='h-5 w-5 text-green-600' aria-hidden="true" />
                    ) : (
                      <ArrowDownCircle className='h-5 w-5 text-red-600' aria-hidden="true" />
                    )}
                    <div>
                      <div className='font-medium'>{transaction.description}</div>
                      <div className='text-sm text-gray-600 flex items-center gap-2'>
                        <span>{transaction.category}</span>
                        <span>•</span>
                        <span>
                          {format(parseISO(transaction.date), 'dd/MM/yyyy', {
                            locale: es,
                          })}
                        </span>
                      </div>
                      <div className='text-xs text-gray-500 mt-1 flex items-center gap-3'>
                        {transaction.balance_total !== null ? (
                          <>
                            <span>
                              Balance Total:{' '}
                              <span className={`font-medium ${
                                transaction.balance_total >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {formatAmount(transaction.balance_total)}
                              </span>
                            </span>
                            <span>•</span>
                            <span>
                              Balance Líquido:{' '}
                              <span className={`font-medium ${
                                liquidBalanceAtTransaction! >= 0 ? 'text-blue-600' : 'text-red-600'
                              }`}>
                                {formatAmount(liquidBalanceAtTransaction!)}
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
                  </div>
                  <div
                    className={`font-semibold ${
                      transaction.type === 'income'
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {transaction.type === 'income' ? '+' : '-'}{formatAmount(transaction.amount).replace('$', '')}
                  </div>
                </div>
              );
            })}
            {transactions.length === 0 && (
              <div className='text-center text-gray-500 py-8'>
                No hay transacciones registradas
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
