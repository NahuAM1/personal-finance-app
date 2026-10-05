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
          service_id: string | null
          period_key?: string
          currency: string
          original_amount: number
          exchange_rate: number
          rate_source: "auto" | "manual"
          base_currency: string
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
          service_id?: string | null
          currency?: string
          original_amount?: number
          exchange_rate?: number
          rate_source?: "auto" | "manual"
          base_currency?: string
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
          service_id?: string | null
          currency?: string
          original_amount?: number
          exchange_rate?: number
          rate_source?: "auto" | "manual"
          base_currency?: string
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
          currency: string
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
          currency?: string
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
          currency?: string
          created_at?: string
          updated_at?: string
        }
      }
      services: {
        Row: {
          id: string
          user_id: string
          name: string
          amount: number
          due_day: number
          mode: "automatic" | "manual"
          icon: string | null
          color: string | null
          notes: string | null
          is_active: boolean
          currency: string
          original_amount: number
          exchange_rate: number
          rate_source: "auto" | "manual"
          base_currency: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          amount: number
          due_day: number
          mode: "automatic" | "manual"
          icon?: string | null
          color?: string | null
          notes?: string | null
          is_active?: boolean
          currency?: string
          original_amount?: number
          exchange_rate?: number
          rate_source?: "auto" | "manual"
          base_currency?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          amount?: number
          due_day?: number
          mode?: "automatic" | "manual"
          icon?: string | null
          color?: string | null
          notes?: string | null
          is_active?: boolean
          currency?: string
          original_amount?: number
          exchange_rate?: number
          rate_source?: "auto" | "manual"
          base_currency?: string
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
          currency: string
          original_amount: number
          exchange_rate: number
          rate_source: "auto" | "manual"
          base_currency: string
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
          currency?: string
          original_amount?: number
          exchange_rate?: number
          rate_source?: "auto" | "manual"
          base_currency?: string
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
          currency?: string
          original_amount?: number
          exchange_rate?: number
          rate_source?: "auto" | "manual"
          base_currency?: string
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
          currency: string
          original_amount: number
          exchange_rate: number
          rate_source: "auto" | "manual"
          base_currency: string
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
          currency?: string
          original_amount?: number
          exchange_rate?: number
          rate_source?: "auto" | "manual"
          base_currency?: string
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
          currency?: string
          original_amount?: number
          exchange_rate?: number
          rate_source?: "auto" | "manual"
          base_currency?: string
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
          currency: string
          exchange_rate: number
          original_amount: number
          rate_source: "auto" | "manual"
          base_currency: string
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
          currency?: string
          exchange_rate?: number
          original_amount?: number
          rate_source?: "auto" | "manual"
          base_currency?: string
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
          currency?: string
          exchange_rate?: number
          original_amount?: number
          rate_source?: "auto" | "manual"
          base_currency?: string
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
      loans: {
        Row: {
          id: string
          user_id: string
          loan_type: "given" | "received" | "payment_plan"
          counterparty_name: string
          description: string
          principal_amount: number
          interest_rate: number
          total_amount: number
          payment_mode: "single" | "installments"
          installments_count: number
          status: "active" | "completed"
          start_date: string
          due_date: string | null
          transaction_id: string | null
          currency: string
          original_amount: number
          exchange_rate: number
          rate_source: "auto" | "manual"
          base_currency: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          loan_type: "given" | "received" | "payment_plan"
          counterparty_name: string
          description: string
          principal_amount: number
          interest_rate?: number
          total_amount: number
          payment_mode: "single" | "installments"
          installments_count?: number
          status?: "active" | "completed"
          start_date: string
          due_date?: string | null
          transaction_id?: string | null
          currency?: string
          original_amount?: number
          exchange_rate?: number
          rate_source?: "auto" | "manual"
          base_currency?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          loan_type?: "given" | "received" | "payment_plan"
          counterparty_name?: string
          description?: string
          principal_amount?: number
          interest_rate?: number
          total_amount?: number
          payment_mode?: "single" | "installments"
          installments_count?: number
          status?: "active" | "completed"
          start_date?: string
          due_date?: string | null
          transaction_id?: string | null
          currency?: string
          original_amount?: number
          exchange_rate?: number
          rate_source?: "auto" | "manual"
          base_currency?: string
          created_at?: string
          updated_at?: string
        }
      }
      loan_payments: {
        Row: {
          id: string
          loan_id: string
          payment_number: number
          due_date: string
          amount: number
          paid: boolean
          paid_date: string | null
          transaction_id: string | null
          currency: string
          original_amount: number
          exchange_rate: number
          rate_source: "auto" | "manual"
          base_currency: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          loan_id: string
          payment_number: number
          due_date: string
          amount: number
          paid?: boolean
          paid_date?: string | null
          transaction_id?: string | null
          currency?: string
          original_amount?: number
          exchange_rate?: number
          rate_source?: "auto" | "manual"
          base_currency?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          loan_id?: string
          payment_number?: number
          due_date?: string
          amount?: number
          paid?: boolean
          paid_date?: string | null
          transaction_id?: string | null
          currency?: string
          original_amount?: number
          exchange_rate?: number
          rate_source?: "auto" | "manual"
          base_currency?: string
          created_at?: string
          updated_at?: string
        }
      }
      trips: {
        Row: {
          id: string
          created_by: string
          name: string
          description: string | null
          destination: string | null
          start_date: string | null
          end_date: string | null
          budget: number | null
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
          destination?: string | null
          start_date?: string | null
          end_date?: string | null
          budget?: number | null
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
          destination?: string | null
          start_date?: string | null
          end_date?: string | null
          budget?: number | null
          currency?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      trip_members: {
        Row: {
          id: string
          trip_id: string
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
          trip_id: string
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
          trip_id?: string
          user_id?: string | null
          display_name?: string
          email?: string | null
          invite_token?: string | null
          invite_status?: "pending" | "accepted" | "declined"
          is_admin?: boolean
          joined_at?: string
        }
      }
      trip_expenses: {
        Row: {
          id: string
          trip_id: string
          paid_by_member_id: string
          description: string
          amount: number
          category: string | null
          expense_date: string
          split_method: "equal" | "custom" | "percentage"
          transaction_id: string | null
          currency: string
          original_amount: number
          exchange_rate: number
          rate_source: "auto" | "manual"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          paid_by_member_id: string
          description: string
          amount: number
          category?: string | null
          expense_date: string
          split_method?: "equal" | "custom" | "percentage"
          transaction_id?: string | null
          currency?: string
          original_amount?: number
          exchange_rate?: number
          rate_source?: "auto" | "manual"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          paid_by_member_id?: string
          description?: string
          amount?: number
          category?: string | null
          expense_date?: string
          split_method?: "equal" | "custom" | "percentage"
          transaction_id?: string | null
          currency?: string
          original_amount?: number
          exchange_rate?: number
          rate_source?: "auto" | "manual"
          created_at?: string
          updated_at?: string
        }
      }
      trip_expense_shares: {
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
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string | null
          data: Record<string, unknown>
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          body?: string | null
          data?: Record<string, unknown>
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          body?: string | null
          data?: Record<string, unknown>
          read_at?: string | null
          created_at?: string
        }
      }
    }
  }
}

