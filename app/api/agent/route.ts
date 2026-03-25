import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { USER_ROLES } from "@/types/database";
import type { UserRole } from "@/types/database";
import { AgentAction } from "@/types/agent";
import type {
  AgentActionType,
  AgentExecuteResponse,
  AgentPayload,
  AgentClarificationPayload,
  ConversationMessage,
  DataQueryParams,
} from "@/types/agent";
import OpenAI from "openai";
import { HuggingFaceModels, OpenRouterModels } from "@/public/enums";
import { buildClassifierPrompt } from "@/public/promts/classifier-prompt";
import { getStrategy } from "@/lib/agent/strategies";
import { fetchDataForQuery } from "@/lib/agent/data-fetcher";
import { buildDataAnswerPrompt } from "@/lib/agent/strategies/data-query";
import {
  detectRecurringPatterns,
  formatPatterns,
} from "@/lib/agent/pattern-detector";
import { serializeHistory } from "@/lib/agent/utils/serialize-history";

const openrouter = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE_URL,
});

const huggingface = new OpenAI({
  apiKey: process.env.HUGGING_FACE_KEY,
  baseURL: process.env.HUGGING_FACE_BASE_URL,
});

function parseJsonFromAI(raw: string): string {
  if (!raw || raw.trim().length === 0) {
    return "{}";
  }

  // Strip thinking tags (e.g. <think>...</think>) that some models emit
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Try code fences first
  const fenceMatch =
    cleaned.match(/```json\s*([\s\S]*?)```/) ||
    cleaned.match(/```\s*([\s\S]*?)```/);
  if (fenceMatch && fenceMatch[1]?.trim()) {
    cleaned = fenceMatch[1].trim();
  } else {
    // Extract the outermost JSON object or array
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (objectMatch) {
      cleaned = objectMatch[0];
    } else if (arrayMatch) {
      cleaned = arrayMatch[0];
    }
  }

  // Remove trailing commas before closing braces/brackets (common AI mistake)
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

  return cleaned;
}

function safeParseJson<T>(raw: string, fallback: T): T {
  const cleaned = parseJsonFromAI(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Second attempt: try to fix common issues like unquoted property names
    try {
      // Replace single quotes with double quotes
      const fixedQuotes = cleaned.replace(/'/g, '"');
      return JSON.parse(fixedQuotes) as T;
    } catch {
      return fallback;
    }
  }
}

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

const MARKET_KEYWORDS = [
  "dolar",
  "dólar",
  "bitcoin",
  "btc",
  "crypto",
  "cripto",
  "ethereum",
  "accion",
  "acciones",
  "bono",
  "bonos",
  "inversion",
  "inversión",
  "inversiones",
  "invertir",
  "cedear",
  "plazo fijo",
  "tasa",
  "rendimiento",
  "lecap",
  "letras",
  "merval",
  "me conviene",
  "blue",
  "mep",
  "ccl",
];

function transcriptionNeedsMarketData(transcription: string): boolean {
  const lower = transcription.toLowerCase();
  return MARKET_KEYWORDS.some((kw) => lower.includes(kw));
}

// --- Classify using NVIDIA free model (no quota limits) ---
async function classifyWithNvidia(
  transcription: string,
  conversationHistory?: ConversationMessage[],
): Promise<{ action: AgentActionType; confidence: number }> {
  const prompt = buildClassifierPrompt(transcription, conversationHistory);

  const response = await openrouter.chat.completions.create({
    model: OpenRouterModels.NVIDIA,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens: 256,
  });

  const rawContent = response.choices[0]?.message?.content ?? "";
  const defaultClassification = {
    action: AgentAction.GENERAL_QUESTION as AgentActionType,
    confidence: 0,
  };
  const parsed = safeParseJson<{ action: AgentActionType; confidence: number }>(
    rawContent,
    defaultClassification,
  );
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
      role: "system",
      content: `Historial de conversación:\n${serializeHistory(conversationHistory)}`,
    });
  }

  messages.push({ role: "user", content: prompt });

  const response = await huggingface.chat.completions.create({
    model: HuggingFaceModels.LLAMA_3_1_8B,
    messages,
    temperature: 0.2,
    max_tokens: 1024,
  });

  return response.choices[0]?.message?.content ?? "";
}

// --- Build insight for DB action confirmations ---
function buildInsightPrompt(
  action: AgentActionType,
  payload: AgentPayload,
  financialContext: string,
): string {
  const actionDescriptions: Partial<Record<AgentActionType, string>> = {
    [AgentAction.ADD_EXPENSE]: `Gasto de $${(payload as { amount: number }).amount.toLocaleString("es-AR")} en ${(payload as { category: string }).category}`,
    [AgentAction.ADD_INCOME]: `Ingreso de $${(payload as { amount: number }).amount.toLocaleString("es-AR")} en ${(payload as { category: string }).category}`,
    [AgentAction.CREATE_SAVINGS_GOAL]: `Meta de ahorro "${(payload as { name: string }).name}" por $${(payload as { targetAmount: number }).targetAmount.toLocaleString("es-AR")}`,
    [AgentAction.CREDIT_PURCHASE]: `Compra en ${(payload as { installments: number }).installments} cuotas por $${(payload as { totalAmount: number }).totalAmount.toLocaleString("es-AR")}`,
    [AgentAction.CREATE_INVESTMENT]: `Inversión de $${(payload as { amount: number }).amount.toLocaleString("es-AR")} en ${(payload as { investmentType: string }).investmentType}`,
    [AgentAction.SAVINGS_DEPOSIT]: `Depósito de $${(payload as { depositAmount: number }).depositAmount.toLocaleString("es-AR")} en meta "${(payload as { goalName: string }).goalName}" (nuevo total: $${(payload as { newTotal: number }).newTotal.toLocaleString("es-AR")}, ${(payload as { progressPercent: number }).progressPercent}%)`,
    [AgentAction.DELETE_TRANSACTION]: `Eliminación de transacción: $${(payload as { amount: number }).amount.toLocaleString("es-AR")} en ${(payload as { category: string }).category} - "${(payload as { description: string }).description}"`,
  };

  const desc = actionDescriptions[action] ?? "Acción detectada";

  return `Sos SmartPocket. Generá un mensaje de confirmación breve (2-3 oraciones) para esta acción:

Acción: ${desc}

Datos financieros del usuario:
${financialContext}

Reglas:
- Determiná si la acción es POSITIVA (add_income, create_savings_goal, create_investment) o COSTOSA (add_expense, credit_purchase)
- Para acciones POSITIVAS: empezá con refuerzo positivo. Ej ingreso: "Buen ingreso." Ej inversión: "Copada la decisión."
- Para acciones COSTOSAS: confirmá con tono neutro. No uses palabras de alerta ("ojo", "cuidado") a menos que el gasto supere el 20% del ingreso mensual.
- Agregá un insight con datos reales (ej: "Ya llevás $X en esa categoría este mes" o "Esto es el X% de tus ingresos")
- Mencioná impacto en metas de ahorro solo si el impacto es > 5% de la meta
- Si la categoría supera el presupuesto (expense_plan), alertá brevemente
- Si no hay datos suficientes, solo confirmá la acción
- Español neutro, texto plano, sin markdown, montos $X.XXX
- Máximo 2 oraciones

Respondé ÚNICAMENTE con un JSON válido:
{"message": "tu mensaje acá"}`;
}

