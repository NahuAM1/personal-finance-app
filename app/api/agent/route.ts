import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { USER_ROLES } from '@/types/database';
import type { UserRole } from '@/types/database';
import { AgentAction } from '@/types/agent';
import type { AgentActionType, AgentExecuteResponse, AgentPayload, ConversationMessage } from '@/types/agent';
import OpenAI from 'openai';
import { OpenAIModels } from '@/public/enums';
import { buildClassifierPrompt } from '@/lib/agent/classifier-prompt';
import { getStrategy } from '@/lib/agent/strategies';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE_URL,
});

function parseJsonFromAI(raw: string): string {
  const jsonMatch =
    raw.match(/```json([\s\S]*?)```/) ||
    raw.match(/```([\s\S]*?)```/) ||
    raw.match(/\{[\s\S]*\}/);

  return jsonMatch
    ? jsonMatch[1]?.trim() || jsonMatch[0].trim()
    : raw;
}

interface TransactionRow {
  type: string;
  amount: number;
  category: string;
  description: string;
  date: string;
}

interface ExpensePlanRow {
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

function serializeHistory(history: ConversationMessage[]): string {
  return history
    .map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
    .join('\n');
}

// --- Classify using NVIDIA free model (no quota limits) ---
async function classifyWithNvidia(
  transcription: string,
  conversationHistory?: ConversationMessage[],
): Promise<{ action: AgentActionType; confidence: number }> {
  const prompt = buildClassifierPrompt(transcription, conversationHistory);

  const response = await openai.chat.completions.create({
    model: OpenAIModels.NVIDIA,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
  });

  const rawContent = response.choices[0]?.message?.content ?? '';
  const cleanJson = parseJsonFromAI(rawContent);
  return JSON.parse(cleanJson);
}

// --- Execute using NVIDIA free LLM ---
async function executeWithNvidia(
  prompt: string,
  conversationHistory?: ConversationMessage[],
): Promise<string> {
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

  if (conversationHistory && conversationHistory.length > 0) {
    messages.push({
      role: 'system',
      content: `Historial de conversación:\n${serializeHistory(conversationHistory)}`,
    });
  }

  messages.push({ role: 'user', content: prompt });

  const response = await openai.chat.completions.create({
    model: OpenAIModels.NVIDIA,
    messages,
    temperature: 0.2,
  });

  return response.choices[0]?.message?.content ?? '';
}

// --- Build insight for DB action confirmations ---
function buildInsightPrompt(
  action: AgentActionType,
  payload: AgentPayload,
  financialContext: string,
): string {
  const actionDescriptions: Partial<Record<AgentActionType, string>> = {
    [AgentAction.ADD_EXPENSE]: `Gasto de $${(payload as { amount: number }).amount.toLocaleString('es-AR')} en ${(payload as { category: string }).category}`,
    [AgentAction.ADD_INCOME]: `Ingreso de $${(payload as { amount: number }).amount.toLocaleString('es-AR')} en ${(payload as { category: string }).category}`,
    [AgentAction.CREATE_SAVINGS_GOAL]: `Meta de ahorro "${(payload as { name: string }).name}" por $${(payload as { targetAmount: number }).targetAmount.toLocaleString('es-AR')}`,
    [AgentAction.CREDIT_PURCHASE]: `Compra en ${(payload as { installments: number }).installments} cuotas por $${(payload as { totalAmount: number }).totalAmount.toLocaleString('es-AR')}`,
    [AgentAction.CREATE_INVESTMENT]: `Inversión de $${(payload as { amount: number }).amount.toLocaleString('es-AR')} en ${(payload as { investmentType: string }).investmentType}`,
  };

  const desc = actionDescriptions[action] ?? 'Acción detectada';

  return `Sos SmartPocket. Generá un mensaje de confirmación breve (1-2 oraciones) para esta acción:

Acción: ${desc}

Datos financieros del usuario:
${financialContext}

Reglas:
- Confirmá la acción detectada
- Agregá un insight basado en datos reales (ej: "Ya llevás $X en esa categoría este mes" o "Esto representa el X% de tus ingresos")
- Si no hay datos suficientes para un insight, solo confirmá la acción
- Español rioplatense, texto plano, sin markdown
- Montos con formato $X.XXX
- Máximo 2 oraciones

Respondé ÚNICAMENTE con un JSON válido:
{"message": "tu mensaje acá"}`;
}

// --- Build user financial context ---
async function buildUserFinancialContext(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
): Promise<string> {
  const now = new Date();
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const endOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`;

  // Previous month dates
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfPrevMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-01`;
  const endOfPrevMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-31`;

  const [
    transactionsResult,
    prevTransactionsResult,
    plansResult,
    investmentsResult,
    unpaidInstallmentsResult,
    creditPurchasesResult,
  ] = await Promise.all([
    supabase
      .from('transactions')
      .select('type, amount, category, description, date')
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
    supabase
      .from('expense_plans')
      .select('name, target_amount, current_amount, deadline, category')
      .eq('user_id', userId)
      .is('deleted_at', null),
    supabase
      .from('investments')
      .select('investment_type, amount, description, is_liquidated, currency')
      .eq('user_id', userId)
      .eq('is_liquidated', false),
    supabase
      .from('credit_installments')
      .select('installment_number, due_date, amount, credit_purchase_id')
      .eq('paid', false)
      .order('due_date', { ascending: true })
      .limit(10),
    supabase
      .from('credit_purchases')
      .select('id, description, category, installments')
      .eq('user_id', userId),
  ]);

  const transactions = (transactionsResult.data ?? []) as TransactionRow[];
  const prevTransactions = (prevTransactionsResult.data ?? []) as TransactionRow[];
  const plans = (plansResult.data ?? []) as ExpensePlanRow[];
  const investments = (investmentsResult.data ?? []) as InvestmentRow[];
  const unpaidInstallments = (unpaidInstallmentsResult.data ?? []) as CreditInstallmentRow[];
  const creditPurchases = (creditPurchasesResult.data ?? []) as CreditPurchaseRow[];

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

  let context = `=== RESUMEN FINANCIERO DEL MES (${monthName}) ===\n`;
  context += `Total de ingresos: $${totalIncome.toLocaleString('es-AR')}\n`;
  context += `Total de gastos: $${totalExpenses.toLocaleString('es-AR')}\n`;
  context += `Total pagos tarjeta: $${totalCredit.toLocaleString('es-AR')}\n`;
  context += `Balance del mes: $${(totalIncome - totalExpenses - totalCredit).toLocaleString('es-AR')}\n\n`;

  if (Object.keys(expensesByCategory).length > 0) {
    context += '=== GASTOS POR CATEGORÍA (este mes) ===\n';
    const sorted = Object.entries(expensesByCategory).sort((a, b) => b[1].total - a[1].total);
    for (const [category, data] of sorted) {
      context += `- ${category}: $${data.total.toLocaleString('es-AR')} (${data.count} transacciones)`;
      if (data.items.length > 0) {
        context += ` | Ejemplos: ${data.items.join(', ')}`;
      }
      context += '\n';
    }
    context += '\n';
  }

  // Comparison with previous month
  if (totalPrevExpenses > 0 || totalPrevIncome > 0) {
    const prevMonthName = prevMonth.toLocaleString('es-AR', { month: 'long' });
    const expenseChange = totalPrevExpenses > 0
      ? Math.round(((totalExpenses - totalPrevExpenses) / totalPrevExpenses) * 100)
      : 0;

    context += `=== COMPARACIÓN CON MES ANTERIOR (${prevMonthName}) ===\n`;
    context += `Gastos mes anterior: $${totalPrevExpenses.toLocaleString('es-AR')} | Este mes: $${totalExpenses.toLocaleString('es-AR')} (${expenseChange >= 0 ? '+' : ''}${expenseChange}%)\n`;
    context += `Ingresos mes anterior: $${totalPrevIncome.toLocaleString('es-AR')} | Este mes: $${totalIncome.toLocaleString('es-AR')}\n`;

    // Categories with biggest changes
    const allCategoriesArray = Array.from(new Set([...Object.keys(expensesByCategory), ...Object.keys(prevExpensesByCategory)]));
    const categoryChanges: { category: string; change: number; current: number; previous: number }[] = [];

    for (const cat of allCategoriesArray) {
      const current = expensesByCategory[cat]?.total ?? 0;
      const previous = prevExpensesByCategory[cat] ?? 0;
      if (previous > 0) {
        const change = Math.round(((current - previous) / previous) * 100);
        categoryChanges.push({ category: cat, change, current, previous });
      } else if (current > 0) {
        categoryChanges.push({ category: cat, change: 100, current, previous: 0 });
      }
    }

    const increases = categoryChanges.filter(c => c.change > 0).sort((a, b) => b.change - a.change).slice(0, 3);
    const decreases = categoryChanges.filter(c => c.change < 0).sort((a, b) => a.change - b.change).slice(0, 3);

    if (increases.length > 0) {
      context += `Categorías con mayor aumento: ${increases.map(c => `${c.category} (+${c.change}%)`).join(', ')}\n`;
    }
    if (decreases.length > 0) {
      context += `Categorías que bajaron: ${decreases.map(c => `${c.category} (${c.change}%)`).join(', ')}\n`;
    }

    const prevBalance = totalPrevIncome - totalPrevExpenses;
    const currentBalance = totalIncome - totalExpenses - totalCredit;
    const trend = currentBalance >= prevBalance ? 'Mejorando' : 'Empeorando';
    context += `Tendencia: Balance anterior $${prevBalance.toLocaleString('es-AR')} → Actual $${currentBalance.toLocaleString('es-AR')} (${trend})\n`;
    context += '\n';
  }

  if (transactions.length > 0) {
    context += `=== ÚLTIMAS TRANSACCIONES (${Math.min(transactions.length, 15)} de ${transactions.length}) ===\n`;
    for (const t of transactions.slice(0, 15)) {
      const sign = t.type === 'income' ? '+' : '-';
      context += `[${t.date}] ${sign}$${t.amount.toLocaleString('es-AR')} | ${t.category} | ${t.description}\n`;
    }
    context += '\n';
  }

  // Upcoming credit installments
  if (unpaidInstallments.length > 0) {
    const purchaseLookup: Record<string, CreditPurchaseRow> = {};
    for (const p of creditPurchases) {
      purchaseLookup[p.id] = p;
    }

    const userInstallments = unpaidInstallments.filter(inst => purchaseLookup[inst.credit_purchase_id]);

    if (userInstallments.length > 0) {
      let totalPending = 0;
      context += '=== PRÓXIMAS CUOTAS A PAGAR ===\n';
      for (const inst of userInstallments) {
        const purchase = purchaseLookup[inst.credit_purchase_id];
        if (purchase) {
          context += `- ${purchase.description}: Cuota ${inst.installment_number}/${purchase.installments} - $${inst.amount.toLocaleString('es-AR')} - Vence ${inst.due_date}\n`;
          totalPending += inst.amount;
        }
      }
      context += `Total cuotas pendientes: $${totalPending.toLocaleString('es-AR')}\n\n`;
    }
  }

  if (plans.length > 0) {
    context += '=== METAS DE AHORRO ACTIVAS ===\n';
    for (const p of plans) {
      const progress = p.target_amount > 0 ? Math.round((p.current_amount / p.target_amount) * 100) : 0;
      context += `- ${p.name}: $${p.current_amount.toLocaleString('es-AR')} / $${p.target_amount.toLocaleString('es-AR')} (${progress}%) | Fecha: ${p.deadline}\n`;
    }
    context += '\n';
  }

  if (investments.length > 0) {
    const totalInvestments = investments.reduce((sum, inv) => sum + inv.amount, 0);
    context += '=== INVERSIONES ACTIVAS ===\n';
    for (const inv of investments) {
      context += `- ${inv.investment_type}: $${inv.amount.toLocaleString('es-AR')} | ${inv.description}`;
      if (inv.currency) {
        context += ` (${inv.currency})`;
      }
      context += '\n';
    }
    context += `Portfolio total inversiones: $${totalInvestments.toLocaleString('es-AR')}\n`;
  }

  return context;
}

async function buildMarketContext(baseUrl: string, transcription: string): Promise<string> {
  const lowerTranscription = transcription.toLowerCase();

  const marketFetches: Promise<string>[] = [];

  if (lowerTranscription.includes('bitcoin') || lowerTranscription.includes('btc') ||
      lowerTranscription.includes('crypto') || lowerTranscription.includes('ethereum') ||
      lowerTranscription.includes('cripto')) {
    marketFetches.push(
      fetch(`${baseUrl}/api/market?type=crypto&instrumentId=100000`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data) return '';
          const d = data as { displayName: string; marketData: { currentPrice: number; dailyChangePercent: number; dailyHigh: number; dailyLow: number } };
          return `Crypto - ${d.displayName}: Precio actual USD $${d.marketData.currentPrice}, Cambio diario: ${d.marketData.dailyChangePercent.toFixed(2)}%, Máximo del día: $${d.marketData.dailyHigh}, Mínimo: $${d.marketData.dailyLow}`;
        })
        .catch(() => ''),
    );
  }

  if (lowerTranscription.includes('accion') || lowerTranscription.includes('acciones') ||
      lowerTranscription.includes('bolsa') || lowerTranscription.includes('merval')) {
    marketFetches.push(
      fetch(`${baseUrl}/api/market?type=acciones`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data || !Array.isArray(data)) return '';
          const top5 = data.slice(0, 5) as { symbol: string; price: number; change: number }[];
          return 'Acciones argentinas (top 5):\n' + top5.map((s: { symbol: string; price: number; change: number }) =>
            `  ${s.symbol}: $${s.price} (${s.change > 0 ? '+' : ''}${s.change}%)`
          ).join('\n');
        })
        .catch(() => ''),
    );
  }

  if (lowerTranscription.includes('bono') || lowerTranscription.includes('bonos')) {
    marketFetches.push(
      fetch(`${baseUrl}/api/market?type=bonos`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data || !Array.isArray(data)) return '';
          const top5 = data.slice(0, 5) as { symbol: string; price: number; change: number }[];
          return 'Bonos argentinos (top 5):\n' + top5.map((b: { symbol: string; price: number; change: number }) =>
            `  ${b.symbol}: $${b.price} (${b.change > 0 ? '+' : ''}${b.change}%)`
          ).join('\n');
        })
        .catch(() => ''),
    );
  }

  if (lowerTranscription.includes('cedear')) {
    marketFetches.push(
      fetch(`${baseUrl}/api/market?type=cedears`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data || !Array.isArray(data)) return '';
          const top5 = data.slice(0, 5) as { symbol: string; price: number; change: number }[];
          return 'CEDEARs (top 5):\n' + top5.map((c: { symbol: string; price: number; change: number }) =>
            `  ${c.symbol}: $${c.price} (${c.change > 0 ? '+' : ''}${c.change}%)`
          ).join('\n');
        })
        .catch(() => ''),
    );
  }

  if (marketFetches.length === 0) {
    marketFetches.push(
      fetch(`${baseUrl}/api/market?type=crypto&instrumentId=100000`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data) return '';
          const d = data as { displayName: string; marketData: { currentPrice: number; dailyChangePercent: number; dailyHigh: number; dailyLow: number } };
          return `Crypto - ${d.displayName}: Precio actual USD $${d.marketData.currentPrice}, Cambio diario: ${d.marketData.dailyChangePercent.toFixed(2)}%, Máximo: $${d.marketData.dailyHigh}, Mínimo: $${d.marketData.dailyLow}`;
        })
        .catch(() => ''),
    );
  }

  const results = await Promise.all(marketFetches);
  return results.filter(Boolean).join('\n\n');
}


export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authorizedRoles: UserRole[] = [USER_ROLES.PREMIUM, USER_ROLES.ADMIN];
  const userRole = user.app_metadata?.role;

  if (!authorizedRoles.includes(userRole)) {
    return NextResponse.json({ error: 'Forbidden: Premium required' }, { status: 403 });
  }

  try {
    const body: {
      transcription: string;
      step: 'classify' | 'execute' | 'unified';
      action?: AgentActionType;
      conversationHistory?: ConversationMessage[];
    } = await request.json();
    const { transcription, step, conversationHistory } = body;

    if (!transcription || !step) {
      return NextResponse.json({ error: 'Missing transcription or step' }, { status: 400 });
    }

    // --- UNIFIED: classify + execute in minimal API calls ---
    if (step === 'unified') {
      // Step 1: Classify with NVIDIA (free, no quota)
      const classification = await classifyWithNvidia(transcription, conversationHistory);
      const action = classification.action;

      // Step 2: Execute based on action type
      let result: AgentExecuteResponse;

      // Dollar rate: no AI needed at all
      if (action === AgentAction.DOLLAR_RATE) {
        const baseUrl = request.nextUrl.origin;
        const marketResponse = await fetch(`${baseUrl}/api/market?type=dolar`);

        if (!marketResponse.ok) {
          return NextResponse.json({ error: 'No se pudo obtener la cotización del dólar' }, { status: 500 });
        }

        const rates = await marketResponse.json();
        const strategy = getStrategy(action);
        const payload = strategy.parseResponse(JSON.stringify(rates));

        result = { payload, message: 'Cotización del dólar obtenida' };
      } else {
        const strategy = getStrategy(action);

        // Build context if needed
        let context: string | undefined;

        if (strategy.needsUserData) {
          context = await buildUserFinancialContext(supabase, user.id);
        }

        if (strategy.needsMarketData) {
          const baseUrl = request.nextUrl.origin;
          const marketContext = await buildMarketContext(baseUrl, transcription);
          context = context ? `${context}\n\n${marketContext}` : marketContext;
        }

        const prompt = strategy.buildPrompt(transcription, context, conversationHistory);

        const rawContent = await executeWithNvidia(prompt, conversationHistory);

        const payload = strategy.parseResponse(rawContent);

        // Generate smart insight for DB actions
        const message = await generateActionMessage(action, payload, context, conversationHistory);

        result = { payload, message };
      }

      return NextResponse.json({
        action,
        confidence: classification.confidence,
        ...result,
      });
    }

    // --- Legacy two-step mode (kept for compatibility) ---
    if (step === 'classify') {
      const classification = await classifyWithNvidia(transcription, conversationHistory);
      return NextResponse.json(classification);
    }

    if (step === 'execute') {
      const action = body.action;
      if (!action) {
        return NextResponse.json({ error: 'Missing action' }, { status: 400 });
      }

      if (action === AgentAction.DOLLAR_RATE) {
        const baseUrl = request.nextUrl.origin;
        const marketResponse = await fetch(`${baseUrl}/api/market?type=dolar`);
        if (!marketResponse.ok) {
          return NextResponse.json({ error: 'Failed to fetch dollar rates' }, { status: 500 });
        }
        const rates = await marketResponse.json();
        const strategy = getStrategy(action);
        const payload = strategy.parseResponse(JSON.stringify(rates));
        return NextResponse.json({ payload, message: 'Cotización del dólar obtenida' });
      }

      const strategy = getStrategy(action);
      let context: string | undefined;
      if (strategy.needsUserData) {
        context = await buildUserFinancialContext(supabase, user.id);
      }
      if (strategy.needsMarketData) {
        const baseUrl = request.nextUrl.origin;
        const marketContext = await buildMarketContext(baseUrl, transcription);
        context = context ? `${context}\n\n${marketContext}` : marketContext;
      }

      const prompt = strategy.buildPrompt(transcription, context, conversationHistory);
      const rawContent = await executeWithNvidia(prompt, conversationHistory);

      const payload = strategy.parseResponse(rawContent);

      // Generate smart insight for DB actions
      const message = await generateActionMessage(action, payload, context, conversationHistory);

      return NextResponse.json({ payload, message });
    }

    return NextResponse.json({ error: 'Invalid step' }, { status: 400 });
  } catch (error) {
    console.error('Agent API error:', error);

    // Better error messages for rate limits
    const errorMessage = error instanceof Error ? error.message : '';
    if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json(
        { error: 'Se alcanzó el límite de consultas. Intentá de nuevo en unos segundos.' },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: 'Error procesando tu solicitud. Intentá de nuevo.' },
      { status: 500 },
    );
  }
}

// DB actions that should get smart insights
const DB_ACTIONS: Set<AgentActionType> = new Set([
  AgentAction.ADD_EXPENSE,
  AgentAction.ADD_INCOME,
  AgentAction.CREATE_SAVINGS_GOAL,
  AgentAction.CREDIT_PURCHASE,
  AgentAction.CREATE_INVESTMENT,
]);

async function generateActionMessage(
  action: AgentActionType,
  payload: AgentPayload,
  financialContext: string | undefined,
  conversationHistory?: ConversationMessage[],
): Promise<string> {
  // Fallback messages
  const fallbackMessages: Record<AgentActionType, string> = {
    [AgentAction.ADD_EXPENSE]: `Gasto de $${(payload as { amount: number }).amount?.toLocaleString('es-AR') ?? '0'} detectado`,
    [AgentAction.ADD_INCOME]: `Ingreso de $${(payload as { amount: number }).amount?.toLocaleString('es-AR') ?? '0'} detectado`,
    [AgentAction.CREATE_SAVINGS_GOAL]: 'Meta de ahorro detectada',
    [AgentAction.CREDIT_PURCHASE]: 'Compra en cuotas detectada',
    [AgentAction.CREATE_INVESTMENT]: 'Inversión detectada',
    [AgentAction.DOLLAR_RATE]: 'Cotización obtenida',
    [AgentAction.MARKET_QUERY]: (payload as { answer: string }).answer,
    [AgentAction.GENERAL_QUESTION]: (payload as { answer: string }).answer,
  };

  // Only generate insights for DB actions with financial context
  if (!DB_ACTIONS.has(action) || !financialContext) {
    return fallbackMessages[action];
  }

  try {
    const insightPrompt = buildInsightPrompt(action, payload, financialContext);
    const rawInsight = await executeWithNvidia(insightPrompt, conversationHistory);
    const cleanJson = parseJsonFromAI(rawInsight);
    const parsed: { message: string } = JSON.parse(cleanJson);
    return parsed.message;
  } catch {
    return fallbackMessages[action];
  }
}
