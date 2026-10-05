import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { DataQueryParams } from '@/types/agent';
import { getBaseCurrency, makeMoney, type MoneyFormatter } from '@/lib/agent/base-currency';

interface TransactionQueryRow {
  type: string;
  amount: number;
  category: string;
  description: string;
  date: string;
}

interface InvestmentQueryRow {
  investment_type: string;
  amount: number;
  description: string;
  is_liquidated: boolean;
  start_date: string;
  currency: string | null;
}

interface CreditPurchaseQueryRow {
  description: string;
  category: string;
  total_amount: number;
  installments: number;
  start_date: string;
}

interface SavingsGoalQueryRow {
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string;
  category: string;
}

function validateAndClampDates(params: DataQueryParams): { dateFrom: string; dateTo: string; compDateFrom: string | null; compDateTo: string | null } {
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];
  const todayStr = now.toISOString().split('T')[0];

  let dateFrom = params.dateFrom;
  let dateTo = params.dateTo;

  // Clamp to max 1 year lookback
  if (dateFrom < oneYearAgoStr) dateFrom = oneYearAgoStr;
  if (dateTo > todayStr) dateTo = todayStr;
  if (dateFrom > dateTo) dateFrom = dateTo;

  let compDateFrom = params.comparisonDateFrom;
  let compDateTo = params.comparisonDateTo;

  if (compDateFrom && compDateFrom < oneYearAgoStr) compDateFrom = oneYearAgoStr;
  if (compDateTo && compDateTo > todayStr) compDateTo = todayStr;

  return { dateFrom, dateTo, compDateFrom, compDateTo };
}

async function fetchTransactions(
  supabase: SupabaseClient<Database>,
  userId: string,
  dateFrom: string,
  dateTo: string,
  transactionType: string,
  category: string,
  queryIntent: string,
  money: MoneyFormatter,
): Promise<string> {
  let query = supabase
    .from('transactions')
    .select('type, amount, category, description, date')
    .eq('user_id', userId)
    .gte('date', dateFrom)
    .lte('date', dateTo)
    .order('date', { ascending: false });

  if (transactionType !== 'all') {
    query = query.eq('type', transactionType);
  }
  if (category !== 'all') {
    query = query.ilike('category', category);
  }

  if (queryIntent === 'list' || queryIntent === 'detail') {
    query = query.limit(50);
  }

  const { data, error } = await query;
  if (error) return `Error consultando transacciones: ${error.message}`;

  const transactions = (data ?? []) as TransactionQueryRow[];

  if (transactions.length === 0) {
    return `No se encontraron transacciones entre ${dateFrom} y ${dateTo}${transactionType !== 'all' ? ` de tipo ${transactionType}` : ''}${category !== 'all' ? ` en categoria ${category}` : ''}.`;
  }

  // Build summary
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalCredit = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);

  let result = `=== TRANSACCIONES (${dateFrom} a ${dateTo}) ===\n`;
  result += `Total transacciones encontradas: ${transactions.length}\n`;
  result += `Ingresos: ${money(totalIncome)}\n`;
  result += `Gastos: ${money(totalExpense)}\n`;
  if (totalCredit > 0) result += `Pagos tarjeta: ${money(totalCredit)}\n`;
  result += `Balance: ${money((totalIncome - totalExpense - totalCredit))}\n\n`;

  // Category breakdown
  if (queryIntent === 'sum' || queryIntent === 'compare' || queryIntent === 'trend') {
    const byCategory: Record<string, { total: number; count: number }> = {};
    for (const t of transactions) {
      if (!byCategory[t.category]) byCategory[t.category] = { total: 0, count: 0 };
      byCategory[t.category].total += t.amount;
      byCategory[t.category].count += 1;
    }
    result += 'Desglose por categoria:\n';
    const sorted = Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total);
    for (const [cat, info] of sorted) {
      result += `- ${cat}: ${money(info.total)} (${info.count} transacciones)\n`;
    }
    result += '\n';
  }

  // Monthly breakdown for trend intent
  if (queryIntent === 'trend' || queryIntent === 'compare') {
    const byMonth: Record<string, { income: number; expense: number; credit: number; count: number }> = {};
    for (const t of transactions) {
      const monthKey = t.date.substring(0, 7); // YYYY-MM
      if (!byMonth[monthKey]) byMonth[monthKey] = { income: 0, expense: 0, credit: 0, count: 0 };
      if (t.type === 'income') byMonth[monthKey].income += t.amount;
      else if (t.type === 'expense') byMonth[monthKey].expense += t.amount;
      else if (t.type === 'credit') byMonth[monthKey].credit += t.amount;
      byMonth[monthKey].count += 1;
    }
    result += 'Evolucion mes a mes:\n';
    const sortedMonths = Object.keys(byMonth).sort();
    for (const mk of sortedMonths) {
      const m = byMonth[mk];
      const balance = m.income - m.expense - m.credit;
      result += `- ${mk}: Ingresos ${money(m.income)} | Gastos ${money(m.expense)}${m.credit > 0 ? ` | Tarjeta ${money(m.credit)}` : ''} | Balance ${money(balance)}\n`;
    }
    result += '\n';
  }

  // Transaction list for detail/list intent
  if (queryIntent === 'list' || queryIntent === 'detail') {
    result += 'Detalle de transacciones:\n';
    for (const t of transactions) {
      const sign = t.type === 'income' ? '+' : '-';
      result += `[${t.date}] ${sign}${money(t.amount)} | ${t.category} | ${t.description}\n`;
    }
  }

  return result;
}

