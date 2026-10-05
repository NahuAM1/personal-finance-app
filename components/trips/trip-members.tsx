'use client';

import { useState } from 'react';
import { Crown, Loader2, LogOut, Mail, UserMinus, UserPlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import type { Trip, TripMember } from '@/types/database';
import * as tripsApi from '@/lib/trips-api';
import { useToast } from '@/hooks/use-toast';

interface TripMembersProps {
  trip: Trip;
  members: TripMember[];
  currentUserId: string;
  isAdmin: boolean;
  isCreator: boolean;
  onChanged: () => void;
  onLeft: () => void;
}

async function postJson(url: string, method: 'POST' | 'DELETE', body?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Ocurrió un error');
  return data;
}

export function TripMembers({
  trip,
  members,
  currentUserId,
  isAdmin,
  isCreator,
  onChanged,
  onLeft,
}: TripMembersProps): React.JSX.Element {
  const { toast } = useToast();
  const [guestName, setGuestName] = useState('');
  const [addingGuest, setAddingGuest] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [toRemove, setToRemove] = useState<TripMember | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleAddGuest = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const name = guestName.trim();
    if (!name) return;
    if (members.some((m) => m.display_name.trim().toLowerCase() === name.toLowerCase())) {
      toast({ title: 'Error', description: 'Ya hay una persona con ese nombre', variant: 'destructive' });
      return;
    }
    setAddingGuest(true);
    try {
      await tripsApi.addGuestMember(trip.id, name);
      setGuestName('');
      toast({ title: 'Persona agregada', description: `${name} se sumó al viaje` });
      onChanged();
    } catch {
      toast({ title: 'Error', description: 'No se pudo agregar a la persona', variant: 'destructive' });
    } finally {
      setAddingGuest(false);
    }
  };

  const handleInvite = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    setInviting(true);
    setInviteError(null);
    try {
      await postJson(`/api/trips/${trip.id}/invite`, 'POST', { email });
      setInviteEmail('');
      toast({ title: 'Invitación enviada', description: `Le llegará una notificación a ${email}` });
      onChanged();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'No se pudo enviar la invitación');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (): Promise<void> => {
    if (!toRemove) return;
    setBusy(true);
    try {
      const result = await postJson(`/api/trips/${trip.id}/members/${toRemove.id}`, 'DELETE');
      toast({
        title: 'Persona quitada',
        description:
          result.action === 'detached'
            ? `${toRemove.display_name} ya no accede al viaje; sus gastos se conservan como invitado.`
            : `${toRemove.display_name} ya no forma parte del viaje.`,
      });
      setToRemove(null);
      onChanged();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo quitar a la persona',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async (): Promise<void> => {
    setBusy(true);
    try {
      await postJson(`/api/trips/${trip.id}/leave`, 'POST');
      toast({ title: 'Saliste del viaje', description: `Ya no formás parte de "${trip.name}"` });
      setConfirmLeave(false);
      onLeft();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo salir del viaje',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const canRemove = (m: TripMember): boolean =>
    isAdmin && m.user_id !== currentUserId && m.user_id !== trip.created_by;

  return (
    <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
      <Card className='min-w-0'>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base'>Personas del viaje</CardTitle>
        </CardHeader>
        <CardContent className='space-y-2'>
          {members.map((m) => (
            <div key={m.id} className='flex items-center gap-3 rounded-lg border p-3 min-w-0'>
              <div className='h-8 w-8 shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-sm font-bold text-emerald-700 dark:text-emerald-300'>
                {m.display_name.charAt(0).toUpperCase()}
              </div>
              <div className='min-w-0 flex-1'>
                <p className='text-sm font-medium truncate'>
                  {m.display_name}
                  {m.user_id === currentUserId && <span className='text-muted-foreground'> (vos)</span>}
                </p>
                <p className='text-xs text-muted-foreground truncate'>
                  {m.user_id ? m.email || 'Con cuenta' : 'Invitado sin cuenta'}
                </p>
              </div>
              <div className='flex items-center gap-1 shrink-0'>
                {m.is_admin && (
                  <Crown className='h-4 w-4 text-amber-500' aria-label='Administrador' />
                )}
                {m.invite_status === 'pending' && (
                  <Badge variant='outline' className='text-amber-700 border-amber-300'>Pendiente</Badge>
                )}
                {m.invite_status === 'declined' && (
                  <Badge variant='outline' className='text-red-600 border-red-300'>Rechazó</Badge>
                )}
                {canRemove(m) && (
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8 text-red-600 hover:text-red-700'
                    aria-label={`Quitar a ${m.display_name}`}
                    onClick={() => setToRemove(m)}
                  >
                    <UserMinus className='h-4 w-4' />
                  </Button>
                )}
              </div>
            </div>
          ))}

          {!isCreator && (
            <Button
              variant='outline'
              className='w-full text-red-600 hover:text-red-700 mt-2'
              onClick={() => setConfirmLeave(true)}
            >
              <LogOut className='h-4 w-4 mr-2' />
              Salir del viaje
            </Button>
          )}
        </CardContent>
      </Card>

      <div className='grid grid-cols-1 gap-4 min-w-0 content-start'>
        <Card className='min-w-0'>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>Invitar por email</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className='space-y-3'>
              <p className='text-sm text-muted-foreground'>
                Para personas que ya tienen cuenta en la app. Les llega una notificación para aceptar.
              </p>
              <div className='flex flex-col sm:flex-row gap-2'>
                <Input
                  type='email'
                  value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null); }}
                  placeholder='email@ejemplo.com'
                  aria-label='Email de la persona a invitar'
                  className='min-w-0'
                />
                <Button
                  type='submit'
                  disabled={inviting || !inviteEmail.trim()}
                  className='bg-emerald-600 hover:bg-emerald-700 text-white shrink-0'
                >
                  {inviting ? (
                    <Loader2 className='h-4 w-4 mr-2 animate-spin' aria-hidden='true' />
                  ) : (
                    <Mail className='h-4 w-4 mr-2' />
                  )}
                  Invitar
                </Button>
              </div>
              {inviteError && <p className='text-sm text-red-600'>{inviteError}</p>}
            </form>
          </CardContent>
        </Card>

        <Card className='min-w-0'>
          <CardHeader className='pb-2'>
            <CardTitle className='text-base'>Agregar invitado sin cuenta</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddGuest} className='space-y-3'>
              <p className='text-sm text-muted-foreground'>
                Para personas que no usan la app. Los demás cargan los gastos por ellas.
              </p>
              <div className='flex flex-col sm:flex-row gap-2'>
                <Input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder='Nombre'
                  maxLength={60}
                  aria-label='Nombre del invitado'
                  className='min-w-0'
                />
                <Button
                  type='submit'
                  disabled={addingGuest || !guestName.trim()}
                  className='bg-emerald-600 hover:bg-emerald-700 text-white shrink-0'
                >
                  {addingGuest ? (
                    <Loader2 className='h-4 w-4 mr-2 animate-spin' aria-hidden='true' />
                  ) : (
                    <UserPlus className='h-4 w-4 mr-2' />
                  )}
                  Agregar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={toRemove !== null} onOpenChange={(open) => { if (!open) setToRemove(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quitar persona</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Querés quitar a {toRemove?.display_name} del viaje? Si tiene gastos registrados, se
              conservan como invitado sin cuenta para no alterar los saldos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className='bg-red-600 hover:bg-red-700 text-white'
              disabled={busy}
              onClick={(e) => { e.preventDefault(); handleRemove(); }}
            >
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Salir del viaje</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a dejar de ver &quot;{trip.name}&quot;. Si tenés gastos registrados, se conservan
              con tu nombre para que los saldos sigan siendo correctos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className='bg-red-600 hover:bg-red-700 text-white'
              disabled={busy}
              onClick={(e) => { e.preventDefault(); handleLeave(); }}
            >
              Salir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
