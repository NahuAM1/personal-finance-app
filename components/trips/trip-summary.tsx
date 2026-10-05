'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { Trip } from '@/types/database';
import { formatTripMoney, type TripSummary as TripSummaryData } from '@/lib/trips';
import { cn } from '@/lib/utils';

interface TripSummaryProps {
  trip: Trip;
  summary: TripSummaryData;
}

export function TripSummary({ trip, summary }: TripSummaryProps): React.JSX.Element {
  const money = (n: number) => formatTripMoney(n, trip.currency);
  const maxMemberValue = Math.max(1, ...summary.byMember.flatMap((m) => [m.paid, m.consumed]));

  return (
    <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
      <Card className='lg:col-span-2'>
        <CardContent className='p-4 space-y-3'>
          <div className='flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2'>
            <div className='min-w-0'>
              <p className='text-sm text-muted-foreground'>Total gastado</p>
              <p className='text-2xl font-bold tabular-nums break-words'>{money(summary.totalSpent)}</p>
            </div>
            {summary.budget !== null && (
              <div className='sm:text-right min-w-0'>
                <p className='text-sm text-muted-foreground'>Presupuesto</p>
                <p className='font-semibold tabular-nums'>{money(summary.budget)}</p>
              </div>
            )}
          </div>
          {summary.budget !== null && summary.budgetUsedPct !== null && (
            <div className='space-y-1'>
              <Progress value={Math.min(summary.budgetUsedPct, 100)} className='h-2.5' />
              <p
                className={cn(
                  'text-xs tabular-nums',
                  summary.budgetUsedPct > 100 ? 'text-red-600' : 'text-muted-foreground'
                )}
              >
                {summary.budgetUsedPct > 100
                  ? `Te pasaste ${money(summary.totalSpent - summary.budget)} (${summary.budgetUsedPct.toFixed(0)}%)`
                  : `Usaste el ${summary.budgetUsedPct.toFixed(0)}% · quedan ${money(summary.budget - summary.totalSpent)}`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className='min-w-0'>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base'>Por categoría</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          {summary.byCategory.length === 0 ? (
            <p className='text-sm text-muted-foreground'>Todavía no hay gastos.</p>
          ) : (
            summary.byCategory.map((c) => (
              <div key={c.category} className='space-y-1'>
                <div className='flex items-baseline justify-between gap-2 text-sm min-w-0'>
                  <span className='truncate'>{c.category}</span>
                  <span className='shrink-0 tabular-nums'>
                    {money(c.total)}{' '}
                    <span className='text-muted-foreground'>({c.percentage.toFixed(0)}%)</span>
                  </span>
                </div>
                <div className='h-2 rounded-full bg-emerald-100 dark:bg-emerald-950 overflow-hidden'>
                  <div
                    className='h-full rounded-full bg-emerald-500'
                    style={{ width: `${Math.max(c.percentage, 1)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className='min-w-0'>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base'>Por persona</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-wrap gap-3 text-xs text-muted-foreground'>
            <span className='flex items-center gap-1'>
              <span className='h-2 w-3 rounded-full bg-emerald-500' aria-hidden='true' /> Pagó
            </span>
            <span className='flex items-center gap-1'>
              <span className='h-2 w-3 rounded-full bg-amber-400' aria-hidden='true' /> Consumió
            </span>
          </div>
          {summary.byMember.map((m) => (
            <div key={m.memberId} className='space-y-1'>
              <div className='flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-x-2 text-sm min-w-0'>
                <span className='font-medium truncate'>{m.name}</span>
                <span className='text-xs text-muted-foreground tabular-nums'>
                  pagó {money(m.paid)} · consumió {money(m.consumed)}
                </span>
              </div>
              <div className='h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden'>
                <div
                  className='h-full rounded-full bg-emerald-500'
                  style={{ width: `${(m.paid / maxMemberValue) * 100}%` }}
                />
              </div>
              <div className='h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden'>
                <div
                  className='h-full rounded-full bg-amber-400'
                  style={{ width: `${(m.consumed / maxMemberValue) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
