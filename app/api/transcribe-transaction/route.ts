import { NextRequest, NextResponse } from "next/server";
import { AiTask, runAiTask } from "@/lib/ai/gateway";
import { aiErrorResponse } from "@/lib/ai/http";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { USER_ROLES, UserRole } from "@/types/database";

export const maxDuration = 60;

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
    const content: string = await runAiTask(AiTask.TRANSCRIBE_TRANSACTION, {
      contents: message,
    });

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Error generating response:", error);
    const aiResponse: NextResponse | null =
      error instanceof Error ? aiErrorResponse(error) : null;
    if (aiResponse !== null) {
      return aiResponse;
    }
    return new Response("Error generating response", { status: 500 });
  }
}
