import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { Notification, TripMember } from '@/types/database';

type InvitationAction = 'accept' | 'decline';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const { memberId } = await params;

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let action: InvitationAction;
  try {
    const body = await request.json();
    if (body?.action !== 'accept' && body?.action !== 'decline') throw new Error('invalid action');
    action = body.action;
  } catch {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  try {
    const { data: memberData } = await admin
      .from('trip_members')
      .select('*')
      .eq('id', memberId)
      .maybeSingle();
    const member = memberData as TripMember | null;

    // Only the invited user can answer their own invitation.
    if (!member || member.user_id !== user.id) {
      return NextResponse.json({ error: 'Invitación no encontrada' }, { status: 404 });
    }
    if (member.invite_status !== 'pending') {
      return NextResponse.json(
        { error: 'Esta invitación ya fue respondida', trip_id: member.trip_id, status: member.invite_status },
        { status: 409 }
      );
    }

    const status = action === 'accept' ? 'accepted' : 'declined';
    const { error: updateError } = await admin
      .from('trip_members')
      .update({
        invite_status: status,
        ...(action === 'accept' ? { joined_at: new Date().toISOString() } : {}),
      })
      .eq('id', memberId)
      .eq('invite_status', 'pending');
    if (updateError) throw updateError;

    // Mark the related invitation notifications as read and record the answer.
    const { data: notifications } = await admin
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', 'trip_invite')
      .filter('data->>member_id', 'eq', memberId);

    const readAt = new Date().toISOString();
    for (const n of (notifications as Notification[] | null) || []) {
      await admin
        .from('notifications')
        .update({ read_at: n.read_at ?? readAt, data: { ...(n.data || {}), status } })
        .eq('id', n.id);
    }

    return NextResponse.json({ trip_id: member.trip_id, status });
  } catch (error) {
    console.error('Error answering trip invitation:', error);
    return NextResponse.json({ error: 'No se pudo responder la invitación' }, { status: 500 });
  }
}
