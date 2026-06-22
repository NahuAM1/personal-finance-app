import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { USER_ROLES } from '@/types/database';
import type { UserRole } from '@/types/database';
import { AgentAction } from '@/types/agent';
import type { AgentActionType, AgentExecuteResponse, AgentPayload, AgentClarificationPayload, ConversationMessage, DataQueryParams } from '@/types/agent';
import OpenAI from 'openai';
import { HuggingFaceModels, OpenRouterModels } from '@/public/enums';
import { buildClassifierPrompt } from '@/public/promts/classifier-prompt';
import { getStrategy } from '@/lib/agent/strategies';
import { fetchDataForQuery } from '@/lib/agent/data-fetcher';
import { buildDataAnswerPrompt } from '@/lib/agent/strategies/data-query';
import { buildUserFinancialContext } from '@/lib/agent/financial-context';
import { buildMarketContext, transcriptionNeedsMarketData } from '@/lib/agent/market-context';
import { safeParseJson } from '@/lib/agent/utils/json-utils';
import { serializeHistory } from '@/lib/agent/utils/serialize-history';
import { needsWebSearch, hasPendingSearch, userAcceptedSearch } from '@/lib/agent/utils/search-utils';
import { searchWeb, buildSearchContext } from '@/lib/agent/web-search';

const openrouter = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE_URL,
});

const huggingface = new OpenAI({
  apiKey: process.env.HUGGING_FACE_KEY,
  baseURL: process.env.HUGGING_FACE_BASE_URL,
});

// --- Pre-classification: detect period-specific queries before LLM ---
// Acts as a safety net for patterns the LLM classifier might miss.
const PERIOD_PATTERNS: RegExp[] = [
  /(\d+\s*mes(?:es)?\s*(?:anteriores|atr[sá]s|pasados))/i,
  /(?:con respecto a|comparado con|en comparaci[oó]n|vs\.?|versus|diferencia entre)/i,
  /(?:[úu]ltimos?\s+\d+\s*(?:meses|semanas|d[ií]as|años|trimestres))/i,
  /(?:evoluci[oó]n\s+(?:en\s+)?(?:los\s+)?[úu]ltimos?)/i,
  /(?:altura del mes|ritmo\s+actual|proyect[áa])/i,
  /(?:tendencia|historial\s+de|hist[oó]rico\s+de)/i,
  /(?:mes\s+(?:a|contra|vs|versus)\s+mes)/i,
];

function detectPeriodQuery(transcription: string): AgentActionType | null {
  for (const p of PERIOD_PATTERNS) {
    if (p.test(transcription)) return AgentAction.DATA_QUERY;
  }
  return null;
}

// --- Classify using NVIDIA free model ---
async function classifyWithNvidia(
  transcription: string,
  conversationHistory?: ConversationMessage[],
): Promise<{ action: AgentActionType; confidence: number }> {
  const prompt = buildClassifierPrompt(transcription, conversationHistory);

  const response = await openrouter.chat.completions.create({
    model: OpenRouterModels.NVIDIA,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 256,
  });

  const rawContent = response.choices[0]?.message?.content ?? '';
  const defaultClassification = { action: AgentAction.GENERAL_QUESTION as AgentActionType, confidence: 0 };
  const parsed = safeParseJson<{ action: AgentActionType; confidence: number }>(rawContent, defaultClassification);
  if (!parsed.action) return defaultClassification;
  return parsed;
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
      content: `<conversation_history>\n${serializeHistory(conversationHistory)}\n</conversation_history>`,
    });
  }

  messages.push({ role: 'user', content: prompt });

  const response = await huggingface.chat.completions.create({
    model: HuggingFaceModels.LLAMA_3_1_8B,
    messages,
    temperature: 0.2,
    max_tokens: 1024,
  });

  return response.choices[0]?.message?.content ?? '';
}

