import { describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => {
  interface FakeRow {
    id: string;
    user_id: string;
    date: string;
    created_at: string;
  }

  interface FakeResult {
    data: FakeRow[];
    error: null;
  }

  // PostgREST max-rows: a single response never carries more than 1000 rows.
  const MAX_ROWS = 1000;
  const rows: FakeRow[] = [];

  class FakeQuery implements PromiseLike<FakeResult> {
    private ascending = true;
    private from = 0;
    private to = MAX_ROWS - 1;

    select(): FakeQuery {
      return this;
    }

    eq(): FakeQuery {
      return this;
    }

    order(column: string, options: { ascending: boolean }): FakeQuery {
      if (column === 'date') this.ascending = options.ascending;
      return this;
    }

    range(from: number, to: number): FakeQuery {
      this.from = from;
      this.to = to;
      return this;
    }

    then<TResult1 = FakeResult, TResult2 = never>(
      onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: Error) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      const sorted: FakeRow[] = this.ascending ? [...rows] : [...rows].reverse();
      const data: FakeRow[] = sorted.slice(this.from, Math.min(this.to + 1, this.from + MAX_ROWS));
      return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected);
    }
  }

  // Rows are stored oldest first, one per day.
  function seed(count: number): void {
    rows.length = 0;
    for (let i = 0; i < count; i++) {
      rows.push({
        id: `tx-${i}`,
        user_id: 'user-1',
        date: new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10),
        created_at: '2026-10-01T00:00:00Z',
      });
    }
  }

  return { supabase: { from: (): FakeQuery => new FakeQuery() }, seed };
});

vi.mock('@/lib/supabase', () => ({ supabase: fake.supabase }));

import { getTransactions } from '@/lib/database-api';

describe('getTransactions', () => {
  it('returns every transaction newest first, past the 1000-row cap of a single response', async () => {
    fake.seed(1500);

    const transactions = await getTransactions('user-1');

    expect(transactions).toHaveLength(1500);
    expect(transactions[0].id).toBe('tx-1499');
    expect(transactions[1499].id).toBe('tx-0');
  });
});
