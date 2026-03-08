import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { USER_ROLES } from '@/types/database';
import type { UserRole } from '@/types/database';
import { GoogleGenAI } from '@google/genai';

const genai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

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
    const body: { text: string } = await request.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    // Use Gemini's native TTS model for audio generation
    const response = await genai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [
        `Decí en español argentino de forma natural y amigable: ${text}`,
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Kore',
            },
          },
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;

    if (!parts || parts.length === 0) {
      console.error('TTS: No parts in response');
      return NextResponse.json({ error: 'No audio generated' }, { status: 500 });
    }

    for (const part of parts) {
      if (part.inlineData?.data && part.inlineData.mimeType) {
        return NextResponse.json({
          audio: part.inlineData.data,
          mimeType: part.inlineData.mimeType,
        });
      }
    }

    console.error('TTS: No audio part found');
    return NextResponse.json({ error: 'No audio generated' }, { status: 500 });
  } catch (error) {
    console.error('TTS API error:', error);
    return NextResponse.json(
      { error: 'Error generating speech' },
      { status: 500 },
    );
  }
}
