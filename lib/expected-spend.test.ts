import { describe, expect, it } from 'vitest';
import { computeExpectedMonthSpend } from '@/lib/expected-spend';
import type { CreditInstallment, Loan, LoanPayment, Service, Transaction } from '@/types/database';

const REF = new Date(2026, 9, 25); // October 2026

const MONEY = {
  currency: 'ARS',
  exchange_rate: 1,
  rate_source: 'auto' as const,
  base_currency: 'ARS',
};

function buildInstallment(id: string, dueDate: string, amount: number, paid: boolean): CreditInstallment {
  return {
    ...MONEY,
    id,
    credit_purchase_id: 'purchase-1',
    installment_number: 1,
    due_date: dueDate,
    amount,
    paid,
    paid_date: null,
    transaction_id: null,
    original_amount: amount,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function buildService(id: string, amount: number, isActive: boolean): Service {
  return {
    ...MONEY,
    id,
    user_id: 'user-1',
    name: id,
    amount,
    due_day: 10,
    mode: 'manual',
    icon: null,
    color: null,
    notes: null,
    is_active: isActive,
    original_amount: amount,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function buildServicePayment(serviceId: string, date: string, amount: number): Transaction {
  return {
    ...MONEY,
    id: `tx-${serviceId}-${date}`,
    user_id: 'user-1',
    type: 'expense',
    amount,
    category: 'Servicios',
    description: serviceId,
    date,
    is_recurring: null,
    installments: null,
    current_installment: null,
    paid: true,
    parent_transaction_id: null,
    due_date: null,
    ticket_id: null,
    service_id: serviceId,
    balance_total: 0,
    original_amount: amount,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function buildLoan(id: string, loanType: Loan['loan_type']): Loan {
  return {
    ...MONEY,
    id,
    user_id: 'user-1',
    loan_type: loanType,
    counterparty_name: 'Banco',
    description: id,
    principal_amount: 1000,
    interest_rate: 0,
    total_amount: 1000,
    payment_mode: 'installments',
    installments_count: 10,
    status: 'active',
    start_date: '2026-01-01',
    due_date: null,
    transaction_id: null,
    original_amount: 1000,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function buildLoanPayment(id: string, loanId: string, dueDate: string, amount: number, paid: boolean): LoanPayment {
  return {
    ...MONEY,
    id,
    loan_id: loanId,
    payment_number: 1,
    due_date: dueDate,
    amount,
    paid,
    paid_date: null,
    transaction_id: null,
    original_amount: amount,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

const NO_DATA = {
  creditInstallments: [],
  services: [],
  transactions: [],
  loans: [],
  loanPayments: [],
};

describe('computeExpectedMonthSpend', () => {
  it('adds up the card installments due this month, split into total and still pending', () => {
    const spend = computeExpectedMonthSpend(
      {
        ...NO_DATA,
        creditInstallments: [
          buildInstallment('paid', '2026-10-05', 100, true),
          buildInstallment('pending', '2026-10-20', 50, false),
          buildInstallment('next-month', '2026-11-05', 999, false),
        ],
      },
      REF,
    );

    expect(spend.cards).toEqual({ total: 150, pending: 50, overdue: 0 });
  });

  it('adds unpaid card installments from earlier months as overdue, to both the total and the pending amount', () => {
    const spend = computeExpectedMonthSpend(
      {
        ...NO_DATA,
        creditInstallments: [
          buildInstallment('this-month', '2026-10-05', 100, false),
          buildInstallment('overdue', '2026-09-05', 40, false),
          buildInstallment('paid-last-month', '2026-09-05', 999, true),
        ],
      },
      REF,
    );

    expect(spend.cards).toEqual({ total: 140, pending: 140, overdue: 40 });
  });

  it('counts active services at their amount, or at what was actually paid this month', () => {
    const spend = computeExpectedMonthSpend(
      {
        ...NO_DATA,
        services: [
          buildService('internet', 300, true),
          buildService('electricity', 200, true),
          buildService('cancelled-gym', 999, false),
        ],
        transactions: [
          buildServicePayment('electricity', '2026-10-08', 260),
          buildServicePayment('internet', '2026-09-10', 300),
        ],
      },
      REF,
    );

    expect(spend.services).toEqual({ total: 560, pending: 300, overdue: 0 });
  });

  it('adds up the payments due this month of loans the user has to pay back', () => {
    const spend = computeExpectedMonthSpend(
      {
        ...NO_DATA,
        loans: [
          buildLoan('bank-loan', 'received'),
          buildLoan('fridge-plan', 'payment_plan'),
          buildLoan('lent-to-friend', 'given'),
        ],
        loanPayments: [
          buildLoanPayment('bank-1', 'bank-loan', '2026-10-15', 400, true),
          buildLoanPayment('fridge-1', 'fridge-plan', '2026-10-30', 120, false),
          buildLoanPayment('friend-1', 'lent-to-friend', '2026-10-15', 999, false),
          buildLoanPayment('bank-2', 'bank-loan', '2026-11-15', 999, false),
        ],
      },
      REF,
    );

    expect(spend.loans).toEqual({ total: 520, pending: 120, overdue: 0 });
  });

  it('adds unpaid payments from earlier months of loans the user pays back as overdue', () => {
    const spend = computeExpectedMonthSpend(
      {
        ...NO_DATA,
        loans: [buildLoan('bank-loan', 'received'), buildLoan('lent-to-friend', 'given')],
        loanPayments: [
          buildLoanPayment('bank-1', 'bank-loan', '2026-08-15', 400, false),
          buildLoanPayment('bank-2', 'bank-loan', '2026-09-15', 999, true),
          buildLoanPayment('friend-1', 'lent-to-friend', '2026-09-15', 999, false),
        ],
      },
      REF,
    );

    expect(spend.loans).toEqual({ total: 400, pending: 400, overdue: 400 });
  });

  it('sums cards, services and loans into the month total and the pending amount', () => {
    const spend = computeExpectedMonthSpend(
      {
        creditInstallments: [
          buildInstallment('card', '2026-10-05', 100, false),
          buildInstallment('late-card', '2026-09-05', 30, false),
        ],
        services: [buildService('internet', 300, true)],
        transactions: [buildServicePayment('internet', '2026-10-10', 300)],
        loans: [buildLoan('bank-loan', 'received')],
        loanPayments: [buildLoanPayment('bank-1', 'bank-loan', '2026-10-15', 400, false)],
      },
      REF,
    );

    expect(spend).toEqual({
      cards: { total: 130, pending: 130, overdue: 30 },
      services: { total: 300, pending: 0, overdue: 0 },
      loans: { total: 400, pending: 400, overdue: 0 },
      total: 830,
      pending: 530,
      overdue: 30,
    });
  });

  it('returns zero for a month without commitments', () => {
    expect(computeExpectedMonthSpend(NO_DATA, REF)).toEqual({
      cards: { total: 0, pending: 0, overdue: 0 },
      services: { total: 0, pending: 0, overdue: 0 },
      loans: { total: 0, pending: 0, overdue: 0 },
      total: 0,
      pending: 0,
      overdue: 0,
    });
  });
});
