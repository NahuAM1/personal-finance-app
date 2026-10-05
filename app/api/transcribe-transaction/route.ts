import { NextRequest, NextResponse } from "next/server";
import { GeminiModels } from "@/public/enums";
import { generateContentWithRetry } from "@/lib/gemini";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { USER_ROLES, UserRole } from "@/types/database";

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

  if (!authorizedRoles.includes(userRole)) {
    return NextResponse.json(
      { error: "Forbidden: Premium required" },
      { status: 403 },
    );
  }

  const { message } = await request.json();
  try {
    const response = await generateContentWithRetry({
      model: GeminiModels.GEMINI_3_5_FLASH,
      contents: message,
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    return NextResponse.json({ content: response.text ?? "" });
  } catch (error) {
    console.error("Error generating response:", error);
    return new Response("Error generating response", { status: 500 });
  }
}
