"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Transaction } from "@/types/database"

interface IncomeFormProps {
  onSubmit: (transaction: Omit<Transaction, "id" | "user_id" | "created_at" | "updated_at">) => void
}

const incomeCategories = ["Salario", "Freelance", "Inversiones", "Alquiler", "Venta", "Bono", "Regalo", "Otros"]

export function IncomeForm({ onSubmit }: IncomeFormProps) {
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState("")
  const [description, setDescription] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!amount || !category || !description) return

    onSubmit({
      type: "income",
      amount: Number.parseFloat(amount),
      category,
      description,
      date: new Date().toISOString().split("T")[0],
    })

    // Reset form
    setAmount("")
    setCategory("")
    setDescription("")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="income-amount">Monto</Label>
        <Input
          id="income-amount"
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="income-category">Categoría</Label>
        <Select value={category} onValueChange={setCategory} required>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona una categoría" />
          </SelectTrigger>
          <SelectContent>
            {incomeCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="income-description">Descripción</Label>
        <Textarea
          id="income-description"
          placeholder="Describe el ingreso..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </div>

      <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">
        Registrar Ingreso
      </Button>
    </form>
  )
}