// --- Build insight message for DB action confirmations ---
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
    [AgentAction.SAVINGS_DEPOSIT]: `Depósito de $${(payload as { depositAmount: number }).depositAmount.toLocaleString('es-AR')} en meta "${(payload as { goalName: string }).goalName}" (nuevo total: $${(payload as { newTotal: number }).newTotal.toLocaleString('es-AR')}, ${(payload as { progressPercent: number }).progressPercent}%)`,
    [AgentAction.DELETE_TRANSACTION]: `Eliminación de transacción: $${(payload as { amount: number }).amount.toLocaleString('es-AR')} en ${(payload as { category: string }).category} - "${(payload as { description: string }).description}"`,
  };

  const desc = actionDescriptions[action] ?? 'Acción detectada';

  return `<personality>Sos SmartPocket. Generá un mensaje de confirmación breve (2-3 oraciones).</personality>

<action>${desc}</action>

<user_data>${financialContext}</user_data>

<rules>
- Determiná si la acción es POSITIVA (add_income, create_savings_goal, create_investment) o COSTOSA (add_expense, credit_purchase)
- Para acciones POSITIVAS: empezá con refuerzo positivo. Ej: "Buen ingreso."
- Para acciones COSTOSAS: confirmá con tono neutro. No uses "ojo" o "cuidado" a menos que supere el 20% del ingreso mensual
- Agregá insight con datos reales (ej: "Ya llevás $[total] en [categoria] este mes" reemplazando con valores reales)
- Mencioná impacto en metas de ahorro solo si > 5%
- Si la categoría superó el presupuesto, alertá brevemente
- Si no hay datos suficientes, solo confirmá
- Español neutro, texto plano, montos $X.XXX
- Máximo 2 oraciones
</rules>

<output>{"message": "tu mensaje acá"}</output>`;
}

// --- Build post-confirmation contextual message prompt ---
function buildPostConfirmPrompt(
  action: AgentActionType,
  payload: AgentPayload,
  financialContext: string,
): string {
  const actionDescriptions: Partial<Record<AgentActionType, string>> = {
    [AgentAction.ADD_EXPENSE]: `Gasto de $${(payload as { amount: number }).amount?.toLocaleString('es-AR') ?? '0'} en ${(payload as { category: string }).category ?? 'Otros'} ya guardado`,
    [AgentAction.ADD_INCOME]: `Ingreso de $${(payload as { amount: number }).amount?.toLocaleString('es-AR') ?? '0'} en ${(payload as { category: string }).category ?? 'Otros'} ya guardado`,
    [AgentAction.CREATE_SAVINGS_GOAL]: `Meta de ahorro "${(payload as { name: string }).name ?? ''}" por $${(payload as { targetAmount: number }).targetAmount?.toLocaleString('es-AR') ?? '0'} creada`,
    [AgentAction.CREDIT_PURCHASE]: `Compra en cuotas por $${(payload as { totalAmount: number }).totalAmount?.toLocaleString('es-AR') ?? '0'} registrada`,
    [AgentAction.CREATE_INVESTMENT]: `Inversión de $${(payload as { amount: number }).amount?.toLocaleString('es-AR') ?? '0'} en ${(payload as { investmentType: string }).investmentType ?? 'instrumento'} registrada`,
  };

  const desc = actionDescriptions[action] ?? 'Acción registrada';

  return `<personality>Sos SmartPocket. La acción ya fue guardada en la base de datos. Generá UN mensaje breve.</personality>

<action_saved>${desc}</action_saved>

<updated_financial_data>${financialContext}</updated_financial_data>

<rules>
- Para gastos: "Anotado. Llevás $[total] en [categoria] este mes." (usá valores reales del contexto)
- Para ingresos: "Perfecto. Tu balance este mes es $[monto]." (monto real)
- Para metas de ahorro: "Meta creada. ¿Querés empezar a depositar?"
- Para inversiones: "Registrada. Tu portfolio activo suma $[total]." (monto real)
- Para cuotas: "Registrado. Tenés [cantidad] cuotas activas." (número real)
- Usá datos reales del contexto financiero
- Español neutro, texto plano, máxima 1 oración
</rules>

<output>{"message": "tu mensaje acá"}</output>`;
}

// --- Build welcome prompt ---
function buildWelcomePrompt(firstName: string, financialContext: string): string {
  const greeting = firstName ? `Hola ${firstName}` : 'Hola';
  return `<personality>Sos SmartPocket, asistente financiero personal. Generá un saludo inicial breve y personalizado.</personality>

<user_name>${firstName || 'Usuario'}</user_name>

<user_financial_data>${financialContext}</user_financial_data>

<rules>
- Empezá con "${greeting}."
- Mencioná 1 dato financiero relevante del mes (balance, gasto más alto, o meta de ahorro más cercana)
- Terminá con "¿En qué te puedo ayudar?"
- Español neutro, texto plano, máximo 2 oraciones
- Si no hay datos, solo saludá y preguntá en qué ayudar
</rules>

<output>{"message": "tu mensaje acá"}</output>`;
}

