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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlusCircle, MapPin, Calendar, Plane, Car, Home, GraduationCap } from "lucide-react"
import type { ExpensePlan } from "@/app/page"

interface ExpensePlansProps {
  expensePlans: ExpensePlan[]
  onAddPlan: (plan: Omit<ExpensePlan, "id">) => void
}

const planCategories = [
  { value: "Viajes", label: "Viajes", icon: Plane },
  { value: "Vehículo", label: "Vehículo", icon: Car },
  { value: "Hogar", label: "Hogar", icon: Home },
  { value: "Educación", label: "Educación", icon: GraduationCap },
  { value: "Otros", label: "Otros", icon: MapPin },
]

export function ExpensePlans({ expensePlans, onAddPlan }: ExpensePlansProps) {
  const [newPlan, setNewPlan] = useState({
    name: "",
    targetAmount: "",
    deadline: "",
    category: "",
  })
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleAddPlan = (e: React.FormEvent) => {
    e.preventDefault()

    if (!newPlan.name || !newPlan.targetAmount || !newPlan.deadline || !newPlan.category) return

    onAddPlan({
      name: newPlan.name,
      targetAmount: Number.parseFloat(newPlan.targetAmount),
      currentAmount: 0,
      deadline: newPlan.deadline,
      category: newPlan.category,
    })

    setNewPlan({ name: "", targetAmount: "", deadline: "", category: "" })
    setIsDialogOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Planes de Gastos</h2>
          <p className="text-gray-600 dark:text-gray-400">Planifica y ahorra para gastos futuros importantes</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="h-4 w-4 mr-2" />
              Nuevo Plan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nuevo Plan de Gastos</DialogTitle>
              <DialogDescription>Planifica un gasto futuro importante como un viaje o compra grande</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddPlan} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="plan-name">Nombre del Plan</Label>
                <Input
                  id="plan-name"
                  placeholder="ej. Vacaciones en Bariloche"
                  value={newPlan.name}
                  onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-category">Categoría</Label>
                <Select
                  value={newPlan.category}
                  onValueChange={(value) => setNewPlan({ ...newPlan, category: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {planCategories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        <div className="flex items-center gap-2">
                          <category.icon className="h-4 w-4" />
                          {category.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-amount">Monto Estimado</Label>
                <Input
                  id="plan-amount"
                  type="number"
                  placeholder="0.00"
                  value={newPlan.targetAmount}
                  onChange={(e) => setNewPlan({ ...newPlan, targetAmount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-deadline">Fecha Objetivo</Label>
                <Input
                  id="plan-deadline"
                  type="date"
                  value={newPlan.deadline}
                  onChange={(e) => setNewPlan({ ...newPlan, deadline: e.target.value })}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Crear Plan
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de planes */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {expensePlans.map((plan) => {
          const progress = (plan.currentAmount / plan.targetAmount) * 100
          const remaining = plan.targetAmount - plan.currentAmount
          const daysLeft = Math.ceil((new Date(plan.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
          const categoryInfo = planCategories.find((cat) => cat.value === plan.category) || planCategories[4]
          const CategoryIcon = categoryInfo.icon

          return (
            <Card key={plan.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <CategoryIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      <CardDescription>{plan.category}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={progress >= 100 ? "default" : "secondary"}>{progress.toFixed(0)}%</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium">${plan.currentAmount.toLocaleString()}</span>
                    <span className="text-gray-600">${plan.targetAmount.toLocaleString()}</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="flex justify-between text-sm mt-2 text-gray-600">
                    <span>Faltan ${remaining.toLocaleString()}</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {daysLeft > 0 ? `${daysLeft}d` : "Vencido"}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <div className="text-sm text-gray-600 mb-2">Ahorro mensual sugerido:</div>
                  <div className="text-lg font-semibold text-blue-600">
                    ${daysLeft > 0 ? Math.ceil(remaining / Math.ceil(daysLeft / 30)).toLocaleString() : "0"}
                  </div>
                  <div className="text-xs text-gray-500">para alcanzar la meta a tiempo</div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {expensePlans.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <MapPin className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100 mb-2">No tienes planes de gastos</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Crea planes para gastos futuros importantes como viajes, compras grandes o proyectos especiales
            </p>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg">
                  <PlusCircle className="h-5 w-5 mr-2" />
                  Crear Primer Plan
                </Button>
              </DialogTrigger>
            </Dialog>
          </CardContent>
        </Card>
      )}

      {/* Tips */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="text-blue-800 dark:text-blue-200">💡 Consejos para tus planes</CardTitle>
        </CardHeader>
        <CardContent className="text-blue-700 dark:text-blue-300">
          <ul className="space-y-2 text-sm">
            <li>• Divide el monto total por los meses disponibles para saber cuánto ahorrar mensualmente</li>
            <li>• Considera crear una cuenta de ahorros separada para cada plan importante</li>
            <li>• Revisa y ajusta tus planes regularmente según cambien tus prioridades</li>
            <li>• Celebra cuando alcances tus metas para mantenerte motivado</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