type MoneyKeys = "currency" | "original_amount" | "exchange_rate" | "rate_source" | "base_currency"

/**
 * Like Omit<T, K>, but the multi-currency money fields become optional so callers
 * that do not set them fall back to the database defaults trigger.
 */
export type OmitNew<T, K extends keyof T> = Omit<T, K | Extract<MoneyKeys, keyof T>> &
  Partial<Pick<T, Extract<MoneyKeys, keyof T>>>

export type RateSource = "auto" | "manual"
export type ArsRateType = "oficial" | "blue" | "bolsa" | "tarjeta"

export interface UserSettings {
  user_id: string
  base_currency: string
  ars_rate_type: ArsRateType
  pending_base_currency: string | null
  reconversion_status: "idle" | "running" | "failed"
  reconversion_started_at: string | null
  reconversion_error: string | null
  created_at: string
  updated_at: string
}

export interface ExchangeRate {
  rate_date: string
  currency: string
  rate_type: ArsRateType
  ars_per_unit: number
  source: string
  fetched_at: string
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
export type Loan = Database["public"]["Tables"]["loans"]["Row"]
export type LoanPayment = Database["public"]["Tables"]["loan_payments"]["Row"]
export type Service = Database["public"]["Tables"]["services"]["Row"]
export type Trip = Database["public"]["Tables"]["trips"]["Row"]
export type TripMember = Database["public"]["Tables"]["trip_members"]["Row"]
export type TripExpense = Database["public"]["Tables"]["trip_expenses"]["Row"]
export type TripExpenseShare = Database["public"]["Tables"]["trip_expense_shares"]["Row"]
export type Notification = Database["public"]["Tables"]["notifications"]["Row"]
