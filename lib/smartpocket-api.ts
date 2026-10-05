import { supabase } from "@/lib/supabase"
import type {
  Ticket,
  TicketItem,
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
