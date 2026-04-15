import { useState, useEffect, useCallback } from 'react';
import { getLoans, getAllLoanPayments, payLoanPayment, createLoan, deleteLoan } from '@/lib/database-api';
import { useAuth } from '@/contexts/auth-context';
import type { Loan, LoanPayment } from '@/types/database';

interface UseLoansResult {
  loans: Loan[];
  payments: LoanPayment[];
  loading: boolean;
  error: string | null;
  create: typeof createLoan;
  pay: (paymentId: string, date: string) => Promise<void>;
  remove: (loanId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useLoans(): UseLoansResult {
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (): Promise<void> => {
    if (!user) return;
    try {
      setLoading(true);
      const [ls, ps] = await Promise.all([getLoans(user.id), getAllLoanPayments(user.id)]);
      setLoans(ls);
      setPayments(ps);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching loans');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const pay = useCallback(
    async (paymentId: string, date: string): Promise<void> => {
      if (!user) return;
      await payLoanPayment(paymentId, user.id, date);
      await fetchAll();
    },
    [user, fetchAll]
  );

  const remove = useCallback(
    async (loanId: string): Promise<void> => {
      if (!user) return;
      await deleteLoan(loanId, user.id);
      await fetchAll();
    },
    [user, fetchAll]
  );

  return { loans, payments, loading, error, create: createLoan, pay, remove, refetch: fetchAll };
}
