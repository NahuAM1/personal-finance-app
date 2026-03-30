import { supabase } from "@/lib/supabase"
import type { Transaction, ExpensePlan, CreditPurchase, CreditInstallment, Investment, Loan, LoanPayment } from "@/types/database"

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

export async function addExpensePlan(plan: Omit<ExpensePlan, "id" | "deleted_at" | "created_at" | "updated_at">) {
  const { data, error } = await supabase
    .from("expense_plans")
    .insert([plan])
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

  // Create a transaction for this payment using addTransaction to calculate balance
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
    balance_total: null, // Will be calculated by addTransaction
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

export async function createInvestment(investment: Omit<Investment, "id" | "created_at" | "updated_at">) {
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
  actualReturn: number
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
  const isProfit = actualReturn >= 0
  const absoluteReturn = Math.abs(actualReturn)

  // Create a transaction for the liquidation using addTransaction to calculate balance
  const transaction: Omit<Transaction, "id" | "created_at" | "updated_at"> = {
    user_id: userId,
    type: isProfit ? "income" : "expense",
    amount: absoluteReturn,
    category: `Inversión - ${investment.investment_type}`,
    description: isProfit
      ? `Liquidación: ${investment.description} (Capital: $${investment.amount.toFixed(2)} + Ganancia: $${actualReturn.toFixed(2)})`
      : `Liquidación: ${investment.description} (Capital: $${investment.amount.toFixed(2)} - Pérdida: $${absoluteReturn.toFixed(2)})`,
    date: liquidationDate,
    is_recurring: null,
    installments: null,
    current_installment: null,
    paid: null,
    parent_transaction_id: null,
    due_date: null,
    balance_total: null, // Will be calculated by addTransaction
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
  updates: Partial<Omit<Investment, "id" | "user_id" | "created_at" | "updated_at">>
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
  const transaction: Omit<Transaction, "id" | "created_at" | "updated_at"> = {
    user_id: userId,
    type: isProfit ? "income" : "expense",
    amount: absoluteProfit,
    category: `Inversión - ${investment.investment_type}`,
    description: `${saleTypeLabel} ${investment.currency}: ${unitsSold.toFixed(2)} unidades a TC $${sellExchangeRate.toFixed(2)} (${isProfit ? 'Ganancia' : 'Pérdida'}: $${absoluteProfit.toFixed(2)}) (${investment.description})`,
    date: saleDate,
    is_recurring: null,
    installments: null,
    current_installment: null,
    paid: null,
    parent_transaction_id: null,
    due_date: null,
    balance_total: null, // Will be calculated by addTransaction
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
        amount: remainingAmount
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
  updates: Partial<Omit<CreditPurchase, "id" | "user_id" | "created_at" | "updated_at">>
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
  loan: Omit<Loan, "id" | "created_at" | "updated_at" | "transaction_id">,
  payments: Omit<LoanPayment, "id" | "loan_id" | "created_at" | "updated_at">[]
): Promise<{ loan: Loan; payments: LoanPayment[]; transaction: Transaction }> {
  // Create the origination transaction
  const isPaymentPlan = loan.loan_type === "payment_plan"
  const transactionType = isPaymentPlan ? "expense" : loan.loan_type === "given" ? "expense" : "income"
  const description = isPaymentPlan
    ? `Plan de pago - ${loan.counterparty_name}: ${loan.description}`
    : `Prestamo ${loan.loan_type === "given" ? "a" : "de"} ${loan.counterparty_name}: ${loan.description}`

  const transaction: Omit<Transaction, "id" | "created_at" | "updated_at"> = {
    user_id: loan.user_id,
    type: transactionType,
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
    ...p,
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
  paidDate: string
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

  const transaction: Omit<Transaction, "id" | "created_at" | "updated_at"> = {
    user_id: userId,
    type: transactionType,
    amount: payment.amount,
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