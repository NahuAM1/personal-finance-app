import { supabase } from "@/lib/supabase"
import type { SupabaseClient } from "@supabase/supabase-js"
import { addMonths, format } from "date-fns"
import type { Transaction, ExpensePlan, CreditPurchase, CreditInstallment, Investment, Loan, LoanPayment, Ticket, TicketItem, Service, Database, OmitNew } from "@/types/database"
import { buildServiceTransactionPayload, currentPeriodDueDate, pendingAutomaticServices } from "@/lib/services"
import { computeLoanTotal, redistributeUnpaidInstallments } from "@/lib/loans"
import { getUserSettings } from "@/lib/user-settings-api"
import { resolveMoney } from "@/lib/currency/resolve-money"
import { formatMoney } from "@/lib/currency/format"
import { roundAmount, type MoneyFields, type RateSource } from "@/lib/currency/money"

type ServiceInsert = Database["public"]["Tables"]["services"]["Insert"]
type ServiceUpdate = Database["public"]["Tables"]["services"]["Update"]

type ChildMoneyParent = {
  currency?: string
  exchange_rate?: number
  rate_source?: RateSource
  base_currency?: string
}

// Child rows (installments, loan payments) created without money fields inherit the
// currency and the provisional rate of their parent; original_amount is derived from amount.
function withParentMoney<T extends { amount: number; original_amount?: number }>(
  child: T,
  parent: ChildMoneyParent
): T {
  if (child.original_amount !== undefined || !parent.currency || !parent.exchange_rate) return child
  return {
    ...child,
    currency: parent.currency,
    exchange_rate: parent.exchange_rate,
    rate_source: parent.rate_source ?? "auto",
    base_currency: parent.base_currency,
    original_amount: roundAmount(child.amount / parent.exchange_rate),
  }
}

// Money pattern of a parent row (loan) reused by its origination transaction.
function parentMoneyFields(parent: {
  currency?: string
  original_amount?: number
  exchange_rate?: number
  rate_source?: RateSource
  base_currency?: string
}) {
  if (!parent.currency || parent.original_amount === undefined || parent.exchange_rate === undefined) return {}
  return {
    currency: parent.currency,
    original_amount: parent.original_amount,
    exchange_rate: parent.exchange_rate,
    rate_source: parent.rate_source ?? "auto",
    base_currency: parent.base_currency,
  }
}

export async function getTransactions(userId: string) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })

  if (error) throw error
  return data
}

export async function addTransaction(transaction: OmitNew<Transaction, "id" | "created_at" | "updated_at">) {
  // Calculate balance_total before inserting
  // Get all transactions for this user to calculate cumulative balance
  const { data: existingTransactions, error: fetchError } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", transaction.user_id)
    .order("date", { ascending: true })

  if (fetchError) throw fetchError

  // Calculate current balance from all existing transactions
  const currentBalance = (existingTransactions || []).reduce((balance, t) => {
    if (t.type === "income") {
      return balance + t.amount
    } else {
      return balance - t.amount
    }
  }, 0)

  // Calculate new balance after this transaction
  let newBalance = currentBalance
  if (transaction.type === "income") {
    newBalance += transaction.amount
  } else {
    newBalance -= transaction.amount
  }

  // Insert transaction with calculated balance_total
  const transactionWithBalance = {
    ...transaction,
    balance_total: newBalance
  }

  const { data, error } = await supabase
    .from("transactions")
    .insert([transactionWithBalance])
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
    .is("deleted_at", null)
    .order("deadline", { ascending: true })

  if (error) throw error
  return data
}

