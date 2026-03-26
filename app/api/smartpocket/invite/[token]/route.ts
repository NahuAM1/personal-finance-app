import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const adminSupabase = createSupabaseAdminClient();

  try {
    const { data: member, error } = await adminSupabase
      .from("split_group_members")
      .select("*, split_groups(*)")
      .eq("invite_token", token)
      .single();

    if (error || !member) {
      return NextResponse.json(
        { error: "Invite not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(member);
  } catch {
    return NextResponse.json(
      { error: "Error fetching invite" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminSupabase = createSupabaseAdminClient();

  try {
    const { action } = await request.json();

    // Fetch the member record using admin client (bypass RLS)
    const { data: member, error: fetchError } = await adminSupabase
      .from("split_group_members")
      .select("*")
      .eq("invite_token", token)
      .single();

    if (fetchError || !member) {
      return NextResponse.json(
        { error: "Invite not found" },
        { status: 404 }
      );
    }

    if (member.invite_status !== "pending") {
      return NextResponse.json(
        { error: "Invite already processed" },
        { status: 400 }
      );
    }

    if (action === "accept") {
      const { error: updateError } = await adminSupabase
        .from("split_group_members")
        .update({
          user_id: user.id,
          invite_status: "accepted",
        })
        .eq("id", member.id);

      if (updateError) throw updateError;

      return NextResponse.json({ status: "accepted" });
    }

    if (action === "decline") {
      const { error: updateError } = await adminSupabase
        .from("split_group_members")
        .update({
          invite_status: "declined",
        })
        .eq("id", member.id);

      if (updateError) throw updateError;

      return NextResponse.json({ status: "declined" });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'accept' or 'decline'" },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { error: "Error processing invite" },
      { status: 500 }
    );
  }
}
