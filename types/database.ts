export interface Database {
  public: {
    Tables: {
      transactions: {
        Row: {
          id: string
          user_id: string
          type: "income" | "expense" | "credit"
          amount: number
          category: string
          description: string
          date: string
          is_recurring: boolean | null
          installments: number | null
          current_installment: number | null
          paid: boolean | null
          parent_transaction_id: string | null
          due_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: "income" | "expense" | "credit"
          amount: number
          category: string
          description: string
          date: string
          is_recurring?: boolean | null
          installments?: number | null
          current_installment?: number | null
          paid?: boolean | null
          parent_transaction_id?: string | null
          due_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: "income" | "expense" | "credit"
          amount?: number
          category?: string
          description?: string
          date?: string
          is_recurring?: boolean | null
          installments?: number | null
          current_installment?: number | null
          paid?: boolean | null
          parent_transaction_id?: string | null
          due_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      savings_goals: {
        Row: {
          id: string
          user_id: string
          name: string
          target_amount: number
          current_amount: number
          deadline: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          target_amount: number
          current_amount?: number
          deadline: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          target_amount?: number
          current_amount?: number
          deadline?: string
          created_at?: string
          updated_at?: string
        }
      }
      expense_plans: {
        Row: {
          id: string
          user_id: string
          name: string
          target_amount: number
          current_amount: number
          deadline: string
          category: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          target_amount: number
          current_amount?: number
          deadline: string
          category: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          target_amount?: number
          current_amount?: number
          deadline?: string
          category?: string
          created_at?: string
          updated_at?: string
        }
      }
      credit_purchases: {
        Row: {
          id: string
          user_id: string
          description: string
          category: string
          total_amount: number
          installments: number
          monthly_amount: number
          start_date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          description: string
          category: string
          total_amount: number
          installments: number
          monthly_amount: number
          start_date: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          description?: string
          category?: string
          total_amount?: number
          installments?: number
          monthly_amount?: number
          start_date?: string
          created_at?: string
          updated_at?: string
        }
      }
      credit_installments: {
        Row: {
          id: string
          credit_purchase_id: string
          installment_number: number
          due_date: string
          amount: number
          paid: boolean
          paid_date: string | null
          transaction_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          credit_purchase_id: string
          installment_number: number
          due_date: string
          amount: number
          paid?: boolean
          paid_date?: string | null
          transaction_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          credit_purchase_id?: string
          installment_number?: number
          due_date?: string
          amount?: number
          paid?: boolean
          paid_date?: string | null
          transaction_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      investments: {
        Row: {
          id: string
          user_id: string
          description: string
          investment_type: "plazo_fijo" | "fci" | "bonos" | "acciones" | "crypto" | "letras" | "cedears" | "cauciones" | "fondos_comunes_inversion"
          amount: number
          start_date: string
          maturity_date: string | null
          annual_rate: number | null
          estimated_return: number
          is_liquidated: boolean
          liquidation_date: string | null
          actual_return: number | null
          transaction_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          description: string
          investment_type: "plazo_fijo" | "fci" | "bonos" | "acciones" | "crypto" | "letras" | "cedears" | "cauciones" | "fondos_comunes_inversion"
          amount: number
          start_date: string
          maturity_date?: string | null
          annual_rate?: number | null
          estimated_return?: number
          is_liquidated?: boolean
          liquidation_date?: string | null
          actual_return?: number | null
          transaction_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          description?: string
          investment_type?: "plazo_fijo" | "fci" | "bonos" | "acciones" | "crypto" | "letras" | "cedears" | "cauciones" | "fondos_comunes_inversion"
          amount?: number
          start_date?: string
          maturity_date?: string | null
          annual_rate?: number | null
          estimated_return?: number
          is_liquidated?: boolean
          liquidation_date?: string | null
          actual_return?: number | null
          transaction_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

export type Transaction = Database["public"]["Tables"]["transactions"]["Row"]
export type SavingsGoal = Database["public"]["Tables"]["savings_goals"]["Row"]
export type ExpensePlan = Database["public"]["Tables"]["expense_plans"]["Row"]
export type CreditPurchase = Database["public"]["Tables"]["credit_purchases"]["Row"]
export type CreditInstallment = Database["public"]["Tables"]["credit_installments"]["Row"]
export type Investment = Database["public"]["Tables"]["investments"]["Row"]
