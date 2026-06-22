'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import type { Service, Transaction } from '@/types/database';
import { deriveServiceStatus } from '@/lib/services';
import type { ServiceWithStatus } from '@/lib/services';
import type { Database } from '@/types/database';
import * as servicesApi from '@/lib/services-api';

type ServiceInsert = Database['public']['Tables']['services']['Insert'];
type ServiceUpdate = Database['public']['Tables']['services']['Update'];

export function useServices(enabled = true): {
  services: Service[];
  serviceTransactions: Transaction[];
  servicesWithStatus: ServiceWithStatus[];
  loading: boolean;
  createService: (input: Omit<ServiceInsert, 'user_id'>) => Promise<void>;
  updateService: (id: string, updates: ServiceUpdate) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  payService: (service: Service, amount: number) => Promise<void>;
  refetchServices: () => Promise<void>;
} {
  const { user } = useAuth();
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [serviceTransactions, setServiceTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  // Synchronous guards: state updates are async and don't commit before a
  // StrictMode double-mount re-runs the effect, so a state flag can't prevent
  // the second invocation. Refs flip immediately and close that window.
  const hasFetchedRef = useRef(false);
  const inFlightRef = useRef(false);

  const fetchAndGenerate = useCallback(async (): Promise<void> => {
    if (!user || inFlightRef.current) return;

    inFlightRef.current = true;
    try {
      setLoading(true);
      const [svcs, txs] = await Promise.all([
        servicesApi.getServices(user.id),
        servicesApi.getServiceTransactions(user.id),
      ]);

      // Lazy generation for automatic services in the current period.
      // The DB partial unique index (uniq_service_period) is the real
      // double-charge guard; this ref only avoids redundant work.
      const created = await servicesApi.generateAutomaticServiceTransactions(
        svcs,
        txs,
        user.id
      );

      setServices(svcs);
      setServiceTransactions(created.length > 0 ? [...created, ...txs] : txs);
      hasFetchedRef.current = true;
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los servicios',
        variant: 'destructive',
      });
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (enabled && !hasFetchedRef.current) {
      fetchAndGenerate();
    }
  }, [enabled, fetchAndGenerate]);

  const servicesWithStatus = useMemo<ServiceWithStatus[]>(
    () => services.map((s) => deriveServiceStatus(s, serviceTransactions)),
    [services, serviceTransactions]
  );

  const createService = useCallback(
    async (input: Omit<ServiceInsert, 'user_id'>): Promise<void> => {
      if (!user) return;

      try {
        const created = await servicesApi.createService(input, user.id);
        setServices((prev) => [created, ...prev]);
        toast({
          title: 'Servicio creado',
          description: `${created.name} fue agregado correctamente`,
        });
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'No se pudo crear el servicio',
          variant: 'destructive',
        });
      }
    },
    [user, toast]
  );

  const updateService = useCallback(
    async (id: string, updates: ServiceUpdate): Promise<void> => {
      if (!user) return;

      try {
        const updated = await servicesApi.updateService(id, updates, user.id);
        setServices((prev) => prev.map((s) => (s.id === id ? updated : s)));
        toast({
          title: 'Servicio actualizado',
          description: `${updated.name} fue actualizado correctamente`,
        });
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'No se pudo actualizar el servicio',
          variant: 'destructive',
        });
      }
    },
    [user, toast]
  );

  const deleteService = useCallback(
    async (id: string): Promise<void> => {
      if (!user) return;

      try {
        await servicesApi.deleteService(id, user.id);
        setServices((prev) => prev.filter((s) => s.id !== id));
        toast({
          title: 'Servicio eliminado',
          description: 'El servicio fue eliminado correctamente',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'No se pudo eliminar el servicio',
          variant: 'destructive',
        });
      }
    },
    [user, toast]
  );

  const payService = useCallback(
    async (service: Service, amount: number): Promise<void> => {
      if (!user) return;

      try {
        const tx = await servicesApi.payService(service, amount, user.id);
        // Push the new transaction so servicesWithStatus immediately flips to "paid"
        // without a full refetch.
        setServiceTransactions((prev) => [tx, ...prev]);
        toast({
          title: 'Pago registrado',
          description: `${service.name} marcado como pagado`,
        });
      } catch (error) {
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'No se pudo registrar el pago',
          variant: 'destructive',
        });
      }
    },
    [user, toast]
  );

  return {
    services,
    serviceTransactions,
    servicesWithStatus,
    loading,
    createService,
    updateService,
    deleteService,
    payService,
    refetchServices: fetchAndGenerate,
  };
}
