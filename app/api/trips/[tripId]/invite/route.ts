import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createNotification } from '@/lib/notifications';
import { getTripAccess, normalizeEmail } from '@/lib/trips-server';
import type { TripMember } from '@/types/database';

export async function POST(
  request: NextRequest,
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

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  if (!email) {
    return NextResponse.json({ error: 'Ingresá un email válido' }, { status: 400 });
  }

  if (user.email && email === user.email.toLowerCase()) {
    return NextResponse.json({ error: 'No podés invitarte a vos mismo' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  try {
    const access = await getTripAccess(admin, tripId, user.id);
    if (!access) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    }
    if (!access.isMember) {
      return NextResponse.json(
        { error: 'Solo las personas del viaje pueden invitar' },
        { status: 403 }
      );
    }

    const { data: invitedUserId, error: lookupError } = await admin.rpc('get_user_id_by_email', {
      p_email: email,
    });
    if (lookupError) throw lookupError;

    if (!invitedUserId) {
      return NextResponse.json(
        {
          error:
            'No hay ningún usuario registrado con ese email. Podés agregarlo como invitado sin cuenta.',
        },
        { status: 404 }
      );
    }

    if (invitedUserId === user.id) {
      return NextResponse.json({ error: 'No podés invitarte a vos mismo' }, { status: 400 });
    }

    const [byUser, byEmail] = await Promise.all([
      admin.from('trip_members').select('*').eq('trip_id', tripId).eq('user_id', invitedUserId),
      admin.from('trip_members').select('*').eq('trip_id', tripId).eq('email', email),
    ]);
    if (byUser.error) throw byUser.error;
    if (byEmail.error) throw byEmail.error;

    const existing =
      ((byUser.data as TripMember[] | null)?.[0] ?? (byEmail.data as TripMember[] | null)?.[0]) ??
      null;
    if (existing?.invite_status === 'accepted') {
      return NextResponse.json({ error: 'Esa persona ya es parte del viaje' }, { status: 409 });
    }
    if (existing?.invite_status === 'pending') {
      return NextResponse.json(
        { error: 'Esa persona ya tiene una invitación pendiente' },
        { status: 409 }
      );
    }

    const { data: invitedUser } = await admin.auth.admin.getUserById(invitedUserId);
    const displayName =
      (invitedUser?.user?.user_metadata?.full_name as string | undefined)?.trim() ||
      email.split('@')[0];
    const inviterName =
      access.membership?.display_name ||
      (user.user_metadata?.full_name as string | undefined) ||
      user.email?.split('@')[0] ||
      'Alguien';

    let member: TripMember;
    if (existing) {
      // Re-invite someone who declined before.
      const { data, error } = await admin
        .from('trip_members')
        .update({
          user_id: invitedUserId,
          email,
          display_name: existing.display_name || displayName,
          invite_status: 'pending',
          is_admin: false,
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      member = data as TripMember;
    } else {
      const { data, error } = await admin
        .from('trip_members')
        .insert([
          {
            trip_id: tripId,
            user_id: invitedUserId,
            email,
            display_name: displayName,
            invite_status: 'pending',
            is_admin: false,
          },
        ])
        .select()
        .single();
      if (error) throw error;
      member = data as TripMember;
    }

    try {
      await createNotification({
        userId: invitedUserId,
        type: 'trip_invite',
        title: 'Te invitaron a un viaje',
        body: `${inviterName} te invitó a "${access.trip.name}"`,
        data: {
          trip_id: tripId,
          member_id: member.id,
          trip_name: access.trip.name,
          inviter_name: inviterName,
          status: 'pending',
        },
      });
    } catch (notificationError) {
      // Without a notification the invitee could never answer: roll back.
      if (existing) {
        await admin.from('trip_members').update({ invite_status: 'declined' }).eq('id', member.id);
      } else {
        await admin.from('trip_members').delete().eq('id', member.id);
      }
      throw notificationError;
    }

    return NextResponse.json({ member });
  } catch (error) {
    console.error('Error inviting to trip:', error);
    return NextResponse.json({ error: 'No se pudo enviar la invitación' }, { status: 500 });
  }
}
