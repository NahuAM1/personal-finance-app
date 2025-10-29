import { supabase } from "@/lib/supabase"
import type { Transaction, SavingsGoal, ExpensePlan, CreditPurchase, CreditInstallment } from "@/types/database"

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

// Credit card payment functions
export async function addMultipleTransactions(transactions: Omit<Transaction, "id" | "created_at" | "updated_at">[]) {
  const { data, error } = await supabase
    .from("transactions")
    .insert(transactions)
    .select()

  if (error) throw error
  return data
}

export async function markInstallmentAsPaid(installmentId: string) {
  const { data, error } = await supabase
    .from("transactions")
    .update({ paid: true, date: new Date().toISOString().split('T')[0] })
    .eq("id", installmentId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getCreditTransactions(userId: string) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("type", "credit")
    .order("due_date", { ascending: true })

  if (error) throw error
  return data
}

export async function getUnpaidInstallments(userId: string) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("type", "credit")
    .eq("paid", false)
    .order("due_date", { ascending: true })

  if (error) throw error
  return data
}

// New Credit Card System Functions

export async function createCreditPurchase(
  purchase: Omit<CreditPurchase, "id" | "created_at" | "updated_at">,
  installments: Omit<CreditInstallment, "id" | "credit_purchase_id" | "created_at" | "updated_at">[]
) {
  // Create the purchase
  const { data: purchaseData, error: purchaseError } = await supabase
    .from("credit_purchases")
    .insert([purchase])
    .select()
    .single()

  if (purchaseError) throw purchaseError

  // Create all installments
  const installmentsWithPurchaseId = installments.map(inst => ({
    ...inst,
    credit_purchase_id: purchaseData.id
  }))

  const { data: installmentsData, error: installmentsError } = await supabase
    .from("credit_installments")
    .insert(installmentsWithPurchaseId)
    .select()

  if (installmentsError) throw installmentsError

  return { purchase: purchaseData, installments: installmentsData }
}

export async function getCreditPurchases(userId: string) {
  const { data, error } = await supabase
    .from("credit_purchases")
    .select("*")
    .eq("user_id", userId)
    .order("start_date", { ascending: false })

  if (error) throw error
  return data
}

export async function getCreditInstallments(purchaseId: string) {
  const { data, error } = await supabase
    .from("credit_installments")
    .select("*")
    .eq("credit_purchase_id", purchaseId)
    .order("installment_number", { ascending: true })

  if (error) throw error
  return data
}

export async function getAllCreditInstallments(userId: string) {
  // First get all purchases for this user
  const { data: purchases, error: purchasesError } = await supabase
    .from("credit_purchases")
    .select("id")
    .eq("user_id", userId)

  if (purchasesError) throw purchasesError
  if (!purchases || purchases.length === 0) return []

  const purchaseIds = purchases.map(p => p.id)

  // Then get all installments for those purchases
  const { data, error } = await supabase
    .from("credit_installments")
    .select("*")
    .in("credit_purchase_id", purchaseIds)
    .order("due_date", { ascending: true })

  if (error) throw error
  return data || []
}

export async function getUnpaidCreditInstallments(userId: string) {
  const { data, error } = await supabase
    .from("credit_installments")
    .select(`
      *,
      credit_purchase:credit_purchases(*)
    `)
    .eq("credit_purchases.user_id", userId)
    .eq("paid", false)
    .order("due_date", { ascending: true })

  if (error) throw error
  return data
}

export async function payCreditInstallment(
  installmentId: string,
  userId: string,
  paidDate: string
) {
  // Get the installment details
  const { data: installment, error: fetchError } = await supabase
    .from("credit_installments")
    .select(`
      *,
      credit_purchase:credit_purchases(*)
    `)
    .eq("id", installmentId)
    .single()

  if (fetchError) throw fetchError
  if (!installment || !installment.credit_purchase) throw new Error("Installment not found")

  const purchase = Array.isArray(installment.credit_purchase)
    ? installment.credit_purchase[0]
    : installment.credit_purchase

  // Create a transaction for this payment
  const transaction: Omit<Transaction, "id" | "created_at" | "updated_at"> = {
    user_id: userId,
    type: "credit",
    amount: installment.amount,
    category: purchase.category,
    description: `${purchase.description} - Cuota ${installment.installment_number}/${purchase.installments}`,
    date: paidDate,
    is_recurring: null,
    installments: null,
    current_installment: null,
    paid: null,
    parent_transaction_id: null,
    due_date: null,
  }

  const { data: transactionData, error: transactionError } = await supabase
    .from("transactions")
    .insert([transaction])
    .select()
    .single()

  if (transactionError) throw transactionError

  // Update the installment as paid
  const { data: updatedInstallment, error: updateError } = await supabase
    .from("credit_installments")
    .update({
      paid: true,
      paid_date: paidDate,
      transaction_id: transactionData.id
    })
    .eq("id", installmentId)
    .select()
    .single()

  if (updateError) throw updateError

  return { installment: updatedInstallment, transaction: transactionData }
}

export async function deleteCreditTransaction(transactionId: string, userId: string) {
  // First, check if this is a credit transaction and get the related installment
  const { data: transaction, error: fetchError } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .eq("user_id", userId)
    .single()

  if (fetchError) {
    console.error("Error fetching transaction:", fetchError)
    throw fetchError
  }

  if (!transaction) {
    throw new Error("Transaction not found")
  }

  console.log("Deleting transaction:", transaction)

  // If it's a credit transaction, reset the related installment
  if (transaction.type === "credit") {
    console.log("This is a credit transaction, resetting installment...")

    const { data: resetData, error: resetError } = await supabase
      .from("credit_installments")
      .update({
        paid: false,
        paid_date: null,
        transaction_id: null
      })
      .eq("transaction_id", transactionId)
      .select()

    if (resetError) {
      console.error("Error resetting installment:", resetError)
      throw resetError
    }

    console.log("Installment reset result:", resetData)
  }

  // Delete the transaction
  const { error: deleteError } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId)
    .eq("user_id", userId)

  if (deleteError) {
    console.error("Error deleting transaction:", deleteError)
    throw deleteError
  }

  console.log("Transaction deleted successfully")
}