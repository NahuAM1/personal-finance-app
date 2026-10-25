import type { CreditInstallment, Loan, LoanPayment, Service, Transaction } from "@/types/database"
import { findLinkedTransactionForPeriod, getPeriodKey } from "@/lib/services"

// What one source (cards, services, loans) commits for the month, in the base currency.
// `overdue` is the unpaid part from earlier months, already included in total and pending.
export interface SpendBucket {
  total: number
  pending: number
  overdue: number
}

export interface ExpectedMonthSpend {
  cards: SpendBucket
  services: SpendBucket
  loans: SpendBucket
  total: number
  pending: number
  overdue: number
}

export interface ExpectedMonthSpendInput {
  creditInstallments: CreditInstallment[]
  services: Service[]
  transactions: Transaction[]
  loans: Loan[]
  loanPayments: LoanPayment[]
}

interface SpendItem {
  amount: number
  paid: boolean
  overdue: boolean
}

// Loans the user pays back; "given" loans are money coming in.
const OUTGOING_LOAN_TYPES: ReadonlySet<Loan["loan_type"]> = new Set<Loan["loan_type"]>(["received", "payment_plan"])

function toBucket(items: readonly SpendItem[]): SpendBucket {
  return items.reduce(
    (bucket: SpendBucket, item: SpendItem) => ({
      total: bucket.total + item.amount,
      pending: item.paid ? bucket.pending : bucket.pending + item.amount,
      overdue: item.overdue ? bucket.overdue + item.amount : bucket.overdue,
    }),
    { total: 0, pending: 0, overdue: 0 },
  )
}

// Expected spend of the month of `ref`: card installments and loan payments due that month,
// plus every active service. Card installments and loan payments still unpaid from earlier
// months count as overdue; services have no per-month record, so they can't be overdue.
export function computeExpectedMonthSpend(input: ExpectedMonthSpendInput, ref: Date = new Date()): ExpectedMonthSpend {
  const periodKey: string = getPeriodKey(ref)
  const isOverdue = (dueDate: string): boolean => dueDate.slice(0, 7) < periodKey
  const isOwedThisMonth = (dueDate: string, paid: boolean): boolean =>
    dueDate.slice(0, 7) === periodKey || (!paid && isOverdue(dueDate))

  const cards: SpendBucket = toBucket(
    input.creditInstallments
      .filter((inst: CreditInstallment) => isOwedThisMonth(inst.due_date, inst.paid))
      .map((inst: CreditInstallment) => ({ amount: inst.amount, paid: inst.paid, overdue: isOverdue(inst.due_date) })),
  )

  // A paid service counts at what was actually paid, since manual services vary month to month.
  const services: SpendBucket = toBucket(
    input.services
      .filter((service: Service) => service.is_active)
      .map((service: Service) => {
        const payment: Transaction | null = findLinkedTransactionForPeriod(service.id, input.transactions, periodKey)
        return payment
          ? { amount: payment.amount, paid: true, overdue: false }
          : { amount: service.amount, paid: false, overdue: false }
      }),
  )

  const outgoingLoanIds: ReadonlySet<string> = new Set(
    input.loans.filter((loan: Loan) => OUTGOING_LOAN_TYPES.has(loan.loan_type)).map((loan: Loan) => loan.id),
  )
  const loans: SpendBucket = toBucket(
    input.loanPayments
      .filter(
        (payment: LoanPayment) =>
          outgoingLoanIds.has(payment.loan_id) && isOwedThisMonth(payment.due_date, payment.paid),
      )
      .map((payment: LoanPayment) => ({
        amount: payment.amount,
        paid: payment.paid,
        overdue: isOverdue(payment.due_date),
      })),
  )

  return {
    cards,
    services,
    loans,
    total: cards.total + services.total + loans.total,
    pending: cards.pending + services.pending + loans.pending,
    overdue: cards.overdue + services.overdue + loans.overdue,
  }
}
