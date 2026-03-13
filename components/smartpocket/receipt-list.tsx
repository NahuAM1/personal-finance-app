'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Receipt, Trash2, Store, Calendar } from 'lucide-react';
import type { Ticket } from '@/types/database';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ReceiptListProps {
  tickets: Ticket[];
  onSelectTicket: (ticket: Ticket) => void;
  onDelete: (ticketId: string) => Promise<void>;
}

export function ReceiptList({ tickets, onSelectTicket, onDelete }: ReceiptListProps) {
  const [ticketToDelete, setTicketToDelete] = useState<string | null>(null);

  if (tickets.length === 0) {
    return (
      <Card className="border-purple-200 dark:border-purple-800">
        <CardContent className="py-12 text-center">
          <Receipt className="h-12 w-12 text-purple-300 dark:text-purple-700 mx-auto mb-4" aria-hidden="true" />
          <p className="text-gray-500 dark:text-gray-400">
            No hay tickets escaneados todavía. Sube tu primer ticket para comenzar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-purple-200 dark:border-purple-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-purple-600" aria-hidden="true" />
            Mis Tickets
          </CardTitle>
          <CardDescription>
            {tickets.length} ticket{tickets.length !== 1 ? 's' : ''} escaneado{tickets.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tickets.map((ticket) => (
              <div
                role="button"
                tabIndex={0}
                key={ticket.id}
                onClick={() => onSelectTicket(ticket)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectTicket(ticket); } }}
                className="w-full text-left flex items-center justify-between p-4 rounded-xl border border-purple-100 dark:border-purple-800 hover:bg-purple-50/50 dark:hover:bg-purple-900/20 cursor-pointer transition-colors group hover:shadow-md hover:shadow-purple-100/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Store className="h-4 w-4 text-purple-500 flex-shrink-0" aria-hidden="true" />
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {ticket.store_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <Calendar className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                    <span>
                      {format(new Date(ticket.ticket_date + 'T12:00:00'), 'dd MMM yyyy', { locale: es })}
                    </span>
                  </div>
                  <Badge variant="secondary" className="mt-2 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 tabular-nums">
                    ${ticket.total_amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Eliminar ticket de ${ticket.store_name}`}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTicketToDelete(ticket.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={ticketToDelete !== null} onOpenChange={(open) => { if (!open) setTicketToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar ticket</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el ticket y todos sus items asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (ticketToDelete) {
                  await onDelete(ticketToDelete);
                  setTicketToDelete(null);
                }
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
