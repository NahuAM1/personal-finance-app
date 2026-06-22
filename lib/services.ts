import { format } from "date-fns"
import type { Service, Transaction } from "@/types/database"

export const SERVICE_CATEGORY = "Servicios"

export type ServiceStatus = "paid" | "pending"

// A service plus its computed status for a given period.
export interface ServiceWithStatus {
  service: Service
  status: ServiceStatus
  dueDate: string            // yyyy-MM-dd for the current period
  linkedTransaction: Transaction | null
}

// ---- Period helpers ----

// Period key "YYYY-MM" for a given date (defaults to now).
export function getPeriodKey(date: Date = new Date()): string {
  return format(date, "yyyy-MM")
}

// Clamp due_day to the number of days in the target month, then return yyyy-MM-dd.
// Handles due_day=31 in February, etc.
export function computeDueDate(dueDay: number, year: number, month0: number): string {
  // month0 is 0-based (0 = January) to match JS Date
  const daysInMonth = new Date(year, month0 + 1, 0).getDate()
  const day = Math.min(dueDay, daysInMonth)
  // Build a yyyy-MM-dd string without timezone drift
  const mm = String(month0 + 1).padStart(2, "0")
  const dd = String(day).padStart(2, "0")
  return `${year}-${mm}-${dd}`
}

// The due date for a service in the CURRENT period.
export function currentPeriodDueDate(service: Service, ref: Date = new Date()): string {
  return computeDueDate(service.due_day, ref.getFullYear(), ref.getMonth())
}

// ---- Linkage / status derivation ----

// Find the transaction (if any) linked to this service within the given period.
// Period match is by year+month of the transaction.date string ("yyyy-MM-dd").
export function findLinkedTransactionForPeriod(
  serviceId: string,
  transactions: Transaction[],
  periodKey: string
): Transaction | null {
  const match = transactions.find(
    (t) => t.service_id === serviceId && t.date.slice(0, 7) === periodKey
  )
  return match ?? null
}

// Derive paid/pending + due date for one service in the current period.
export function deriveServiceStatus(
  service: Service,
  transactions: Transaction[],
  ref: Date = new Date()
): ServiceWithStatus {
  const periodKey = getPeriodKey(ref)
  const linked = findLinkedTransactionForPeriod(service.id, transactions, periodKey)
  return {
    service,
    status: linked ? "paid" : "pending",
    dueDate: currentPeriodDueDate(service, ref),
    linkedTransaction: linked,
  }
}

// Build the transaction payload (WITHOUT user_id) for a service payment in a period.
// The amount may be overridden (manual services with variable amounts).
export function buildServiceTransactionPayload(
  service: Service,
  amount: number,
  ref: Date = new Date()
): Omit<Transaction, "id" | "user_id" | "created_at" | "updated_at" | "balance_total"> {
  return {
    type: "expense",
    amount,
    category: SERVICE_CATEGORY,
    description: service.name,
    date: currentPeriodDueDate(service, ref),
    is_recurring: null,
    installments: null,
    current_installment: null,
    paid: true,
    parent_transaction_id: null,
    due_date: null,
    ticket_id: null,
    service_id: service.id,
  }
}

// Which active AUTOMATIC services still need a transaction generated for the current period.
export function pendingAutomaticServices(
  services: Service[],
  transactions: Transaction[],
  ref: Date = new Date()
): Service[] {
  const periodKey = getPeriodKey(ref)
  return services.filter(
    (s) =>
      s.is_active &&
      s.mode === "automatic" &&
      findLinkedTransactionForPeriod(s.id, transactions, periodKey) === null
  )
}
