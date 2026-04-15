import { useState, useEffect, useCallback } from 'react';
import { ExpensePlanService } from '@/lib/expense-plans';
import { useAuth } from '@/contexts/auth-context';
import type { ExpensePlan } from '@/types/database';

interface UseExpensePlansResult {
  expensePlans: ExpensePlan[];
  loading: boolean;
  error: string | null;
  addExpensePlan: (plan: Omit<ExpensePlan, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>) => Promise<ExpensePlan | null>;
  addMoney: (id: string, amount: number) => Promise<ExpensePlan | null>;
  deleteExpensePlan: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useExpensePlans(): UseExpensePlansResult {
  const { user } = useAuth();
  const [expensePlans, setExpensePlans] = useState<ExpensePlan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExpensePlans = useCallback(async (): Promise<void> => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await ExpensePlanService.getAll(user.id);
      setExpensePlans(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching expense plans');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchExpensePlans();
  }, [fetchExpensePlans]);

  const addExpensePlan = useCallback(
    async (plan: Omit<ExpensePlan, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'deleted_at'>): Promise<ExpensePlan | null> => {
      if (!user) return null;
      try {
        const newPlan = await ExpensePlanService.create(plan, user.id);
        setExpensePlans((prev) => [newPlan, ...prev]);
        return newPlan;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error adding expense plan');
        throw err;
      }
    },
    [user]
  );

  const addMoney = useCallback(
    async (id: string, amount: number): Promise<ExpensePlan | null> => {
      if (!user) return null;
      try {
        const updated = await ExpensePlanService.addMoney(id, amount, user.id);
        setExpensePlans((prev) => prev.map((p) => (p.id === id ? updated : p)));
        return updated;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error updating expense plan');
        throw err;
      }
    },
    [user]
  );

  const deleteExpensePlan = useCallback(
    async (id: string): Promise<void> => {
      if (!user) return;
      try {
        await ExpensePlanService.delete(id, user.id);
        setExpensePlans((prev) => prev.filter((p) => p.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error deleting expense plan');
        throw err;
      }
    },
    [user]
  );

  return { expensePlans, loading, error, addExpensePlan, addMoney, deleteExpensePlan, refetch: fetchExpensePlans };
}
