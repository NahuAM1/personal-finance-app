import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { detachOrDeleteMember, getTripAccess } from '@/lib/trips-server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  try {
    const access = await getTripAccess(admin, tripId, user.id);
    if (!access) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    }

    // Safer than silently deleting everyone's data: the creator must delete
    // the trip explicitly.
    if (access.isCreator) {
      return NextResponse.json(
        { error: 'Creaste este viaje, así que no podés salir. Si ya no lo necesitás, eliminalo.' },
        { status: 400 }
      );
    }
    if (!access.membership) {
      return NextResponse.json({ error: 'No sos parte de este viaje' }, { status: 404 });
    }

    // Keeps the row as a guest when it has expense history so balances stay intact.
    const action = await detachOrDeleteMember(admin, access.membership);
    return NextResponse.json({ action: 'left', detail: action });
  } catch (error) {
    console.error('Error leaving trip:', error);
    return NextResponse.json({ error: 'No se pudo salir del viaje' }, { status: 500 });
  }
}
