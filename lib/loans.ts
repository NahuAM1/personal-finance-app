import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database"
import type { Loan, LoanPayment } from "@/types/database"

const roundCents = (n: number): number => Math.round(n * 100) / 100

export function computeLoanTotal(principal: number, interestRate: number): number {
  return roundCents(principal * (1 + interestRate / 100))
}

// Spread whatever is left of `newTotal` (after paid installments) evenly across
// the unpaid ones. The last unpaid installment absorbs the rounding remainder.
export function redistributeUnpaidInstallments(
  payments: Pick<LoanPayment, "id" | "amount" | "paid" | "payment_number">[],
  newTotal: number
): { id: string; amount: number }[] {
  const paidSum = payments.filter((p) => p.paid).reduce((sum, p) => sum + p.amount, 0)
  const unpaid = payments
    .filter((p) => !p.paid)
    .sort((a, b) => a.payment_number - b.payment_number)
  if (unpaid.length === 0) return []

  const remaining = roundCents(newTotal - paidSum)
  if (remaining < 0) {
    throw new Error("El nuevo total es menor a lo ya pagado")
  }

  const each = roundCents(remaining / unpaid.length)
  return unpaid.map((p, i) => ({
    id: p.id,
    amount: i === unpaid.length - 1 ? roundCents(remaining - each * (unpaid.length - 1)) : each,
  }))
}

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
