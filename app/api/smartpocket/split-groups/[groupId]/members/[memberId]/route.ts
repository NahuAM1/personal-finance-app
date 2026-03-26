import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string; memberId: string }> }
) {
  const { groupId, memberId } = await params;

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminSupabase = createSupabaseAdminClient();

  try {
    // Verify user is creator or admin of the group
    const { data: group } = await adminSupabase
      .from("split_groups")
      .select("created_by")
      .eq("id", groupId)
      .single();

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const isCreator = group.created_by === user.id;

    if (!isCreator) {
      const { data: adminMember } = await adminSupabase
        .from("split_group_members")
        .select("is_admin")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .single();

      if (!adminMember?.is_admin) {
        return NextResponse.json(
          { error: "Only group admins can remove members" },
          { status: 403 }
        );
      }
    }

    const { error } = await adminSupabase
      .from("split_group_members")
      .delete()
      .eq("id", memberId)
      .eq("group_id", groupId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Error removing member" },
      { status: 500 }
    );
  }
}
