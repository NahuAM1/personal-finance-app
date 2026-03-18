import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database"
import type { Loan } from "@/types/database"

type LoanInsert = Database["public"]["Tables"]["loans"]["Insert"]
type LoanUpdate = Database["public"]["Tables"]["loans"]["Update"]

export class LoanService {
  static async getAll(userId: string): Promise<Loan[]> {
    const { data, error } = await supabase
      .from("loans")
      .select("*")
      .eq("user_id", userId)
      .order("start_date", { ascending: false })

    if (error) throw error
    return data
  }

  static async getActive(userId: string): Promise<Loan[]> {
    const { data, error } = await supabase
      .from("loans")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("start_date", { ascending: false })

    if (error) throw error
    return data
  }

  static async create(loan: Omit<LoanInsert, "user_id">, userId: string): Promise<Loan> {
    const { data, error } = await supabase
      .from("loans")
      .insert({ ...loan, user_id: userId })
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async update(id: string, updates: LoanUpdate, userId: string): Promise<Loan> {
    const { data, error } = await supabase
      .from("loans")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async delete(id: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from("loans")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)

    if (error) throw error
  }
}
