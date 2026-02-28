import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { OpenAIModels } from "@/public/enums";
import { getMessage } from "@/public/utils/openAI";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { USER_ROLES, UserRole } from "@/types/database";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE_URL,
});

export async function POST(request: NextRequest) {
  // Verify authentication and role
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authorizedRoles: UserRole[] = [USER_ROLES.PREMIUM, USER_ROLES.ADMIN];
  const userRole = user.app_metadata?.role;

  console.log(userRole);

  if (!authorizedRoles.includes(userRole)) {
    return NextResponse.json(
      { error: "Forbidden: Premium required" },
      { status: 403 },
    );
  }

  const { message } = await request.json();
  const messages = new Array(getMessage(message));
  try {
    const response = await openai.chat.completions.create({
      model: OpenAIModels.NVIDIA,
      messages,
      temperature: 0.7,
    });

    return new NextResponse(JSON.stringify(response), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating response:", error);
    return new Response("Error generating response", { status: 500 });
  }
}
