import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { detectRecurringPatterns, formatPatterns } from '@/lib/agent/pattern-detector';
import { getBaseCurrency, makeMoney } from '@/lib/agent/base-currency';

interface TransactionRow {
  id?: string;
  type: string;
  amount: number;
  category: string;
  description: string;
  date: string;
}

interface ExpensePlanRow {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string;
  category: string;
}

interface InvestmentRow {
  investment_type: string;
  amount: number;
  description: string;
  is_liquidated: boolean;
  currency: string | null;
}

interface CreditInstallmentRow {
  installment_number: number;
  due_date: string;
  amount: number;
  credit_purchase_id: string;
}

interface CreditPurchaseRow {
  id: string;
  description: string;
  category: string;
  installments: number;
}

/**
 * Builds the full financial context string for the AI agent.
 * Incluye: resumen del mes, gastos por categoría, comparación mes anterior,
 * cuotas de tarjeta, metas de ahorro, inversiones, gastos destacables,
 * perfil de riesgo, scoring, patrones, adherencia a presupuestos.
 */
export async function buildUserFinancialContext(
  supabase: SupabaseClient<Database>,
  userId: string,
  includeTransactionIds = false,
): Promise<string> {
  const baseCurrency = await getBaseCurrency(supabase, userId);
  const money = makeMoney(baseCurrency);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const startOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // Previous month dates
  const prevMonth = new Date(year, month - 1, 1);
  const prevYear = prevMonth.getFullYear();
  const prevMonthIndex = prevMonth.getMonth();
  const startOfPrevMonth = `${prevYear}-${String(prevMonthIndex + 1).padStart(2, '0')}-01`;
  const prevLastDay = new Date(prevYear, prevMonthIndex + 1, 0).getDate();
  const endOfPrevMonth = `${prevYear}-${String(prevMonthIndex + 1).padStart(2, '0')}-${String(prevLastDay).padStart(2, '0')}`;

  // 6-month lookback for trend analysis
  const sixMonthsAgo = new Date(year, month - 6, 1);
  const sixMonthsAgoStr = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;

  const [
    transactionsResult,
    prevTransactionsResult,
    historyResult,
    plansResult,
    investmentsResult,
    creditPurchasesResult,
  ] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, type, amount, category, description, date')
      .eq('user_id', userId)
      .gte('date', startOfMonth)
      .lte('date', endOfMonth)
      .order('date', { ascending: false }),
    supabase
      .from('transactions')
      .select('type, amount, category, description, date')
      .eq('user_id', userId)
      .gte('date', startOfPrevMonth)
      .lte('date', endOfPrevMonth),
    // Last 6 months aggregate (exclusive of current month to avoid overlap)
    supabase
      .from('transactions')
      .select('type, amount, date')
      .eq('user_id', userId)
      .gte('date', sixMonthsAgoStr)
      .lt('date', startOfMonth),
    supabase
      .from('expense_plans')
      .select('id, name, target_amount, current_amount, deadline, category')
      .eq('user_id', userId)
      .is('deleted_at', null),
    supabase
      .from('investments')
      .select('investment_type, amount, description, is_liquidated, currency')
      .eq('user_id', userId)
      .eq('is_liquidated', false),
    supabase
      .from('credit_purchases')
      .select('id, description, category, installments')
      .eq('user_id', userId),
  ]);

  const transactions = (transactionsResult.data ?? []) as TransactionRow[];
  const prevTransactions = (prevTransactionsResult.data ?? []) as TransactionRow[];
  const plans = (plansResult.data ?? []) as ExpensePlanRow[];
  const investments = (investmentsResult.data ?? []) as InvestmentRow[];
  const creditPurchases = (creditPurchasesResult.data ?? []) as CreditPurchaseRow[];

  // Query installments filtered by user's purchases
  const purchaseIds = creditPurchases.map(p => p.id);
  let unpaidInstallments: CreditInstallmentRow[] = [];
  if (purchaseIds.length > 0) {
    const todayStr = now.toISOString().split('T')[0];
    const { data: installmentsData } = await supabase
      .from('credit_installments')
      .select('installment_number, due_date, amount, credit_purchase_id')
      .eq('paid', false)
      .in('credit_purchase_id', purchaseIds)
      .gte('due_date', todayStr)
      .order('due_date', { ascending: true })
      .limit(30);
    unpaidInstallments = (installmentsData ?? []) as CreditInstallmentRow[];
  }

  // Current month calculations
  const expenses = transactions.filter(t => t.type === 'expense');
  const incomes = transactions.filter(t => t.type === 'income');
  const credits = transactions.filter(t => t.type === 'credit');
  const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = incomes.reduce((sum, t) => sum + t.amount, 0);
  const totalCredit = credits.reduce((sum, t) => sum + t.amount, 0);

  // Previous month calculations
  const prevExpenses = prevTransactions.filter(t => t.type === 'expense');
  const prevIncomes = prevTransactions.filter(t => t.type === 'income');
  const totalPrevExpenses = prevExpenses.reduce((sum, t) => sum + t.amount, 0);
  const totalPrevIncome = prevIncomes.reduce((sum, t) => sum + t.amount, 0);

  const expensesByCategory: Record<string, { total: number; count: number; items: string[] }> = {};
  for (const t of expenses) {
    if (!expensesByCategory[t.category]) {
      expensesByCategory[t.category] = { total: 0, count: 0, items: [] };
    }
    expensesByCategory[t.category].total += t.amount;
    expensesByCategory[t.category].count += 1;
    if (expensesByCategory[t.category].items.length < 3) {
      expensesByCategory[t.category].items.push(t.description);
    }
  }

  // Previous month expenses by category
  const prevExpensesByCategory: Record<string, number> = {};
  for (const t of prevExpenses) {
    prevExpensesByCategory[t.category] = (prevExpensesByCategory[t.category] ?? 0) + t.amount;
  }

  const monthName = now.toLocaleString('es-AR', { month: 'long', year: 'numeric' });

  const parts: string[] = [];

  // === SUMMARY ===
  let summary = `<summary month="${monthName}" currency="${baseCurrency}">\n`;
  summary += `Moneda base: ${baseCurrency}. Todos los montos están expresados en ${baseCurrency} (los movimientos en otra moneda ya fueron convertidos).\n`;
  summary += `Ingresos: ${money(totalIncome)}\n`;
  summary += `Gastos: ${money(totalExpenses)}\n`;
  summary += `Tarjeta: ${money(totalCredit)}\n`;
  summary += `Balance: ${money((totalIncome - totalExpenses - totalCredit))}\n`;
  summary += `</summary>`;
  parts.push(summary);

  // === CATEGORY BREAKDOWN ===
  if (Object.keys(expensesByCategory).length > 0) {
    let cats = '<categories>\n';
    const sorted = Object.entries(expensesByCategory).sort((a, b) => b[1].total - a[1].total);
    for (const [category, data] of sorted) {
      cats += `<category name="${category}" total="${data.total}" count="${data.count}"`;
      if (data.items.length > 0) {
        cats += ` examples="${data.items.join(', ')}"`;
      }
      cats += ` />\n`;
    }
    cats += '</categories>';
    parts.push(cats);
  }

  // Category changes
  const allCategoriesArray = Array.from(new Set([...Object.keys(expensesByCategory), ...Object.keys(prevExpensesByCategory)]));
  const categoryChanges: { category: string; change: number; current: number; previous: number }[] = [];
  for (const cat of allCategoriesArray) {
    const currentCat = expensesByCategory[cat]?.total ?? 0;
    const previousCat = prevExpensesByCategory[cat] ?? 0;
    if (previousCat > 0) {
      const change = Math.round(((currentCat - previousCat) / previousCat) * 100);
      categoryChanges.push({ category: cat, change, current: currentCat, previous: previousCat });
    } else if (currentCat > 0) {
      categoryChanges.push({ category: cat, change: 100, current: currentCat, previous: 0 });
    }
  }

  // === MONTH OVER MONTH ===
  if (totalPrevExpenses > 0 || totalPrevIncome > 0) {
    const prevMonthName = prevMonth.toLocaleString('es-AR', { month: 'long' });
    const expenseChange = totalPrevExpenses > 0
      ? Math.round(((totalExpenses - totalPrevExpenses) / totalPrevExpenses) * 100)
      : 0;

    let comparison = `<comparison prev_month="${prevMonthName}">\n`;
    comparison += `Gastos anterior: ${money(totalPrevExpenses)} | Actual: ${money(totalExpenses)} (${expenseChange >= 0 ? '+' : ''}${expenseChange}%)\n`;
    comparison += `Ingresos anterior: ${money(totalPrevIncome)} | Actual: ${money(totalIncome)}\n`;

    const increases = categoryChanges.filter(c => c.change > 0).sort((a, b) => b.change - a.change).slice(0, 3);
    const decreases = categoryChanges.filter(c => c.change < 0).sort((a, b) => a.change - b.change).slice(0, 3);

    if (increases.length > 0) {
      comparison += `Subieron: ${increases.map(c => `${c.category} (+${c.change}%)`).join(', ')}\n`;
    }
    if (decreases.length > 0) {
      comparison += `Bajaron: ${decreases.map(c => `${c.category} (${c.change}%)`).join(', ')}\n`;
    }

    const prevBalance = totalPrevIncome - totalPrevExpenses;
    const currentBalance = totalIncome - totalExpenses - totalCredit;
    const trend = currentBalance >= prevBalance ? 'Mejorando' : 'Empeorando';
    comparison += `Tendencia: ${money(prevBalance)} → ${money(currentBalance)} (${trend})\n`;
    comparison += '</comparison>';
    parts.push(comparison);
  }

  // === RECENT TRANSACTIONS ===
  if (transactions.length > 0) {
    let txns = '<recent_transactions>\n';
    for (const t of transactions.slice(0, 15)) {
      const sign = t.type === 'income' ? '+' : '-';
      const idPart = (includeTransactionIds && t.id) ? ` id="${t.id}"` : '';
      txns += `<transaction date="${t.date}"${idPart} amount="${sign}${money(t.amount)}" type="${t.type}" category="${t.category}" description="${t.description}" />\n`;
    }
    txns += '</recent_transactions>';
    parts.push(txns);
  }

  // === CREDIT INSTALLMENTS ===
  if (unpaidInstallments.length > 0) {
    const purchaseLookup: Record<string, CreditPurchaseRow> = {};
    for (const p of creditPurchases) {
      purchaseLookup[p.id] = p;
    }

    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const byMonth: Record<string, CreditInstallmentRow[]> = {};
    for (const inst of unpaidInstallments) {
      const key = inst.due_date.substring(0, 7);
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(inst);
    }

    let instSection = '<credit_installments>\n';
    const sortedMonths = Object.keys(byMonth).sort();
    for (const monthKey of sortedMonths) {
      const monthInstallments = byMonth[monthKey];
      const monthTotal = monthInstallments.reduce((sum, inst) => sum + inst.amount, 0);
      const [y, m] = monthKey.split('-');
      const monthLabel = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString('es-AR', { month: 'long', year: 'numeric' });
      const tag = monthKey === currentMonthKey ? ' (este mes)' : monthKey > currentMonthKey ? ` (mes ${sortedMonths.indexOf(monthKey) - sortedMonths.indexOf(currentMonthKey)} adelante)` : '';

      instSection += `<month name="${monthLabel}"${tag} total="${monthTotal}">\n`;
      for (const inst of monthInstallments) {
        const purchase = purchaseLookup[inst.credit_purchase_id];
        if (purchase) {
          instSection += `  <installment number="${inst.installment_number}/${purchase.installments}" amount="${inst.amount}" due="${inst.due_date}" description="${purchase.description}" />\n`;
        }
      }
      instSection += `</month>\n`;
    }
    instSection += '</credit_installments>';
    parts.push(instSection);
  }

  // === SAVINGS GOALS ===
  if (plans.length > 0) {
    let goals = '<savings_goals>\n';
    for (const p of plans) {
      const progress = p.target_amount > 0 ? Math.round((p.current_amount / p.target_amount) * 100) : 0;
      goals += `<goal id="${p.id}" name="${p.name}" current="${p.current_amount}" target="${p.target_amount}" progress="${progress}%" deadline="${p.deadline}" />\n`;
    }
    goals += '</savings_goals>';
    parts.push(goals);
  }

  // === INVESTMENTS ===
  if (investments.length > 0) {
    const totalInvestments = investments.reduce((sum, inv) => sum + inv.amount, 0);
    let invs = '<investments>\n';
    for (const inv of investments) {
      invs += `<investment type="${inv.investment_type}" amount="${inv.amount}" description="${inv.description}"${inv.currency ? ` currency="${inv.currency}"` : ''} />\n`;
    }
    invs += `Total: ${money(totalInvestments)}\n`;
    invs += '</investments>';
    parts.push(invs);

    // Detect broker/platform from investment descriptions
    const brokerPatterns = [
      { name: 'IOL', patterns: ['iol', 'invertir online', 'invertironline'] },
      { name: 'Bull Market', patterns: ['bull market', 'bullmarket', 'bull'] },
      { name: 'PPI', patterns: ['ppi', 'portfolio personal'] },
      { name: 'Cocos', patterns: ['cocos', 'cocos capital'] },
      { name: 'Balanz', patterns: ['balanz'] },
      { name: 'Adcap', patterns: ['adcap'] },
      { name: 'Rava', patterns: ['rava'] },
      { name: 'ByMA', patterns: ['byma'] },
    ];
    const allDescriptions = investments.map(i => i.description?.toLowerCase() ?? '').join(' ');
    const foundBroker = brokerPatterns.find(b => b.patterns.some(p => allDescriptions.includes(p)));
    if (foundBroker) {
      parts.push(`<user_broker>${foundBroker.name}</user_broker>`);
    }
  }

  // === NOTABLE EXPENSES ===
  if (totalIncome > 0 && expenses.length > 0) {
    const significantExpenses = expenses.filter(t => t.amount > totalIncome * 0.10);
    const categoryGroups: Record<string, { count: number; total: number; avgAmount: number }> = {};
    for (const t of expenses) {
      if (!categoryGroups[t.category]) {
        categoryGroups[t.category] = { count: 0, total: 0, avgAmount: 0 };
      }
      categoryGroups[t.category].count += 1;
      categoryGroups[t.category].total += t.amount;
    }
    for (const cat of Object.keys(categoryGroups)) {
      categoryGroups[cat].avgAmount = Math.round(categoryGroups[cat].total / categoryGroups[cat].count);
    }

    const antExpenses = Object.entries(categoryGroups)
      .filter(([, data]) => data.count >= 5 && data.avgAmount < totalIncome * 0.05);

    const risingCategories = categoryChanges.filter(c => c.change > 30);

    if (significantExpenses.length > 0 || antExpenses.length > 0 || risingCategories.length > 0) {
      let notable = '<notable_expenses>\n';

      if (significantExpenses.length > 0) {
        notable += '<significant>(>10% del ingreso)\n';
        for (const t of significantExpenses.slice(0, 5)) {
          const pct = Math.round((t.amount / totalIncome) * 100);
          notable += `  ${t.date}: ${money(t.amount)} | ${t.category} | ${t.description} (${pct}% del ingreso)\n`;
        }
        notable += '</significant>\n';
      }

      if (antExpenses.length > 0) {
        notable += '<ant_expenses>(5+ transacciones pequeñas en misma categoría)\n';
        for (const [cat, data] of antExpenses) {
          notable += `  ${cat}: ${data.count} transacciones, ${money(data.total)} (promedio ${money(data.avgAmount)})\n`;
        }
        notable += '</ant_expenses>\n';
      }

      if (risingCategories.length > 0) {
        notable += '<rising>(>30% vs mes anterior)\n';
        for (const c of risingCategories) {
          notable += `  ${c.category}: +${c.change}% (${money(c.previous)} → ${money(c.current)})\n`;
        }
        notable += '</rising>\n';
      }

      notable += '</notable_expenses>';
      parts.push(notable);
    }
  }

  // === RISK PROFILE ===
  let riskProfile = 'Sin inversiones';
  if (investments.length > 0) {
    const conservativeTypes = new Set(['plazo_fijo', 'fci', 'cauciones', 'letras']);
    const aggressiveTypes = new Set(['crypto', 'acciones', 'cedears']);
    const hasConservative = investments.some(inv => conservativeTypes.has(inv.investment_type));
    const hasAggressive = investments.some(inv => aggressiveTypes.has(inv.investment_type));

    if (hasConservative && hasAggressive) {
      riskProfile = 'Moderado';
    } else if (hasAggressive) {
      riskProfile = 'Agresivo';
    } else {
      riskProfile = 'Conservador';
    }
  }

  const savingsRate = totalIncome > 0
    ? Math.round(((totalIncome - totalExpenses - totalCredit) / totalIncome) * 100)
    : 0;

  const surplus = totalIncome - totalExpenses - totalCredit;
  const top3Categories = Object.entries(expensesByCategory)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 3);

  // Upcoming installments total (next 30 days)
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0];
  const userInstallments = unpaidInstallments.filter(inst => {
    const purchase = creditPurchases.find(p => p.id === inst.credit_purchase_id);
    return purchase && inst.due_date <= thirtyDaysStr;
  });
  const upcomingInstallmentsTotal = userInstallments.reduce((sum, inst) => sum + inst.amount, 0);

  const dayOfMonth = now.getDate();
  const hasSavingsGoals = plans.length > 0;

  let precomputed = '<precomputed>\n';
  precomputed += `Surplus: ${money(surplus)}\n`;
  if (top3Categories.length > 0) {
    precomputed += `Top3: ${top3Categories.map(([cat, data], i) => `${i + 1}. ${cat} (${money(data.total)})`).join(', ')}\n`;
  }
  precomputed += `Installments_30d: ${money(upcomingInstallmentsTotal)} (${userInstallments.length} cuotas)\n`;
  precomputed += `Day_of_month: ${dayOfMonth}/30\n`;
  precomputed += `Has_emergency_fund: ${hasSavingsGoals ? 'Yes' : 'No'}\n`;
  precomputed += '</precomputed>';

  const partsFinal: string[] = [
    ...parts,
    precomputed,
  ];

  // === SCORING ===
  let savingsScore = 0;
  if (savingsRate > 20) savingsScore = 3;
  else if (savingsRate >= 10) savingsScore = 2;
  else if (savingsRate > 0) savingsScore = 1;

  const prevBalance = totalPrevIncome - totalPrevExpenses;
  const currentBalance = totalIncome - totalExpenses - totalCredit;
  let trendScore = 1;
  let trendLabel = 'Estable';
  if (currentBalance > prevBalance * 1.1) { trendScore = 2; trendLabel = 'Mejorando'; }
  else if (currentBalance < prevBalance * 0.9) { trendScore = 0; trendLabel = 'Empeorando'; }

  const investmentScore = investments.length > 0 ? 2 : 0;
  const debtPct = totalIncome > 0 ? Math.round((upcomingInstallmentsTotal / totalIncome) * 100) : 0;
  let debtScore = 0;
  if (debtPct < 20) debtScore = 2;
  else if (debtPct <= 40) debtScore = 1;
  const emergencyScore = hasSavingsGoals ? 1 : 0;
  const totalScore = savingsScore + trendScore + investmentScore + debtScore + emergencyScore;

  let scoring = '<scoring>\n';
  scoring += `Savings_rate: ${savingsRate}% (pts: ${savingsScore}/3)\n`;
  scoring += `Trend: ${trendLabel} (pts: ${trendScore}/2)\n`;
  scoring += `Investments: ${investments.length > 0 ? 'Yes' : 'No'} (pts: ${investmentScore}/2)\n`;
  scoring += `Debt: ${debtPct}% income (pts: ${debtScore}/2)\n`;
  scoring += `Emergency_fund: ${hasSavingsGoals ? 'Yes' : 'No'} (pts: ${emergencyScore}/1)\n`;
  scoring += `Total_score: ${totalScore}/10\n`;
  scoring += '</scoring>';

  partsFinal.push(scoring);

  // === RECURRING PATTERNS ===
  const allTransactionsForPatterns = [...transactions, ...prevTransactions];
  const patterns = detectRecurringPatterns(allTransactionsForPatterns);
  if (patterns.length > 0) {
    partsFinal.push(`<patterns>\n${formatPatterns(patterns, money)}\n</patterns>`);
  }

  // === BUDGET ADHERENCE ===
  if (plans.length > 0 && Object.keys(expensesByCategory).length > 0) {
    const budgetLines: string[] = [];
    for (const plan of plans) {
      const categoryExpense = expensesByCategory[plan.category]?.total ?? 0;
      if (plan.target_amount > 0) {
        const pct = Math.round((categoryExpense / plan.target_amount) * 100);
        let statusLabel = 'On_track';
        if (pct >= 100) statusLabel = 'EXCEEDED';
        else if (pct >= 90) statusLabel = 'NEAR_LIMIT';
        else if (pct >= 75) statusLabel = 'WATCH';
        budgetLines.push(`<budget category="${plan.category}" name="${plan.name}" spent="${categoryExpense}" budget="${plan.target_amount}" pct="${pct}" status="${statusLabel}" />`);
      }
    }
    if (budgetLines.length > 0) {
      partsFinal.push(`<budgets>\n${budgetLines.join('\n')}\n</budgets>`);
    }
  }

  return partsFinal.join('\n\n');
}
