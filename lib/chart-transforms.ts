import { parseISO, format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Transaction } from '@/types/database';

export interface MonthlyTrendPoint {
  month: string;
  ingresos: number;
  gastos: number;
}

export interface BudgetSlice {
  name: string;
  value: number;
}

export interface BalancePoint {
  date: string;
  balance: number;
}

export function getMonthlyTrends(transactions: Transaction[], monthsBack: number): MonthlyTrendPoint[] {
  const now = new Date();
  const points: MonthlyTrendPoint[] = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const monthDate = subMonths(now, i);
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);

    const monthTransactions = transactions.filter((t) => {
      const date = parseISO(t.date);
      return isWithinInterval(date, { start, end });
    });

    const ingresos = monthTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const gastos = monthTransactions
      .filter((t) => t.type === 'expense' || t.type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0);

    points.push({
      month: format(monthDate, 'MMM yyyy', { locale: es }),
      ingresos,
      gastos,
    });
  }

  return points;
}

export function getBudgetDistribution(transactions: Transaction[]): BudgetSlice[] {
  const byCategory = transactions.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + t.amount;
    return acc;
  }, {});

  return Object.entries(byCategory).map(([name, value]) => ({ name, value }));
}

export function getBalanceEvolution(transactions: Transaction[], limit: number): BalancePoint[] {
  return transactions
    .filter((t): t is Transaction & { balance_total: number } => t.balance_total !== null)
    .slice(0, limit)
    .reverse()
    .map((t) => ({
      date: format(parseISO(t.date), 'dd/MM'),
      balance: t.balance_total,
    }));
}
