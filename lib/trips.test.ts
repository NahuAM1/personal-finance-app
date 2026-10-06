import { describe, expect, it } from 'vitest';
import { canManageExpense, canSettleDebt, planNewMemberShares, toCents } from '@/lib/trips';
import type { ShareInput, SplitMethod, TripExpenseWithShares } from '@/lib/trips';
import type { TripExpenseShare } from '@/types/database';

const OWNER = 'user-owner';
const CREATOR = 'user-creator';
const OTHER = 'user-other';

describe('canManageExpense', () => {
  it('allows the trip owner to manage any expense', () => {
    expect(
      canManageExpense({ currentUserId: OWNER, tripOwnerId: OWNER, expenseCreatedBy: CREATOR })
    ).toBe(true);
  });

  it('allows the user who created the expense', () => {
    expect(
      canManageExpense({ currentUserId: CREATOR, tripOwnerId: OWNER, expenseCreatedBy: CREATOR })
    ).toBe(true);
  });

  it('denies any other member', () => {
    expect(
      canManageExpense({ currentUserId: OTHER, tripOwnerId: OWNER, expenseCreatedBy: CREATOR })
    ).toBe(false);
  });

  it('allows only the owner when the expense has no creator', () => {
    expect(
      canManageExpense({ currentUserId: OWNER, tripOwnerId: OWNER, expenseCreatedBy: null })
    ).toBe(true);
    expect(
      canManageExpense({ currentUserId: OTHER, tripOwnerId: OWNER, expenseCreatedBy: null })
    ).toBe(false);
  });
});

describe('canSettleDebt', () => {
  const settlement = { fromMemberId: 'm-debtor', toMemberId: 'm-creditor' };

  it('allows the trip owner to settle any debt', () => {
    expect(
      canSettleDebt({ currentUserId: OWNER, tripOwnerId: OWNER, currentMemberId: 'm-owner', settlement })
    ).toBe(true);
  });

  it('allows the debtor and the creditor', () => {
    expect(
      canSettleDebt({ currentUserId: OTHER, tripOwnerId: OWNER, currentMemberId: 'm-debtor', settlement })
    ).toBe(true);
    expect(
      canSettleDebt({ currentUserId: OTHER, tripOwnerId: OWNER, currentMemberId: 'm-creditor', settlement })
    ).toBe(true);
  });

  it('denies a third member, or a user without a member row', () => {
    expect(
      canSettleDebt({ currentUserId: OTHER, tripOwnerId: OWNER, currentMemberId: 'm-third', settlement })
    ).toBe(false);
    expect(
      canSettleDebt({ currentUserId: OTHER, tripOwnerId: OWNER, currentMemberId: null, settlement })
    ).toBe(false);
  });
});

describe('planNewMemberShares', () => {
  const NEW = 'm-new';

  function share(id: string, memberId: string, amount: number, isSettled = false): TripExpenseShare {
    return {
      id,
      expense_id: 'unused',
      member_id: memberId,
      share_amount: amount,
      is_settled: isSettled,
      settled_at: isSettled ? '2026-01-01T00:00:00Z' : null,
    };
  }

  function expense(
    id: string,
    amount: number,
    splitMethod: SplitMethod,
    shares: TripExpenseShare[],
    paidBy = 'm-payer'
  ): TripExpenseWithShares {
    return {
      id,
      trip_id: 'trip-1',
      paid_by_member_id: paidBy,
      description: 'Gasto',
      amount,
      category: null,
      expense_date: '2026-01-01',
      split_method: splitMethod,
      transaction_id: null,
      created_by: null,
      currency: 'ARS',
      original_amount: amount,
      exchange_rate: 1,
      rate_source: 'manual',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      trip_expense_shares: shares.map((s) => ({ ...s, expense_id: id })),
    };
  }

  function total(shares: ShareInput[]): number {
    return shares.reduce((acc, s) => acc + toCents(s.share_amount), 0);
  }

  it('re-splits an equal expense of 100 between 2 into 50/50', () => {
    const plan = planNewMemberShares(
      [expense('e1', 100, 'equal', [share('s1', 'm-payer', 100)])],
      NEW
    );
    expect(plan).toEqual([
      {
        expenseId: 'e1',
        shares: [
          { member_id: 'm-payer', share_amount: 50 },
          { member_id: NEW, share_amount: 50 },
        ],
      },
    ]);
  });

  it('re-splits 100 among 3 so shares sum exactly to 100, remainder on the last share', () => {
    const plan = planNewMemberShares(
      [expense('e1', 100, 'equal', [share('s1', 'm-payer', 50), share('s2', 'm-b', 50)])],
      NEW
    );
    expect(plan).toHaveLength(1);
    expect(plan[0].shares).toEqual([
      { member_id: 'm-payer', share_amount: 33.33 },
      { member_id: 'm-b', share_amount: 33.33 },
      { member_id: NEW, share_amount: 33.34 },
    ]);
    expect(total(plan[0].shares)).toBe(10000);
  });

  it('keeps the payer share in the re-split', () => {
    const plan = planNewMemberShares(
      [expense('e1', 90, 'equal', [share('s1', 'm-payer', 45), share('s2', 'm-b', 45)], 'm-payer')],
      NEW
    );
    expect(plan[0].shares.map((s) => s.member_id)).toEqual(['m-payer', 'm-b', NEW]);
    expect(plan[0].shares.every((s) => s.share_amount === 30)).toBe(true);
  });

  it('skips an equal expense that has any settled share', () => {
    const plan = planNewMemberShares(
      [expense('e1', 100, 'equal', [share('s1', 'm-payer', 50), share('s2', 'm-b', 50, true)])],
      NEW
    );
    expect(plan).toEqual([]);
  });

  it('skips custom and percentage expenses', () => {
    const plan = planNewMemberShares(
      [
        expense('e1', 100, 'custom', [share('s1', 'm-payer', 70), share('s2', 'm-b', 30)]),
        expense('e2', 100, 'percentage', [share('s3', 'm-payer', 50), share('s4', 'm-b', 50)]),
      ],
      NEW
    );
    expect(plan).toEqual([]);
  });

  it('skips an expense that already includes the new member', () => {
    const plan = planNewMemberShares(
      [expense('e1', 100, 'equal', [share('s1', 'm-payer', 50), share('s2', NEW, 50)])],
      NEW
    );
    expect(plan).toEqual([]);
  });

  it('only plans the eligible expenses of a mixed list', () => {
    const plan = planNewMemberShares(
      [
        expense('e1', 100, 'equal', [share('s1', 'm-payer', 100)]),
        expense('e2', 100, 'custom', [share('s2', 'm-payer', 100)]),
        expense('e3', 60, 'equal', [share('s3', 'm-payer', 30), share('s4', 'm-b', 30)]),
      ],
      NEW
    );
    expect(plan.map((p) => p.expenseId)).toEqual(['e1', 'e3']);
  });
});
