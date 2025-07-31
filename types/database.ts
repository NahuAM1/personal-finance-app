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
    }
  }
}

export type Transaction = Database["public"]["Tables"]["transactions"]["Row"]
export type SavingsGoal = Database["public"]["Tables"]["savings_goals"]["Row"]
export type ExpensePlan = Database["public"]["Tables"]["expense_plans"]["Row"]
