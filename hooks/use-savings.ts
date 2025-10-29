"use client"

import { useState, useEffect } from "react"
// import { SavingsService } from "@/components/savings" // TODO: This service doesn't exist
import { useAuth } from "./use-auth"
import type { SavingsGoal } from "@/types/database"

export function useSavings() {
  const { user } = useAuth()
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSavingsGoals = async () => {
    if (!user) return

    try {
      setLoading(true)
      // const data = await SavingsService.getAll(user.id)
      const data: SavingsGoal[] = []
      setSavingsGoals(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching savings goals")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSavingsGoals()
  }, [user])

  const addSavingsGoal = async (goal: Omit<SavingsGoal, "id" | "user_id" | "created_at" | "updated_at">) => {
    if (!user) return

    try {
      // const newGoal = await SavingsService.create(goal, user.id)
      const newGoal = {} as SavingsGoal
      setSavingsGoals((prev) => [newGoal, ...prev])
      return newGoal
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error adding savings goal")
      throw err
    }
  }

  const updateSavingsGoal = async (id: string, amount: number) => {
    if (!user) return

    try {
      // const updatedGoal = await SavingsService.addMoney(id, amount, user.id)
      const updatedGoal = {} as SavingsGoal
      setSavingsGoals((prev) => prev.map((g) => (g.id === id ? updatedGoal : g)))
      return updatedGoal
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating savings goal")
      throw err
    }
  }

  const deleteSavingsGoal = async (id: string) => {
    if (!user) return

    try {
      // await SavingsService.delete(id, user.id)
      setSavingsGoals((prev) => prev.filter((g) => g.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting savings goal")
      throw err
    }
  }

  return {
    savingsGoals,
    loading,
    error,
    addSavingsGoal,
    updateSavingsGoal,
    deleteSavingsGoal,
    refetch: fetchSavingsGoals,
  }
}