// --- Shared execution logic used by both unified and legacy execute steps ---
async function executeAction(
  action: AgentActionType,
  transcription: string,
  request: NextRequest,
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
  conversationHistory?: ConversationMessage[],
  searchContext?: string,
): Promise<{ payload: AgentPayload; message: string }> {
  // Dollar rate: no AI needed at all
  if (action === AgentAction.DOLLAR_RATE) {
    const baseUrl = request.nextUrl.origin;
    const marketResponse = await fetch(`${baseUrl}/api/market?type=dolar`);
    if (!marketResponse.ok) {
      return {
        payload: { action: 'dollar_rate', rates: [] } as AgentPayload,
        message: 'No se pudo obtener la cotización del dólar',
      };
    }
    const rates = await marketResponse.json();
    const strategy = getStrategy(action);
    const payload = strategy.parseResponse(JSON.stringify(rates));
    return { payload, message: 'Cotización del dólar obtenida' };
  }

  // Scan receipt: fast-path, no AI needed
  if (action === AgentAction.SCAN_RECEIPT) {
    return {
      payload: { action: 'scan_receipt', triggerScanner: true } as AgentPayload,
      message: 'Abriendo el scanner de tickets...',
    };
  }

  // Data query: three-pass flow (extract params → fetch data → generate answer)
  if (action === AgentAction.DATA_QUERY) {
    const paramStrategy = getStrategy(action);
    const paramPrompt = paramStrategy.buildPrompt(transcription, undefined, conversationHistory);
    const rawParams = await executeWithNvidia(paramPrompt, conversationHistory);
    const now = new Date();
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const todayStr = now.toISOString().split('T')[0];
    const defaultParams: DataQueryParams = {
      dateFrom: startOfMonth, dateTo: todayStr,
      transactionType: 'all', category: '',
      comparisonDateFrom: null, comparisonDateTo: null,
      dataScope: 'all', queryIntent: 'sum',
    };
    const queryParams = safeParseJson<DataQueryParams>(rawParams, defaultParams);
    const queryResults = await fetchDataForQuery(supabase, userId, queryParams);

    // Fetch full financial context for hybrid analysis (scoring, goals, trends)
    const financialContext = await buildUserFinancialContext(supabase, userId);

    const answerPrompt = buildDataAnswerPrompt(transcription, queryResults, conversationHistory, financialContext);
    const rawAnswer = await executeWithNvidia(answerPrompt, conversationHistory);
    const parsed = safeParseJson<{ answer: string }>(rawAnswer, { answer: 'No pude procesar la consulta. Intentá de nuevo.' });
    return {
      payload: { action: 'data_query', answer: parsed.answer } as AgentPayload,
      message: parsed.answer,
    };
  }

  // Standard strategy-based actions
  const strategy = getStrategy(action);

  let context: string | undefined;

  if (strategy.needsUserData) {
    const includeIds = action === AgentAction.DELETE_TRANSACTION;
    context = await buildUserFinancialContext(supabase, userId, includeIds);
  }

  if (strategy.needsMarketData && (action !== AgentAction.GENERAL_QUESTION || transcriptionNeedsMarketData(transcription))) {
    const baseUrl = request.nextUrl.origin;
    const marketContext = await buildMarketContext(baseUrl, transcription, action);
    context = context ? `${context}\n\n${marketContext}` : marketContext;
  }

  // Web search results: injected for questions that need external knowledge
  if (searchContext) {
    context = context ? `${context}\n\n${searchContext}` : searchContext;
  }

  const prompt = strategy.buildPrompt(transcription, context, conversationHistory);
  const rawContent = await executeWithNvidia(prompt, conversationHistory);
  const payload = strategy.parseResponse(rawContent);

  // Handle clarification responses
  if (payload.action === AgentAction.CLARIFICATION) {
    const clarification = payload as AgentClarificationPayload;
    return {
      payload: clarification,
      message: clarification.question,
    };
  }

  // Generate smart insight for DB actions
  const message = await generateActionMessage(action, payload, context, conversationHistory);

  return { payload, message };
}

