'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CreditCard, Pencil, PlusCircle, Trash2 } from 'lucide-react';
import { useCards } from '@/hooks/use-cards';
import { CardForm } from '@/components/card-form';
import { formatCardLabel, type CardDraft } from '@/lib/cards';
import { emitDataChanged } from '@/lib/app-events';
import type { Card as UserCard } from '@/types/database';

type CardsManagerView = 'list' | 'create' | 'edit';

interface CardRowProps {
  card: UserCard;
  onEdit: (card: UserCard) => void;
  onDelete: (card: UserCard) => void;
}

function CardRow({ card, onEdit, onDelete }: CardRowProps): React.JSX.Element {
  const label: string = formatCardLabel(card);

  return (
    <li className='flex items-center justify-between gap-3 py-3'>
      <div className='flex items-center gap-3 min-w-0'>
        <div className='p-2 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 rounded-xl shrink-0'>
          <CreditCard className='h-4 w-4 text-blue-600 dark:text-blue-400' aria-hidden='true' />
        </div>
        <span className='text-sm font-medium break-words'>{label}</span>
      </div>
      <div className='flex items-center gap-1 shrink-0'>
        <Button
          variant='ghost'
          size='sm'
          className='px-2'
          onClick={() => onEdit(card)}
          aria-label={`Editar ${label}`}
        >
          <Pencil className='h-4 w-4' aria-hidden='true' />
        </Button>
        <Button
          variant='ghost'
          size='sm'
          className='px-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30'
          onClick={() => onDelete(card)}
          aria-label={`Eliminar ${label}`}
        >
          <Trash2 className='h-4 w-4' aria-hidden='true' />
        </Button>
      </div>
    </li>
  );
}

export function CardsManager(): React.JSX.Element {
  const { cards, loading, createCard, updateCard, deleteCard } = useCards();

  const [view, setView] = useState<CardsManagerView>('list');
  const [editingCard, setEditingCard] = useState<UserCard | null>(null);
  const [cardToDelete, setCardToDelete] = useState<UserCard | null>(null);

  const openCreate = (): void => {
    setEditingCard(null);
    setView('create');
  };

  const openEdit = (card: UserCard): void => {
    setEditingCard(card);
    setView('edit');
  };

  const backToList = (): void => {
    setView('list');
    setEditingCard(null);
  };

  const handleFormSubmit = async (draft: CardDraft): Promise<void> => {
    const saved: boolean = editingCard
      ? await updateCard(editingCard.id, draft)
      : (await createCard(draft)) !== null;
    if (!saved) return;
    emitDataChanged();
    backToList();
  };

  const confirmDelete = async (): Promise<void> => {
    if (!cardToDelete) return;
    const id: string = cardToDelete.id;
    setCardToDelete(null);
    if (await deleteCard(id)) emitDataChanged();
  };

  const title: string =
    view === 'create' ? 'Nueva tarjeta' : view === 'edit' ? 'Editar tarjeta' : 'Mis tarjetas';
  const description: string =
    view === 'create'
      ? 'Registrá una tarjeta para asignarla a tus compras en cuotas.'
      : view === 'edit'
        ? 'Modificá los datos de la tarjeta.'
        : 'Registrá tus tarjetas de crédito para elegir con cuál pagás cada compra en cuotas.';

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      {loading ? (
        <div className='flex items-center justify-center py-8'>
          <div className='text-sm text-gray-500 dark:text-gray-400'>Cargando tarjetas...</div>
        </div>
      ) : view !== 'list' ? (
        <CardForm
          key={editingCard?.id ?? 'new'}
          initialData={editingCard}
          onSubmit={handleFormSubmit}
          onCancel={backToList}
        />
      ) : cards.length === 0 ? (
        <div className='text-center py-6'>
          <CreditCard className='h-12 w-12 text-gray-400 mx-auto mb-3' aria-hidden='true' />
          <h3 className='text-base font-medium text-gray-900 dark:text-gray-100 mb-1'>
            No tenés tarjetas registradas
          </h3>
          <p className='text-sm text-gray-600 dark:text-gray-400 mb-5'>
            Agregá tus tarjetas para indicar con cuál pagaste cada compra en cuotas
          </p>
          <Button onClick={openCreate}>
            <PlusCircle className='h-4 w-4 mr-2' aria-hidden='true' />
            Agregar primera tarjeta
          </Button>
        </div>
      ) : (
        <div className='min-w-0 space-y-4'>
          <ul className='divide-y divide-gray-100 dark:divide-gray-800 max-h-80 overflow-y-auto'>
            {cards.map((card: UserCard) => (
              <CardRow
                key={card.id}
                card={card}
                onEdit={openEdit}
                onDelete={setCardToDelete}
              />
            ))}
          </ul>
          <Button onClick={openCreate} className='w-full'>
            <PlusCircle className='h-4 w-4 mr-2' aria-hidden='true' />
            Nueva tarjeta
          </Button>
        </div>
      )}

      <AlertDialog open={cardToDelete !== null} onOpenChange={(v) => { if (!v) setCardToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la tarjeta?</AlertDialogTitle>
            <AlertDialogDescription>
              {cardToDelete ? `Vas a eliminar ${formatCardLabel(cardToDelete)}. ` : ''}
              Las compras que la usaban se conservan, pero quedan sin tarjeta asignada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className='bg-red-600 hover:bg-red-700'
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface CardsManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CardsManagerDialog({ open, onOpenChange }: CardsManagerDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <CardsManager />
      </DialogContent>
    </Dialog>
  );
}