// --- Build post-confirmation contextual message prompt ---
function buildPostConfirmPrompt(
  action: AgentActionType,
  payload: AgentPayload,
  financialContext: string,
): string {
  const actionDescriptions: Partial<Record<AgentActionType, string>> = {
    [AgentAction.ADD_EXPENSE]: `Gasto de $${(payload as { amount: number }).amount?.toLocaleString("es-AR") ?? "0"} en ${(payload as { category: string }).category ?? "Otros"} ya guardado`,
    [AgentAction.ADD_INCOME]: `Ingreso de $${(payload as { amount: number }).amount?.toLocaleString("es-AR") ?? "0"} en ${(payload as { category: string }).category ?? "Otros"} ya guardado`,
    [AgentAction.CREATE_SAVINGS_GOAL]: `Meta de ahorro "${(payload as { name: string }).name ?? ""}" por $${(payload as { targetAmount: number }).targetAmount?.toLocaleString("es-AR") ?? "0"} creada`,
    [AgentAction.CREDIT_PURCHASE]: `Compra en cuotas por $${(payload as { totalAmount: number }).totalAmount?.toLocaleString("es-AR") ?? "0"} registrada`,
    [AgentAction.CREATE_INVESTMENT]: `Inversión de $${(payload as { amount: number }).amount?.toLocaleString("es-AR") ?? "0"} en ${(payload as { investmentType: string }).investmentType ?? "instrumento"} registrada`,
  };

  const desc = actionDescriptions[action] ?? "Acción registrada";

  return `Sos SmartPocket. La acción ya fue guardada en la base de datos. Generá UN mensaje breve confirmando el nuevo estado financiero del usuario.

Acción guardada: ${desc}

Datos financieros actualizados del usuario:
${financialContext}

Reglas:
- Para gastos: "Anotado. Llevás $X en [categoría] este mes." (usa los datos reales del contexto)
- Para ingresos: "Perfecto. Tu balance este mes es $X."
- Para metas de ahorro: "Meta creada. ¿Querés empezar a depositar?"
- Para inversiones: "Registrada. Tu portfolio activo suma $X."
- Para cuotas: "Registrado. Tenés X cuotas activas."
- Español neutro, texto plano, sin markdown, máximo 1 oración
- Usá datos reales del contexto financiero

Respondé ÚNICAMENTE con un JSON válido:
{"message": "tu mensaje acá"}`;
}

// --- Build welcome prompt ---
function buildWelcomePrompt(firstName: string, financialContext: string): string {
  const greeting = firstName ? `Hola ${firstName}` : "Hola";
  return `Sos SmartPocket, el asistente financiero personal. Generá un saludo inicial breve y personalizado.

Nombre del usuario: ${firstName || "Usuario"}

Datos financieros del usuario este mes:
${financialContext}

Reglas:
- Empezá con "${greeting}."
- Mencioná 1 dato financiero relevante del mes (balance, gasto más alto, o meta de ahorro más cercana a cumplirse)
- Terminá con "¿En qué te puedo ayudar?"
- Español neutro, texto plano, sin markdown, máximo 2 oraciones
- Si no hay datos suficientes, solo saludá y preguntá en qué ayudar

Respondé ÚNICAMENTE con un JSON válido:
{"message": "tu mensaje acá"}`;
}

