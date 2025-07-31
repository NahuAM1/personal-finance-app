import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database"

type SavingsGoalInsert = Database["public"]["Tables"]["savings_goals"]["Insert"]
type SavingsGoalUpdate = Database["public"]["Tables"]["savings_goals"]["Update"]

export class SavingsService {
  static async getAll(userId: string) {
    const { data, error } = await supabase
      .from("savings_goals")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) throw error
    return data
  }

  static async create(goal: Omit<SavingsGoalInsert, "user_id">, userId: string) {
    const { data, error } = await supabase
      .from("savings_goals")
      .insert({ ...goal, user_id: userId })
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async update(id: string, updates: SavingsGoalUpdate, userId: string) {
    const { data, error } = await supabase
      .from("savings_goals")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async delete(id: string, userId: string) {
    const { error } = await supabase.from("savings_goals").delete().eq("id", id).eq("user_id", userId)

    if (error) throw error
  }

  static async addMoney(id: string, amount: number, userId: string) {
    // Get current amount first
    const { data: currentGoal, error: fetchError } = await supabase
      .from("savings_goals")
      .select("current_amount, target_amount")
      .eq("id", id)
      .eq("user_id", userId)
      .single()

    if (fetchError) throw fetchError

    const newAmount = Math.min(currentGoal.current_amount + amount, currentGoal.target_amount)

    const { data, error } = await supabase
      .from("savings_goals")
      .update({ current_amount: newAmount })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single()

    if (error) throw error
    return data
  }
}
