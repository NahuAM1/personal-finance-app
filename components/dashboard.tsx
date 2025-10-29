'use client';

import { useState } from 'react';
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
  PieChart,
  Pie,
  Cell,
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

const COLORS = [
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#8884D8',
  '#82CA9D',
];

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
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Calendar className='h-5 w-5' />
            Filtrar por Período
          </CardTitle>
          <CardDescription>
            Selecciona el mes y año para ver los datos específicos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex gap-4'>
            <div className='flex-1'>
              <label className='text-sm font-medium mb-2 block'>Mes</label>
              <Select
                value={selectedMonth.toString()}
                onValueChange={(value) => setSelectedMonth(parseInt(value))}
              >
                <SelectTrigger>
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
              <label className='text-sm font-medium mb-2 block'>Año</label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => setSelectedYear(parseInt(value))}
              >
                <SelectTrigger>
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

      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Ingresos de {months[selectedMonth].label} {selectedYear}
            </CardTitle>
            <TrendingUp className='h-4 w-4 text-green-600' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-green-600'>
              ${totalIncome.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>
              Gastos de {months[selectedMonth].label} {selectedYear}
            </CardTitle>
            <TrendingDown className='h-4 w-4 text-red-600' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-red-600'>
              ${totalExpenses.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Balance Total</CardTitle>
            <DollarSign
              className={`h-4 w-4 ${
                balance >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                balance >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              ${balance.toLocaleString()}
            </div>
            {activeInvestmentsTotal > 0 && (
              <p className='text-xs text-gray-500 mt-1'>
                ${activeInvestmentsTotal.toLocaleString()} invertido
              </p>
            )}
          </CardContent>
        </Card>

        <Card className='bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border-blue-200 dark:border-blue-800'>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Balance Líquido</CardTitle>
            <DollarSign
              className={`h-4 w-4 ${
                liquidBalance >= 0 ? 'text-blue-600' : 'text-red-600'
              }`}
            />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                liquidBalance >= 0 ? 'text-blue-600' : 'text-red-600'
              }`}
            >
              ${liquidBalance.toLocaleString()}
            </div>
            <p className='text-xs text-blue-600 dark:text-blue-400 mt-1'>
              Dinero disponible para usar
            </p>
          </CardContent>
        </Card>
      </div>

      <div className='grid gap-6 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>Gastos por Categoría</CardTitle>
            <CardDescription>
              Distribución de gastos de {months[selectedMonth].label} {selectedYear}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={300}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray='3 3' />
                <XAxis dataKey='category' />
                <YAxis />
                <Tooltip
                  formatter={(value) => [
                    `$${Number(value).toLocaleString()}`,
                    'Monto',
                  ]}
                />
                <Bar dataKey='amount' fill='#8884d8' />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribución de Gastos</CardTitle>
            <CardDescription>Porcentaje por categoría - {months[selectedMonth].label} {selectedYear}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx='50%'
                  cy='50%'
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill='#8884d8'
                  dataKey='value'
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [
                    `$${Number(value).toLocaleString()}`,
                    'Monto',
                  ]}
                />
              </PieChart>
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
                      ${goal.current_amount.toLocaleString()} / $
                      {goal.target_amount.toLocaleString()}
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
                        <CreditCard className={`h-4 w-4 ${isOverdue ? 'text-red-600' : 'text-blue-600'}`} />
                        <div>
                          <div className='font-medium'>{installment.purchase!.description}</div>
                          <div className='text-sm text-gray-600'>
                            Cuota {installment.installment_number} de{' '}
                            {installment.purchase!.installments}
                          </div>
                        </div>
                      </div>
                      <div className='text-right'>
                        <div className='font-medium'>
                          ${installment.amount.toLocaleString()}
                        </div>
                        <div className={`text-sm flex items-center gap-1 ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                          <Calendar className='h-3 w-3' />
                          {format(parseISO(installment.due_date), 'dd/MM/yyyy')}
                          {isOverdue && ' ⚠️'}
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
            {transactions.slice(0, 10).map((transaction) => (
              <div
                key={transaction.id}
                className='flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
              >
                <div className='flex items-center gap-3'>
                  {transaction.type === 'income' ? (
                    <ArrowUpCircle className='h-5 w-5 text-green-600' />
                  ) : (
                    <ArrowDownCircle className='h-5 w-5 text-red-600' />
                  )}
                  <div>
                    <div className='font-medium'>{transaction.description}</div>
                    <div className='text-sm text-gray-600'>
                      {transaction.category} •{' '}
                      {format(parseISO(transaction.date), 'dd/MM/yyyy', {
                        locale: es,
                      })}
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
                  {transaction.type === 'income' ? '+' : '-'}$
                  {transaction.amount.toLocaleString()}
                </div>
              </div>
            ))}
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
