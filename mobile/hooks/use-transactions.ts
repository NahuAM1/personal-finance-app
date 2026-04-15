import { useState, useEffect, useCallback } from 'react';
import { TransactionService } from '@/lib/transactions';
import { addTransaction } from '@/lib/database-api';
import { useAuth } from '@/contexts/auth-context';
import type { Transaction } from '@/types/database';

interface UseTransactionsResult {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  addTransaction: (t: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => Promise<Transaction | null>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<Transaction | null>;
  deleteTransaction: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useTransactions(): UseTransactionsResult {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async (): Promise<void> => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await TransactionService.getAll(user.id);
      setTransactions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching transactions');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const addTx = useCallback(
    async (transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>): Promise<Transaction | null> => {
      if (!user) return null;
      try {
        const newTransaction = await addTransaction({ ...transaction, user_id: user.id });
        setTransactions((prev) => [newTransaction, ...prev]);
        return newTransaction;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error adding transaction');
        throw err;
      }
    },
    [user]
  );

  const updateTx = useCallback(
    async (id: string, updates: Partial<Transaction>): Promise<Transaction | null> => {
      if (!user) return null;
      try {
        const updated = await TransactionService.update(id, updates, user.id);
        setTransactions((prev) => prev.map((t) => (t.id === id ? updated : t)));
        return updated;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error updating transaction');
        throw err;
      }
    },
    [user]
  );

  const deleteTx = useCallback(
    async (id: string): Promise<void> => {
      if (!user) return;
      try {
        await TransactionService.delete(id, user.id);
        setTransactions((prev) => prev.filter((t) => t.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error deleting transaction');
        throw err;
      }
    },
    [user]
  );

  return {
    transactions,
    loading,
    error,
    addTransaction: addTx,
    updateTransaction: updateTx,
    deleteTransaction: deleteTx,
    refetch: fetchTransactions,
  };
}
