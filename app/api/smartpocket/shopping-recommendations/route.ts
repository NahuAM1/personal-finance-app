import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { USER_ROLES, type UserRole } from "@/types/database";
import { OpenAIModels } from "@/public/enums";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE_URL,
});

export async function POST(request: NextRequest) {
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
      { status: 403 }
    );
  }

  try {
    // Get recent tickets with items
    const { data: recentTickets, error: recentError } = await supabase
      .from("tickets")
      .select("*, ticket_items(*)")
      .eq("user_id", user.id)
      .order("ticket_date", { ascending: false })
      .limit(10);

    if (recentError) throw recentError;

    // Get tickets from same month last year
    const now = new Date();
    const lastYearStart = new Date(now.getFullYear() - 1, now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
    const lastYearEnd = new Date(now.getFullYear() - 1, now.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];

    const { data: lastYearTickets, error: lastYearError } = await supabase
      .from("tickets")
      .select("*, ticket_items(*)")
      .eq("user_id", user.id)
      .gte("ticket_date", lastYearStart)
      .lte("ticket_date", lastYearEnd);

    if (lastYearError) throw lastYearError;

    if ((!recentTickets || recentTickets.length === 0) && (!lastYearTickets || lastYearTickets.length === 0)) {
      return NextResponse.json({
        recommendations: [],
        message: "No hay suficientes datos para generar recomendaciones. Escanea más tickets.",
      });
    }

    // Build context for AI
    const recentItems = (recentTickets || []).flatMap((t) =>
      ((t as Record<string, unknown>).ticket_items as Array<Record<string, unknown>> || []).map((item) => ({
        product: item.product_name,
        quantity: item.quantity,
        price: item.total_price,
        category: item.category,
        date: (t as Record<string, unknown>).ticket_date,
        store: (t as Record<string, unknown>).store_name,
      }))
    );

    const lastYearItems = (lastYearTickets || []).flatMap((t) =>
      ((t as Record<string, unknown>).ticket_items as Array<Record<string, unknown>> || []).map((item) => ({
        product: item.product_name,
        quantity: item.quantity,
        price: item.total_price,
        category: item.category,
      }))
    );

    const prompt = `Eres un asistente de compras inteligente. Analiza el historial de compras del usuario y genera una lista de compras recomendada.

Compras recientes (últimos 10 tickets):
${JSON.stringify(recentItems, null, 2)}

Compras del mismo mes del año pasado:
${JSON.stringify(lastYearItems, null, 2)}

Genera una lista de compras recomendada en formato JSON. Responde SOLO con JSON válido, sin markdown:

{
  "recommendations": [
    {
      "product_name": "Nombre del producto",
      "suggested_quantity": 1,
      "estimated_price": 100.00,
      "frequency": "Semanal",
      "reason": "Razón breve de la recomendación"
    }
  ],
  "insights": "Un párrafo breve con insights sobre los patrones de compra del usuario"
}

Incluye entre 10 y 20 productos. Prioriza productos que el usuario compra frecuentemente. Estima precios basándote en los datos históricos.`;

    const response = await openai.chat.completions.create({
      model: OpenAIModels.GEMMA_3,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    const rawContent = response.choices[0]?.message?.content || "";

    const jsonMatch =
      rawContent.match(/```json([\s\S]*?)```/) ||
      rawContent.match(/```([\s\S]*?)```/) ||
      rawContent.match(/\{[\s\S]*\}/);

    const cleanJson = jsonMatch
      ? jsonMatch[1]?.trim() || jsonMatch[0].trim()
      : rawContent;

    const parsed = JSON.parse(cleanJson);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Error generating recommendations:", error);
    return NextResponse.json(
      { error: "Error generating recommendations" },
      { status: 500 }
    );
  }
}
