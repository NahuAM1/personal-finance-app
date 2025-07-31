import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database"

type TransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"]
type TransactionUpdate = Database["public"]["Tables"]["transactions"]["Update"]

export class TransactionService {
  static async getAll(userId: string) {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })

    if (error) throw error
    return data
  }

  static async create(transaction: Omit<TransactionInsert, "user_id">, userId: string) {
    const { data, error } = await supabase
      .from("transactions")
      .insert({ ...transaction, user_id: userId })
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async update(id: string, updates: TransactionUpdate, userId: string) {
    const { data, error } = await supabase
      .from("transactions")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async delete(id: string, userId: string) {
    const { error } = await supabase.from("transactions").delete().eq("id", id).eq("user_id", userId)

    if (error) throw error
  }

  static async getByDateRange(userId: string, startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false })

    if (error) throw error
    return data
  }

  static async getByType(userId: string, type: "income" | "expense" | "credit") {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .eq("type", type)
      .order("date", { ascending: false })

    if (error) throw error
    return data
  }
}
