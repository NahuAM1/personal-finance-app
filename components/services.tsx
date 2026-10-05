'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  PlusCircle,
  Zap,
  Hand,
  CheckCircle2,
  Clock,
  Trash2,
  Pencil,
  Receipt,
  Calendar,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useServices } from '@/hooks/use-services';
import { ServiceForm } from '@/components/service-form';
import type { Service } from '@/types/database';
import { sortByPaymentPriority, type ServiceWithStatus } from '@/lib/services';
import type { Database } from '@/types/database';
import { cn } from '@/lib/utils';

type ServiceInsert = Database['public']['Tables']['services']['Insert'];

// ---- Pay confirm dialog ----

interface PayDialogProps {
  item: ServiceWithStatus;
  open: boolean;
  onClose: () => void;
  onPay: (service: Service, amount: number) => Promise<void>;
}

function PayDialog({ item, open, onClose, onPay }: PayDialogProps): React.JSX.Element {
  const [amount, setAmount] = useState<string>(item.service.amount.toString());
  const [paying, setPaying] = useState(false);

  const handlePay = async (): Promise<void> => {
    const parsed = Number.parseFloat(amount);
    if (Number.isNaN(parsed) || parsed <= 0) return;
    setPaying(true);
    try {
      await onPay(item.service, parsed);
      onClose();
    } finally {
      setPaying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pago — {item.service.name}</DialogTitle>
          <DialogDescription>
            Confirmá el monto a pagar. Podés editarlo si el importe real difiere del esperado.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4 pt-2'>
          <div className='space-y-2'>
            <label htmlFor='pay-amount' className='text-sm font-medium'>
              Monto
            </label>
            <Input
              id='pay-amount'
              type='number'
              inputMode='decimal'
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={0.01}
              step='0.01'
              autoComplete='off'
              className='tabular-nums'
              autoFocus
            />
          </div>
          <div className='flex gap-3'>
            <Button
              className='flex-1'
              onClick={handlePay}
              disabled={paying || Number.parseFloat(amount) <= 0}
            >
              Confirmar pago
            </Button>
            <Button variant='ghost' onClick={onClose} disabled={paying}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---- Service card ----

interface ServiceCardProps {
  item: ServiceWithStatus;
  onPay: (service: Service, amount: number) => Promise<void>;
  onEdit: (service: Service) => void;
  onDelete: (id: string) => Promise<void>;
}

function ServiceCard({ item, onPay, onEdit, onDelete }: ServiceCardProps): React.JSX.Element {
  const [payOpen, setPayOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { service, status, dueDate } = item;
  const isManual = service.mode === 'manual';
  const isPending = status === 'pending';
  const isInactive = !service.is_active;

  const formattedDueDate = format(parseISO(dueDate), "d 'de' MMM", { locale: es });

  const handleDelete = async (): Promise<void> => {
    setDeleting(true);
    try {
      await onDelete(service.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card
        className={cn(
          'min-w-0 hover:shadow-lg transition-all duration-300',
          isInactive && 'opacity-60'
        )}
      >
        <CardHeader className='pb-3'>
          <div className='flex items-start justify-between gap-2'>
            <div className='flex items-center gap-3 min-w-0'>
              <div className='p-2 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 rounded-xl shrink-0'>
                <Receipt className='h-5 w-5 text-blue-600 dark:text-blue-400' aria-hidden='true' />
              </div>
              <div className='min-w-0'>
                <CardTitle className='text-base truncate'>{service.name}</CardTitle>
                <div className='flex items-center gap-1.5 mt-0.5'>
                  {isManual ? (
                    <Hand className='h-3 w-3 text-gray-400' aria-hidden='true' />
                  ) : (
                    <Zap className='h-3 w-3 text-amber-500' aria-hidden='true' />
                  )}
                  <span className='text-xs text-gray-500 dark:text-gray-400'>
                    {isManual ? 'Manual' : 'Automático'}
                  </span>
                </div>
              </div>
            </div>
            <div className='flex items-center gap-1 shrink-0'>
              {isInactive ? (
                <Badge variant='secondary'>Inactivo</Badge>
              ) : isPending ? (
                <Badge variant='secondary' className='flex items-center gap-1'>
                  <Clock className='h-3 w-3' aria-hidden='true' />
                  Pendiente
                </Badge>
              ) : (
                <Badge className='flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600'>
                  <CheckCircle2 className='h-3 w-3' aria-hidden='true' />
                  Pagado
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className='space-y-3'>
          <div className='flex items-center justify-between'>
            <span className='text-sm text-gray-500 dark:text-gray-400'>Monto</span>
            <span className='text-lg font-semibold tabular-nums'>
              ${service.amount.toLocaleString('es-AR')}
            </span>
          </div>

          <div className='flex items-center justify-between gap-2 text-sm'>
            <span className='text-gray-500 dark:text-gray-400 flex items-center gap-1 shrink-0'>
              <Calendar className='h-3.5 w-3.5' aria-hidden='true' />
              Vence
            </span>
            <span className='font-medium text-right'>
              Día {service.due_day} ({formattedDueDate})
            </span>
          </div>

          {service.notes && (
            <p className='text-xs text-gray-500 dark:text-gray-400 italic truncate'>
              {service.notes}
            </p>
          )}

          <div className='flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800'>
            {isManual && isPending && !isInactive && (
              <Button
                size='sm'
                className='flex-1'
                onClick={() => setPayOpen(true)}
              >
                Pagar
              </Button>
            )}
            <Button
              variant='ghost'
              size='sm'
              className='px-2'
              onClick={() => onEdit(service)}
              aria-label={`Editar ${service.name}`}
            >
              <Pencil className='h-4 w-4' aria-hidden='true' />
            </Button>
            <Button
              variant='ghost'
              size='sm'
              className='px-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30'
              onClick={handleDelete}
              disabled={deleting}
              aria-label={`Eliminar ${service.name}`}
            >
              <Trash2 className='h-4 w-4' aria-hidden='true' />
            </Button>
          </div>
        </CardContent>
      </Card>

      {payOpen && (
        <PayDialog
          item={item}
          open={payOpen}
          onClose={() => setPayOpen(false)}
          onPay={onPay}
        />
      )}
    </>
  );
}

// ---- Main component ----

export function Services(): React.JSX.Element {
  const {
    servicesWithStatus,
    loading,
    createService,
    updateService,
    deleteService,
    payService,
  } = useServices();

  const [formOpen, setFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const activeItems = sortByPaymentPriority(
    servicesWithStatus.filter((i) => i.service.is_active)
  );
  const inactiveItems = sortByPaymentPriority(
    servicesWithStatus.filter((i) => !i.service.is_active)
  );

  const paidCount = activeItems.filter((i) => i.status === 'paid').length;
  const pendingCount = activeItems.filter((i) => i.status === 'pending').length;
  const totalMonthly = activeItems.reduce((sum, i) => sum + i.service.amount, 0);

  const upcomingItems = activeItems.filter((i) => i.status === 'pending');

  const openCreate = (): void => {
    setEditingService(null);
    setFormOpen(true);
  };

  const openEdit = (service: Service): void => {
    setEditingService(service);
    setFormOpen(true);
  };

  const closeForm = (): void => {
    setFormOpen(false);
    setEditingService(null);
  };

  const handleFormSubmit = async (data: Omit<ServiceInsert, 'user_id'>): Promise<void> => {
    if (editingService) {
      await updateService(editingService.id, data);
    } else {
      await createService(data);
    }
    closeForm();
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center py-16'>
        <div className='text-gray-500 dark:text-gray-400'>Cargando servicios...</div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center'>
        <div className='min-w-0'>
          <h2 className='text-2xl font-bold'>Servicios</h2>
          <p className='text-gray-600 dark:text-gray-400'>
            Gestioná tus servicios y suscripciones recurrentes
          </p>
        </div>
        <Button onClick={openCreate} className='w-full sm:w-auto'>
          <PlusCircle className='h-4 w-4 mr-2' aria-hidden='true' />
          Nuevo Servicio
        </Button>
      </div>

      {/* Summary card */}
      {activeItems.length > 0 && (
        <Card className='bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <div className='p-2 bg-blue-100 dark:bg-blue-900 rounded-lg'>
                <Receipt className='h-5 w-5 text-blue-600 dark:text-blue-400' aria-hidden='true' />
              </div>
              Resumen del mes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4'>
              <div className='col-span-2 md:col-span-1 min-w-0 text-center p-3 md:p-4 bg-white/50 dark:bg-gray-900/50 rounded-xl'>
                <div className='text-xl md:text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums break-words'>
                  ${totalMonthly.toLocaleString('es-AR')}
                </div>
                <div className='text-sm text-gray-600 dark:text-gray-400'>Total mensual</div>
              </div>
              <div className='min-w-0 text-center p-3 md:p-4 bg-white/50 dark:bg-gray-900/50 rounded-xl'>
                <div className='text-xl md:text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums'>
                  {paidCount}
                </div>
                <div className='text-xs md:text-sm text-gray-600 dark:text-gray-400'>Pagados este mes</div>
              </div>
              <div className='min-w-0 text-center p-3 md:p-4 bg-white/50 dark:bg-gray-900/50 rounded-xl'>
                <div className='text-xl md:text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums'>
                  {pendingCount}
                </div>
                <div className='text-xs md:text-sm text-gray-600 dark:text-gray-400'>Pendientes</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service grid */}
      {servicesWithStatus.length === 0 ? (
        <Card>
          <CardContent className='text-center py-12'>
            <Receipt className='h-16 w-16 text-gray-400 mx-auto mb-4' aria-hidden='true' />
            <h3 className='text-xl font-medium text-gray-900 dark:text-gray-100 mb-2'>
              No tenés servicios registrados
            </h3>
            <p className='text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto'>
              Agregá tus servicios recurrentes como internet, luz, gas o suscripciones
              para llevar el control de tus pagos mensuales
            </p>
            <Button size='lg' onClick={openCreate}>
              <PlusCircle className='h-5 w-5 mr-2' aria-hidden='true' />
              Crear primer servicio
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {activeItems.length > 0 && (
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3'>
              {activeItems.map((item) => (
                <ServiceCard
                  key={item.service.id}
                  item={item}
                  onPay={payService}
                  onEdit={openEdit}
                  onDelete={deleteService}
                />
              ))}
            </div>
          )}

          {/* Inactive services */}
          {inactiveItems.length > 0 && (
            <div className='space-y-3'>
              <h3 className='text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide'>
                Servicios inactivos
              </h3>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3'>
                {inactiveItems.map((item) => (
                  <ServiceCard
                    key={item.service.id}
                    item={item}
                    onPay={payService}
                    onEdit={openEdit}
                    onDelete={deleteService}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Upcoming due dates */}
      {upcomingItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Calendar className='h-4 w-4 text-amber-500' aria-hidden='true' />
              Próximos vencimientos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className='divide-y divide-gray-100 dark:divide-gray-800'>
              {upcomingItems.map((item) => (
                <li
                  key={item.service.id}
                  className='flex items-center justify-between gap-3 py-2.5'
                >
                  <div className='flex items-center gap-2 min-w-0'>
                    {item.service.mode === 'automatic' ? (
                      <Zap className='h-3.5 w-3.5 shrink-0 text-amber-500' aria-hidden='true' />
                    ) : (
                      <Hand className='h-3.5 w-3.5 shrink-0 text-gray-400' aria-hidden='true' />
                    )}
                    <span className='text-sm font-medium truncate'>{item.service.name}</span>
                  </div>
                  <div className='flex items-center gap-3 shrink-0'>
                    <span className='text-sm tabular-nums text-gray-600 dark:text-gray-400'>
                      ${item.service.amount.toLocaleString('es-AR')}
                    </span>
                    <span className='text-xs text-amber-600 dark:text-amber-400 font-medium'>
                      {format(parseISO(item.dueDate), "d MMM", { locale: es })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={(v) => { if (!v) closeForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingService ? 'Editar servicio' : 'Nuevo servicio'}
            </DialogTitle>
            <DialogDescription>
              {editingService
                ? 'Modificá los datos del servicio.'
                : 'Registrá un servicio recurrente para controlar tus pagos mensuales.'}
            </DialogDescription>
          </DialogHeader>
          <ServiceForm
            initialData={editingService ?? undefined}
            onSubmit={handleFormSubmit}
            onCancel={closeForm}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