// DB actions that should get smart insights
const DB_ACTIONS: Set<AgentActionType> = new Set([
  AgentAction.ADD_EXPENSE,
  AgentAction.ADD_INCOME,
  AgentAction.CREATE_SAVINGS_GOAL,
  AgentAction.CREDIT_PURCHASE,
  AgentAction.CREATE_INVESTMENT,
  AgentAction.SAVINGS_DEPOSIT,
  AgentAction.DELETE_TRANSACTION,
]);

const DB_ACTION_FALLBACKS: Record<AgentActionType, string> = {
  [AgentAction.ADD_EXPENSE]: '',
  [AgentAction.ADD_INCOME]: '',
  [AgentAction.CREATE_SAVINGS_GOAL]: 'Meta de ahorro detectada',
  [AgentAction.CREDIT_PURCHASE]: 'Compra en cuotas detectada',
  [AgentAction.CREATE_INVESTMENT]: 'Inversión detectada',
  [AgentAction.DOLLAR_RATE]: 'Cotización obtenida',
  [AgentAction.MARKET_QUERY]: '',
  [AgentAction.GENERAL_QUESTION]: '',
  [AgentAction.DATA_QUERY]: '',
  [AgentAction.SCAN_RECEIPT]: 'Abriendo el scanner de tickets...',
  [AgentAction.CLARIFICATION]: '',
  [AgentAction.SAVINGS_DEPOSIT]: '',
  [AgentAction.DELETE_TRANSACTION]: '',
};

