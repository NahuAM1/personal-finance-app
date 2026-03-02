import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { USER_ROLES, type UserRole } from "@/types/database";
import { OpenAIModels } from "@/public/enums";
import { shoppingRecommendationsPrompt } from "@/public/promts/shopping-recommendations";
import { GoogleGenAI } from "@google/genai";

const genai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
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
      { status: 403 },
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

    if (
      (!recentTickets || recentTickets.length === 0) &&
      (!lastYearTickets || lastYearTickets.length === 0)
    ) {
      return NextResponse.json({
        recommendations: [],
        message:
          "No hay suficientes datos para generar recomendaciones. Escanea más tickets.",
      });
    }

    // Build context for AI
    const recentItems = (recentTickets || []).flatMap((t) =>
      (
        ((t as Record<string, unknown>).ticket_items as Array<
          Record<string, unknown>
        >) || []
      ).map((item) => ({
        product: item.product_name,
        quantity: item.quantity,
        price: item.total_price,
        category: item.category,
        date: (t as Record<string, unknown>).ticket_date,
        store: (t as Record<string, unknown>).store_name,
      })),
    );

    const lastYearItems = (lastYearTickets || []).flatMap((t) =>
      (
        ((t as Record<string, unknown>).ticket_items as Array<
          Record<string, unknown>
        >) || []
      ).map((item) => ({
        product: item.product_name,
        quantity: item.quantity,
        price: item.total_price,
        category: item.category,
      })),
    );

    const prompt = shoppingRecommendationsPrompt(
      JSON.stringify(recentItems, null, 2),
      JSON.stringify(lastYearItems, null, 2),
    );

    const response = await genai.models.generateContent({
      model: OpenAIModels.GEMINI_2_5_FLASH,
      contents: [prompt],
      config: {
        temperature: 0.3,
      },
    });

    const rawContent = response.text ?? "";

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
      { status: 500 },
    );
  }
}
