import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { USER_ROLES, type UserRole } from "@/types/database";
import { GeminiModels } from "@/public/enums";
import { shoppingRecommendationsPrompt } from "@/public/promts/shopping-recommendations";
import { generateContentWithRetry } from "@/lib/gemini";
import {
  aggregateProductStats,
  buildShoppingSummary,
  normalizeProductName,
  type TicketWithItems,
} from "@/lib/shopping-stats";
import {
  predictNeeds,
  type NeedPrediction,
  type PredictionConfidence,
  type Urgency,
} from "@/lib/shopping-predictions";

interface LlmRecommendation {
  product_name?: unknown;
  suggested_quantity?: unknown;
  estimated_price?: unknown;
  frequency?: unknown;
  reason?: unknown;
  evidence_ticket_ids?: unknown;
  confidence?: unknown;
}

interface LlmResponse {
  recommendations?: unknown;
  insights?: unknown;
  data_note?: unknown;
}

interface ValidatedRecommendation {
  product_name: string;
  suggested_quantity: number;
  estimated_price: number;
  frequency: string;
  reason: string;
  evidence_ticket_ids: string[];
  confidence: PredictionConfidence;
  urgency: Urgency;
  days_until_expected: number | null;
  category: string;
}

interface ShoppingResponse {
  recommendations: ValidatedRecommendation[];
  insights: string;
  data_note: string;
  message?: string;
  total_estimated: number;
}

