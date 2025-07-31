"use client"

import { useState, useEffect } from "react"
import { TransactionService } from "@/lib/transactions"
import { useAuth } from "./use-auth"
import type { Transaction } from "@/types/database"

export function useTransactions() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTransactions = async () => {
    if (!user) return

    try {
      setLoading(true)
      const data = await TransactionService.getAll(user.id)
      setTransactions(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching transactions")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTransactions()
  }, [user])

  const addTransaction = async (transaction: Omit<Transaction, "id" | "user_id" | "created_at" | "updated_at">) => {
    if (!user) return

    try {
      const newTransaction = await TransactionService.create(transaction, user.id)
      setTransactions((prev) => [newTransaction, ...prev])
      return newTransaction
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error adding transaction")
      throw err
    }
  }

  const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
    if (!user) return

    try {
      const updatedTransaction = await TransactionService.update(id, updates, user.id)
      setTransactions((prev) => prev.map((t) => (t.id === id ? updatedTransaction : t)))
      return updatedTransaction
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating transaction")
      throw err
    }
  }

  const deleteTransaction = async (id: string) => {
    if (!user) return

    try {
      await TransactionService.delete(id, user.id)
      setTransactions((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting transaction")
      throw err
    }
  }

  return {
    transactions,
    loading,
    error,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    refetch: fetchTransactions,
  }
}
