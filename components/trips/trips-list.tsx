'use client';

import { CalendarDays, MapPin, Plane, PlusCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { TripWithTotals } from '@/lib/trips-api';
import { formatTripMoney } from '@/lib/trips';
import { cn } from '@/lib/utils';

export function formatTripDates(start: string | null, end: string | null): string | null {
  const fmt = (d: string) => format(parseISO(d), "d MMM yyyy", { locale: es });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `Desde ${fmt(start)}`;
  if (end) return `Hasta ${fmt(end)}`;
  return null;
}

interface TripsListProps {
  trips: TripWithTotals[];
  onSelect: (trip: TripWithTotals) => void;
  onCreate: () => void;
}

export function TripsList({ trips, onSelect, onCreate }: TripsListProps): React.JSX.Element {
  if (trips.length === 0) {
    return (
      <Card>
        <CardContent className='py-12 text-center space-y-4'>
          <Plane className='h-12 w-12 text-emerald-500 mx-auto' aria-hidden='true' />
          <div>
            <p className='font-medium'>Todavía no tenés viajes</p>
            <p className='text-sm text-muted-foreground'>
              Creá uno para registrar gastos compartidos y ver quién le debe a quién.
            </p>
          </div>
          <Button onClick={onCreate} className='bg-emerald-600 hover:bg-emerald-700 text-white'>
            <PlusCircle className='h-4 w-4 mr-2' />
            Crear viaje
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'>
      {trips.map((trip) => {
        const dates = formatTripDates(trip.start_date, trip.end_date);
        const budget = trip.budget != null && Number(trip.budget) > 0 ? Number(trip.budget) : null;
        const pct = budget ? (trip.total_spent / budget) * 100 : null;
        return (
          <button
            key={trip.id}
            type='button'
            onClick={() => onSelect(trip)}
            className='text-left min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500'
          >
            <Card className='h-full hover:shadow-lg hover:border-emerald-300 transition-all'>
              <CardContent className='p-4 space-y-3'>
                <div className='flex items-start gap-3 min-w-0'>
                  <div className='h-10 w-10 shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center'>
                    <Plane className='h-5 w-5 text-emerald-600' aria-hidden='true' />
                  </div>
                  <div className='min-w-0 flex-1'>
                    <p className='font-semibold truncate'>{trip.name}</p>
                    {trip.destination && (
                      <p className='text-sm text-muted-foreground flex items-center gap-1 min-w-0'>
                        <MapPin className='h-3.5 w-3.5 shrink-0' aria-hidden='true' />
                        <span className='truncate'>{trip.destination}</span>
                      </p>
                    )}
                    {dates && (
                      <p className='text-xs text-muted-foreground flex items-center gap-1 min-w-0'>
                        <CalendarDays className='h-3.5 w-3.5 shrink-0' aria-hidden='true' />
                        <span className='truncate'>{dates}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className='space-y-1'>
                  <div className='flex flex-wrap items-baseline justify-between gap-x-2 text-sm'>
                    <span className='text-muted-foreground'>Gastado</span>
                    <span className='font-semibold tabular-nums'>
                      {formatTripMoney(trip.total_spent, trip.currency)}
                      {budget && (
                        <span className='font-normal text-muted-foreground'>
                          {' '}/ {formatTripMoney(budget, trip.currency)}
                        </span>
                      )}
                    </span>
                  </div>
                  {pct !== null && (
                    <>
                      <Progress value={Math.min(pct, 100)} className='h-2' />
                      <p className={cn('text-xs tabular-nums', pct > 100 ? 'text-red-600' : 'text-muted-foreground')}>
                        {pct.toFixed(0)}% del presupuesto
                      </p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
