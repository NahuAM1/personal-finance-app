"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { TrendingUp, TrendingDown, DollarSign, CreditCard, PiggyBank } from "lucide-react"
import type { Transaction, SavingsGoal, ExpensePlan } from "@/types/database"

interface DashboardProps {
  transactions: Transaction[]
  savingsGoals: SavingsGoal[]
  expensePlans: ExpensePlan[]
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D"]

export function Dashboard({ transactions, savingsGoals, expensePlans }: DashboardProps) {
  // Calcular totales del mes actual
  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()

  const currentMonthTransactions = transactions.filter((t) => {
    const transactionDate = new Date(t.date)
    return transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear
  })

  const totalIncome = currentMonthTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0)

  const totalExpenses = currentMonthTransactions
    .filter((t) => t.type === "expense" || t.type === "credit")
    .reduce((sum, t) => sum + t.amount, 0)

  const balance = totalIncome - totalExpenses

  // Datos para gráfico de categorías
  const expensesByCategory = currentMonthTransactions
    .filter((t) => t.type === "expense" || t.type === "credit")
    .reduce(
      (acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount
        return acc
      },
      {} as Record<string, number>,
    )

  const categoryData = Object.entries(expensesByCategory).map(([category, amount]) => ({
    category,
    amount,
  }))

  const pieData = Object.entries(expensesByCategory).map(([category, amount]) => ({
    name: category,
    value: amount,
  }))

  // Próximos pagos de tarjeta
  const creditCardPayments = transactions
    .filter((t) => t.type === "credit" && t.is_recurring && t.current_installment && t.installments)
    .filter((t) => t.current_installment! < t.installments!)

  // Total de ahorros
  const totalSavings = savingsGoals.reduce((sum, goal) => sum + goal.current_amount, 0)

  return (
    <div className="space-y-6">
      {/* Resumen financiero */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos del Mes</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalIncome.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos del Mes</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">${totalExpenses.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance</CardTitle>
            <DollarSign className={`h-4 w-4 ${balance >= 0 ? "text-green-600" : "text-red-600"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
              ${balance.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ahorros</CardTitle>
            <PiggyBank className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">${totalSavings.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Gráfico de barras por categorías */}
        <Card>
          <CardHeader>
            <CardTitle>Gastos por Categoría</CardTitle>
            <CardDescription>Distribución de gastos del mes actual</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, "Monto"]} />
                <Bar dataKey="amount" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de torta */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución de Gastos</CardTitle>
            <CardDescription>Porcentaje por categoría</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, "Monto"]} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Estado de ahorros */}
        <Card>
          <CardHeader>
            <CardTitle>Metas de Ahorro</CardTitle>
            <CardDescription>Progreso hacia tus objetivos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {savingsGoals.map((goal) => {
              const progress = (goal.current_amount / goal.target_amount) * 100
              return (
                <div key={goal.id} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{goal.name}</span>
                    <Badge variant="outline">
                      ${goal.current_amount.toLocaleString()} / ${goal.target_amount.toLocaleString()}
                    </Badge>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="text-sm text-gray-600">{progress.toFixed(1)}% completado</div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Próximos pagos de tarjeta */}
        <Card>
          <CardHeader>
            <CardTitle>Próximos Pagos de Tarjeta</CardTitle>
            <CardDescription>Cuotas pendientes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {creditCardPayments.length > 0 ? (
                creditCardPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-4 w-4 text-blue-600" />
                      <div>
                        <div className="font-medium">{payment.description}</div>
                        <div className="text-sm text-gray-600">
                          Cuota {payment.current_installment! + 1} de {payment.installments}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">${payment.amount.toLocaleString()}</div>
                      <div className="text-sm text-gray-600">Próximo mes</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-4">No hay pagos pendientes</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
