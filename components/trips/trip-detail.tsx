'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRightLeft,
  CalendarDays,
  MapPin,
  Pencil,
  PieChart,
  Receipt,
  Trash2,
  Users,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
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
import { InlineSpinner } from './inline-spinner';
import type { Trip, TripMember } from '@/types/database';
import {
  calculateBalances,
  calculateSettlements,
  summarizeTrip,
  type TripExpenseWithShares,
} from '@/lib/trips';
import * as tripsApi from '@/lib/trips-api';
import { useToast } from '@/hooks/use-toast';
import { TripForm, type TripFormValues } from './trip-form';
import { TripSummary } from './trip-summary';
import { TripExpenses } from './trip-expenses';
import { TripMembers } from './trip-members';
import { TripSettlements } from './trip-settlements';
import { formatTripDates } from './trips-list';

interface TripDetailProps {
  trip: Trip;
  currentUserId: string;
  onBack: () => void;
  onTripChanged: () => void;
  onTransactionsChanged?: () => void;
}

export function TripDetail({
  trip,
  currentUserId,
  onBack,
  onTripChanged,
  onTransactionsChanged,
}: TripDetailProps): React.JSX.Element {
  const { toast } = useToast();
  const [members, setMembers] = useState<TripMember[]>([]);
  const [expenses, setExpenses] = useState<TripExpenseWithShares[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async (): Promise<void> => {
    try {
      const [membersData, expensesData] = await Promise.all([
        tripsApi.getTripMembers(trip.id),
        tripsApi.getTripExpenses(trip.id),
      ]);
      setMembers(membersData);
      setExpenses(expensesData);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los datos del viaje', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [trip.id, toast]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const currentMember = useMemo(
    () => members.find((m) => m.user_id === currentUserId) ?? null,
    [members, currentUserId]
  );
  const isCreator = trip.created_by === currentUserId;
  const isAdmin = isCreator || Boolean(currentMember?.is_admin);

  const activeMembers = useMemo(
    () => members.filter((m) => m.invite_status === 'accepted'),
    [members]
  );
  const summary = useMemo(
    () => summarizeTrip(trip.budget, activeMembers, expenses),
    [trip.budget, activeMembers, expenses]
  );
  const balances = useMemo(() => calculateBalances(activeMembers, expenses), [activeMembers, expenses]);
  const settlements = useMemo(
    () => calculateSettlements(members, expenses),
    [members, expenses]
  );

  const handleExpensesChanged = (): void => {
    loadData();
    onTripChanged();
    onTransactionsChanged?.();
  };

  const handleEdit = async (values: TripFormValues): Promise<void> => {
    await tripsApi.updateTrip(trip.id, values);
    toast({ title: 'Viaje actualizado' });
    setEditOpen(false);
    onTripChanged();
  };

  const handleDelete = async (): Promise<void> => {
    setDeleting(true);
    try {
      await tripsApi.deleteTrip(trip.id);
      toast({ title: 'Viaje eliminado', description: `"${trip.name}" fue eliminado` });
      onTripChanged();
      onBack();
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar el viaje', variant: 'destructive' });
      setDeleting(false);
    }
  };

  const dates = formatTripDates(trip.start_date, trip.end_date);

  return (
    <div className='space-y-4'>
      <div className='flex flex-col sm:flex-row sm:items-start gap-3'>
        <div className='flex items-start gap-2 min-w-0 flex-1'>
          <Button variant='ghost' size='icon' onClick={onBack} aria-label='Volver a viajes' className='shrink-0'>
            <ArrowLeft className='h-5 w-5' />
          </Button>
          <div className='min-w-0'>
            <h2 className='text-xl font-bold truncate'>{trip.name}</h2>
            <div className='flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground'>
              {trip.destination && (
                <span className='flex items-center gap-1 min-w-0'>
                  <MapPin className='h-3.5 w-3.5 shrink-0' aria-hidden='true' />
                  <span className='truncate'>{trip.destination}</span>
                </span>
              )}
              {dates && (
                <span className='flex items-center gap-1'>
                  <CalendarDays className='h-3.5 w-3.5 shrink-0' aria-hidden='true' />
                  {dates}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className='flex gap-2 sm:shrink-0'>
          {isAdmin && (
            <Button variant='outline' size='sm' onClick={() => setEditOpen(true)}>
              <Pencil className='h-4 w-4 mr-2' />
              Editar
            </Button>
          )}
          {isCreator && (
            <Button
              variant='outline'
              size='sm'
              className='text-red-600 hover:text-red-700'
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className='h-4 w-4 mr-2' />
              Eliminar
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <InlineSpinner />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className='space-y-4'>
          <TabsList className='grid w-full grid-cols-4 h-auto'>
            <TabsTrigger value='summary' className='flex items-center gap-1.5 px-1'>
              <PieChart className='h-4 w-4 hidden sm:block' />
              <span className='text-xs sm:text-sm'>Resumen</span>
            </TabsTrigger>
            <TabsTrigger value='expenses' className='flex items-center gap-1.5 px-1'>
              <Receipt className='h-4 w-4 hidden sm:block' />
              <span className='text-xs sm:text-sm'>Gastos</span>
            </TabsTrigger>
            <TabsTrigger value='members' className='flex items-center gap-1.5 px-1'>
              <Users className='h-4 w-4 hidden sm:block' />
              <span className='text-xs sm:text-sm'>Personas</span>
            </TabsTrigger>
            <TabsTrigger value='balances' className='flex items-center gap-1.5 px-1'>
              <ArrowRightLeft className='h-4 w-4 hidden sm:block' />
              <span className='text-xs sm:text-sm'>Saldos</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value='summary'>
            <TripSummary trip={trip} summary={summary} />
          </TabsContent>

          <TabsContent value='expenses'>
            <TripExpenses
              trip={trip}
              members={members}
              expenses={expenses}
              currentMember={currentMember}
              currentUserId={currentUserId}
              onChanged={handleExpensesChanged}
            />
          </TabsContent>

          <TabsContent value='members'>
            <TripMembers
              trip={trip}
              members={members}
              currentUserId={currentUserId}
              onChanged={loadData}
            />
          </TabsContent>

          <TabsContent value='balances'>
            <TripSettlements
              trip={trip}
              members={members}
              expenses={expenses}
              settlements={settlements}
              balances={balances}
              currentUserId={currentUserId}
              onSettled={handleExpensesChanged}
            />
          </TabsContent>
        </Tabs>
      )}

      {editOpen && (
        <TripForm open={editOpen} trip={trip} onClose={() => setEditOpen(false)} onSubmit={handleEdit} />
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar viaje</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán &quot;{trip.name}&quot;, sus gastos y saldos para todas las personas. Los
              gastos ya registrados en tus transacciones personales se mantienen. Esta acción no se
              puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className='bg-red-600 hover:bg-red-700 text-white'
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
