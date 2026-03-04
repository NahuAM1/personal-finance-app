'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import type { Ticket } from '@/types/database';
import * as smartpocketApi from '@/lib/smartpocket-api';

export function useTickets(enabled = true) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchTickets = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const data = await smartpocketApi.getTickets(user.id);
      setTickets(data || []);
      setHasFetched(true);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los tickets',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (enabled && !hasFetched) {
      fetchTickets();
    }
  }, [enabled, hasFetched, fetchTickets]);

  const deleteTicket = useCallback(
    async (ticketId: string) => {
      if (!user) return;

      try {
        await smartpocketApi.deleteTicket(ticketId, user.id);
        setTickets((prev) => prev.filter((t) => t.id !== ticketId));
        toast({
          title: 'Eliminado',
          description: 'Ticket eliminado correctamente',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'No se pudo eliminar el ticket',
          variant: 'destructive',
        });
      }
    },
    [user, toast]
  );

  const selectTicket = useCallback((ticket: Ticket) => {
    setSelectedTicket(ticket);
  }, []);

  const clearSelectedTicket = useCallback(() => {
    setSelectedTicket(null);
  }, []);

  return {
    tickets,
    loading,
    selectedTicket,
    selectTicket,
    clearSelectedTicket,
    refetchTickets: fetchTickets,
    deleteTicket,
  };
}