// A plan without an explicit currency is created in the user's base currency.
export async function addExpensePlan(plan: OmitNew<ExpensePlan, "id" | "deleted_at" | "created_at" | "updated_at">) {
  const currency = plan.currency ?? (await getUserSettings(plan.user_id)).base_currency
  const { data, error } = await supabase
    .from("expense_plans")
    .insert([{ ...plan, currency }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateExpensePlan(id: string, updates: Partial<ExpensePlan>) {
  const { data, error } = await supabase
    .from("expense_plans")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteExpensePlan(id: string, userId: string) {
  const { error } = await supabase
    .from("expense_plans")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)

  if (error) throw error
}

// Credit card payment functions
export async function addMultipleTransactions(transactions: OmitNew<Transaction, "id" | "created_at" | "updated_at">[]) {
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
  purchase: OmitNew<CreditPurchase, "id" | "created_at" | "updated_at">,
  installments: OmitNew<CreditInstallment, "id" | "credit_purchase_id" | "created_at" | "updated_at">[]
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
    ...withParentMoney(inst, purchase),
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

// Pays an installment. By default the transaction is converted at the payment-date rate of the
// installment currency; pass `money` (e.g. from the pay dialog) to use an edited rate. The
// installment keeps its own record (provisional rate).
export async function payCreditInstallment(
  installmentId: string,
  userId: string,
  paidDate: string,
  money?: MoneyFields
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

  const settings = await getUserSettings(userId)
  const payMoney = money ?? await resolveMoney({
    currency: installment.currency,
    originalAmount: installment.original_amount,
    base: settings.base_currency,
    date: paidDate,
    rateType: settings.ars_rate_type,
  })

  // Create a transaction for this payment using addTransaction to calculate balance
  const transaction: OmitNew<Transaction, "id" | "created_at" | "updated_at"> = {
    user_id: userId,
    type: "credit",
    ...payMoney,
    category: purchase.category,
    description: `${purchase.description} - Cuota ${installment.installment_number}/${purchase.installments}`,
    date: paidDate,
    is_recurring: null,
    installments: null,
    current_installment: null,
    paid: null,
    parent_transaction_id: null,
    due_date: null,
    balance_total: null, // Will be calculated by addTransaction
    ticket_id: null,
    service_id: null,
  }

  // Use addTransaction to automatically calculate balance_total
  const transactionData = await addTransaction(transaction)

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

// Pay several installments at once (e.g. a whole statement month).
// SEQUENTIAL: addTransaction recomputes cumulative balance_total on every call;
// parallel inserts would race on balance_total and corrupt it.
export async function payCreditInstallments(
  installmentIds: string[],
  userId: string,
  paidDate: string
): Promise<number> {
  let paid = 0
  for (const id of installmentIds) {
    await payCreditInstallment(id, userId, paidDate)
    paid++
  }
  return paid
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

export async function deleteTransaction(transactionId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', transactionId)
    .eq('user_id', userId)

  if (error) throw error
}

// Investment Functions

export async function createInvestment(investment: OmitNew<Investment, "id" | "created_at" | "updated_at">) {
  const { data, error } = await supabase
    .from("investments")
    .insert([investment])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getInvestments(userId: string) {
  const { data, error } = await supabase
    .from("investments")
    .select("*")
    .eq("user_id", userId)
    .order("start_date", { ascending: false })

  if (error) throw error
  return data
}

export async function getActiveInvestments(userId: string) {
  const { data, error } = await supabase
    .from("investments")
    .select("*")
    .eq("user_id", userId)
    .eq("is_liquidated", false)
    .order("maturity_date", { ascending: true })

  if (error) throw error
  return data
}

export async function liquidateInvestment(
  investmentId: string,
  userId: string,
  liquidationDate: string,
  actualReturn: number,
  money?: MoneyFields
) {
  // Get the investment details
  const { data: investment, error: fetchError } = await supabase
    .from("investments")
    .select("*")
    .eq("id", investmentId)
    .eq("user_id", userId)
    .single()

  if (fetchError) throw fetchError
  if (!investment) throw new Error("Investment not found")

  // Only record the difference (profit or loss), not the full amount
  // `actualReturn` is expressed in the base currency; `money` (optional) records the original
  // currency and rate the user typed it in (money.amount === |actualReturn|).
  const isProfit = actualReturn >= 0
  const absoluteReturn = Math.abs(actualReturn)
  const baseCurrency = investment.base_currency
  const returnMoney: Partial<MoneyFields> = money ?? {}

  // Create a transaction for the liquidation using addTransaction to calculate balance
  const transaction: OmitNew<Transaction, "id" | "created_at" | "updated_at"> = {
    user_id: userId,
    type: isProfit ? "income" : "expense",
    ...returnMoney,
    amount: absoluteReturn,
    category: `Inversión - ${investment.investment_type}`,
    description: isProfit
      ? `Liquidación: ${investment.description} (Capital: ${formatMoney(investment.amount, baseCurrency)} + Ganancia: ${formatMoney(actualReturn, baseCurrency)})`
      : `Liquidación: ${investment.description} (Capital: ${formatMoney(investment.amount, baseCurrency)} - Pérdida: ${formatMoney(absoluteReturn, baseCurrency)})`,
    date: liquidationDate,
    is_recurring: null,
    installments: null,
    current_installment: null,
    paid: null,
    parent_transaction_id: null,
    due_date: null,
    balance_total: null, // Will be calculated by addTransaction
    ticket_id: null,
    service_id: null,
  }

  // Use addTransaction to automatically calculate balance_total
  const transactionData = await addTransaction(transaction)

  // Update the investment as liquidated
  const { data: updatedInvestment, error: updateError } = await supabase
    .from("investments")
    .update({
      is_liquidated: true,
      liquidation_date: liquidationDate,
      actual_return: actualReturn,
      transaction_id: transactionData.id
    })
    .eq("id", investmentId)
    .select()
    .single()

  if (updateError) throw updateError

  return { investment: updatedInvestment, transaction: transactionData }
}

export async function updateInvestment(
  investmentId: string,
  userId: string,
  updates: Partial<OmitNew<Investment, "id" | "user_id" | "created_at" | "updated_at">>
) {
  const { data, error } = await supabase
    .from("investments")
    .update(updates)
    .eq("id", investmentId)
    .eq("user_id", userId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function partialSellCurrency(
  investmentId: string,
  userId: string,
  unitsSold: number,
  sellExchangeRate: number,
  saleDate: string
) {
  // Get the investment details
  const { data: investment, error: fetchError } = await supabase
    .from("investments")
    .select("*")
    .eq("id", investmentId)
    .eq("user_id", userId)
    .single()

  if (fetchError) throw fetchError
  if (!investment) throw new Error("Investment not found")
  if (investment.investment_type !== 'compra_divisas') throw new Error("This function is only for currency investments")
  if (!investment.exchange_rate) throw new Error("Investment has no exchange rate")

  // Calculate total currency units available
  const totalUnits = investment.amount / investment.exchange_rate

  // Validate units to sell
  if (unitsSold > totalUnits) throw new Error("Cannot sell more units than available")
  if (unitsSold <= 0) throw new Error("Units to sell must be greater than 0")

  // Calculate sale amounts
  const saleAmount = unitsSold * sellExchangeRate
  const proportionalCost = unitsSold * investment.exchange_rate
  const profit = saleAmount - proportionalCost

  // Calculate remaining amount in ARS (remaining units * original exchange rate)
  const remainingUnits = totalUnits - unitsSold
  const remainingAmount = remainingUnits * investment.exchange_rate

  // Check if this is a full sale (within small tolerance for floating point)
  const isFullSale = remainingUnits < 0.01

  // Only record the difference (profit or loss), not the full sale amount
  const isProfit = profit >= 0
  const absoluteProfit = Math.abs(profit)
  const saleTypeLabel = isFullSale ? 'Venta total' : 'Venta parcial'

  // Create a transaction for the profit/loss only
  // The profit or loss is booked in the base currency (rate 1).
  const baseCurrency = investment.base_currency
  const profitAmount = roundAmount(absoluteProfit)
  const transaction: OmitNew<Transaction, "id" | "created_at" | "updated_at"> = {
    user_id: userId,
    type: isProfit ? "income" : "expense",
    amount: profitAmount,
    currency: baseCurrency,
    original_amount: profitAmount,
    exchange_rate: 1,
    rate_source: "auto",
    base_currency: baseCurrency,
    category: `Inversión - ${investment.investment_type}`,
    description: `${saleTypeLabel} ${investment.currency}: ${unitsSold.toFixed(2)} unidades a TC ${formatMoney(sellExchangeRate, baseCurrency)} (${isProfit ? 'Ganancia' : 'Pérdida'}: ${formatMoney(absoluteProfit, baseCurrency)}) (${investment.description})`,
    date: saleDate,
    is_recurring: null,
    installments: null,
    current_installment: null,
    paid: null,
    parent_transaction_id: null,
    due_date: null,
    balance_total: null, // Will be calculated by addTransaction
    ticket_id: null,
    service_id: null,
  }

  const transactionData = await addTransaction(transaction)

  if (isFullSale) {
    // Full sale - mark as liquidated
    const { data: updatedInvestment, error: updateError } = await supabase
      .from("investments")
      .update({
        is_liquidated: true,
        liquidation_date: saleDate,
        actual_return: profit,
        transaction_id: transactionData.id
      })
      .eq("id", investmentId)
      .select()
      .single()

    if (updateError) throw updateError

    return {
      investment: updatedInvestment,
      transaction: transactionData,
      isFullSale: true,
      profit
    }
  } else {
    // Partial sale - update the remaining amount
    const { data: updatedInvestment, error: updateError } = await supabase
      .from("investments")
      .update({
        amount: remainingAmount,
        original_amount: remainingUnits
      })
      .eq("id", investmentId)
      .select()
      .single()

    if (updateError) throw updateError

    return {
      investment: updatedInvestment,
      transaction: transactionData,
      isFullSale: false,
      profit
    }
  }
}

export async function deleteInvestment(investmentId: string, userId: string) {
  // Check if investment is liquidated and has a transaction
  const { data: investment, error: fetchError } = await supabase
    .from("investments")
    .select("*")
    .eq("id", investmentId)
    .eq("user_id", userId)
    .single()

  if (fetchError) throw fetchError
  if (!investment) throw new Error("Investment not found")

  // If liquidated and has a transaction, delete the transaction first
  if (investment.is_liquidated && investment.transaction_id) {
    const { error: deleteTransactionError } = await supabase
      .from("transactions")
      .delete()
      .eq("id", investment.transaction_id)
      .eq("user_id", userId)

    if (deleteTransactionError) {
      console.error("Error deleting related transaction:", deleteTransactionError)
    }
  }

  // Delete the investment
  const { error: deleteError } = await supabase
    .from("investments")
    .delete()
    .eq("id", investmentId)
    .eq("user_id", userId)

  if (deleteError) throw deleteError
}

export async function updateCreditPurchase(
  purchaseId: string,
  userId: string,
  updates: Partial<OmitNew<CreditPurchase, "id" | "user_id" | "created_at" | "updated_at">>
) {
  // First verify the purchase belongs to the user
  const { data: purchase, error: fetchError } = await supabase
    .from("credit_purchases")
    .select("*")
    .eq("id", purchaseId)
    .eq("user_id", userId)
    .single()

  if (fetchError) throw fetchError
  if (!purchase) throw new Error("Purchase not found")

  // Update the purchase
  const { data, error } = await supabase
    .from("credit_purchases")
    .update(updates)
    .eq("id", purchaseId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function pushCreditPurchaseInstallments(
  purchaseId: string,
  userId: string
): Promise<CreditInstallment[]> {
  const { data: purchase, error: fetchError } = await supabase
    .from("credit_purchases")
    .select("id")
    .eq("id", purchaseId)
    .eq("user_id", userId)
    .single()

  if (fetchError) throw fetchError
  if (!purchase) throw new Error("Purchase not found")

  const { data: installments, error: instError } = await supabase
    .from("credit_installments")
    .select("*")
    .eq("credit_purchase_id", purchaseId)
    .eq("paid", false)

  if (instError) throw instError
  if (!installments || installments.length === 0) return []

  const updated: CreditInstallment[] = []
  for (const inst of installments) {
    const newDueDate = format(addMonths(new Date(inst.due_date), 1), "yyyy-MM-dd")
    const { data, error } = await supabase
      .from("credit_installments")
      .update({ due_date: newDueDate })
      .eq("id", inst.id)
      .select()
      .single()

    if (error) throw error
    updated.push(data)
  }

  return updated
}

export async function deleteCreditPurchase(purchaseId: string, userId: string) {
  // First verify the purchase belongs to the user
  const { data: purchase, error: fetchError } = await supabase
    .from("credit_purchases")
    .select("*")
    .eq("id", purchaseId)
    .eq("user_id", userId)
    .single()

  if (fetchError) throw fetchError
  if (!purchase) throw new Error("Purchase not found")

  // Get all installments for this purchase
  const { data: installments, error: installmentsError } = await supabase
    .from("credit_installments")
    .select("*")
    .eq("credit_purchase_id", purchaseId)

  if (installmentsError) throw installmentsError

  // Delete all related transactions (for paid installments)
  if (installments && installments.length > 0) {
    const transactionIds = installments
      .filter(inst => inst.transaction_id)
      .map(inst => inst.transaction_id!)

    if (transactionIds.length > 0) {
      const { error: deleteTransactionsError } = await supabase
        .from("transactions")
        .delete()
        .in("id", transactionIds)

      if (deleteTransactionsError) {
        console.error("Error deleting transactions:", deleteTransactionsError)
      }
    }
  }

  // Delete the purchase (installments will cascade delete due to FK constraint)
  const { error: deleteError } = await supabase
    .from("credit_purchases")
    .delete()
    .eq("id", purchaseId)

  if (deleteError) throw deleteError
}

// Loan Functions

export async function createLoan(
  loan: OmitNew<Loan, "id" | "created_at" | "updated_at" | "transaction_id">,
  payments: OmitNew<LoanPayment, "id" | "loan_id" | "created_at" | "updated_at">[]
): Promise<{ loan: Loan; payments: LoanPayment[]; transaction: Transaction }> {
  // Create the origination transaction
  const isPaymentPlan = loan.loan_type === "payment_plan"
  const transactionType = isPaymentPlan ? "expense" : loan.loan_type === "given" ? "expense" : "income"
  const description = isPaymentPlan
    ? `Plan de pago - ${loan.counterparty_name}: ${loan.description}`
    : `Prestamo ${loan.loan_type === "given" ? "a" : "de"} ${loan.counterparty_name}: ${loan.description}`

  const transaction: OmitNew<Transaction, "id" | "created_at" | "updated_at"> = {
    user_id: loan.user_id,
    type: transactionType,
    ...parentMoneyFields(loan),
    amount: loan.total_amount,
    category: isPaymentPlan ? "Plan de Pago" : "Prestamo",
    description,
    date: loan.start_date,
    is_recurring: null,
    installments: null,
    current_installment: null,
    paid: null,
    parent_transaction_id: null,
    due_date: null,
    balance_total: null,
    ticket_id: null,
    service_id: null,
  }

  const transactionData = await addTransaction(transaction)

  // Create the loan record
  const { data: loanData, error: loanError } = await supabase
    .from("loans")
    .insert([{ ...loan, transaction_id: transactionData.id }])
    .select()
    .single()

  if (loanError) throw loanError

  // Create all payment records
  const paymentsWithLoanId = payments.map(p => ({
    ...withParentMoney(p, loan),
    loan_id: loanData.id
  }))

  const { data: paymentsData, error: paymentsError } = await supabase
    .from("loan_payments")
    .insert(paymentsWithLoanId)
    .select()

  if (paymentsError) throw paymentsError

  return { loan: loanData, payments: paymentsData, transaction: transactionData }
}

export async function getLoans(userId: string): Promise<Loan[]> {
  const { data, error } = await supabase
    .from("loans")
    .select("*")
    .eq("user_id", userId)
    .order("start_date", { ascending: false })

  if (error) throw error
  return data
}

export async function getActiveLoans(userId: string): Promise<Loan[]> {
  const { data, error } = await supabase
    .from("loans")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("start_date", { ascending: false })

  if (error) throw error
  return data
}

export async function getLoanPayments(loanId: string): Promise<LoanPayment[]> {
  const { data, error } = await supabase
    .from("loan_payments")
    .select("*")
    .eq("loan_id", loanId)
    .order("payment_number", { ascending: true })

  if (error) throw error
  return data
}

export async function getAllLoanPayments(userId: string): Promise<LoanPayment[]> {
  const { data: loans, error: loansError } = await supabase
    .from("loans")
    .select("id")
    .eq("user_id", userId)

  if (loansError) throw loansError
  if (!loans || loans.length === 0) return []

  const loanIds = loans.map(l => l.id)

  const { data, error } = await supabase
    .from("loan_payments")
    .select("*")
    .in("loan_id", loanIds)
    .order("due_date", { ascending: true })

  if (error) throw error
  return data || []
}

export async function payLoanPayment(
  paymentId: string,
  userId: string,
  paidDate: string,
  money?: MoneyFields
): Promise<{ payment: LoanPayment; transaction: Transaction }> {
  // Get the payment details with its parent loan
  const { data: payment, error: fetchError } = await supabase
    .from("loan_payments")
    .select(`
      *,
      loan:loans(*)
    `)
    .eq("id", paymentId)
    .single()

  if (fetchError) throw fetchError
  if (!payment || !payment.loan) throw new Error("Payment not found")

  const loan = Array.isArray(payment.loan) ? payment.loan[0] : payment.loan

  // Create a transaction for this payment
  const isPaymentPlan = loan.loan_type === "payment_plan"
  const isGiven = loan.loan_type === "given"
  const transactionType = isPaymentPlan ? "expense" : isGiven ? "income" : "expense"
  const action = isPaymentPlan
    ? `Cuota plan de pago - ${loan.counterparty_name}`
    : isGiven ? `Cobro prestamo a ${loan.counterparty_name}` : `Pago prestamo de ${loan.counterparty_name}`

  const settings = await getUserSettings(userId)
  const payMoney = money ?? await resolveMoney({
    currency: payment.currency,
    originalAmount: payment.original_amount,
    base: settings.base_currency,
    date: paidDate,
    rateType: settings.ars_rate_type,
  })

  const transaction: OmitNew<Transaction, "id" | "created_at" | "updated_at"> = {
    user_id: userId,
    type: transactionType,
    ...payMoney,
    category: isPaymentPlan ? "Plan de Pago" : "Prestamo",
    description: `${action}: Cuota ${payment.payment_number}/${loan.installments_count}`,
    date: paidDate,
    is_recurring: null,
    installments: null,
    current_installment: null,
    paid: null,
    parent_transaction_id: null,
    due_date: null,
    balance_total: null,
    ticket_id: null,
    service_id: null,
  }

  const transactionData = await addTransaction(transaction)

  // Update the payment as paid
  const { data: updatedPayment, error: updateError } = await supabase
    .from("loan_payments")
    .update({
      paid: true,
      paid_date: paidDate,
      transaction_id: transactionData.id
    })
    .eq("id", paymentId)
    .select()
    .single()

  if (updateError) throw updateError

  // Check if all payments for this loan are now paid
  const { data: allPayments, error: allPaymentsError } = await supabase
    .from("loan_payments")
    .select("paid")
    .eq("loan_id", loan.id)

  if (allPaymentsError) throw allPaymentsError

  const allPaid = allPayments.every(p => p.paid)
  if (allPaid) {
    await supabase
      .from("loans")
      .update({ status: "completed" })
      .eq("id", loan.id)
  }

  return { payment: updatedPayment, transaction: transactionData }
}

// Ticket Functions (used by data portability export)

export async function getTickets(userId: string): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("user_id", userId)
    .order("ticket_date", { ascending: false })

  if (error) throw error
  return data || []
}

export async function getTicketItems(ticketIds: string[]): Promise<TicketItem[]> {
  if (ticketIds.length === 0) return []
  const { data, error } = await supabase
    .from("ticket_items")
    .select("*")
    .in("ticket_id", ticketIds)

  if (error) throw error
  return data || []
}

// Recompute balance_total for every transaction of a user in date order.
// Used after a bulk import to keep the cumulative balance coherent.
// The client is injectable so server routes can run it with their own (service-role) client.
export async function recalculateAllBalances(
  userId: string,
  client: SupabaseClient<Database> = supabase
): Promise<void> {
  const { data: rows, error } = await client
    .from("transactions")
    .select("id, type, amount, date, created_at")
    .eq("user_id", userId)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) throw error
  if (!rows || rows.length === 0) return

  let running = 0
  const BATCH = 50
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH)
    await Promise.all(
      slice.map((r) => {
        running = r.type === "income" ? running + r.amount : running - r.amount
        const newBalance = running
        return client
          .from("transactions")
          .update({ balance_total: newBalance })
          .eq("id", r.id)
          .eq("user_id", userId)
      })
    )
  }
}

export async function deleteLoan(loanId: string, userId: string): Promise<void> {
  // Verify ownership
  const { data: loan, error: fetchError } = await supabase
    .from("loans")
    .select("*")
    .eq("id", loanId)
    .eq("user_id", userId)
    .single()

  if (fetchError) throw fetchError
  if (!loan) throw new Error("Loan not found")

  // Get all payments to find related transactions
  const { data: payments, error: paymentsError } = await supabase
    .from("loan_payments")
    .select("*")
    .eq("loan_id", loanId)

  if (paymentsError) throw paymentsError

  // Collect all transaction IDs to delete
  const transactionIds: string[] = []
  if (payments) {
    for (const p of payments) {
      if (p.transaction_id) transactionIds.push(p.transaction_id)
    }
  }
  if (loan.transaction_id) transactionIds.push(loan.transaction_id)

  // Delete all related transactions
  if (transactionIds.length > 0) {
    const { error: deleteTransactionsError } = await supabase
      .from("transactions")
      .delete()
      .in("id", transactionIds)

    if (deleteTransactionsError) {
      console.error("Error deleting loan transactions:", deleteTransactionsError)
    }
  }

  // Delete the loan (payments will cascade delete)
  const { error: deleteError } = await supabase
    .from("loans")
    .delete()
    .eq("id", loanId)

  if (deleteError) throw deleteError
}

// `principal_amount` is expressed in the loan currency (the dialog works in the original
// currency); base amounts are derived with the loan rate.
export type LoanEditableFields = Pick<
  Loan,
  "counterparty_name" | "description" | "principal_amount" | "interest_rate" | "start_date" | "due_date"
>

export interface LoanRateOverride {
  rate: number
  source: RateSource
}

function loanOriginDescription(loan: Pick<Loan, "loan_type" | "counterparty_name" | "description">): string {
  return loan.loan_type === "payment_plan"
    ? `Plan de pago - ${loan.counterparty_name}: ${loan.description}`
    : `Prestamo ${loan.loan_type === "given" ? "a" : "de"} ${loan.counterparty_name}: ${loan.description}`
}

// Edit a loan's terms. Amounts are computed in the loan currency, then converted with the loan
// rate (optionally overridden). The total is recomputed, the origination transaction is kept in
// sync and the new total is redistributed across unpaid installments.
export async function updateLoan(
  loanId: string,
  userId: string,
  fields: LoanEditableFields,
  rateOverride?: LoanRateOverride
): Promise<void> {
  const { data: loan, error: fetchError } = await supabase
    .from("loans")
    .select("*")
    .eq("id", loanId)
    .eq("user_id", userId)
    .single()

  if (fetchError) throw fetchError
  if (!loan) throw new Error("Loan not found")

  const { data: payments, error: paymentsError } = await supabase
    .from("loan_payments")
    .select("*")
    .eq("loan_id", loanId)

  if (paymentsError) throw paymentsError

  const sameCurrency = loan.currency === loan.base_currency
  const rate = sameCurrency ? 1 : (rateOverride?.rate ?? loan.exchange_rate)
  const rateSource: RateSource = sameCurrency ? "auto" : (rateOverride?.source ?? loan.rate_source)
  const rateChanged = rate !== loan.exchange_rate

  // Everything below is computed in the loan (original) currency.
  const totalOriginal = computeLoanTotal(fields.principal_amount, fields.interest_rate)
  const installmentUpdates = redistributeUnpaidInstallments(
    (payments ?? []).map((p) => ({ ...p, amount: p.original_amount })),
    totalOriginal
  )

  const { error: loanError } = await supabase
    .from("loans")
    .update({
      ...fields,
      principal_amount: roundAmount(fields.principal_amount * rate),
      total_amount: roundAmount(totalOriginal * rate),
      original_amount: totalOriginal,
      exchange_rate: rate,
      rate_source: rateSource,
    })
    .eq("id", loanId)
    .eq("user_id", userId)

  if (loanError) throw loanError

  for (const update of installmentUpdates) {
    const { error } = await supabase
      .from("loan_payments")
      .update({
        amount: roundAmount(update.amount * rate),
        original_amount: update.amount,
        exchange_rate: rate,
        rate_source: rateSource,
      })
      .eq("id", update.id)
    if (error) throw error
  }

  if (rateChanged) {
    // Paid installments keep the rate they were paid with; only their provisional record follows.
    const { error } = await supabase
      .from("loan_payments")
      .update({ exchange_rate: rate, rate_source: rateSource })
      .eq("loan_id", loanId)
      .eq("paid", true)
    if (error) throw error
  }

  if (loan.transaction_id) {
    const { error } = await supabase
      .from("transactions")
      .update({
        amount: roundAmount(totalOriginal * rate),
        original_amount: totalOriginal,
        exchange_rate: rate,
        rate_source: rateSource,
        date: fields.start_date,
        description: loanOriginDescription({ ...loan, ...fields }),
      })
      .eq("id", loan.transaction_id)
      .eq("user_id", userId)
    if (error) throw error
  }

  await recalculateAllBalances(userId)
}

// Edit a single installment. `amount` is expressed in the loan currency. A paid installment also
// updates its transaction (at the rate that transaction was recorded with). The loan total
// becomes the sum of its installments.
export async function updateLoanPayment(
  paymentId: string,
  userId: string,
  fields: Pick<LoanPayment, "amount" | "due_date">
): Promise<void> {
  const { data: payment, error: fetchError } = await supabase
    .from("loan_payments")
    .select(`
      *,
      loan:loans(*)
    `)
    .eq("id", paymentId)
    .single()

  if (fetchError) throw fetchError
  const loan = payment && (Array.isArray(payment.loan) ? payment.loan[0] : payment.loan)
  if (!payment || !loan || loan.user_id !== userId) throw new Error("Payment not found")

  const { error: paymentError } = await supabase
    .from("loan_payments")
    .update({
      due_date: fields.due_date,
      amount: roundAmount(fields.amount * payment.exchange_rate),
      original_amount: fields.amount,
    })
    .eq("id", paymentId)

  if (paymentError) throw paymentError

  if (payment.paid && payment.transaction_id) {
    const { data: tx, error: txFetchError } = await supabase
      .from("transactions")
      .select("exchange_rate")
      .eq("id", payment.transaction_id)
      .eq("user_id", userId)
      .single()
    if (txFetchError) throw txFetchError

    const { error } = await supabase
      .from("transactions")
      .update({
        amount: roundAmount(fields.amount * tx.exchange_rate),
        original_amount: fields.amount,
      })
      .eq("id", payment.transaction_id)
      .eq("user_id", userId)
    if (error) throw error
  }

  const { data: allPayments, error: allPaymentsError } = await supabase
    .from("loan_payments")
    .select("original_amount")
    .eq("loan_id", loan.id)

  if (allPaymentsError) throw allPaymentsError

  const totalOriginal = roundAmount(allPayments.reduce((sum, p) => sum + p.original_amount, 0))
  const totalBase = roundAmount(totalOriginal * loan.exchange_rate)

  const { error: loanError } = await supabase
    .from("loans")
    .update({ total_amount: totalBase, original_amount: totalOriginal })
    .eq("id", loan.id)
    .eq("user_id", userId)

  if (loanError) throw loanError

  if (loan.transaction_id) {
    const { error } = await supabase
      .from("transactions")
      .update({ amount: totalBase, original_amount: totalOriginal })
      .eq("id", loan.transaction_id)
      .eq("user_id", userId)
    if (error) throw error
  }

  await recalculateAllBalances(userId)
}

// ============================================================
// Services
// ============================================================

export async function getServices(userId: string): Promise<Service[]> {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) throw error
  return data
}

export async function createService(
  service: Omit<ServiceInsert, "user_id">,
  userId: string
): Promise<Service> {
  const { data, error } = await supabase
    .from("services")
    .insert({ ...service, user_id: userId })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateService(
  serviceId: string,
  updates: ServiceUpdate,
  userId: string
): Promise<Service> {
  const { data, error } = await supabase
    .from("services")
    .update(updates)
    .eq("id", serviceId)
    .eq("user_id", userId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteService(serviceId: string, userId: string): Promise<void> {
  // ON DELETE SET NULL on transactions.service_id keeps historical expenses intact.
  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", serviceId)
    .eq("user_id", userId)

  if (error) throw error
}

// ---- Linked-transaction queries ----

// All transactions linked to any service for this user (used to derive status).
export async function getServiceTransactions(userId: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .not("service_id", "is", null)
    .order("date", { ascending: false })

  if (error) throw error
  return data
}

// ---- Manual payment ----

// Create the linked expense for a manual service. Amount may differ from
// service.amount (utilities vary). Funnels through addTransaction so
// balance_total stays coherent. The transaction date is the actual pay day,
// not the service due date.
// `amount` is expressed in the service currency; the transaction is converted at the pay-date
// rate unless `money` (an edited rate from the pay dialog) is given.
export async function payService(
  service: Service,
  amount: number,
  userId: string,
  ref: Date = new Date(),
  money?: MoneyFields
): Promise<Transaction> {
  const date = format(ref, "yyyy-MM-dd")
  let payMoney = money
  if (!payMoney) {
    const settings = await getUserSettings(userId)
    payMoney = await resolveMoney({
      currency: service.currency,
      originalAmount: amount,
      base: settings.base_currency,
      date,
      rateType: settings.ars_rate_type,
    })
  }
  const payload = buildServiceTransactionPayload(service, payMoney.amount, date)
  return addTransaction({ ...payload, ...payMoney, user_id: userId, balance_total: null })
}

// ---- Lazy automatic generation ----

// True when `error` carries a Postgres "unique_violation" (23505) code.
// This is the DB-level idempotency signal: the uniq_service_period partial index
// rejected a second charge for the same service in the same period.
// Supabase rejections arrive as PostgrestError-like objects with a string `code`.
function isUniqueViolation(error: object): boolean {
  return "code" in error && error.code === "23505"
}

// For each active automatic service with no transaction in the current period,
// create one. Returns the newly created transactions (possibly empty).
// SEQUENTIAL: addTransaction recomputes cumulative balance_total on every call;
// parallel inserts would race on balance_total and corrupt it.
//
// A 23505 unique violation means another session/tab/device (or a StrictMode
// double-mount) already charged this service this period — treat it as "already
// paid" and skip, so generation stays idempotent regardless of concurrency.
export async function generateAutomaticServiceTransactions(
  services: Service[],
  serviceTransactions: Transaction[],
  userId: string,
  ref: Date = new Date()
): Promise<Transaction[]> {
  const pending = pendingAutomaticServices(services, serviceTransactions, ref)
  const created: Transaction[] = []
  if (pending.length === 0) return created

  const settings = await getUserSettings(userId)

  for (const service of pending) {
    const dueDate = currentPeriodDueDate(service, ref)
    // Generation uses the rate of the charge date; when the lookup fails the stored
    // provisional rate keeps the generation going.
    const money = await resolveMoney({
      currency: service.currency,
      originalAmount: service.original_amount,
      base: settings.base_currency,
      date: dueDate,
      rateType: settings.ars_rate_type,
      fallback: { rate: service.exchange_rate, source: service.rate_source },
    })
    const payload = buildServiceTransactionPayload(service, money.amount, dueDate)
    try {
      const tx = await addTransaction({ ...payload, ...money, user_id: userId, balance_total: null })
      created.push(tx)
    } catch (error) {
      if (typeof error === "object" && error !== null && isUniqueViolation(error)) continue
      throw error
    }
  }

  return created
}