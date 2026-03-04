import { supabase } from "@/lib/supabase"
import type {
  Ticket,
  TicketItem,
  SplitGroup,
  SplitGroupMember,
  SplitExpense,
  SplitExpenseShare,
} from "@/types/database"

// ============================================
// Tickets
// ============================================

export async function getTickets(userId: string) {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("user_id", userId)
    .order("ticket_date", { ascending: false })

  if (error) throw error
  return data
}

export async function getTicketById(ticketId: string) {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", ticketId)
    .single()

  if (error) throw error
  return data
}

export async function createTicket(ticket: Omit<Ticket, "id" | "created_at" | "updated_at">) {
  const { data, error } = await supabase
    .from("tickets")
    .insert([ticket])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateTicket(
  ticketId: string,
  userId: string,
  updates: Partial<Omit<Ticket, "id" | "user_id" | "created_at" | "updated_at">>
) {
  const { data, error } = await supabase
    .from("tickets")
    .update(updates)
    .eq("id", ticketId)
    .eq("user_id", userId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteTicket(ticketId: string, userId: string) {
  // Delete image from storage first
  const { data: ticket, error: fetchError } = await supabase
    .from("tickets")
    .select("image_path")
    .eq("id", ticketId)
    .eq("user_id", userId)
    .single()

  if (fetchError) throw fetchError

  if (ticket?.image_path) {
    await supabase.storage.from("receipts").remove([ticket.image_path])
  }

  const { error } = await supabase
    .from("tickets")
    .delete()
    .eq("id", ticketId)
    .eq("user_id", userId)

  if (error) throw error
}

// ============================================
// Ticket Items
// ============================================

export async function getTicketItems(ticketId: string) {
  const { data, error } = await supabase
    .from("ticket_items")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true })

  if (error) throw error
  return data
}

export async function createTicketItems(items: Omit<TicketItem, "id" | "created_at">[]) {
  const { data, error } = await supabase
    .from("ticket_items")
    .insert(items)
    .select()

  if (error) throw error
  return data
}

export async function updateTicketItem(
  itemId: string,
  updates: Partial<Omit<TicketItem, "id" | "ticket_id" | "created_at">>
) {
  const { data, error } = await supabase
    .from("ticket_items")
    .update(updates)
    .eq("id", itemId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteTicketItem(itemId: string) {
  const { error } = await supabase
    .from("ticket_items")
    .delete()
    .eq("id", itemId)

  if (error) throw error
}

// ============================================
// Ticket Items - Aggregations for dashboard
// ============================================

export async function getAllTicketItems(userId: string) {
  const { data: tickets, error: ticketsError } = await supabase
    .from("tickets")
    .select("id")
    .eq("user_id", userId)

  if (ticketsError) throw ticketsError
  if (!tickets || tickets.length === 0) return []

  const ticketIds = tickets.map((t) => t.id)

  const { data, error } = await supabase
    .from("ticket_items")
    .select("*, tickets!inner(ticket_date, store_name)")
    .in("ticket_id", ticketIds)

  if (error) throw error
  return data
}

// ============================================
// Image upload
// ============================================

export async function uploadReceiptImage(userId: string, ticketId: string, file: File) {
  const ext = file.name.split(".").pop() || "jpg"
  const path = `${userId}/${ticketId}.${ext}`

  const { error } = await supabase.storage
    .from("receipts")
    .upload(path, file, { upsert: true })

  if (error) throw error
  return path
}

export function getReceiptImageUrl(path: string) {
  const { data } = supabase.storage.from("receipts").getPublicUrl(path)
  return data.publicUrl
}

export async function getReceiptSignedUrl(path: string) {
  const { data, error } = await supabase.storage
    .from("receipts")
    .createSignedUrl(path, 3600) // 1 hour

  if (error) throw error
  return data.signedUrl
}

// ============================================
// Split Groups
// ============================================

export async function getSplitGroups(userId: string) {
  // Get groups where user is a member (inner join filters to only groups with this user)
  const { data: memberGroups, error: memberError } = await supabase
    .from("split_groups")
    .select("*, split_group_members!inner(user_id)")
    .eq("split_group_members.user_id", userId)
    .order("created_at", { ascending: false })

  if (memberError) throw memberError

  // Also get groups created by user (they might not have a member row yet)
  const { data: createdGroups, error: createdError } = await supabase
    .from("split_groups")
    .select("*")
    .eq("created_by", userId)
    .order("created_at", { ascending: false })

  if (createdError) throw createdError

  // Merge and deduplicate
  const seen = new Set<string>()
  const unique: SplitGroup[] = []

  for (const group of [...(memberGroups || []), ...(createdGroups || [])]) {
    if (!seen.has(group.id)) {
      seen.add(group.id)
      // Strip the joined relation if present
      const { split_group_members: _, ...groupData } = group as Record<string, unknown> & { split_group_members?: unknown }
      unique.push(groupData as SplitGroup)
    }
  }

  // Sort by created_at descending
  unique.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return unique
}

export async function getSplitGroupById(groupId: string) {
  const { data, error } = await supabase
    .from("split_groups")
    .select("*")
    .eq("id", groupId)
    .single()

  if (error) throw error
  return data
}

export async function createSplitGroup(
  group: Omit<SplitGroup, "id" | "created_at" | "updated_at" | "is_active">,
  creatorDisplayName: string
) {
  // Create the group
  const { data: groupData, error: groupError } = await supabase
    .from("split_groups")
    .insert([group])
    .select()
    .single()

  if (groupError) throw groupError

  // Add creator as admin member
  const { error: memberError } = await supabase
    .from("split_group_members")
    .insert([{
      group_id: groupData.id,
      user_id: group.created_by,
      display_name: creatorDisplayName,
      is_admin: true,
      invite_status: "accepted" as const,
    }])

  if (memberError) throw memberError

  return groupData
}

export async function updateSplitGroup(
  groupId: string,
  updates: Partial<Omit<SplitGroup, "id" | "created_by" | "created_at" | "updated_at">>
) {
  const { data, error } = await supabase
    .from("split_groups")
    .update(updates)
    .eq("id", groupId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteSplitGroup(groupId: string) {
  const { error } = await supabase
    .from("split_groups")
    .delete()
    .eq("id", groupId)

  if (error) throw error
}

// ============================================
// Split Group Members
// ============================================

export async function getGroupMembers(groupId: string) {
  const { data, error } = await supabase
    .from("split_group_members")
    .select("*")
    .eq("group_id", groupId)
    .order("joined_at", { ascending: true })

  if (error) throw error
  return data
}

export async function addGroupMember(
  member: Omit<SplitGroupMember, "id" | "joined_at">
) {
  const { data, error } = await supabase
    .from("split_group_members")
    .insert([member])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateGroupMember(
  memberId: string,
  updates: Partial<Omit<SplitGroupMember, "id" | "group_id" | "joined_at">>
) {
  const { data, error } = await supabase
    .from("split_group_members")
    .update(updates)
    .eq("id", memberId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function removeGroupMember(memberId: string) {
  const { error } = await supabase
    .from("split_group_members")
    .delete()
    .eq("id", memberId)

  if (error) throw error
}

export async function getMemberByInviteToken(token: string) {
  const { data, error } = await supabase
    .from("split_group_members")
    .select("*, split_groups(*)")
    .eq("invite_token", token)
    .single()

  if (error) throw error
  return data
}

// ============================================
// Split Expenses
// ============================================

export async function getGroupExpenses(groupId: string) {
  const { data, error } = await supabase
    .from("split_expenses")
    .select("*, split_expense_shares(*)")
    .eq("group_id", groupId)
    .order("expense_date", { ascending: false })

  if (error) throw error
  return data
}

export async function createSplitExpense(
  expense: Omit<SplitExpense, "id" | "created_at" | "updated_at">,
  shares: Omit<SplitExpenseShare, "id" | "expense_id" | "is_settled" | "settled_at">[]
) {
  // Create the expense
  const { data: expenseData, error: expenseError } = await supabase
    .from("split_expenses")
    .insert([expense])
    .select()
    .single()

  if (expenseError) throw expenseError

  // Create shares with the expense_id
  const sharesWithExpenseId = shares.map((share) => ({
    ...share,
    expense_id: expenseData.id,
  }))

  const { data: sharesData, error: sharesError } = await supabase
    .from("split_expense_shares")
    .insert(sharesWithExpenseId)
    .select()

  if (sharesError) throw sharesError

  return { expense: expenseData, shares: sharesData }
}

export async function deleteSplitExpense(expenseId: string) {
  const { error } = await supabase
    .from("split_expenses")
    .delete()
    .eq("id", expenseId)

  if (error) throw error
}

// ============================================
// Split Expense Shares
// ============================================

export async function getExpenseShares(expenseId: string) {
  const { data, error } = await supabase
    .from("split_expense_shares")
    .select("*")
    .eq("expense_id", expenseId)

  if (error) throw error
  return data
}

export async function settleShare(shareId: string) {
  const { data, error } = await supabase
    .from("split_expense_shares")
    .update({
      is_settled: true,
      settled_at: new Date().toISOString(),
    })
    .eq("id", shareId)
    .select()
    .single()

  if (error) throw error
  return data
}

// ============================================
// Debt Simplification Algorithm
// ============================================

interface DebtSettlement {
  fromMemberId: string
  toMemberId: string
  amount: number
}

export function calculateSettlements(
  members: SplitGroupMember[],
  expenses: (SplitExpense & { split_expense_shares: SplitExpenseShare[] })[]
): DebtSettlement[] {
  // Calculate net balance for each member
  const balances = new Map<string, number>()

  for (const member of members) {
    balances.set(member.id, 0)
  }

  for (const expense of expenses) {
    // The payer gets a positive balance (others owe them)
    const currentPayerBalance = balances.get(expense.paid_by_member_id) || 0
    balances.set(expense.paid_by_member_id, currentPayerBalance + expense.amount)

    // Each share holder gets a negative balance (they owe)
    for (const share of expense.split_expense_shares) {
      if (!share.is_settled) {
        const currentBalance = balances.get(share.member_id) || 0
        balances.set(share.member_id, currentBalance - share.share_amount)
      }
    }
  }

  // Greedy algorithm: match largest debtor with largest creditor
  const debtors: { id: string; amount: number }[] = []
  const creditors: { id: string; amount: number }[] = []

  for (const [memberId, balance] of balances) {
    if (balance < -0.01) {
      debtors.push({ id: memberId, amount: Math.abs(balance) })
    } else if (balance > 0.01) {
      creditors.push({ id: memberId, amount: balance })
    }
  }

  debtors.sort((a, b) => b.amount - a.amount)
  creditors.sort((a, b) => b.amount - a.amount)

  const settlements: DebtSettlement[] = []
  let i = 0
  let j = 0

  while (i < debtors.length && j < creditors.length) {
    const transferAmount = Math.min(debtors[i].amount, creditors[j].amount)

    if (transferAmount > 0.01) {
      settlements.push({
        fromMemberId: debtors[i].id,
        toMemberId: creditors[j].id,
        amount: Math.round(transferAmount * 100) / 100,
      })
    }

    debtors[i].amount -= transferAmount
    creditors[j].amount -= transferAmount

    if (debtors[i].amount < 0.01) i++
    if (creditors[j].amount < 0.01) j++
  }

  return settlements
}
