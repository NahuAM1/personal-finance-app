"use client"

import { useState, useEffect } from "react"
import { ExpensePlanService } from "@/components/expense-plans"
import { useAuth } from "./use-auth"
import type { ExpensePlan } from "@/types/database"

export function useExpensePlans() {
  const { user } = useAuth()
  const [expensePlans, setExpensePlans] = useState<ExpensePlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchExpensePlans = async () => {
    if (!user) return

    try {
      setLoading(true)
      const data = await ExpensePlanService.getAll(user.id)
      setExpensePlans(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching expense plans")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExpensePlans()
  }, [user])

  const addExpensePlan = async (plan: Omit<ExpensePlan, "id" | "user_id" | "created_at" | "updated_at">) => {
    if (!user) return

    try {
      const newPlan = await ExpensePlanService.create(plan, user.id)
      setExpensePlans((prev) => [newPlan, ...prev])
      return newPlan
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error adding expense plan")
      throw err
    }
  }

  const updateExpensePlan = async (id: string, amount: number) => {
    if (!user) return

    try {
      const updatedPlan = await ExpensePlanService.addMoney(id, amount, user.id)
      setExpensePlans((prev) => prev.map((p) => (p.id === id ? updatedPlan : p)))
      return updatedPlan
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating expense plan")
      throw err
    }
  }

  const deleteExpensePlan = async (id: string) => {
    if (!user) return

    try {
      await ExpensePlanService.delete(id, user.id)
      setExpensePlans((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting expense plan")
      throw err
    }
  }

  return {
    expensePlans,
    loading,
    error,
    addExpensePlan,
    updateExpensePlan,
    deleteExpensePlan,
    refetch: fetchExpensePlans,
  }
}
