import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { USER_ROLES } from "@/types/database";
import type { UserRole } from "@/types/database";
import { EdgeTTS } from "edge-tts-universal";

const VOICE_ID = "es-CL-CatalinaNeural";

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
    const body: { text: string } = await request.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const tts = new EdgeTTS(text, VOICE_ID, {
      rate: "+0%",
      volume: "+0%",
      pitch: "+0Hz",
    });

    const result = await tts.synthesize();
    const audioBuffer = Buffer.from(await result.audio.arrayBuffer());
    const audioBase64 = audioBuffer.toString("base64");

    if (!audioBase64) {
      console.error("TTS: No audio data generated");
      return NextResponse.json(
        { error: "No audio generated" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      audio: audioBase64,
      mimeType: "audio/mp3",
    });
  } catch (error) {
    console.error("TTS API error:", error);
    return NextResponse.json(
      { error: "Error generating speech" },
      { status: 500 },
    );
  }
}
