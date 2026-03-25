'use client';

import { useState, useEffect, useMemo } from 'react';
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
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useChartPreferences } from '@/contexts/chart-preferences-context';
import { getMonthlyTrends, getBudgetDistribution, getBalanceEvolution } from '@/lib/chart-transforms';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  ArrowUpCircle,
  ArrowDownCircle,
  Calendar,
  Eye,
  EyeOff,
} from 'lucide-react';
import { getMonth, getYear, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Transaction, ExpensePlan, CreditPurchase, CreditInstallment, Investment, Loan } from '@/types/database';

interface ChartTooltipEntry {
  name: string;
  value: number;
  color: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl px-3 py-2 text-sm">
      {label && (
        <p className="text-gray-500 dark:text-gray-400 mb-1.5 font-medium text-xs">{label}</p>
      )}
      {payload.map((entry) => (
        <p key={entry.name} className="font-semibold leading-6">
          <span className="text-gray-500 dark:text-gray-400 font-normal">{entry.name}: </span>
          <span style={{ color: entry.color }}>${entry.value.toLocaleString('es-AR')}</span>
        </p>
      ))}
    </div>
  );
}

interface DashboardProps {
  transactions: Transaction[];
  expensePlans: ExpensePlan[];
  creditPurchases: CreditPurchase[];
  creditInstallments: CreditInstallment[];
  investments: Investment[];
  loans: Loan[];
}

