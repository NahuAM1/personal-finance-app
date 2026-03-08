import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { USER_ROLES } from '@/types/database';
import type { UserRole } from '@/types/database';
import { AgentAction } from '@/types/agent';
import type { AgentActionType, AgentExecuteResponse } from '@/types/agent';
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

// --- Classify using NVIDIA free model (no quota limits) ---
async function classifyWithNvidia(transcription: string): Promise<{ action: AgentActionType; confidence: number }> {
  const prompt = buildClassifierPrompt(transcription);

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
async function executeWithNvidia(prompt: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: OpenAIModels.NVIDIA,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
  });

  return response.choices[0]?.message?.content ?? '';
}

// --- Build user financial context ---
async function buildUserFinancialContext(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
): Promise<string> {
  const now = new Date();
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const endOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`;

  const [transactionsResult, plansResult, investmentsResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('type, amount, category, description, date')
      .eq('user_id', userId)
      .gte('date', startOfMonth)
      .lte('date', endOfMonth)
      .order('date', { ascending: false }),
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
  ]);

  const transactions = (transactionsResult.data ?? []) as TransactionRow[];
  const plans = (plansResult.data ?? []) as ExpensePlanRow[];
  const investments = (investmentsResult.data ?? []) as InvestmentRow[];

  const expenses = transactions.filter(t => t.type === 'expense');
  const incomes = transactions.filter(t => t.type === 'income');
  const credits = transactions.filter(t => t.type === 'credit');

  const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = incomes.reduce((sum, t) => sum + t.amount, 0);
  const totalCredit = credits.reduce((sum, t) => sum + t.amount, 0);

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

  if (transactions.length > 0) {
    context += `=== ÚLTIMAS TRANSACCIONES (${Math.min(transactions.length, 15)} de ${transactions.length}) ===\n`;
    for (const t of transactions.slice(0, 15)) {
      const sign = t.type === 'income' ? '+' : '-';
      context += `[${t.date}] ${sign}$${t.amount.toLocaleString('es-AR')} | ${t.category} | ${t.description}\n`;
    }
    context += '\n';
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
    context += '=== INVERSIONES ACTIVAS ===\n';
    for (const inv of investments) {
      context += `- ${inv.investment_type}: $${inv.amount.toLocaleString('es-AR')} | ${inv.description}`;
      if (inv.currency) {
        context += ` (${inv.currency})`;
      }
      context += '\n';
    }
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
    const body: { transcription: string; step: 'classify' | 'execute' | 'unified'; action?: AgentActionType } = await request.json();
    const { transcription, step } = body;

    if (!transcription || !step) {
      return NextResponse.json({ error: 'Missing transcription or step' }, { status: 400 });
    }

    // --- UNIFIED: classify + execute in minimal API calls ---
    if (step === 'unified') {
      // Step 1: Classify with NVIDIA (free, no quota)
      const classification = await classifyWithNvidia(transcription);
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

        const prompt = strategy.buildPrompt(transcription, context);

        const rawContent = await executeWithNvidia(prompt);

        const payload = strategy.parseResponse(rawContent);

        const actionMessages: Record<AgentActionType, string> = {
          [AgentAction.ADD_EXPENSE]: `Gasto de $${(payload as { amount: number }).amount} detectado`,
          [AgentAction.ADD_INCOME]: `Ingreso de $${(payload as { amount: number }).amount} detectado`,
          [AgentAction.CREATE_SAVINGS_GOAL]: 'Meta de ahorro detectada',
          [AgentAction.CREDIT_PURCHASE]: 'Compra en cuotas detectada',
          [AgentAction.CREATE_INVESTMENT]: 'Inversión detectada',
          [AgentAction.DOLLAR_RATE]: 'Cotización obtenida',
          [AgentAction.MARKET_QUERY]: (payload as { answer: string }).answer,
          [AgentAction.GENERAL_QUESTION]: (payload as { answer: string }).answer,
        };

        result = { payload, message: actionMessages[action] };
      }

      return NextResponse.json({
        action,
        confidence: classification.confidence,
        ...result,
      });
    }

    // --- Legacy two-step mode (kept for compatibility) ---
    if (step === 'classify') {
      const classification = await classifyWithNvidia(transcription);
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

      const prompt = strategy.buildPrompt(transcription, context);
      const rawContent = await executeWithNvidia(prompt);

      const payload = strategy.parseResponse(rawContent);
      const actionMessages: Record<AgentActionType, string> = {
        [AgentAction.ADD_EXPENSE]: `Gasto de $${(payload as { amount: number }).amount} detectado`,
        [AgentAction.ADD_INCOME]: `Ingreso de $${(payload as { amount: number }).amount} detectado`,
        [AgentAction.CREATE_SAVINGS_GOAL]: 'Meta de ahorro detectada',
        [AgentAction.CREDIT_PURCHASE]: 'Compra en cuotas detectada',
        [AgentAction.CREATE_INVESTMENT]: 'Inversión detectada',
        [AgentAction.DOLLAR_RATE]: 'Cotización obtenida',
        [AgentAction.MARKET_QUERY]: (payload as { answer: string }).answer,
        [AgentAction.GENERAL_QUESTION]: (payload as { answer: string }).answer,
      };

      return NextResponse.json({ payload, message: actionMessages[action] });
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
