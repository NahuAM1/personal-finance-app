import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { USER_ROLES, type UserRole } from '@/types/database';

const VALID_ROLES = Object.values(USER_ROLES) as string[];

async function getAuthenticatedAdmin() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, error: 'Unauthorized' as const };
  }

  if (user.app_metadata?.role !== USER_ROLES.ADMIN) {
    return { user: null, error: 'Forbidden' as const };
  }

  return { user, error: null };
}

export async function GET() {
  const { user, error } = await getAuthenticatedAdmin();

  if (error === 'Unauthorized') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (error === 'Forbidden' || !user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const { data, error: listError } = await adminClient.auth.admin.listUsers();

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    const users = data.users.map((u) => ({
      id: u.id,
      email: u.email ?? '',
      role: (u.app_metadata?.role as UserRole) ?? USER_ROLES.FREE,
      created_at: u.created_at,
      full_name: (u.user_metadata?.full_name as string) ?? null,
      avatar_url: (u.user_metadata?.avatar_url as string) ?? null,
    }));

    return NextResponse.json({ users });
  } catch (err) {
    console.error('Error listing users:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const { user, error } = await getAuthenticatedAdmin();

  if (error === 'Unauthorized') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (error === 'Forbidden' || !user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { userId, role } = body as { userId: string; role: string };

    if (!userId || !role) {
      return NextResponse.json({ error: 'userId and role are required' }, { status: 400 });
    }

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    if (userId === user.id) {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 400 }
      );
    }

    const adminClient = createSupabaseAdminClient();
    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      app_metadata: { role },
    });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error updating user role:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
