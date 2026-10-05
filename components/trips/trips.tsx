'use client';

import { useState } from 'react';
import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InlineSpinner } from './inline-spinner';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { useTrips } from '@/hooks/use-trips';
import * as tripsApi from '@/lib/trips-api';
import { TripsList } from './trips-list';
import { TripDetail } from './trip-detail';
import { TripForm, type TripFormValues } from './trip-form';

interface TripsProps {
  /** Called when a trip action created/updated/deleted personal transactions. */
  onTransactionsChanged?: () => void;
}

export function Trips({ onTransactionsChanged }: TripsProps): React.JSX.Element {
  const { user } = useAuth();
  const { toast } = useToast();
  const { trips, loading, refetchTrips } = useTrips();
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const selectedTrip = trips.find((t) => t.id === selectedTripId) ?? null;

  const handleCreate = async (values: TripFormValues): Promise<void> => {
    if (!user) return;
    const trip = await tripsApi.createTrip(
      { ...values, created_by: user.id },
      {
        displayName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Yo',
        email: user.email ?? null,
      }
    );
    toast({ title: 'Viaje creado', description: `"${trip.name}" está listo` });
    setCreateOpen(false);
    await refetchTrips();
    setSelectedTripId(trip.id);
  };

  if (!user) return <InlineSpinner />;

  return (
    <div className='space-y-4'>
      {selectedTrip ? (
        <TripDetail
          key={selectedTrip.id}
          trip={selectedTrip}
          currentUserId={user.id}
          onBack={() => setSelectedTripId(null)}
          onTripChanged={refetchTrips}
          onTransactionsChanged={onTransactionsChanged}
        />
      ) : (
        <>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
            <div className='min-w-0'>
              <h2 className='text-xl font-bold'>Viajes</h2>
              <p className='text-sm text-muted-foreground'>
                Gestioná los gastos compartidos de tus viajes y quién le debe a quién.
              </p>
            </div>
            <Button
              onClick={() => setCreateOpen(true)}
              className='bg-emerald-600 hover:bg-emerald-700 text-white sm:shrink-0'
            >
              <PlusCircle className='h-4 w-4 mr-2' />
              Nuevo viaje
            </Button>
          </div>
          {loading && trips.length === 0 ? (
            <InlineSpinner />
          ) : (
            <TripsList
              trips={trips}
              onSelect={(trip) => setSelectedTripId(trip.id)}
              onCreate={() => setCreateOpen(true)}
            />
          )}
        </>
      )}

      {createOpen && (
        <TripForm open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={handleCreate} />
      )}
    </div>
  );
}
