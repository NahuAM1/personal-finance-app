import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { USER_ROLES, type UserRole } from "@/types/database";

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authorizedRoles: UserRole[] = [USER_ROLES.PREMIUM, USER_ROLES.ADMIN];
  const userRole = user.app_metadata?.role;

  if (!authorizedRoles.includes(userRole)) {
    return NextResponse.json(
      { error: "Forbidden: Premium required" },
      { status: 403 }
    );
  }

  try {
    const { groupId, email, displayName } = await request.json();

    if (!groupId || !email || !displayName) {
      return NextResponse.json(
        { error: "Missing required fields: groupId, email, displayName" },
        { status: 400 }
      );
    }

    // Verify user is a member/admin of the group
    const { data: group, error: groupError } = await supabase
      .from("split_groups")
      .select("*")
      .eq("id", groupId)
      .single();

    if (groupError || !group) {
      return NextResponse.json(
        { error: "Group not found" },
        { status: 404 }
      );
    }

    // Check if user is group creator or admin member
    const isCreator = group.created_by === user.id;
    if (!isCreator) {
      const { data: membership } = await supabase
        .from("split_group_members")
        .select("is_admin")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .single();

      if (!membership?.is_admin) {
        return NextResponse.json(
          { error: "Only group admins can invite members" },
          { status: 403 }
        );
      }
    }

    // Check if email is already a member
    const { data: existingMember } = await supabase
      .from("split_group_members")
      .select("id")
      .eq("group_id", groupId)
      .eq("email", email)
      .single();

    if (existingMember) {
      return NextResponse.json(
        { error: "This email is already a member of the group" },
        { status: 400 }
      );
    }

    // Generate unique invite token
    const inviteToken = crypto.randomUUID();

    // Create member with pending status
    const { data: member, error: memberError } = await supabase
      .from("split_group_members")
      .insert([
        {
          group_id: groupId,
          display_name: displayName,
          email,
          invite_token: inviteToken,
          invite_status: "pending",
          is_admin: false,
        },
      ])
      .select()
      .single();

    if (memberError) throw memberError;

    // Build the invite link
    const baseUrl = request.headers.get("origin") || request.nextUrl.origin;
    const inviteLink = `${baseUrl}/smartpocket/invite/${inviteToken}`;

    return NextResponse.json({
      member,
      inviteLink,
    });
  } catch (error) {
    console.error("Error sending invite:", error);
    return NextResponse.json(
      { error: "Error processing invitation" },
      { status: 500 }
    );
  }
}
