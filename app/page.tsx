"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dashboard } from "@/components/dashboard"
import { QuickActions } from "@/components/quick-actions"
import { ExpenseForm } from "@/components/expense-form"
import { IncomeForm } from "@/components/income-form"
import { CreditCardForm } from "@/components/credit-card-form"
import { Savings } from "@/components/savings"
import { ExpensePlans } from "@/components/expense-plans"
import { BarChart3, Home, PlusCircle, CreditCard, PiggyBank, MapPin } from "lucide-react"

export interface Transaction {
  id: string
  type: "income" | "expense" | "credit"
  amount: number
  category: string
  description: string
  date: string
  isRecurring?: boolean
  installments?: number
  currentInstallment?: number
}

export interface SavingsGoal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  deadline: string
}

export interface ExpensePlan {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  deadline: string
  category: string
}

export default function FinanceApp() {
  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: "1",
      type: "income",
      amount: 150000,
      category: "Salario",
      description: "Salario mensual",
      date: "2024-01-01",
    },
    {
      id: "2",
      type: "expense",
      amount: 25000,
      category: "Alimentación",
      description: "Supermercado",
      date: "2024-01-02",
    },
    {
      id: "3",
      type: "credit",
      amount: 12000,
      category: "Tecnología",
      description: "Notebook - Cuota 3/12",
      date: "2024-01-03",
      isRecurring: true,
      installments: 12,
      currentInstallment: 3,
    },
  ])

  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([
    {
      id: "1",
      name: "Viaje a Europa",
      targetAmount: 200000,
      currentAmount: 85000,
      deadline: "2024-12-31",
    },
    {
      id: "2",
      name: "Fondo de emergencia",
      targetAmount: 100000,
      currentAmount: 45000,
      deadline: "2024-06-30",
    },
  ])

  const [expensePlans, setExpensePlans] = useState<ExpensePlan[]>([
    {
      id: "1",
      name: "Vacaciones en Bariloche",
      targetAmount: 80000,
      currentAmount: 32000,
      deadline: "2024-07-15",
      category: "Viajes",
    },
  ])

  const addTransaction = (transaction: Omit<Transaction, "id">) => {
    const newTransaction = {
      ...transaction,
      id: Date.now().toString(),
    }
    setTransactions((prev) => [...prev, newTransaction])
  }

  const addSavingsGoal = (goal: Omit<SavingsGoal, "id">) => {
    const newGoal = {
      ...goal,
      id: Date.now().toString(),
    }
    setSavingsGoals((prev) => [...prev, newGoal])
  }

  const updateSavingsGoal = (id: string, amount: number) => {
    setSavingsGoals((prev) =>
      prev.map((goal) =>
        goal.id === id ? { ...goal, currentAmount: Math.min(goal.currentAmount + amount, goal.targetAmount) } : goal,
      ),
    )
  }

  const addExpensePlan = (plan: Omit<ExpensePlan, "id">) => {
    const newPlan = {
      ...plan,
      id: Date.now().toString(),
    }
    setExpensePlans((prev) => [...prev, newPlan])
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto p-4 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Finanzas Personales</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Gestiona tus ingresos, gastos y ahorros de manera inteligente
          </p>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 lg:w-fit lg:grid-cols-6">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="home" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Inicio</span>
            </TabsTrigger>
            <TabsTrigger value="expenses" className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Gastos</span>
            </TabsTrigger>
            <TabsTrigger value="credit" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Tarjetas</span>
            </TabsTrigger>
            <TabsTrigger value="savings" className="flex items-center gap-2">
              <PiggyBank className="h-4 w-4" />
              <span className="hidden sm:inline">Ahorros</span>
            </TabsTrigger>
            <TabsTrigger value="plans" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Planes</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <Dashboard transactions={transactions} savingsGoals={savingsGoals} expensePlans={expensePlans} />
          </TabsContent>

          <TabsContent value="home">
            <QuickActions />
          </TabsContent>

          <TabsContent value="expenses">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Registrar Gasto</CardTitle>
                  <CardDescription>Agrega un nuevo gasto a tu registro</CardDescription>
                </CardHeader>
                <CardContent>
                  <ExpenseForm onSubmit={addTransaction} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Registrar Ingreso</CardTitle>
                  <CardDescription>Agrega un nuevo ingreso a tu registro</CardDescription>
                </CardHeader>
                <CardContent>
                  <IncomeForm onSubmit={addTransaction} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="credit">
            <Card>
              <CardHeader>
                <CardTitle>Gastos con Tarjeta de Crédito</CardTitle>
                <CardDescription>Registra compras en cuotas que se cargarán automáticamente cada mes</CardDescription>
              </CardHeader>
              <CardContent>
                <CreditCardForm onSubmit={addTransaction} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="savings">
            <Savings savingsGoals={savingsGoals} onAddGoal={addSavingsGoal} onUpdateGoal={updateSavingsGoal} />
          </TabsContent>

          <TabsContent value="plans">
            <ExpensePlans expensePlans={expensePlans} onAddPlan={addExpensePlan} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