function isLlmResponse(value: unknown): value is LlmResponse {
  if (value === null || typeof value !== "object") return false;
  const obj: Record<string, unknown> = value as Record<string, unknown>;
  return (
    "recommendations" in obj || "insights" in obj || "data_note" in obj
  );
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function tokenize(value: string): Set<string> {
  return new Set(
    normalizeProductName(value)
      .split(" ")
      .filter((w) => w.length >= 3),
  );
}

function findMatchingPrediction(
  productName: string,
  predictions: NeedPrediction[],
): NeedPrediction | null {
  const normalized: string = normalizeProductName(productName);
  if (normalized.length === 0) return null;

  const exact: NeedPrediction | undefined = predictions.find(
    (p) => normalizeProductName(p.product.display_name) === normalized,
  );
  if (exact !== undefined) return exact;

  for (const prediction of predictions) {
    const statName: string = prediction.product.name;
    if (statName.length >= 6) {
      if (normalized.includes(statName) || statName.includes(normalized)) {
        return prediction;
      }
    }
  }

  const inputTokens: Set<string> = tokenize(productName);
  if (inputTokens.size < 2) return null;

  let best: { prediction: NeedPrediction; overlap: number } | null = null;
  for (const prediction of predictions) {
    const statTokens: Set<string> = tokenize(prediction.product.display_name);
    let overlap: number = 0;
    statTokens.forEach((token: string) => {
      if (inputTokens.has(token)) overlap++;
    });
    if (overlap >= 2 && (best === null || overlap > best.overlap)) {
      best = { prediction, overlap };
    }
  }
  return best?.prediction ?? null;
}

function extractJson(text: string): string {
  const jsonMatch: RegExpMatchArray | null =
    text.match(/```json([\s\S]*?)```/) ||
    text.match(/```([\s\S]*?)```/) ||
    text.match(/\{[\s\S]*\}/);

  if (jsonMatch === null) return text;
  const captured: string | undefined = jsonMatch[1];
  return (captured ?? jsonMatch[0]).trim();
}

function buildFallbackReason(prediction: NeedPrediction): string {
  const { product, urgency, days_until_expected, confidence } = prediction;

  if (urgency === "overdue" && days_until_expected !== null) {
    return `Hace ${product.days_since_last} días que no lo comprás y tu ciclo es cada ${product.avg_gap_days ?? "?"}. Estás atrasado ${Math.abs(days_until_expected)} días, te toca reponer.`;
  }

  if (urgency === "due_soon" && days_until_expected !== null) {
    return `Comprás cada ${product.avg_gap_days ?? "?"} días. Ya pasaron ${product.days_since_last}, te toca en ${days_until_expected}.`;
  }

  if (urgency === "scheduled" && days_until_expected !== null) {
    return `Tu próximo ciclo de compra es en ${days_until_expected} días. Te lo incluyo igual por si querés anticipar.`;
  }

  return `Compraste este producto una vez hace ${product.days_since_last} días. No hay patrón claro todavía${
    confidence === "low" ? ", te lo sugiero con baja confianza" : ""
  }.`;
}

function validateAndEnrich(
  raw: LlmResponse,
  predictions: NeedPrediction[],
): {
  recommendations: ValidatedRecommendation[];
  insights: string;
  data_note: string;
  total: number;
} {
  const recommendations: ValidatedRecommendation[] = [];
  const rawRecs: unknown[] = Array.isArray(raw.recommendations)
    ? raw.recommendations
    : [];
  const matchedKeys: Set<string> = new Set();

  for (const rawRec of rawRecs) {
    if (rawRec === null || typeof rawRec !== "object") continue;
    const rec: LlmRecommendation = rawRec as LlmRecommendation;

    if (!isString(rec.product_name)) continue;

    const prediction: NeedPrediction | null = findMatchingPrediction(
      rec.product_name,
      predictions,
    );
    if (prediction === null) {
      console.warn(
        `[shopping-recs] LLM tried to add non-predicted product: "${rec.product_name}" — dropped`,
      );
      continue;
    }

    const productKey: string = prediction.product.name;
    if (matchedKeys.has(productKey)) {
      console.warn(
        `[shopping-recs] Duplicate recommendation for "${rec.product_name}" — dropped`,
      );
      continue;
    }
    matchedKeys.add(productKey);

    const reason: string = isString(rec.reason) && rec.reason.length > 0
      ? rec.reason
      : buildFallbackReason(prediction);

    const rawEvidence: unknown = rec.evidence_ticket_ids;
    const evidenceFromLlm: string[] = Array.isArray(rawEvidence)
      ? rawEvidence.filter(isString)
      : [];
    const validEvidence: string[] = evidenceFromLlm.filter((id) =>
      prediction.product.ticket_ids.includes(id),
    );
    const evidence: string[] =
      validEvidence.length > 0 ? validEvidence : prediction.product.ticket_ids;

    recommendations.push({
      product_name: prediction.product.display_name,
      suggested_quantity: prediction.expected_quantity,
      estimated_price: prediction.expected_unit_price,
      frequency: "Mensual",
      reason,
      evidence_ticket_ids: evidence,
      confidence: prediction.confidence,
      urgency: prediction.urgency,
      days_until_expected: prediction.days_until_expected,
      category: prediction.product.category,
    });
  }

  const total: number = recommendations.reduce(
    (sum, r) => sum + r.estimated_price * r.suggested_quantity,
    0,
  );

  return {
    recommendations,
    insights: isString(raw.insights) ? raw.insights : "",
    data_note: isString(raw.data_note) ? raw.data_note : "",
    total,
  };
}

function buildResponseFromPredictions(
  predictions: NeedPrediction[],
  dataNote: string,
): ShoppingResponse {
  const recommendations: ValidatedRecommendation[] = predictions.map(
    (prediction) => {
      const evidence: string[] = prediction.product.ticket_ids;
      return {
        product_name: prediction.product.display_name,
        suggested_quantity: prediction.expected_quantity,
        estimated_price: prediction.expected_unit_price,
        frequency: "Mensual",
        reason: buildFallbackReason(prediction),
        evidence_ticket_ids: evidence,
        confidence: prediction.confidence,
        urgency: prediction.urgency,
        days_until_expected: prediction.days_until_expected,
        category: prediction.product.category,
      };
    },
  );

  const total: number = recommendations.reduce(
    (sum, r) => sum + r.estimated_price * r.suggested_quantity,
    0,
  );

  return {
    recommendations,
    insights: "",
    data_note: dataNote,
    total_estimated: total,
  };
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authorizedRoles: UserRole[] = [USER_ROLES.PREMIUM, USER_ROLES.ADMIN];
  const userRole: string | undefined = user.app_metadata?.role;

  if (
    typeof userRole !== "string" ||
    !authorizedRoles.includes(userRole as UserRole)
  ) {
    return NextResponse.json(
      { error: "Forbidden: Premium required" },
      { status: 403 },
    );
  }

  try {
    const since: Date = new Date();
    since.setDate(since.getDate() - 120);
    const sinceStr: string | undefined = since.toISOString().split("T")[0];
    if (sinceStr === undefined) {
      return NextResponse.json(
        { error: "Invalid date computation" },
        { status: 500 },
      );
    }

    const { data: tickets, error: ticketsError } = await supabase
      .from("tickets")
      .select("*, ticket_items(*)")
      .eq("user_id", user.id)
      .gte("ticket_date", sinceStr)
      .order("ticket_date", { ascending: false });

    if (ticketsError) throw ticketsError;

    const typedTickets: TicketWithItems[] = (tickets ??
      []) as TicketWithItems[];

    if (typedTickets.length === 0) {
      const response: ShoppingResponse = {
        recommendations: [],
        insights: "",
        data_note: "No hay tickets escaneados todavía. Escaneá al menos 3 tickets para empezar a recibir recomendaciones mensuales.",
        message: "No hay tickets escaneados todavía.",
        total_estimated: 0,
      };
      return NextResponse.json(response);
    }

    const summary = buildShoppingSummary(typedTickets);
    const stats = aggregateProductStats(typedTickets);
    const predictions = predictNeeds(stats);

    if (predictions.length === 0) {
      const response: ShoppingResponse = {
        recommendations: [],
        insights: "",
        data_note: summary.note,
        message: summary.note,
        total_estimated: 0,
      };
      return NextResponse.json(response);
    }

    const promptInput = {
      predictions,
      data_note: summary.note,
      data_quality: summary.data_quality,
    };

    let validated: {
      recommendations: ValidatedRecommendation[];
      insights: string;
      data_note: string;
      total: number;
    };

    try {
      const response = await generateContentWithRetry({
        model: GeminiModels.GEMINI_3_5_FLASH,
        contents: [shoppingRecommendationsPrompt(promptInput)],
        config: {
          temperature: 0.1,
        },
      });

      const rawContent: string = response.text ?? "";
      const cleanJson: string = extractJson(rawContent);
      const parsed: unknown = JSON.parse(cleanJson);

      if (!isLlmResponse(parsed)) {
        throw new Error("Unexpected response shape");
      }

      validated = validateAndEnrich(parsed, predictions);
    } catch (llmError) {
      console.warn(
        "[shopping-recs] LLM failed, falling back to TS-only reasons:",
        llmError,
      );
      const fallback = buildResponseFromPredictions(predictions, summary.note);
      return NextResponse.json(fallback);
    }

    const finalResponse: ShoppingResponse = {
      recommendations: validated.recommendations,
      insights: validated.insights,
      data_note:
        validated.data_note.length > 0 ? validated.data_note : summary.note,
      total_estimated: validated.total,
    };

    return NextResponse.json(finalResponse);
  } catch (error) {
    console.error("Error generating recommendations:", error);
    return NextResponse.json(
      { error: "Error generating recommendations" },
      { status: 500 },
    );
  }
}
