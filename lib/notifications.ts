// Server-only helper: uses the service-role client, which bypasses RLS.
// Never import this module from client components.
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { Notification } from '@/types/database';

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  data?: Record<string, unknown>;
}

export async function createNotification(input: CreateNotificationInput): Promise<Notification> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('notifications')
    .insert([
      {
        user_id: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        data: input.data ?? {},
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data as Notification;
}
