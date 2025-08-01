import { supabase } from "@/lib/supabase"
import type { Transaction, SavingsGoal, ExpensePlan } from "@/types/database"

export async function getTransactions(userId: string) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })

  if (error) throw error
  return data
}

export async function addTransaction(transaction: Omit<Transaction, "id" | "created_at" | "updated_at">) {
  const { data, error } = await supabase
    .from("transactions")
    .insert([transaction])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getSavingsGoals(userId: string) {
  const { data, error } = await supabase
    .from("savings_goals")
    .select("*")
    .eq("user_id", userId)
    .order("deadline", { ascending: true })

  if (error) throw error
  return data
}

export async function addSavingsGoal(goal: Omit<SavingsGoal, "id" | "created_at" | "updated_at">) {
  const { data, error } = await supabase
    .from("savings_goals")
    .insert([goal])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateSavingsGoal(id: string, updates: Partial<SavingsGoal>) {
  const { data, error } = await supabase
    .from("savings_goals")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getExpensePlans(userId: string) {
  const { data, error } = await supabase
    .from("expense_plans")
    .select("*")
    .eq("user_id", userId)
    .order("deadline", { ascending: true })

  if (error) throw error
  return data
}

export async function addExpensePlan(plan: Omit<ExpensePlan, "id" | "created_at" | "updated_at">) {
  const { data, error } = await supabase
    .from("expense_plans")
    .insert([plan])
    .select()
    .single()

  if (error) throw error
  return data
}