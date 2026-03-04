'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import type { SplitGroup } from '@/types/database';
import * as smartpocketApi from '@/lib/smartpocket-api';

export function useSplitGroups() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [groups, setGroups] = useState<SplitGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<SplitGroup | null>(null);

  const fetchGroups = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const data = await smartpocketApi.getSplitGroups(user.id);
      setGroups(data || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los grupos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const selectGroup = useCallback((group: SplitGroup) => {
    setSelectedGroup(group);
  }, []);

  const clearSelectedGroup = useCallback(() => {
    setSelectedGroup(null);
  }, []);

  return {
    groups,
    loading,
    selectedGroup,
    selectGroup,
    clearSelectedGroup,
    refetchGroups: fetchGroups,
  };
}