// --- Build user financial context ---
async function buildUserFinancialContext(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
  includeTransactionIds = false,
): Promise<string> {
  const now = new Date();
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const endOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-31`;

  // Previous month dates
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfPrevMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}-01`;
  const endOfPrevMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}-31`;

  const [
    transactionsResult,
    prevTransactionsResult,
    plansResult,
    investmentsResult,
    creditPurchasesResult,
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, type, amount, category, description, date")
      .eq("user_id", userId)
      .gte("date", startOfMonth)
      .lte("date", endOfMonth)
      .order("date", { ascending: false }),
    supabase
      .from("transactions")
      .select("type, amount, category, description, date")
      .eq("user_id", userId)
      .gte("date", startOfPrevMonth)
      .lte("date", endOfPrevMonth),
    supabase
      .from("expense_plans")
      .select("id, name, target_amount, current_amount, deadline, category")
      .eq("user_id", userId)
      .is("deleted_at", null),
    supabase
      .from("investments")
      .select("investment_type, amount, description, is_liquidated, currency")
      .eq("user_id", userId)
      .eq("is_liquidated", false),
    supabase
      .from("credit_purchases")
      .select("id, description, category, installments")
      .eq("user_id", userId),
  ]);

  const transactions = (transactionsResult.data ?? []) as TransactionRow[];
  const prevTransactions = (prevTransactionsResult.data ??
    []) as TransactionRow[];
  const plans = (plansResult.data ?? []) as ExpensePlanRow[];
  const investments = (investmentsResult.data ?? []) as InvestmentRow[];
  const creditPurchases = (creditPurchasesResult.data ??
    []) as CreditPurchaseRow[];

  // Query installments filtered by user's purchases to ensure proper isolation
  const purchaseIds = creditPurchases.map((p) => p.id);
  let unpaidInstallments: CreditInstallmentRow[] = [];
  if (purchaseIds.length > 0) {
    const todayStr = now.toISOString().split("T")[0];
    const { data: installmentsData } = await supabase
      .from("credit_installments")
      .select("installment_number, due_date, amount, credit_purchase_id")
      .eq("paid", false)
      .in("credit_purchase_id", purchaseIds)
      .gte("due_date", todayStr)
      .order("due_date", { ascending: true })
      .limit(30);
    unpaidInstallments = (installmentsData ?? []) as CreditInstallmentRow[];
  }

  // Current month calculations
  const expenses = transactions.filter((t) => t.type === "expense");
  const incomes = transactions.filter((t) => t.type === "income");
  const credits = transactions.filter((t) => t.type === "credit");

  const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = incomes.reduce((sum, t) => sum + t.amount, 0);
  const totalCredit = credits.reduce((sum, t) => sum + t.amount, 0);

  // Previous month calculations
  const prevExpenses = prevTransactions.filter((t) => t.type === "expense");
  const prevIncomes = prevTransactions.filter((t) => t.type === "income");
  const totalPrevExpenses = prevExpenses.reduce((sum, t) => sum + t.amount, 0);
  const totalPrevIncome = prevIncomes.reduce((sum, t) => sum + t.amount, 0);

  const expensesByCategory: Record<
    string,
    { total: number; count: number; items: string[] }
  > = {};
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
    prevExpensesByCategory[t.category] =
      (prevExpensesByCategory[t.category] ?? 0) + t.amount;
  }

  const monthName = now.toLocaleString("es-AR", {
    month: "long",
    year: "numeric",
  });

  let context = `=== RESUMEN FINANCIERO DEL MES (${monthName}) ===\n`;
  context += `Total de ingresos: $${totalIncome.toLocaleString("es-AR")}\n`;
  context += `Total de gastos: $${totalExpenses.toLocaleString("es-AR")}\n`;
  context += `Total pagos tarjeta: $${totalCredit.toLocaleString("es-AR")}\n`;
  context += `Balance del mes: $${(totalIncome - totalExpenses - totalCredit).toLocaleString("es-AR")}\n\n`;

  if (Object.keys(expensesByCategory).length > 0) {
    context += "=== GASTOS POR CATEGORÍA (este mes) ===\n";
    const sorted = Object.entries(expensesByCategory).sort(
      (a, b) => b[1].total - a[1].total,
    );
    for (const [category, data] of sorted) {
      context += `- ${category}: $${data.total.toLocaleString("es-AR")} (${data.count} transacciones)`;
      if (data.items.length > 0) {
        context += ` | Ejemplos: ${data.items.join(", ")}`;
      }
      context += "\n";
    }
    context += "\n";
  }

  // Category changes (hoisted for reuse in later sections)
  const allCategoriesArray = Array.from(
    new Set([
      ...Object.keys(expensesByCategory),
      ...Object.keys(prevExpensesByCategory),
    ]),
  );
  const categoryChanges: {
    category: string;
    change: number;
    current: number;
    previous: number;
  }[] = [];

  for (const cat of allCategoriesArray) {
    const currentCat = expensesByCategory[cat]?.total ?? 0;
    const previousCat = prevExpensesByCategory[cat] ?? 0;
    if (previousCat > 0) {
      const change = Math.round(
        ((currentCat - previousCat) / previousCat) * 100,
      );
      categoryChanges.push({
        category: cat,
        change,
        current: currentCat,
        previous: previousCat,
      });
    } else if (currentCat > 0) {
      categoryChanges.push({
        category: cat,
        change: 100,
        current: currentCat,
        previous: 0,
      });
    }
  }

  // Comparison with previous month
  if (totalPrevExpenses > 0 || totalPrevIncome > 0) {
    const prevMonthName = prevMonth.toLocaleString("es-AR", { month: "long" });
    const expenseChange =
      totalPrevExpenses > 0
        ? Math.round(
            ((totalExpenses - totalPrevExpenses) / totalPrevExpenses) * 100,
          )
        : 0;

    context += `=== COMPARACIÓN CON MES ANTERIOR (${prevMonthName}) ===\n`;
    context += `Gastos mes anterior: $${totalPrevExpenses.toLocaleString("es-AR")} | Este mes: $${totalExpenses.toLocaleString("es-AR")} (${expenseChange >= 0 ? "+" : ""}${expenseChange}%)\n`;
    context += `Ingresos mes anterior: $${totalPrevIncome.toLocaleString("es-AR")} | Este mes: $${totalIncome.toLocaleString("es-AR")}\n`;

    const increases = categoryChanges
      .filter((c) => c.change > 0)
      .sort((a, b) => b.change - a.change)
      .slice(0, 3);
    const decreases = categoryChanges
      .filter((c) => c.change < 0)
      .sort((a, b) => a.change - b.change)
      .slice(0, 3);

    if (increases.length > 0) {
      context += `Categorías con mayor aumento: ${increases.map((c) => `${c.category} (+${c.change}%)`).join(", ")}\n`;
    }
    if (decreases.length > 0) {
      context += `Categorías que bajaron: ${decreases.map((c) => `${c.category} (${c.change}%)`).join(", ")}\n`;
    }

    const prevBalance = totalPrevIncome - totalPrevExpenses;
    const currentBalance = totalIncome - totalExpenses - totalCredit;
    const trend = currentBalance >= prevBalance ? "Mejorando" : "Empeorando";
    context += `Tendencia: Balance anterior $${prevBalance.toLocaleString("es-AR")} → Actual $${currentBalance.toLocaleString("es-AR")} (${trend})\n`;
    context += "\n";
  }

  if (transactions.length > 0) {
    context += `=== ÚLTIMAS TRANSACCIONES (${Math.min(transactions.length, 15)} de ${transactions.length}) ===\n`;
    for (const t of transactions.slice(0, 15)) {
      const sign = t.type === "income" ? "+" : "-";
      const idPart = includeTransactionIds && t.id ? ` [ID: ${t.id}]` : "";
      context += `[${t.date}]${idPart} ${sign}$${t.amount.toLocaleString("es-AR")} | ${t.type} | ${t.category} | ${t.description}\n`;
    }
    context += "\n";
  }

  // Credit installments context grouped by month (already filtered by user's purchases)
  if (unpaidInstallments.length > 0) {
    const purchaseLookup: Record<string, CreditPurchaseRow> = {};
    for (const p of creditPurchases) {
      purchaseLookup[p.id] = p;
    }

    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const byMonth: Record<string, CreditInstallmentRow[]> = {};
    for (const inst of unpaidInstallments) {
      const key = inst.due_date.substring(0, 7);
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(inst);
    }

    context += "=== CUOTAS DE TARJETA DE CRÉDITO POR MES ===\n";
    for (const monthKey of Object.keys(byMonth).sort()) {
      const monthInstallments = byMonth[monthKey];
      const monthTotal = monthInstallments.reduce(
        (sum, inst) => sum + inst.amount,
        0,
      );
      const [y, m] = monthKey.split("-");
      const monthLabel = new Date(
        parseInt(y),
        parseInt(m) - 1,
        1,
      ).toLocaleString("es-AR", { month: "long", year: "numeric" });
      const tag =
        monthKey === currentMonthKey
          ? " (ESTE MES)"
          : monthKey > currentMonthKey
            ? ` (mes ${Object.keys(byMonth).sort().indexOf(monthKey) - Object.keys(byMonth).sort().indexOf(currentMonthKey)} hacia adelante)`
            : "";

      context += `\n${monthLabel.toUpperCase()}${tag}:\n`;
      for (const inst of monthInstallments) {
        const purchase = purchaseLookup[inst.credit_purchase_id];
        if (purchase) {
          context += `- ${purchase.description}: Cuota ${inst.installment_number}/${purchase.installments} - $${inst.amount.toLocaleString("es-AR")} - Vence ${inst.due_date}\n`;
        }
      }
      context += `Total ${monthLabel}: $${monthTotal.toLocaleString("es-AR")}\n`;
    }
    context += "\n";
  }

  if (plans.length > 0) {
    context += "=== METAS DE AHORRO ACTIVAS ===\n";
    for (const p of plans) {
      const progress =
        p.target_amount > 0
          ? Math.round((p.current_amount / p.target_amount) * 100)
          : 0;
      context += `- [ID: ${p.id}] ${p.name}: $${p.current_amount.toLocaleString("es-AR")} / $${p.target_amount.toLocaleString("es-AR")} (${progress}%) | Fecha: ${p.deadline}\n`;
    }
    context += "\n";
  }

  if (investments.length > 0) {
    const totalInvestments = investments.reduce(
      (sum, inv) => sum + inv.amount,
      0,
    );
    context += "=== INVERSIONES ACTIVAS ===\n";
    for (const inv of investments) {
      context += `- ${inv.investment_type}: $${inv.amount.toLocaleString("es-AR")} | ${inv.description}`;
      if (inv.currency) {
        context += ` (${inv.currency})`;
      }
      context += "\n";
    }
    context += `Portfolio total inversiones: $${totalInvestments.toLocaleString("es-AR")}\n\n`;
  }

  // --- GASTOS ESPECÍFICOS DESTACABLES ---
  if (totalIncome > 0 && expenses.length > 0) {
    const significantExpenses = expenses.filter(
      (t) => t.amount > totalIncome * 0.1,
    );
    const categoryGroups: Record<
      string,
      { count: number; total: number; avgAmount: number }
    > = {};
    for (const t of expenses) {
      if (!categoryGroups[t.category]) {
        categoryGroups[t.category] = { count: 0, total: 0, avgAmount: 0 };
      }
      categoryGroups[t.category].count += 1;
      categoryGroups[t.category].total += t.amount;
    }
    for (const cat of Object.keys(categoryGroups)) {
      categoryGroups[cat].avgAmount = Math.round(
        categoryGroups[cat].total / categoryGroups[cat].count,
      );
    }

    const antExpenses = Object.entries(categoryGroups).filter(
      ([, data]) => data.count >= 5 && data.avgAmount < totalIncome * 0.05,
    );

    const risingCategories = categoryChanges.filter((c) => c.change > 30);

    if (
      significantExpenses.length > 0 ||
      antExpenses.length > 0 ||
      risingCategories.length > 0
    ) {
      context += "=== GASTOS ESPECÍFICOS DESTACABLES ===\n";

      if (significantExpenses.length > 0) {
        context += "GASTOS SIGNIFICATIVOS (>10% del ingreso):\n";
        for (const t of significantExpenses.slice(0, 5)) {
          const pct = Math.round((t.amount / totalIncome) * 100);
          context += `- [${t.date}] $${t.amount.toLocaleString("es-AR")} | ${t.category} | ${t.description} (${pct}% del ingreso)\n`;
        }
      }

      if (antExpenses.length > 0) {
        context +=
          "GASTOS HORMIGA (5+ transacciones pequeñas en misma categoría):\n";
        for (const [cat, data] of antExpenses) {
          context += `- ${cat}: ${data.count} transacciones, total $${data.total.toLocaleString("es-AR")} (promedio $${data.avgAmount.toLocaleString("es-AR")} c/u)\n`;
        }
      }

      if (risingCategories.length > 0) {
        context += "CATEGORÍAS EN AUMENTO (>30% vs mes anterior):\n";
        for (const c of risingCategories) {
          context += `- ${c.category}: +${c.change}% ($${c.previous.toLocaleString("es-AR")} → $${c.current.toLocaleString("es-AR")})\n`;
        }
      }

      context += "\n";
    }
  }

  // --- PERFIL DE RIESGO INFERIDO ---
  let riskProfile =
    "Sin inversiones - Sugerir inicio con opciones conservadoras";
  if (investments.length > 0) {
    const conservativeTypes = new Set([
      "plazo_fijo",
      "fci",
      "cauciones",
      "letras",
    ]);
    const aggressiveTypes = new Set(["crypto", "acciones", "cedears"]);
    const hasConservative = investments.some((inv) =>
      conservativeTypes.has(inv.investment_type),
    );
    const hasAggressive = investments.some((inv) =>
      aggressiveTypes.has(inv.investment_type),
    );

    if (hasConservative && hasAggressive) {
      riskProfile = "Moderado";
    } else if (hasAggressive) {
      riskProfile = "Agresivo";
    } else {
      riskProfile = "Conservador";
    }
  }

  const savingsRate =
    totalIncome > 0
      ? Math.round(
          ((totalIncome - totalExpenses - totalCredit) / totalIncome) * 100,
        )
      : 0;

  context += "=== PERFIL DE RIESGO INFERIDO ===\n";
  context += `Perfil: ${riskProfile}\n`;
  context += `Tasa de ahorro: ${savingsRate}%\n\n`;

  // --- DATOS PRE-COMPUTADOS Y SCORING ---
  const surplus = totalIncome - totalExpenses - totalCredit;
  const top3Categories = Object.entries(expensesByCategory)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 3);

  // Upcoming installments total (next 30 days)
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const thirtyDaysStr = thirtyDaysFromNow.toISOString().split("T")[0];
  const userInstallments = unpaidInstallments.filter((inst) => {
    const purchase = creditPurchases.find(
      (p) => p.id === inst.credit_purchase_id,
    );
    return purchase && inst.due_date <= thirtyDaysStr;
  });
  const upcomingInstallmentsTotal = userInstallments.reduce(
    (sum, inst) => sum + inst.amount,
    0,
  );

  const dayOfMonth = now.getDate();
  const hasSavingsGoals = plans.length > 0;

  context += "=== DATOS PRE-COMPUTADOS ===\n";
  context += `Superávit/Déficit mensual: $${surplus.toLocaleString("es-AR")}\n`;
  if (top3Categories.length > 0) {
    context += `Top 3 gastos: ${top3Categories.map(([cat, data], i) => `${i + 1}. ${cat} ($${data.total.toLocaleString("es-AR")})`).join(", ")}\n`;
  }
  context += `Cuotas próximos 30 días: $${upcomingInstallmentsTotal.toLocaleString("es-AR")} (${userInstallments.length} cuotas)\n`;
  context += `Día del mes: ${dayOfMonth} de 30 (para alertas proactivas)\n`;
  context += `Tiene fondo de emergencia: ${hasSavingsGoals ? "Sí" : "No"}\n\n`;

  // --- SCORING FINANCIERO PRE-CALCULADO ---
  // Tasa de ahorro: >20% = 3, 10-20% = 2, 0-10% = 1, negativa = 0
  let savingsScore = 0;
  if (savingsRate > 20) savingsScore = 3;
  else if (savingsRate >= 10) savingsScore = 2;
  else if (savingsRate > 0) savingsScore = 1;

  // Tendencia: mejorando = 2, estable = 1, empeorando = 0
  const prevBalance = totalPrevIncome - totalPrevExpenses;
  const currentBalance = totalIncome - totalExpenses - totalCredit;
  let trendScore = 1;
  let trendLabel = "Estable";
  if (currentBalance > prevBalance * 1.1) {
    trendScore = 2;
    trendLabel = "Mejorando";
  } else if (currentBalance < prevBalance * 0.9) {
    trendScore = 0;
    trendLabel = "Empeorando";
  }

  // Inversiones: tiene = 2, no tiene = 0
  const investmentScore = investments.length > 0 ? 2 : 0;

  // Deuda: cuotas < 20% ingreso = 2, 20-40% = 1, >40% = 0
  const debtPct =
    totalIncome > 0
      ? Math.round((upcomingInstallmentsTotal / totalIncome) * 100)
      : 0;
  let debtScore = 0;
  if (debtPct < 20) debtScore = 2;
  else if (debtPct <= 40) debtScore = 1;

  // Fondo emergencia: tiene = 1, no tiene = 0
  const emergencyScore = hasSavingsGoals ? 1 : 0;

  const totalScore =
    savingsScore + trendScore + investmentScore + debtScore + emergencyScore;

  context += "=== SCORING FINANCIERO PRE-CALCULADO ===\n";
  context += `Tasa de ahorro: ${savingsRate}% (puntos: ${savingsScore}/3)\n`;
  context += `Tendencia: ${trendLabel} (puntos: ${trendScore}/2)\n`;
  context += `Inversiones: ${investments.length > 0 ? "Tiene" : "No tiene"} (puntos: ${investmentScore}/2)\n`;
  context += `Deuda: ${debtPct}% del ingreso (puntos: ${debtScore}/2)\n`;
  context += `Fondo emergencia: ${hasSavingsGoals ? "Sí" : "No"} (puntos: ${emergencyScore}/1)\n`;
  context += `Score total: ${totalScore}/10\n\n`;

  // --- PATRONES RECURRENTES ---
  const allTransactionsForPatterns = [...transactions, ...prevTransactions];
  const patterns = detectRecurringPatterns(allTransactionsForPatterns);
  if (patterns.length > 0) {
    context += formatPatterns(patterns);
  }

  // --- ADHERENCIA A PRESUPUESTOS ---
  if (plans.length > 0 && Object.keys(expensesByCategory).length > 0) {
    const budgetLines: string[] = [];
    for (const plan of plans) {
      const categoryExpense = expensesByCategory[plan.category]?.total ?? 0;
      if (plan.target_amount > 0) {
        const pct = Math.round((categoryExpense / plan.target_amount) * 100);
        let statusLabel = "En buen camino";
        if (pct >= 100) statusLabel = "EXCEDIDO";
        else if (pct >= 90) statusLabel = "ALERTA: casi al limite";
        else if (pct >= 75) statusLabel = "Atencion";
        budgetLines.push(
          `- ${plan.category} (${plan.name}): $${categoryExpense.toLocaleString("es-AR")} / $${plan.target_amount.toLocaleString("es-AR")} (${pct}%) - ${statusLabel}`,
        );
      }
    }
    if (budgetLines.length > 0) {
      context += "=== ADHERENCIA A PRESUPUESTOS ===\n";
      context += budgetLines.join("\n") + "\n\n";
    }
  }

  return context;
}

interface MarketListItem {
  symbol: string;
  price: number;
  change: number;
}

interface DollarApiEntry {
  nombre: string;
  compra: number;
  venta: number;
  casa: string;
}

interface CryptoApiResponse {
  displayName: string;
  marketData: {
    currentPrice: number;
    dailyChangePercent: number;
    dailyHigh: number;
    dailyLow: number;
  };
}

async function buildMarketContext(
  baseUrl: string,
  transcription: string,
  action?: string,
): Promise<string> {
  const lowerTranscription = transcription.toLowerCase();

  const marketFetches: Promise<string>[] = [];
  let hasAcciones = false;
  let hasBonos = false;

  // Always include dollar rates
  marketFetches.push(
    fetch(`${baseUrl}/api/market?type=dolar`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data)) return "";
        const rates = data as DollarApiEntry[];
        return (
          "Cotización del dólar:\n" +
          rates
            .map(
              (r) => `  ${r.nombre}: Compra $${r.compra} / Venta $${r.venta}`,
            )
            .join("\n")
        );
      })
      .catch(() => ""),
  );

  if (
    lowerTranscription.includes("bitcoin") ||
    lowerTranscription.includes("btc") ||
    lowerTranscription.includes("crypto") ||
    lowerTranscription.includes("ethereum") ||
    lowerTranscription.includes("cripto")
  ) {
    marketFetches.push(
      fetch(`${baseUrl}/api/market?type=crypto&instrumentId=100000`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return "";
          const d = data as CryptoApiResponse;
          return `Crypto - ${d.displayName}: Precio actual USD $${d.marketData.currentPrice}, Cambio diario: ${d.marketData.dailyChangePercent.toFixed(2)}%, Máximo del día: $${d.marketData.dailyHigh}, Mínimo: $${d.marketData.dailyLow}`;
        })
        .catch(() => ""),
    );
  }

  if (
    lowerTranscription.includes("accion") ||
    lowerTranscription.includes("acciones") ||
    lowerTranscription.includes("bolsa") ||
    lowerTranscription.includes("merval") ||
    lowerTranscription.includes("invertir") ||
    lowerTranscription.includes("inversion") ||
    lowerTranscription.includes("inversiones") ||
    lowerTranscription.includes("me conviene")
  ) {
    hasAcciones = true;
    marketFetches.push(
      fetch(`${baseUrl}/api/market?type=acciones`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data || !Array.isArray(data)) return "";
          const top5 = data.slice(0, 5) as MarketListItem[];
          return (
            "Acciones argentinas (top 5):\n" +
            top5
              .map(
                (s: MarketListItem) =>
                  `  ${s.symbol}: $${s.price} (${s.change > 0 ? "+" : ""}${s.change}%)`,
              )
              .join("\n")
          );
        })
        .catch(() => ""),
    );
  }

  if (
    lowerTranscription.includes("bono") ||
    lowerTranscription.includes("bonos") ||
    lowerTranscription.includes("invertir") ||
    lowerTranscription.includes("inversion") ||
    lowerTranscription.includes("inversiones") ||
    lowerTranscription.includes("me conviene")
  ) {
    hasBonos = true;
    marketFetches.push(
      fetch(`${baseUrl}/api/market?type=bonos`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data || !Array.isArray(data)) return "";
          const top5 = data.slice(0, 5) as MarketListItem[];
          return (
            "Bonos argentinos (top 5):\n" +
            top5
              .map(
                (b: MarketListItem) =>
                  `  ${b.symbol}: $${b.price} (${b.change > 0 ? "+" : ""}${b.change}%)`,
              )
              .join("\n")
          );
        })
        .catch(() => ""),
    );
  }

  if (lowerTranscription.includes("cedear")) {
    marketFetches.push(
      fetch(`${baseUrl}/api/market?type=cedears`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data || !Array.isArray(data)) return "";
          const top5 = data.slice(0, 5) as MarketListItem[];
          return (
            "CEDEARs (top 5):\n" +
            top5
              .map(
                (c: MarketListItem) =>
                  `  ${c.symbol}: $${c.price} (${c.change > 0 ? "+" : ""}${c.change}%)`,
              )
              .join("\n")
          );
        })
        .catch(() => ""),
    );
  }

  if (
    lowerTranscription.includes("plazo fijo") ||
    lowerTranscription.includes("tasa") ||
    lowerTranscription.includes("rendimiento") ||
    lowerTranscription.includes("letras") ||
    lowerTranscription.includes("lecap")
  ) {
    marketFetches.push(
      fetch(`${baseUrl}/api/market?type=letras`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data || !Array.isArray(data)) return "";
          const top5 = data.slice(0, 5) as MarketListItem[];
          return (
            "Letras/LECAPs (top 5):\n" +
            top5
              .map(
                (l: MarketListItem) =>
                  `  ${l.symbol}: $${l.price} (${l.change > 0 ? "+" : ""}${l.change}%)`,
              )
              .join("\n")
          );
        })
        .catch(() => ""),
    );
  }

  // For general_question, always include diversified market data if not already added by keywords
  if (action === "general_question") {
    if (!hasAcciones) {
      marketFetches.push(
        fetch(`${baseUrl}/api/market?type=acciones`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (!data || !Array.isArray(data)) return "";
            const top5 = data.slice(0, 5) as MarketListItem[];
            return (
              "Acciones argentinas (top 5):\n" +
              top5
                .map(
                  (s: MarketListItem) =>
                    `  ${s.symbol}: $${s.price} (${s.change > 0 ? "+" : ""}${s.change}%)`,
                )
                .join("\n")
            );
          })
          .catch(() => ""),
      );
    }
    if (!hasBonos) {
      marketFetches.push(
        fetch(`${baseUrl}/api/market?type=bonos`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (!data || !Array.isArray(data)) return "";
            const top5 = data.slice(0, 5) as MarketListItem[];
            return (
              "Bonos argentinos (top 5):\n" +
              top5
                .map(
                  (b: MarketListItem) =>
                    `  ${b.symbol}: $${b.price} (${b.change > 0 ? "+" : ""}${b.change}%)`,
                )
                .join("\n")
            );
          })
          .catch(() => ""),
      );
    }
  }

  const results = await Promise.all(marketFetches);
  return results.filter(Boolean).join("\n\n");
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authorizedRoles: UserRole[] = [USER_ROLES.PREMIUM, USER_ROLES.ADMIN];
  const userRole = user.app_metadata?.role;

  if (!authorizedRoles.includes(userRole)) {
    return NextResponse.json(
      { error: "Forbidden: Premium required" },
      { status: 403 },
    );
  }

  try {
    const body: {
      transcription: string;
      step: "classify" | "execute" | "unified" | "post-confirm" | "welcome";
      action?: AgentActionType;
      payload?: AgentPayload;
      conversationHistory?: ConversationMessage[];
    } = await request.json();
    const { transcription, step, conversationHistory } = body;

    if (!step) {
      return NextResponse.json({ error: "Missing step" }, { status: 400 });
    }

    // --- POST-CONFIRM: generate contextual message after action is saved ---
    if (step === "post-confirm") {
      const action = body.action;
      const payload = body.payload;
      if (!action || !payload) {
        return NextResponse.json({ message: "Listo, se registró correctamente." });
      }
      const financialContext = await buildUserFinancialContext(supabase, user.id);
      const postConfirmPrompt = buildPostConfirmPrompt(action, payload, financialContext);
      try {
        const raw = await executeWithNvidia(postConfirmPrompt);
        const parsed = safeParseJson<{ message: string }>(raw, { message: "" });
        return NextResponse.json({ message: parsed.message || "Listo, se registró correctamente." });
      } catch {
        return NextResponse.json({ message: "Listo, se registró correctamente." });
      }
    }

    // --- WELCOME: personalized greeting with financial context ---
    if (step === "welcome") {
      const firstName =
        (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? "";
      const financialContext = await buildUserFinancialContext(supabase, user.id);
      const welcomePrompt = buildWelcomePrompt(firstName, financialContext);
      const fallback = `Hola${firstName ? ` ${firstName}` : ""}. ¿En qué te puedo ayudar?`;
      try {
        const raw = await executeWithNvidia(welcomePrompt);
        const parsed = safeParseJson<{ message: string }>(raw, { message: "" });
        return NextResponse.json({ message: parsed.message || fallback });
      } catch {
        return NextResponse.json({ message: fallback });
      }
    }

    if (!transcription) {
      return NextResponse.json(
        { error: "Missing transcription" },
        { status: 400 },
      );
    }

    // --- UNIFIED: classify + execute in minimal API calls ---
    if (step === "unified") {
      // Step 1: Classify with NVIDIA (free, no quota)
      const classification = await classifyWithNvidia(
        transcription,
        conversationHistory,
      );
      const action = classification.action;

      // Low confidence: ask for reformulation instead of executing incorrectly
      if (classification.confidence < 0.65) {
        return NextResponse.json({
          action: "general_question",
          confidence: classification.confidence,
          payload: {
            action: "general_question",
            answer: "No entendí bien tu consulta. ¿Podés reformularla?",
          },
          message: "No entendí bien tu consulta. ¿Podés reformularla?",
        });
      }

      // Step 2: Execute based on action type
      let result: AgentExecuteResponse;

      // Dollar rate: no AI needed at all
      if (action === AgentAction.DOLLAR_RATE) {
        const baseUrl = request.nextUrl.origin;
        const marketResponse = await fetch(`${baseUrl}/api/market?type=dolar`);

        if (!marketResponse.ok) {
          return NextResponse.json(
            { error: "No se pudo obtener la cotización del dólar" },
            { status: 500 },
          );
        }

        const rates = await marketResponse.json();
        const strategy = getStrategy(action);
        const payload = strategy.parseResponse(JSON.stringify(rates));

        result = { payload, message: "Cotización del dólar obtenida" };
      }
      // Scan receipt: fast-path, no AI needed
      else if (action === AgentAction.SCAN_RECEIPT) {
        return NextResponse.json({
          action,
          confidence: classification.confidence,
          payload: { action: "scan_receipt", triggerScanner: true },
          message: "Abriendo el scanner de tickets...",
        });
      }
      // Data query: two-pass flow (extract params → fetch data → generate answer)
      else if (action === AgentAction.DATA_QUERY) {
        // Pass 1: Extract query parameters from natural language
        const paramStrategy = getStrategy(action);
        const paramPrompt = paramStrategy.buildPrompt(
          transcription,
          undefined,
          conversationHistory,
        );
        const rawParams = await executeWithNvidia(
          paramPrompt,
          conversationHistory,
        );
        const now = new Date();
        const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        const todayStr = now.toISOString().split("T")[0];
        const defaultParams: DataQueryParams = {
          dateFrom: startOfMonth,
          dateTo: todayStr,
          transactionType: "all",
          category: "",
          comparisonDateFrom: null,
          comparisonDateTo: null,
          dataScope: "all",
          queryIntent: "sum",
        };
        const queryParams = safeParseJson<DataQueryParams>(
          rawParams,
          defaultParams,
        );

        // Pass 2: Fetch actual data from Supabase
        const queryResults = await fetchDataForQuery(
          supabase,
          user.id,
          queryParams,
        );

        // Pass 3: Generate natural language answer with real data
        const answerPrompt = buildDataAnswerPrompt(
          transcription,
          queryResults,
          conversationHistory,
        );
        const rawAnswer = await executeWithNvidia(
          answerPrompt,
          conversationHistory,
        );
        const parsed = safeParseJson<{ answer: string }>(rawAnswer, {
          answer: "No pude procesar la consulta. Intentá de nuevo.",
        });

        result = {
          payload: { action: "data_query", answer: parsed.answer },
          message: parsed.answer,
        };
      } else {
        const strategy = getStrategy(action);

        // Build context if needed
        let context: string | undefined;

        if (strategy.needsUserData) {
          const includeIds = action === AgentAction.DELETE_TRANSACTION;
          context = await buildUserFinancialContext(supabase, user.id, includeIds);
        }

        if (
          strategy.needsMarketData &&
          (action !== AgentAction.GENERAL_QUESTION ||
            transcriptionNeedsMarketData(transcription))
        ) {
          const baseUrl = request.nextUrl.origin;
          const marketContext = await buildMarketContext(
            baseUrl,
            transcription,
            action,
          );
          context = context ? `${context}\n\n${marketContext}` : marketContext;
        }

        const prompt = strategy.buildPrompt(
          transcription,
          context,
          conversationHistory,
        );

        const rawContent = await executeWithNvidia(prompt, conversationHistory);

        const payload = strategy.parseResponse(rawContent);

        // Handle clarification responses
        if (payload.action === AgentAction.CLARIFICATION) {
          const clarification = payload as AgentClarificationPayload;
          return NextResponse.json({
            action: clarification.originalAction,
            confidence: classification.confidence,
            payload: clarification,
            message: clarification.question,
          });
        }

        // Generate smart insight for DB actions
        const message = await generateActionMessage(
          action,
          payload,
          context,
          conversationHistory,
        );

        result = { payload, message };
      }

      return NextResponse.json({
        action,
        confidence: classification.confidence,
        ...result,
      });
    }

    // --- Legacy two-step mode (kept for compatibility) ---
    if (step === "classify") {
      const classification = await classifyWithNvidia(
        transcription,
        conversationHistory,
      );
      return NextResponse.json(classification);
    }

    if (step === "execute") {
      const action = body.action;
      if (!action) {
        return NextResponse.json({ error: "Missing action" }, { status: 400 });
      }

      if (action === AgentAction.DOLLAR_RATE) {
        const baseUrl = request.nextUrl.origin;
        const marketResponse = await fetch(`${baseUrl}/api/market?type=dolar`);
        if (!marketResponse.ok) {
          return NextResponse.json(
            { error: "Failed to fetch dollar rates" },
            { status: 500 },
          );
        }
        const rates = await marketResponse.json();
        const strategy = getStrategy(action);
        const payload = strategy.parseResponse(JSON.stringify(rates));
        return NextResponse.json({
          payload,
          message: "Cotización del dólar obtenida",
        });
      }

      // Scan receipt: fast-path, no AI needed
      if (action === AgentAction.SCAN_RECEIPT) {
        return NextResponse.json({
          payload: { action: "scan_receipt", triggerScanner: true },
          message: "Abriendo el scanner de tickets...",
        });
      }

      // Data query: two-pass flow (extract params → fetch data → generate answer)
      if (action === AgentAction.DATA_QUERY) {
        // Pass 1: Extract query parameters from natural language
        const paramStrategy = getStrategy(action);
        const paramPrompt = paramStrategy.buildPrompt(
          transcription,
          undefined,
          conversationHistory,
        );
        const rawParams = await executeWithNvidia(
          paramPrompt,
          conversationHistory,
        );
        const now = new Date();
        const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        const todayStr = now.toISOString().split("T")[0];
        const defaultParams: DataQueryParams = {
          dateFrom: startOfMonth,
          dateTo: todayStr,
          transactionType: "all",
          category: "",
          comparisonDateFrom: null,
          comparisonDateTo: null,
          dataScope: "all",
          queryIntent: "sum",
        };
        const queryParams = safeParseJson<DataQueryParams>(
          rawParams,
          defaultParams,
        );

        // Pass 2: Fetch actual data from Supabase
        const queryResults = await fetchDataForQuery(
          supabase,
          user.id,
          queryParams,
        );

        // Pass 3: Generate natural language answer with real data
        const answerPrompt = buildDataAnswerPrompt(
          transcription,
          queryResults,
          conversationHistory,
        );
        const rawAnswer = await executeWithNvidia(
          answerPrompt,
          conversationHistory,
        );
        const parsed = safeParseJson<{ answer: string }>(rawAnswer, {
          answer: "No pude procesar la consulta. Intentá de nuevo.",
        });

        return NextResponse.json({
          payload: { action: "data_query", answer: parsed.answer },
          message: parsed.answer,
        });
      }

      const strategy = getStrategy(action);
      let context: string | undefined;
      if (strategy.needsUserData) {
        const includeIds = action === AgentAction.DELETE_TRANSACTION;
        context = await buildUserFinancialContext(supabase, user.id, includeIds);
      }
      if (
        strategy.needsMarketData &&
        (action !== AgentAction.GENERAL_QUESTION ||
          transcriptionNeedsMarketData(transcription))
      ) {
        const baseUrl = request.nextUrl.origin;
        const marketContext = await buildMarketContext(
          baseUrl,
          transcription,
          action,
        );
        context = context ? `${context}\n\n${marketContext}` : marketContext;
      }

      const prompt = strategy.buildPrompt(
        transcription,
        context,
        conversationHistory,
      );
      const rawContent = await executeWithNvidia(prompt, conversationHistory);

      const payload = strategy.parseResponse(rawContent);

      // Handle clarification responses
      if (payload.action === AgentAction.CLARIFICATION) {
        const clarification = payload as AgentClarificationPayload;
        return NextResponse.json({
          action: clarification.originalAction,
          confidence: 1,
          payload: clarification,
          message: clarification.question,
        });
      }

      // Generate smart insight for DB actions
      const message = await generateActionMessage(
        action,
        payload,
        context,
        conversationHistory,
      );

      return NextResponse.json({ payload, message });
    }

    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  } catch (error) {
    console.error("Agent API error:", error);

    // Better error messages for rate limits
    const errorMessage = error instanceof Error ? error.message : "";
    if (
      errorMessage.includes("429") ||
      errorMessage.includes("quota") ||
      errorMessage.includes("RESOURCE_EXHAUSTED")
    ) {
      return NextResponse.json(
        {
          error:
            "Se alcanzó el límite de consultas. Intentá de nuevo en unos segundos.",
        },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: "Error procesando tu solicitud. Intentá de nuevo." },
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
  AgentAction.SAVINGS_DEPOSIT,
  AgentAction.DELETE_TRANSACTION,
]);

async function generateActionMessage(
  action: AgentActionType,
  payload: AgentPayload,
  financialContext: string | undefined,
  conversationHistory?: ConversationMessage[],
): Promise<string> {
  // Fallback messages
  const fallbackMessages: Record<AgentActionType, string> = {
    [AgentAction.ADD_EXPENSE]: `Gasto de $${(payload as { amount: number }).amount?.toLocaleString("es-AR") ?? "0"} detectado`,
    [AgentAction.ADD_INCOME]: `Ingreso de $${(payload as { amount: number }).amount?.toLocaleString("es-AR") ?? "0"} detectado`,
    [AgentAction.CREATE_SAVINGS_GOAL]: "Meta de ahorro detectada",
    [AgentAction.CREDIT_PURCHASE]: "Compra en cuotas detectada",
    [AgentAction.CREATE_INVESTMENT]: "Inversión detectada",
    [AgentAction.DOLLAR_RATE]: "Cotización obtenida",
    [AgentAction.MARKET_QUERY]: (payload as { answer: string }).answer,
    [AgentAction.GENERAL_QUESTION]: (payload as { answer: string }).answer,
    [AgentAction.DATA_QUERY]: (payload as { answer: string }).answer,
    [AgentAction.SCAN_RECEIPT]: "Abriendo el scanner de tickets...",
    [AgentAction.CLARIFICATION]: (payload as { question: string }).question,
    [AgentAction.SAVINGS_DEPOSIT]: `Depósito de $${(payload as { depositAmount: number }).depositAmount?.toLocaleString("es-AR") ?? "0"} en ${(payload as { goalName: string }).goalName ?? "meta"}`,
    [AgentAction.DELETE_TRANSACTION]: `Eliminar: ${(payload as { description: string }).description ?? "transacción"}`,
  };

  // Only generate insights for DB actions with financial context
  if (!DB_ACTIONS.has(action) || !financialContext) {
    return fallbackMessages[action];
  }

  try {
    const insightPrompt = buildInsightPrompt(action, payload, financialContext);
    const rawInsight = await executeWithNvidia(
      insightPrompt,
      conversationHistory,
    );
    const parsed = safeParseJson<{ message: string }>(rawInsight, {
      message: "",
    });
    return parsed.message || fallbackMessages[action];
  } catch {
    return fallbackMessages[action];
  }
}