async function generateActionMessage(
  action: AgentActionType,
  payload: AgentPayload,
  financialContext: string | undefined,
  conversationHistory?: ConversationMessage[],
): Promise<string> {
  // For actions that already carry their answer in the payload
  if ([AgentAction.GENERAL_QUESTION, AgentAction.MARKET_QUERY, AgentAction.DATA_QUERY].includes(action)) {
    return (payload as { answer: string }).answer ?? '';
  }
  if (action === AgentAction.CLARIFICATION) {
    return (payload as { question: string }).question ?? '';
  }

  // Direct amount/description payload messages
  if (action === AgentAction.ADD_EXPENSE || action === AgentAction.ADD_INCOME) {
    const p = payload as { amount: number; category: string };
    return `$${p.amount?.toLocaleString('es-AR') ?? '0'} en ${p.category ?? 'Otros'}`;
  }
  if (action === AgentAction.SAVINGS_DEPOSIT) {
    const p = payload as { depositAmount: number; goalName: string };
    return `Depósito de $${p.depositAmount?.toLocaleString('es-AR') ?? '0'} en ${p.goalName ?? 'meta'}`;
  }
  if (action === AgentAction.DELETE_TRANSACTION) {
    const p = payload as { description: string };
    return `Eliminar: ${p.description ?? 'transacción'}`;
  }

  // Only generate insights for DB actions with financial context
  if (!DB_ACTIONS.has(action) || !financialContext) {
    return DB_ACTION_FALLBACKS[action] ?? 'Acción detectada';
  }

  try {
    const insightPrompt = buildInsightPrompt(action, payload, financialContext);
    const rawInsight = await executeWithNvidia(insightPrompt, conversationHistory);
    const parsed = safeParseJson<{ message: string }>(rawInsight, { message: '' });
    return parsed.message || (DB_ACTION_FALLBACKS[action] ?? 'Acción detectada');
  } catch {
    return DB_ACTION_FALLBACKS[action] ?? 'Acción detectada';
  }
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
      step: 'classify' | 'execute' | 'unified' | 'post-confirm' | 'welcome';
      action?: AgentActionType;
      payload?: AgentPayload;
      conversationHistory?: ConversationMessage[];
    } = await request.json();
    const { transcription, step, conversationHistory } = body;

    if (!step) {
      return NextResponse.json({ error: 'Missing step' }, { status: 400 });
    }

    // --- POST-CONFIRM: generate contextual message after action is saved ---
    if (step === 'post-confirm') {
      const action = body.action;
      const payload = body.payload;
      if (!action || !payload) {
        return NextResponse.json({ message: 'Listo, se registró correctamente.' });
      }
      const financialContext = await buildUserFinancialContext(supabase, user.id);
      const postConfirmPrompt = buildPostConfirmPrompt(action, payload, financialContext);
      try {
        const raw = await executeWithNvidia(postConfirmPrompt);
        const parsed = safeParseJson<{ message: string }>(raw, { message: '' });
        return NextResponse.json({ message: parsed.message || 'Listo, se registró correctamente.' });
      } catch {
        return NextResponse.json({ message: 'Listo, se registró correctamente.' });
      }
    }

    // --- WELCOME: personalized greeting with financial context ---
    if (step === 'welcome') {
      const firstName = (user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? '';
      const financialContext = await buildUserFinancialContext(supabase, user.id);
      const welcomePrompt = buildWelcomePrompt(firstName, financialContext);
      const fallback = `Hola${firstName ? ` ${firstName}` : ''}. ¿En qué te puedo ayudar?`;
      try {
        const raw = await executeWithNvidia(welcomePrompt);
        const parsed = safeParseJson<{ message: string }>(raw, { message: '' });
        return NextResponse.json({ message: parsed.message || fallback });
      } catch {
        return NextResponse.json({ message: fallback });
      }
    }

    if (!transcription) {
      return NextResponse.json({ error: 'Missing transcription' }, { status: 400 });
    }

    // --- UNIFIED: classify + execute in minimal API calls ---
    if (step === 'unified') {
      // Pre-classification: detect period-specific queries before LLM
      const periodAction = detectPeriodQuery(transcription);
      const classification = periodAction
        ? { action: periodAction as AgentActionType, confidence: 0.95 }
        : await classifyWithNvidia(transcription, conversationHistory);
      const action = classification.action;

      // Low confidence: ask for reformulation
      if (classification.confidence < 0.65) {
        return NextResponse.json({
          action: 'general_question',
          confidence: classification.confidence,
          payload: { action: 'general_question', answer: 'No entendí bien tu consulta. ¿Podés reformularla?' },
          message: 'No entendí bien tu consulta. ¿Podés reformularla?',
        });
      }

      // Web search — only if user explicitly approved a pending suggestion
      let searchContext: string | undefined;
      if (action === AgentAction.GENERAL_QUESTION) {
        if (needsWebSearch(transcription)) {
          const pending = hasPendingSearch(conversationHistory);
          const approved = userAcceptedSearch(transcription);
          if (pending && approved) {
            // User said "sí" / "dale" / "buscá" — now do the search
            const results = await searchWeb(transcription);
            if (results.length > 0) {
              searchContext = buildSearchContext(results);
            }
          } else {
            // Don't search yet — tell the LLM to suggest asking the user
            searchContext = '[WEB_SEARCH_SUGGESTED]';
          }
        }
      }

      const result = await executeAction(action, transcription, request, supabase, user.id, conversationHistory, searchContext);

      // Handle clarification specially
      if (result.payload.action === AgentAction.CLARIFICATION) {
        return NextResponse.json({
          action: classification.action,
          confidence: classification.confidence,
          payload: result.payload,
          message: (result.payload as AgentClarificationPayload).question,
        });
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

      // Legacy web search — approval gate (same as unified)
      let searchContext: string | undefined;
      if (action === AgentAction.GENERAL_QUESTION) {
        if (needsWebSearch(transcription)) {
          const pending = hasPendingSearch(conversationHistory);
          const approved = userAcceptedSearch(transcription);
          if (pending && approved) {
            const results = await searchWeb(transcription);
            if (results.length > 0) {
              searchContext = buildSearchContext(results);
            }
          } else {
            searchContext = '[WEB_SEARCH_SUGGESTED]';
          }
        }
      }

      const result = await executeAction(action, transcription, request, supabase, user.id, conversationHistory, searchContext);

      if (result.payload.action === AgentAction.CLARIFICATION) {
        return NextResponse.json({
          action: action,
          confidence: 1,
          payload: result.payload,
          message: (result.payload as AgentClarificationPayload).question,
        });
      }

      return NextResponse.json({ payload: result.payload, message: result.message });
    }

    return NextResponse.json({ error: 'Invalid step' }, { status: 400 });
  } catch (error) {
    console.error('Agent API error:', error);

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
