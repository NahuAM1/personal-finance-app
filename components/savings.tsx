"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { PlusCircle, Target, Calendar, DollarSign } from "lucide-react"
import type { SavingsGoal } from "@/types/database"

interface SavingsProps {
  savingsGoals: SavingsGoal[]
  onAddGoal: (goal: Omit<SavingsGoal, "id" | "user_id" | "created_at" | "updated_at">) => void
  onUpdateGoal: (id: string, amount: number) => void
}

export function Savings({ savingsGoals, onAddGoal, onUpdateGoal }: SavingsProps) {
  const [newGoal, setNewGoal] = useState({
    name: "",
    targetAmount: "",
    deadline: "",
  })
  const [addAmount, setAddAmount] = useState<Record<string, string>>({})
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault()

    if (!newGoal.name || !newGoal.targetAmount || !newGoal.deadline) return

    onAddGoal({
      name: newGoal.name,
      target_amount: Number.parseFloat(newGoal.targetAmount),
      current_amount: 0,
      deadline: newGoal.deadline,
    })

    setNewGoal({ name: "", targetAmount: "", deadline: "" })
    setIsDialogOpen(false)
  }

  const handleAddMoney = (goalId: string) => {
    const amount = Number.parseFloat(addAmount[goalId] || "0")
    if (amount > 0) {
      onUpdateGoal(goalId, amount)
      setAddAmount({ ...addAmount, [goalId]: "" })
    }
  }

  const totalSaved = savingsGoals.reduce((sum, goal) => sum + goal.current_amount, 0)
  const totalTarget = savingsGoals.reduce((sum, goal) => sum + goal.target_amount, 0)
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Resumen general */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Resumen de Ahorros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">${totalSaved.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Total Ahorrado</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">${totalTarget.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Meta Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{overallProgress.toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Progreso General</div>
            </div>
          </div>
          <div className="mt-4">
            <Progress value={overallProgress} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Botón para agregar nueva meta */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Metas de Ahorro</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="h-4 w-4 mr-2" />
              Nueva Meta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nueva Meta de Ahorro</DialogTitle>
              <DialogDescription>Define una nueva meta de ahorro con un objetivo y fecha límite</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddGoal} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="goal-name">Nombre de la Meta</Label>
                <Input
                  id="goal-name"
                  placeholder="ej. Viaje a Europa"
                  value={newGoal.name}
                  onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal-amount">Monto Objetivo</Label>
                <Input
                  id="goal-amount"
                  type="number"
                  placeholder="0.00"
                  value={newGoal.targetAmount}
                  onChange={(e) => setNewGoal({ ...newGoal, targetAmount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal-deadline">Fecha Límite</Label>
                <Input
                  id="goal-deadline"
                  type="date"
                  value={newGoal.deadline}
                  onChange={(e) => setNewGoal({ ...newGoal, deadline: e.target.value })}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Crear Meta
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de metas */}
      <div className="grid gap-4 md:grid-cols-2">
        {savingsGoals.map((goal) => {
          const progress = (goal.current_amount / goal.target_amount) * 100
          const remaining = goal.target_amount - goal.current_amount
          const daysLeft = Math.ceil((new Date(goal.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))

          return (
            <Card key={goal.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{goal.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Calendar className="h-4 w-4" />
                      {daysLeft > 0 ? `${daysLeft} días restantes` : "Fecha vencida"}
                    </CardDescription>
                  </div>
                  <Badge variant={progress >= 100 ? "default" : "secondary"}>{progress.toFixed(1)}%</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>${goal.current_amount.toLocaleString()}</span>
                    <span>${goal.target_amount.toLocaleString()}</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="text-sm text-gray-600 mt-1">Faltan ${remaining.toLocaleString()}</div>
                </div>

                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Monto a agregar"
                    value={addAmount[goal.id] || ""}
                    onChange={(e) => setAddAmount({ ...addAmount, [goal.id]: e.target.value })}
                  />
                  <Button
                    onClick={() => handleAddMoney(goal.id)}
                    disabled={!addAmount[goal.id] || Number.parseFloat(addAmount[goal.id]) <= 0}
                  >
                    <DollarSign className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {savingsGoals.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No tienes metas de ahorro</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Crea tu primera meta de ahorro para comenzar a planificar tu futuro financiero
            </p>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Crear Primera Meta
                </Button>
              </DialogTrigger>
            </Dialog>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
