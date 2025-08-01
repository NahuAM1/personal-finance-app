import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database"

type ExpensePlanInsert = Database["public"]["Tables"]["expense_plans"]["Insert"]
type ExpensePlanUpdate = Database["public"]["Tables"]["expense_plans"]["Update"]

export class ExpensePlanService {
  static async getAll(userId: string) {
    const { data, error } = await supabase
      .from("expense_plans")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) throw error
    return data
  }

  static async create(plan: Omit<ExpensePlanInsert, "user_id">, userId: string) {
    const { data, error } = await supabase
      .from("expense_plans")
      .insert({ ...plan, user_id: userId })
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async update(id: string, updates: ExpensePlanUpdate, userId: string) {
    const { data, error } = await supabase
      .from("expense_plans")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async delete(id: string, userId: string) {
    const { error } = await supabase.from("expense_plans").delete().eq("id", id).eq("user_id", userId)

    if (error) throw error
  }

  static async addMoney(id: string, amount: number, userId: string) {
    const { data: currentPlan, error: fetchError } = await supabase
      .from("expense_plans")
      .select("current_amount, target_amount")
      .eq("id", id)
      .eq("user_id", userId)
      .single()

    if (fetchError) throw fetchError

    const newAmount = Math.min(currentPlan.current_amount + amount, currentPlan.target_amount)

    const { data, error } = await supabase
      .from("expense_plans")
      .update({ current_amount: newAmount })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single()

    if (error) throw error
    return data
  }
}
