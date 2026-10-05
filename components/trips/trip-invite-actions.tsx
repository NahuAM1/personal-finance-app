'use client';

import { useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { emitNavigateTab, emitTripsChanged } from '@/lib/app-events';
import type { Notification } from '@/types/database';

interface TripInviteActionsProps {
  notification: Notification;
  onAnswered: () => Promise<void>;
}

export function TripInviteActions({ notification, onAnswered }: TripInviteActionsProps): React.JSX.Element | null {
  const { toast } = useToast();
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const data = notification.data || {};
  const memberId = typeof data.member_id === 'string' ? data.member_id : null;
  const status = typeof data.status === 'string' ? data.status : 'pending';

  if (!memberId) return null;

  if (status === 'accepted') {
    return <p className='text-xs font-medium text-emerald-700 dark:text-emerald-300'>Aceptaste la invitación</p>;
  }
  if (status === 'declined') {
    return <p className='text-xs font-medium text-muted-foreground'>Rechazaste la invitación</p>;
  }

  const answer = async (action: 'accept' | 'decline'): Promise<void> => {
    setBusy(action);
    try {
      const res = await fetch(`/api/trips/invitations/${memberId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 409) {
        throw new Error(result.error || 'No se pudo responder la invitación');
      }
      if (res.status === 409) {
        toast({ title: 'Invitación', description: result.error || 'La invitación ya fue respondida' });
      } else if (action === 'accept') {
        toast({ title: '¡Te sumaste al viaje!', description: String(data.trip_name ?? '') });
        emitTripsChanged();
        emitNavigateTab('trips');
      } else {
        toast({ title: 'Invitación rechazada' });
      }
      await onAnswered();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo responder la invitación',
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className='flex flex-wrap gap-2'>
      <Button
        size='sm'
        className='h-8 bg-emerald-600 hover:bg-emerald-700 text-white'
        disabled={busy !== null}
        onClick={(e) => { e.stopPropagation(); answer('accept'); }}
      >
        {busy === 'accept' ? (
          <Loader2 className='h-3.5 w-3.5 mr-1 animate-spin' aria-hidden='true' />
        ) : (
          <Check className='h-3.5 w-3.5 mr-1' aria-hidden='true' />
        )}
        Aceptar
      </Button>
      <Button
        size='sm'
        variant='outline'
        className='h-8'
        disabled={busy !== null}
        onClick={(e) => { e.stopPropagation(); answer('decline'); }}
      >
        {busy === 'decline' ? (
          <Loader2 className='h-3.5 w-3.5 mr-1 animate-spin' aria-hidden='true' />
        ) : (
          <X className='h-3.5 w-3.5 mr-1' aria-hidden='true' />
        )}
        Rechazar
      </Button>
    </div>
  );
}
