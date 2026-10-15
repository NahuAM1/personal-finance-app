'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import type { Card } from '@/types/database';
import type { CardDraft } from '@/lib/cards';
import * as api from '@/lib/database-api';

export interface UseCardsResult {
  cards: Card[];
  loading: boolean;
  createCard: (draft: CardDraft) => Promise<Card | null>;
  updateCard: (id: string, draft: CardDraft) => Promise<boolean>;
  deleteCard: (id: string) => Promise<boolean>;
  refetchCards: () => Promise<void>;
}

function sortByName(cards: Card[]): Card[] {
  return [...cards].sort((a: Card, b: Card) => a.name.localeCompare(b.name));
}

export function useCards(): UseCardsResult {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refetchCards = useCallback(async (): Promise<void> => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setCards(await api.getCards(user.id));
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar las tarjetas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    void refetchCards();
  }, [refetchCards]);

  const createCard = useCallback(
    async (draft: CardDraft): Promise<Card | null> => {
      if (!user) return null;
      try {
        const card: Card = await api.createCard(draft, user.id);
        setCards((current: Card[]) => sortByName([...current, card]));
        return card;
      } catch {
        toast({ title: 'Error', description: 'No se pudo guardar la tarjeta', variant: 'destructive' });
        return null;
      }
    },
    [user, toast],
  );

  const updateCard = useCallback(
    async (id: string, draft: CardDraft): Promise<boolean> => {
      if (!user) return false;
      try {
        const updated: Card = await api.updateCard(id, draft, user.id);
        setCards((current: Card[]) => sortByName(current.map((card: Card) => (card.id === id ? updated : card))));
        return true;
      } catch {
        toast({ title: 'Error', description: 'No se pudo actualizar la tarjeta', variant: 'destructive' });
        return false;
      }
    },
    [user, toast],
  );

  const deleteCard = useCallback(
    async (id: string): Promise<boolean> => {
      if (!user) return false;
      try {
        await api.deleteCard(id, user.id);
        setCards((current: Card[]) => current.filter((card: Card) => card.id !== id));
        return true;
      } catch {
        toast({ title: 'Error', description: 'No se pudo eliminar la tarjeta', variant: 'destructive' });
        return false;
      }
    },
    [user, toast],
  );

  return { cards, loading, createCard, updateCard, deleteCard, refetchCards };
}
