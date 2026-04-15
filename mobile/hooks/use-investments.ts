import { useState, useEffect, useCallback } from 'react';
import { getInvestments, liquidateInvestment, deleteInvestment, createInvestment } from '@/lib/database-api';
import { useAuth } from '@/contexts/auth-context';
import type { Investment } from '@/types/database';

interface UseInvestmentsResult {
  investments: Investment[];
  loading: boolean;
  error: string | null;
  add: (investment: Omit<Investment, 'id' | 'created_at' | 'updated_at'>) => Promise<Investment | null>;
  liquidate: (id: string, date: string, actualReturn: number) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useInvestments(): UseInvestmentsResult {
  const { user } = useAuth();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvestments = useCallback(async (): Promise<void> => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await getInvestments(user.id);
      setInvestments(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching investments');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchInvestments();
  }, [fetchInvestments]);

  const add = useCallback(
    async (investment: Omit<Investment, 'id' | 'created_at' | 'updated_at'>): Promise<Investment | null> => {
      if (!user) return null;
      const created = await createInvestment(investment);
      setInvestments((prev) => [created, ...prev]);
      return created;
    },
    [user]
  );

  const liquidate = useCallback(
    async (id: string, date: string, actualReturn: number): Promise<void> => {
      if (!user) return;
      await liquidateInvestment(id, user.id, date, actualReturn);
      await fetchInvestments();
    },
    [user, fetchInvestments]
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      if (!user) return;
      await deleteInvestment(id, user.id);
      setInvestments((prev) => prev.filter((i) => i.id !== id));
    },
    [user]
  );

  return { investments, loading, error, add, liquidate, remove, refetch: fetchInvestments };
}
