import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminSupabase = createSupabaseAdminClient();

  try {
    // Check if user is the group creator
    const { data: group, error: groupError } = await adminSupabase
      .from("split_groups")
      .select("created_by")
      .eq("id", groupId)
      .single();

    if (groupError || !group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (group.created_by === user.id) {
      // Creator deletes the entire group
      const { error: deleteError } = await adminSupabase
        .from("split_groups")
        .delete()
        .eq("id", groupId);

      if (deleteError) throw deleteError;

      return NextResponse.json({ action: "deleted" });
    }

    // Non-creator: remove their membership
    const { error: leaveError } = await adminSupabase
      .from("split_group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", user.id);

    if (leaveError) throw leaveError;

    return NextResponse.json({ action: "left" });
  } catch {
    return NextResponse.json(
      { error: "Error processing request" },
      { status: 500 }
    );
  }
}
