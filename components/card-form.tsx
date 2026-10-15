'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Card as UserCard, CardNetwork } from '@/types/database';
import {
  CARD_NETWORKS,
  CARD_NETWORK_LABELS,
  formatCardLabel,
  parseCardForm,
  type CardDraft,
  type CardFormResult,
} from '@/lib/cards';
import { useCards, type UseCardsResult } from '@/hooks/use-cards';
import { DATA_CHANGED_EVENT } from '@/lib/app-events';

const NO_CARD_VALUE: string = 'none';
const LAST_FOUR_LENGTH: number = 4;

interface CardFormProps {
  initialData: UserCard | null;
  onSubmit: (draft: CardDraft) => Promise<void>;
  onCancel: () => void;
}

interface CardFormState {
  name: string;
  network: string;
  lastFour: string;
}

function initialFormState(card: UserCard | null): CardFormState {
  return {
    name: card?.name ?? '',
    network: card?.network ?? '',
    lastFour: card?.last_four ?? '',
  };
}

export function CardForm({ initialData, onSubmit, onCancel }: CardFormProps): React.JSX.Element {
  const [form, setForm] = useState<CardFormState>(() => initialFormState(initialData));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const updateForm = (changes: Partial<CardFormState>): void => {
    setForm((current: CardFormState) => ({ ...current, ...changes }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (submitting) return;

    const result: CardFormResult = parseCardForm(form);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(result.card);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className='min-w-0 space-y-4' noValidate>
      <div className='space-y-2'>
        <Label htmlFor='card-name'>Nombre de la tarjeta</Label>
        <Input
          id='card-name'
          placeholder='ej. Visa del Galicia'
          value={form.name}
          onChange={(e) => updateForm({ name: e.target.value })}
          maxLength={100}
          autoComplete='off'
        />
      </div>

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <div className='space-y-2'>
          <Label htmlFor='card-network'>Red</Label>
          <Select
            value={form.network}
            onValueChange={(value: string) => updateForm({ network: value })}
          >
            <SelectTrigger id='card-network'>
              <SelectValue placeholder='Elegí la red' />
            </SelectTrigger>
            <SelectContent>
              {CARD_NETWORKS.map((network: CardNetwork) => (
                <SelectItem key={network} value={network}>
                  {CARD_NETWORK_LABELS[network]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-2'>
          <Label htmlFor='card-last-four'>Últimos 4 dígitos (opcional)</Label>
          <Input
            id='card-last-four'
            inputMode='numeric'
            placeholder='ej. 1234'
            value={form.lastFour}
            onChange={(e) =>
              updateForm({ lastFour: e.target.value.replace(/\D/g, '').slice(0, LAST_FOUR_LENGTH) })
            }
            maxLength={LAST_FOUR_LENGTH}
            autoComplete='off'
            className='tabular-nums'
          />
        </div>
      </div>

      {error && (
        <p role='alert' className='text-sm text-red-600 dark:text-red-400'>
          {error}
        </p>
      )}

      <div className='flex gap-3 pt-2'>
        <Button type='submit' className='flex-1' disabled={submitting}>
          {initialData ? 'Guardar cambios' : 'Crear tarjeta'}
        </Button>
        <Button type='button' variant='ghost' onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function useLiveCards(): UseCardsResult {
  const result: UseCardsResult = useCards();
  const { refetchCards } = result;

  useEffect(() => {
    const handler = (): void => {
      void refetchCards();
    };
    window.addEventListener(DATA_CHANGED_EVENT, handler);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, handler);
  }, [refetchCards]);

  return result;
}

interface CardSelectProps {
  id: string;
  cards: UserCard[];
  value: string | null;
  onChange: (cardId: string | null) => void;
}

export function CardSelect({ id, cards, value, onChange }: CardSelectProps): React.JSX.Element {
  return (
    <Select
      value={value ?? NO_CARD_VALUE}
      onValueChange={(selected: string) => onChange(selected === NO_CARD_VALUE ? null : selected)}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder='Elegí una tarjeta' />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_CARD_VALUE}>Sin tarjeta</SelectItem>
        {cards.map((card: UserCard) => (
          <SelectItem key={card.id} value={card.id}>
            {formatCardLabel(card)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
