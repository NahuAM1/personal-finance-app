import { useState, useEffect, useCallback } from 'react';
import { getCreditPurchases, getAllCreditInstallments, payCreditInstallment, createCreditPurchase, deleteCreditPurchase } from '@/lib/database-api';
import { useAuth } from '@/contexts/auth-context';
import type { CreditPurchase, CreditInstallment } from '@/types/database';

interface UseCreditResult {
  purchases: CreditPurchase[];
  installments: CreditInstallment[];
  loading: boolean;
  error: string | null;
  create: typeof createCreditPurchase;
  pay: (installmentId: string, date: string) => Promise<void>;
  remove: (purchaseId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useCredit(): UseCreditResult {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<CreditPurchase[]>([]);
  const [installments, setInstallments] = useState<CreditInstallment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (): Promise<void> => {
    if (!user) return;
    try {
      setLoading(true);
      const [ps, is] = await Promise.all([getCreditPurchases(user.id), getAllCreditInstallments(user.id)]);
      setPurchases(ps);
      setInstallments(is);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching credit data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const pay = useCallback(
    async (installmentId: string, date: string): Promise<void> => {
      if (!user) return;
      await payCreditInstallment(installmentId, user.id, date);
      await fetchAll();
    },
    [user, fetchAll]
  );

  const remove = useCallback(
    async (purchaseId: string): Promise<void> => {
      if (!user) return;
      await deleteCreditPurchase(purchaseId, user.id);
      await fetchAll();
    },
    [user, fetchAll]
  );

  return { purchases, installments, loading, error, create: createCreditPurchase, pay, remove, refetch: fetchAll };
}