async function fetchInvestments(
  supabase: SupabaseClient<Database>,
  userId: string,
  dateFrom: string,
  dateTo: string,
  money: MoneyFormatter,
): Promise<string> {
  const { data, error } = await supabase
    .from('investments')
    .select('investment_type, amount, description, is_liquidated, start_date, currency')
    .eq('user_id', userId)
    .gte('start_date', dateFrom)
    .lte('start_date', dateTo)
    .order('start_date', { ascending: false })
    .limit(50);

  if (error) return `Error consultando inversiones: ${error.message}`;

  const investments = (data ?? []) as InvestmentQueryRow[];
  if (investments.length === 0) return `No se encontraron inversiones entre ${dateFrom} y ${dateTo}.`;

  const total = investments.reduce((s, i) => s + i.amount, 0);
  let result = `=== INVERSIONES (${dateFrom} a ${dateTo}) ===\n`;
  result += `Total invertido: ${money(total)} en ${investments.length} inversiones\n\n`;

  for (const inv of investments) {
    result += `- [${inv.start_date}] ${inv.investment_type}: ${money(inv.amount)} | ${inv.description}`;
    if (inv.currency) result += ` (${inv.currency})`;
    result += ` | ${inv.is_liquidated ? 'Liquidada' : 'Activa'}\n`;
  }

  return result;
}

async function fetchCreditPurchases(
  supabase: SupabaseClient<Database>,
  userId: string,
  dateFrom: string,
  dateTo: string,
  money: MoneyFormatter,
): Promise<string> {
  const { data, error } = await supabase
    .from('credit_purchases')
    .select('description, category, total_amount, installments, start_date')
    .eq('user_id', userId)
    .gte('start_date', dateFrom)
    .lte('start_date', dateTo)
    .order('start_date', { ascending: false })
    .limit(50);

  if (error) return `Error consultando compras en cuotas: ${error.message}`;

  const purchases = (data ?? []) as CreditPurchaseQueryRow[];
  if (purchases.length === 0) return `No se encontraron compras en cuotas entre ${dateFrom} y ${dateTo}.`;

  const total = purchases.reduce((s, p) => s + p.total_amount, 0);
  let result = `=== COMPRAS EN CUOTAS (${dateFrom} a ${dateTo}) ===\n`;
  result += `Total: ${money(total)} en ${purchases.length} compras\n\n`;

  for (const p of purchases) {
    result += `- [${p.start_date}] ${p.description}: ${money(p.total_amount)} en ${p.installments} cuotas | ${p.category}\n`;
  }

  return result;
}

async function fetchSavingsGoals(
  supabase: SupabaseClient<Database>,
  userId: string,
  money: MoneyFormatter,
): Promise<string> {
  const { data, error } = await supabase
    .from('expense_plans')
    .select('name, target_amount, current_amount, deadline, category')
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (error) return `Error consultando metas de ahorro: ${error.message}`;

  const goals = (data ?? []) as SavingsGoalQueryRow[];
  if (goals.length === 0) return 'No se encontraron metas de ahorro activas.';

  let result = '=== METAS DE AHORRO ===\n';
  for (const g of goals) {
    const progress = g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0;
    result += `- ${g.name}: ${money(g.current_amount)} / ${money(g.target_amount)} (${progress}%) | Fecha: ${g.deadline} | ${g.category}\n`;
  }

  return result;
}

export async function fetchDataForQuery(
  supabase: SupabaseClient<Database>,
  userId: string,
  params: DataQueryParams,
): Promise<string> {
  const { dateFrom, dateTo, compDateFrom, compDateTo } = validateAndClampDates(params);
  const parts: string[] = [];
  const baseCurrency = await getBaseCurrency(supabase, userId);
  const money = makeMoney(baseCurrency);
  parts.push(`Moneda base: ${baseCurrency}. Todos los montos están expresados en ${baseCurrency}.`);

  const scope = params.dataScope;

  if (scope === 'all' || scope === 'transactions') {
    parts.push(await fetchTransactions(supabase, userId, dateFrom, dateTo, params.transactionType, params.category, params.queryIntent, money));
  }

  if (scope === 'all' || scope === 'investments') {
    parts.push(await fetchInvestments(supabase, userId, dateFrom, dateTo, money));
  }

  if (scope === 'all' || scope === 'credit_purchases') {
    parts.push(await fetchCreditPurchases(supabase, userId, dateFrom, dateTo, money));
  }

  if (scope === 'all' || scope === 'savings_goals') {
    parts.push(await fetchSavingsGoals(supabase, userId, money));
  }

  // Comparison period
  if (compDateFrom && compDateTo && params.queryIntent === 'compare') {
    parts.push('\n=== PERIODO DE COMPARACION ===');
    if (scope === 'all' || scope === 'transactions') {
      parts.push(await fetchTransactions(supabase, userId, compDateFrom, compDateTo, params.transactionType, params.category, 'sum', money));
    }
    if (scope === 'all' || scope === 'investments') {
      parts.push(await fetchInvestments(supabase, userId, compDateFrom, compDateTo, money));
    }
    if (scope === 'all' || scope === 'credit_purchases') {
      parts.push(await fetchCreditPurchases(supabase, userId, compDateFrom, compDateTo, money));
    }
  }

  return parts.filter(Boolean).join('\n\n');
}
