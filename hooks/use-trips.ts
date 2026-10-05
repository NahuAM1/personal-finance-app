'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import * as tripsApi from '@/lib/trips-api';
import type { TripWithTotals } from '@/lib/trips-api';
import { TRIPS_CHANGED_EVENT } from '@/lib/app-events';

export function useTrips(): {
  trips: TripWithTotals[];
  loading: boolean;
  refetchTrips: () => Promise<void>;
} {
  const { user } = useAuth();
  const { toast } = useToast();
  const [trips, setTrips] = useState<TripWithTotals[]>([]);
  const [loading, setLoading] = useState(true);
  const inFlightRef = useRef(false);

  const refetchTrips = useCallback(async (): Promise<void> => {
    if (!user || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      setLoading(true);
      setTrips(await tripsApi.getTrips());
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los viajes',
        variant: 'destructive',
      });
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    refetchTrips();
  }, [refetchTrips]);

  // e.g. an invitation accepted from the notification bell.
  useEffect(() => {
    const handler = () => { refetchTrips(); };
    window.addEventListener(TRIPS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(TRIPS_CHANGED_EVENT, handler);
  }, [refetchTrips]);

  return { trips, loading, refetchTrips };
}