export function Dashboard({
  transactions,
  expensePlans,
  creditPurchases,
  creditInstallments,
  investments,
  loans,
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

  const { preferences } = useChartPreferences();

  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains('dark'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const prefersReducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  const gridColor = isDark ? '#374151' : '#e5e7eb';
  const axisColor = isDark ? '#9ca3af' : '#6b7280';

  const CHART_COLORS = [
    '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6',
    '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  ];

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

  const monthlyTrends = useMemo(() => getMonthlyTrends(transactions, 6), [transactions]);
  const budgetDistribution = useMemo(
    () => getBudgetDistribution(currentMonthTransactions.filter((t) => t.type === 'expense' || t.type === 'credit')),
    [currentMonthTransactions]
  );
  const balanceEvolution = useMemo(() => getBalanceEvolution(transactions, 60), [transactions]);

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

  // Calculate money reserved in expense plans
  const totalPlannedSavings = expensePlans.reduce(
    (sum, plan) => sum + plan.current_amount,
    0
  );

  // Calculate active loans given (money lent to others, not yet fully repaid)
  const activeLoansGivenTotal = loans
    .filter((loan) => loan.loan_type === 'given' && loan.status === 'active')
    .reduce((sum, loan) => sum + loan.total_amount, 0);

  // Liquid balance = Total balance - Active investments - Reserved in plans
  const liquidBalance = balance - activeInvestmentsTotal - totalPlannedSavings;

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

  return (
    <div className='space-y-8 w-full min-w-0'>
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
      <div className='grid gap-5 md:grid-cols-2 lg:grid-cols-4 min-w-0'>
        {/* Income Card */}
        <Card className='relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-0 shadow-lg shadow-emerald-500/20 min-w-0'>
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
        <Card className='relative overflow-hidden bg-gradient-to-br from-rose-500 to-pink-600 text-white border-0 shadow-lg shadow-rose-500/20 min-w-0'>
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
        <Card className={`relative overflow-hidden border-0 shadow-lg min-w-0 ${
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
            {activeLoansGivenTotal > 0 && (
              <p className='text-xs text-white/70 mt-1 tabular-nums'>
                {formatAmount(activeLoansGivenTotal)} prestado
              </p>
            )}
          </CardContent>
        </Card>

        {/* Liquid Balance Card */}
        <Card className='relative overflow-hidden bg-gradient-to-br from-cyan-500 to-blue-600 text-white border-0 shadow-lg shadow-cyan-500/20 min-w-0'>
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
            {totalPlannedSavings > 0 && (
              <p className='text-xs text-cyan-200/70 mt-1 tabular-nums'>
                {formatAmount(totalPlannedSavings)} destinado a metas de ahorros
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Section — Row 1: existing charts */}
      {(preferences.gastosPorCategoria || preferences.distribucionGastos) && (
        <div className='grid gap-6 md:grid-cols-2 min-w-0'>
          {preferences.gastosPorCategoria && (
            <Card className='shadow-lg min-w-0'>
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
                    <CartesianGrid strokeDasharray='3 3' stroke={gridColor} vertical={false} />
                    <XAxis dataKey='category' axisLine={false} tickLine={false} tick={{ fill: axisColor, fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: axisColor, fontSize: 12 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey='amount' name='Monto' fill='url(#barGradient)' radius={[8, 8, 0, 0]} isAnimationActive={!prefersReducedMotion} />
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
          )}

          {preferences.distribucionGastos && (
            <Card className='shadow-lg min-w-0'>
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
                    <CartesianGrid strokeDasharray='3 3' stroke={gridColor} horizontal={true} vertical={false} />
                    <XAxis type='number' hide />
                    <YAxis dataKey='name' type='category' width={100} axisLine={false} tickLine={false} tick={{ fill: axisColor, fontSize: 12 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar
                      dataKey='value'
                      name='Monto'
                      fill='url(#barGradient2)'
                      radius={[0, 8, 8, 0]}
                      isAnimationActive={!prefersReducedMotion}
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
          )}
        </div>
      )}

      {/* Charts Section — Row 2: new charts */}
      {(preferences.tendenciaMensual || preferences.distribucionPresupuesto) && (
        <div className='grid gap-6 md:grid-cols-2 min-w-0'>
          {preferences.tendenciaMensual && (
            <Card className='shadow-lg min-w-0'>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <div className='w-1 h-6 bg-gradient-to-b from-emerald-500 to-blue-500 rounded-full' />
                  Tendencia Mensual
                </CardTitle>
                <CardDescription>Ingresos y gastos de los últimos 6 meses</CardDescription>
              </CardHeader>
              <CardContent>
                {monthlyTrends.filter((p) => p.ingresos > 0 || p.gastos > 0).length < 2 ? (
                  <div className='flex items-center justify-center h-[300px] text-gray-400 text-sm'>
                    No hay datos suficientes
                  </div>
                ) : (
                  <ResponsiveContainer width='100%' height={300}>
                    <LineChart data={monthlyTrends}>
                      <CartesianGrid strokeDasharray='3 3' stroke={gridColor} vertical={false} />
                      <XAxis dataKey='month' axisLine={false} tickLine={false} tick={{ fill: axisColor, fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: axisColor, fontSize: 12 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ color: axisColor, fontSize: 12 }} />
                      <Line type='monotone' dataKey='ingresos' stroke='#10b981' strokeWidth={2} dot={false} name='Ingresos' isAnimationActive={!prefersReducedMotion} />
                      <Line type='monotone' dataKey='gastos' stroke='#f43f5e' strokeWidth={2} dot={false} name='Gastos' isAnimationActive={!prefersReducedMotion} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          )}

          {preferences.distribucionPresupuesto && (
            <Card className='shadow-lg min-w-0'>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <div className='w-1 h-6 bg-gradient-to-b from-orange-500 to-pink-500 rounded-full' />
                  Distribución del Presupuesto
                </CardTitle>
                <CardDescription>Gastos por categoría - {months[selectedMonth].label} {selectedYear}</CardDescription>
              </CardHeader>
              <CardContent>
                {budgetDistribution.length === 0 ? (
                  <div className='flex items-center justify-center h-[300px] text-gray-400 text-sm'>
                    No hay gastos registrados
                  </div>
                ) : (
                  <ResponsiveContainer width='100%' height={300}>
                    <PieChart>
                      <Pie
                        data={budgetDistribution}
                        cx='50%'
                        cy='50%'
                        innerRadius={60}
                        outerRadius={100}
                        dataKey='value'
                        nameKey='name'
                        isAnimationActive={!prefersReducedMotion}
                      >
                        {budgetDistribution.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ color: axisColor, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Charts Section — Row 3: balance evolution + income vs expenses */}
      {(preferences.evolucionBalance || preferences.ingresosVsGastos) && (
        <div className='grid gap-6 md:grid-cols-2 min-w-0'>
          {preferences.evolucionBalance && (
            <Card className='shadow-lg min-w-0'>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <div className='w-1 h-6 bg-gradient-to-b from-cyan-500 to-blue-500 rounded-full' />
                  Evolución del Balance
                </CardTitle>
                <CardDescription>Balance total a lo largo del tiempo</CardDescription>
              </CardHeader>
              <CardContent>
                {balanceEvolution.length < 2 ? (
                  <div className='flex items-center justify-center h-[300px] text-gray-400 text-sm'>
                    No hay datos suficientes
                  </div>
                ) : (
                  <ResponsiveContainer width='100%' height={300}>
                    <AreaChart data={balanceEvolution}>
                      <defs>
                        <linearGradient id='balanceGradient' x1='0' y1='0' x2='0' y2='1'>
                          <stop offset='5%' stopColor='#06b6d4' stopOpacity={0.3} />
                          <stop offset='95%' stopColor='#06b6d4' stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray='3 3' stroke={gridColor} vertical={false} />
                      <XAxis dataKey='date' axisLine={false} tickLine={false} tick={{ fill: axisColor, fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: axisColor, fontSize: 12 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area
                        type='monotone'
                        dataKey='balance'
                        stroke='#06b6d4'
                        strokeWidth={2}
                        fill='url(#balanceGradient)'
                        name='Balance'
                        isAnimationActive={!prefersReducedMotion}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          )}

          {preferences.ingresosVsGastos && (
            <Card className='shadow-lg min-w-0'>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <div className='w-1 h-6 bg-gradient-to-b from-emerald-500 to-rose-500 rounded-full' />
                  Ingresos vs Gastos
                </CardTitle>
                <CardDescription>Comparación mensual de los últimos 6 meses</CardDescription>
              </CardHeader>
              <CardContent>
                {monthlyTrends.filter((p) => p.ingresos > 0 || p.gastos > 0).length < 2 ? (
                  <div className='flex items-center justify-center h-[300px] text-gray-400 text-sm'>
                    No hay datos suficientes
                  </div>
                ) : (
                  <ResponsiveContainer width='100%' height={300}>
                    <BarChart data={monthlyTrends} barCategoryGap='20%'>
                      <defs>
                        <linearGradient id='ingresosBarGradient' x1='0' y1='0' x2='0' y2='1'>
                          <stop offset='0%' stopColor='#10b981' />
                          <stop offset='100%' stopColor='#059669' />
                        </linearGradient>
                        <linearGradient id='gastosBarGradient' x1='0' y1='0' x2='0' y2='1'>
                          <stop offset='0%' stopColor='#f43f5e' />
                          <stop offset='100%' stopColor='#e11d48' />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray='3 3' stroke={gridColor} vertical={false} />
                      <XAxis dataKey='month' axisLine={false} tickLine={false} tick={{ fill: axisColor, fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: axisColor, fontSize: 12 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ color: axisColor, fontSize: 12 }} />
                      <Bar dataKey='ingresos' fill='url(#ingresosBarGradient)' radius={[4, 4, 0, 0]} name='Ingresos' isAnimationActive={!prefersReducedMotion} />
                      <Bar dataKey='gastos' fill='url(#gastosBarGradient)' radius={[4, 4, 0, 0]} name='Gastos' isAnimationActive={!prefersReducedMotion} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Bottom section: left column (savings + credit), right column (transactions) */}
      <div className='grid gap-6 lg:grid-cols-5 min-w-0'>
        {/* Left: stacked cards */}
        <div className='lg:col-span-2 flex flex-col gap-6 min-w-0'>
          <Card className='shadow-lg min-w-0 overflow-hidden'>
            <CardHeader>
              <CardTitle>Metas de Ahorros</CardTitle>
              <CardDescription>Progreso de ahorro hacia tus metas</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              {expensePlans.length > 0 ? (
                expensePlans.map((plan) => {
                  const progress = plan.target_amount > 0
                    ? (plan.current_amount / plan.target_amount) * 100
                    : 0;
                  return (
                    <div key={plan.id} className='space-y-2'>
                      <div className='flex justify-between items-center gap-2 flex-wrap'>
                        <span className='font-medium min-w-0 truncate'>{plan.name}</span>
                        <Badge variant='outline' className='shrink-0 tabular-nums text-xs'>
                          {formatAmount(plan.current_amount)} / {formatAmount(plan.target_amount)}
                        </Badge>
                      </div>
                      <Progress value={progress} className='h-2' />
                      <div className='text-sm text-gray-600'>
                        {progress.toFixed(1)}% completado
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className='text-center text-gray-500 py-4'>
                  No hay planes de gastos
                </div>
              )}
            </CardContent>
          </Card>

          <Card className='shadow-lg min-w-0 overflow-hidden'>
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
                        <div className='flex items-center gap-3 min-w-0'>
                          <CreditCard className={`h-4 w-4 shrink-0 ${isOverdue ? 'text-red-600' : 'text-blue-600'}`} aria-hidden="true" />
                          <div className='min-w-0'>
                            <div className='font-medium truncate'>{installment.purchase!.description}</div>
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

          {/* Inversiones activas */}
          {investments.filter((inv) => !inv.is_liquidated).length > 0 && (
            <Card className='shadow-lg min-w-0 overflow-hidden'>
              <CardHeader className='pb-3'>
                <CardTitle className='flex items-center justify-between'>
                  <span className='flex items-center gap-2'>
                    <div className='w-1 h-6 bg-gradient-to-b from-amber-500 to-orange-500 rounded-full' />
                    Inversiones Activas
                  </span>
                  <span className='text-sm font-normal text-gray-500'>
                    {formatAmount(
                      investments
                        .filter((inv) => !inv.is_liquidated)
                        .reduce((sum, inv) => sum + inv.amount, 0)
                    )}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-2'>
                {investments
                  .filter((inv) => !inv.is_liquidated)
                  .map((inv) => {
                    const typeLabels: Record<string, string> = {
                      plazo_fijo: 'Plazo Fijo',
                      fci: 'FCI',
                      bonos: 'Bonos',
                      acciones: 'Acciones',
                      crypto: 'Crypto',
                      letras: 'Letras',
                      cedears: 'CEDEARs',
                      cauciones: 'Cauciones',
                      fondos_comunes_inversion: 'FCI',
                      compra_divisas: 'Divisas',
                    };
                    return (
                      <div key={inv.id} className='flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800'>
                        <div className='min-w-0'>
                          <div className='text-sm font-medium truncate'>{inv.description}</div>
                          <div className='text-xs text-gray-500'>{typeLabels[inv.investment_type] ?? inv.investment_type}</div>
                        </div>
                        <div className='text-right flex-shrink-0 ml-3'>
                          <div className='text-sm font-semibold text-amber-600 dark:text-amber-400 tabular-nums'>
                            {formatAmount(inv.amount)}
                          </div>
                          {inv.annual_rate !== null && (
                            <div className='text-xs text-gray-500'>{inv.annual_rate}% TNA</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          )}

          {/* Préstamos activos */}
          {loans.filter((l) => l.status === 'active').length > 0 && (
            <Card className='shadow-lg min-w-0 overflow-hidden'>
              <CardHeader className='pb-3'>
                <CardTitle className='flex items-center gap-2'>
                  <div className='w-1 h-6 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full' />
                  Préstamos Activos
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-2'>
                {loans
                  .filter((l) => l.status === 'active')
                  .map((loan) => (
                    <div key={loan.id} className='flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800'>
                      <div className='min-w-0'>
                        <div className='text-sm font-medium truncate'>{loan.counterparty_name}</div>
                        <Badge
                          variant='outline'
                          className={`text-xs mt-0.5 ${
                            loan.loan_type === 'given'
                              ? 'border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400'
                              : 'border-violet-300 text-violet-600 dark:border-violet-700 dark:text-violet-400'
                          }`}
                        >
                          {loan.loan_type === 'given' ? 'Prestado' : 'Recibido'}
                        </Badge>
                      </div>
                      <div className='text-right flex-shrink-0 ml-3'>
                        <div className={`text-sm font-semibold tabular-nums ${
                          loan.loan_type === 'given' ? 'text-blue-600 dark:text-blue-400' : 'text-violet-600 dark:text-violet-400'
                        }`}>
                          {formatAmount(loan.total_amount)}
                        </div>
                        {loan.due_date && (
                          <div className='text-xs text-gray-500'>
                            {format(parseISO(loan.due_date), 'dd/MM/yyyy')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: transactions */}
        <div className='lg:col-span-3 flex flex-col min-w-0'>
          <Card className='flex-1 flex flex-col shadow-lg min-w-0 overflow-hidden'>
            <CardHeader>
              <CardTitle>Transacciones Recientes</CardTitle>
              <CardDescription>
                Últimas 10 transacciones registradas
              </CardDescription>
            </CardHeader>
            <CardContent className='flex-1 overflow-hidden'>
              <div className='space-y-2 overflow-y-auto h-full'>
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
                  className='flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors overflow-hidden'
                >
                  <div className='flex items-center gap-3 min-w-0 flex-1'>
                    {transaction.type === 'income' ? (
                      <ArrowUpCircle className='h-5 w-5 text-green-600 flex-shrink-0' aria-hidden="true" />
                    ) : (
                      <ArrowDownCircle className='h-5 w-5 text-red-600 flex-shrink-0' aria-hidden="true" />
                    )}
                    <div className='min-w-0'>
                      <div className='font-medium break-words'>{transaction.description}</div>
                      <div className='text-sm text-gray-600 flex items-center gap-2'>
                        <span className='truncate'>{transaction.category}</span>
                        <span>•</span>
                        <span className='flex-shrink-0'>
                          {format(parseISO(transaction.date), 'dd/MM/yyyy', {
                            locale: es,
                          })}
                        </span>
                      </div>
                      <div className='text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1'>
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
                    className={`font-semibold flex-shrink-0 text-right ${
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
      </div>
    </div>
  );
}
