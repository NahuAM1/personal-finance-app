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
          balance_total: number | null
          ticket_id: string | null
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
          balance_total?: number | null
          ticket_id?: string | null
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
          balance_total?: number | null
          ticket_id?: string | null
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
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
          investment_type: "plazo_fijo" | "fci" | "bonos" | "acciones" | "crypto" | "letras" | "cedears" | "cauciones" | "fondos_comunes_inversion" | "compra_divisas"
          amount: number
          start_date: string
          maturity_date: string | null
          annual_rate: number | null
          estimated_return: number
          is_liquidated: boolean
          liquidation_date: string | null
          actual_return: number | null
          transaction_id: string | null
          currency: string | null
          exchange_rate: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          description: string
          investment_type: "plazo_fijo" | "fci" | "bonos" | "acciones" | "crypto" | "letras" | "cedears" | "cauciones" | "fondos_comunes_inversion" | "compra_divisas"
          amount: number
          start_date: string
          maturity_date?: string | null
          annual_rate?: number | null
          estimated_return?: number
          is_liquidated?: boolean
          liquidation_date?: string | null
          actual_return?: number | null
          transaction_id?: string | null
          currency?: string | null
          exchange_rate?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          description?: string
          investment_type?: "plazo_fijo" | "fci" | "bonos" | "acciones" | "crypto" | "letras" | "cedears" | "cauciones" | "fondos_comunes_inversion" | "compra_divisas"
          amount?: number
          start_date?: string
          maturity_date?: string | null
          annual_rate?: number | null
          estimated_return?: number
          is_liquidated?: boolean
          liquidation_date?: string | null
          actual_return?: number | null
          transaction_id?: string | null
          currency?: string | null
          exchange_rate?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      tickets: {
        Row: {
          id: string
          user_id: string
          store_name: string
          total_amount: number
          ticket_date: string
          image_path: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          store_name: string
          total_amount: number
          ticket_date: string
          image_path: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          store_name?: string
          total_amount?: number
          ticket_date?: string
          image_path?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      ticket_items: {
        Row: {
          id: string
          ticket_id: string
          product_name: string
          quantity: number
          unit_price: number
          total_price: number
          category: string | null
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          product_name: string
          quantity?: number
          unit_price: number
          total_price: number
          category?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          ticket_id?: string
          product_name?: string
          quantity?: number
          unit_price?: number
          total_price?: number
          category?: string | null
          created_at?: string
        }
      }
      split_groups: {
        Row: {
          id: string
          created_by: string
          name: string
          description: string | null
          currency: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          created_by: string
          name: string
          description?: string | null
          currency?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          created_by?: string
          name?: string
          description?: string | null
          currency?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      split_group_members: {
        Row: {
          id: string
          group_id: string
          user_id: string | null
          display_name: string
          email: string | null
          invite_token: string | null
          invite_status: "pending" | "accepted" | "declined"
          is_admin: boolean
          joined_at: string
        }
        Insert: {
          id?: string
          group_id: string
          user_id?: string | null
          display_name: string
          email?: string | null
          invite_token?: string | null
          invite_status?: "pending" | "accepted" | "declined"
          is_admin?: boolean
          joined_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          user_id?: string | null
          display_name?: string
          email?: string | null
          invite_token?: string | null
          invite_status?: "pending" | "accepted" | "declined"
          is_admin?: boolean
          joined_at?: string
        }
      }
      split_expenses: {
        Row: {
          id: string
          group_id: string
          paid_by_member_id: string
          description: string
          amount: number
          category: string | null
          expense_date: string
          split_method: "equal" | "custom" | "percentage"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          group_id: string
          paid_by_member_id: string
          description: string
          amount: number
          category?: string | null
          expense_date: string
          split_method?: "equal" | "custom" | "percentage"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          paid_by_member_id?: string
          description?: string
          amount?: number
          category?: string | null
          expense_date?: string
          split_method?: "equal" | "custom" | "percentage"
          created_at?: string
          updated_at?: string
        }
      }
      split_expense_shares: {
        Row: {
          id: string
          expense_id: string
          member_id: string
          share_amount: number
          is_settled: boolean
          settled_at: string | null
        }
        Insert: {
          id?: string
          expense_id: string
          member_id: string
          share_amount: number
          is_settled?: boolean
          settled_at?: string | null
        }
        Update: {
          id?: string
          expense_id?: string
          member_id?: string
          share_amount?: number
          is_settled?: boolean
          settled_at?: string | null
        }
      }
    }
  }
}

export const USER_ROLES = {
  ADMIN: 'admin',
  PREMIUM: 'premium',
  FREE: 'free',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export type Transaction = Database["public"]["Tables"]["transactions"]["Row"]
export type ExpensePlan = Database["public"]["Tables"]["expense_plans"]["Row"]
export type CreditPurchase = Database["public"]["Tables"]["credit_purchases"]["Row"]
export type CreditInstallment = Database["public"]["Tables"]["credit_installments"]["Row"]
export type Investment = Database["public"]["Tables"]["investments"]["Row"]
export type Ticket = Database["public"]["Tables"]["tickets"]["Row"]
export type TicketItem = Database["public"]["Tables"]["ticket_items"]["Row"]
export type SplitGroup = Database["public"]["Tables"]["split_groups"]["Row"]
export type SplitGroupMember = Database["public"]["Tables"]["split_group_members"]["Row"]
export type SplitExpense = Database["public"]["Tables"]["split_expenses"]["Row"]
export type SplitExpenseShare = Database["public"]["Tables"]["split_expense_shares"]["Row"]
