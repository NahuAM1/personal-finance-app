// Server-only helpers for trip API routes. They receive the service-role client,
// so every caller MUST authenticate the user and check permissions first.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Trip, TripMember } from '@/types/database';

export interface TripAccess {
  trip: Trip;
  membership: TripMember | null;
  isCreator: boolean;
  isMember: boolean;
  isAdmin: boolean;
}

/** Loads a trip and the caller's accepted membership. Returns null if the trip does not exist. */
export async function getTripAccess(
  admin: SupabaseClient,
  tripId: string,
  userId: string
): Promise<TripAccess | null> {
  const { data: trip } = await admin.from('trips').select('*').eq('id', tripId).maybeSingle();
  if (!trip) return null;

  const { data: membership } = await admin
    .from('trip_members')
    .select('*')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .eq('invite_status', 'accepted')
    .maybeSingle();

  const isCreator = (trip as Trip).created_by === userId;
  const member = (membership as TripMember | null) ?? null;
  return {
    trip: trip as Trip,
    membership: member,
    isCreator,
    isMember: isCreator || Boolean(member),
    isAdmin: isCreator || Boolean(member?.is_admin),
  };
}

/** True when the member paid an expense or has a share in one. */
export async function memberHasExpenses(admin: SupabaseClient, memberId: string): Promise<boolean> {
  const [{ count: paidCount }, { count: shareCount }] = await Promise.all([
    admin
      .from('trip_expenses')
      .select('id', { count: 'exact', head: true })
      .eq('paid_by_member_id', memberId),
    admin
      .from('trip_expense_shares')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', memberId),
  ]);
  return (paidCount ?? 0) > 0 || (shareCount ?? 0) > 0;
}

/**
 * Removes a registered user from a trip. If they have expense history, the row
 * is kept as a guest (no account link) so balances stay intact; otherwise it is
 * deleted. Pending invitation notifications for that row are deleted too.
 */
export async function detachOrDeleteMember(
  admin: SupabaseClient,
  member: TripMember
): Promise<'detached' | 'deleted'> {
  await admin
    .from('notifications')
    .delete()
    .eq('type', 'trip_invite')
    .filter('data->>member_id', 'eq', member.id)
    .is('read_at', null);

  if (await memberHasExpenses(admin, member.id)) {
    const { error } = await admin
      .from('trip_members')
      .update({
        user_id: null,
        email: null,
        invite_status: 'accepted',
        is_admin: false,
      })
      .eq('id', member.id);
    if (error) throw error;
    return 'detached';
  }

  const { error } = await admin.from('trip_members').delete().eq('id', member.id);
  if (error) throw error;
  return 'deleted';
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return EMAIL_REGEX.test(email) ? email : null;
}
