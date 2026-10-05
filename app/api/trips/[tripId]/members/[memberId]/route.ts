import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { detachOrDeleteMember, getTripAccess, memberHasExpenses } from '@/lib/trips-server';
import type { TripMember } from '@/types/database';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ tripId: string; memberId: string }> }
) {
  const { tripId, memberId } = await params;

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
    if (!access.isAdmin) {
      return NextResponse.json(
        { error: 'Solo quienes administran el viaje pueden quitar personas' },
        { status: 403 }
      );
    }

    const { data: memberData } = await admin
      .from('trip_members')
      .select('*')
      .eq('id', memberId)
      .eq('trip_id', tripId)
      .maybeSingle();
    const member = memberData as TripMember | null;

    if (!member) {
      return NextResponse.json({ error: 'Persona no encontrada' }, { status: 404 });
    }
    if (member.user_id === user.id) {
      return NextResponse.json(
        { error: 'Para salir del viaje usá la opción "Salir del viaje"' },
        { status: 400 }
      );
    }
    if (member.user_id && member.user_id === access.trip.created_by) {
      return NextResponse.json(
        { error: 'No se puede quitar a quien creó el viaje' },
        { status: 400 }
      );
    }

    if (!member.user_id) {
      // Guest without an account: deleting it would erase its expenses/shares.
      if (await memberHasExpenses(admin, member.id)) {
        return NextResponse.json(
          { error: 'No se puede quitar porque tiene gastos registrados en el viaje' },
          { status: 409 }
        );
      }
      const { error } = await admin.from('trip_members').delete().eq('id', member.id);
      if (error) throw error;
      return NextResponse.json({ action: 'deleted' });
    }

    const action = await detachOrDeleteMember(admin, member);
    return NextResponse.json({ action });
  } catch (error) {
    console.error('Error removing trip member:', error);
    return NextResponse.json({ error: 'No se pudo quitar a la persona' }, { status: 500 });
  }
}
