import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { USER_ROLES } from '@/types/database';
import type { TTSEngine } from '@/types/agent';

export async function GET(): Promise<NextResponse> {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ttsEngine: TTSEngine = user.app_metadata?.tts_engine ?? 'genai';

  return NextResponse.json({ ttsEngine });
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = user.app_metadata?.role;

  if (userRole !== USER_ROLES.ADMIN) {
    return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 });
  }

  try {
    const body: { ttsEngine: TTSEngine } = await request.json();
    const { ttsEngine } = body;

    if (ttsEngine !== 'genai' && ttsEngine !== 'browser') {
      return NextResponse.json({ error: 'Invalid TTS engine' }, { status: 400 });
    }

    const adminClient = createSupabaseAdminClient();

    const { error } = await adminClient.auth.admin.updateUserById(user.id, {
      app_metadata: { ...user.app_metadata, tts_engine: ttsEngine },
    });

    if (error) throw error;

    return NextResponse.json({ ttsEngine });
  } catch (error) {
    console.error('Settings API error:', error);
    return NextResponse.json(
      { error: 'Error updating settings' },
      { status: 500 },
    );
  }
}
