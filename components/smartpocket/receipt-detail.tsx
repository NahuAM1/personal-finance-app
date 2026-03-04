'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Trash2, Pencil, Save, X, Store, Calendar, Loader2, ZoomIn } from 'lucide-react';
import type { Ticket, TicketItem } from '@/types/database';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as smartpocketApi from '@/lib/smartpocket-api';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

interface ReceiptDetailProps {
  ticket: Ticket;
  onBack: () => void;
  onDelete: (ticketId: string) => Promise<void>;
  onUpdate: () => void;
}

export function ReceiptDetail({ ticket, onBack, onDelete, onUpdate }: ReceiptDetailProps) {
  const [items, setItems] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<TicketItem>>({});
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [ticketToDelete, setTicketToDelete] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [itemsData, signedUrl] = await Promise.all([
          smartpocketApi.getTicketItems(ticket.id),
          smartpocketApi.getReceiptSignedUrl(ticket.image_path),
        ]);
        setItems(itemsData || []);
        setImageUrl(signedUrl);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los detalles del ticket',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [ticket.id, ticket.image_path, toast]);

  const startEditing = (item: TicketItem) => {
    setEditingItemId(item.id);
    setEditValues({
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      category: item.category,
    });
  };

  const cancelEditing = () => {
    setEditingItemId(null);
    setEditValues({});
  };

  const saveItem = async (itemId: string) => {
    try {
      const updatedItem = await smartpocketApi.updateTicketItem(itemId, editValues);
      setItems((prev) => prev.map((i) => (i.id === itemId ? updatedItem : i)));
      setEditingItemId(null);
      setEditValues({});
      toast({
        title: 'Actualizado',
        description: 'Item actualizado correctamente',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el item',
        variant: 'destructive',
      });
    }
  };

  const deleteItem = async (itemId: string) => {
    try {
      await smartpocketApi.deleteTicketItem(itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      toast({
        title: 'Eliminado',
        description: 'Item eliminado correctamente',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el item',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4 max-w-full overflow-hidden">
      <Button variant="ghost" onClick={onBack} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
        Volver a la lista
      </Button>

      <div className="grid gap-4 md:grid-cols-2 min-w-0">
        {/* Ticket image */}
        <Card className="border-purple-200 dark:border-purple-800 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg">Imagen del Ticket</CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            {imageUrl ? (
              <Dialog>
                <DialogTrigger asChild>
                  <div className="relative max-h-[200px] overflow-hidden rounded-lg border border-purple-100 dark:border-purple-800 cursor-pointer group">
                    <Image
                      src={imageUrl}
                      alt={`Ticket de ${ticket.store_name}`}
                      width={400}
                      height={800}
                      className="w-full max-w-full h-auto object-contain"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <div className="bg-white/90 dark:bg-gray-800/90 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                        <ZoomIn className="h-5 w-5 text-purple-600" aria-hidden="true" />
                      </div>
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent p-2 text-center">
                      <span className="text-white text-xs font-medium">Toca para ampliar</span>
                    </div>
                  </div>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] max-h-[90vh] p-2 sm:p-4 border-purple-200 dark:border-purple-800 bg-white dark:bg-gray-900">
                  <DialogHeader>
                    <DialogTitle className="text-sm text-purple-700 dark:text-purple-300">
                      Ticket de {ticket.store_name}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="overflow-auto max-h-[80vh] rounded-lg">
                    <Image
                      src={imageUrl}
                      alt={`Ticket de ${ticket.store_name}`}
                      width={800}
                      height={1600}
                      className="w-full h-auto object-contain"
                    />
                  </div>
                </DialogContent>
              </Dialog>
            ) : (
              <div className="flex items-center justify-center h-64 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <p className="text-gray-500">Cargando imagen\u2026</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ticket details */}
        <div className="space-y-4 min-w-0">
          <Card className="border-purple-200 dark:border-purple-800 overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Store className="h-5 w-5 text-purple-600" aria-hidden="true" />
                  {ticket.store_name}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Eliminar ticket"
                  className="text-red-500 hover:text-red-700"
                  onClick={() => setTicketToDelete(true)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  {format(new Date(ticket.ticket_date + 'T12:00:00'), "dd 'de' MMMM, yyyy", { locale: es })}
                </div>
                <Badge className="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 border-0 tabular-nums">
                  Total: ${ticket.total_amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Items table */}
          <Card className="border-purple-200 dark:border-purple-800 overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg">
                Items ({items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-600" aria-hidden="true" />
                </div>
              ) : items.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No se encontraron items</p>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-purple-100 dark:border-purple-800 hover:bg-purple-50/50 dark:hover:bg-purple-900/10"
                    >
                      {editingItemId === item.id ? (
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <Input
                            value={editValues.product_name || ''}
                            onChange={(e) => setEditValues({ ...editValues, product_name: e.target.value })}
                            placeholder="Producto\u2026"
                            aria-label="Nombre del producto"
                            className="col-span-2 hover:border-purple-300 focus-visible:border-purple-500 focus-visible:ring-purple-500/20"
                          />
                          <Input
                            type="number"
                            value={editValues.quantity || 0}
                            onChange={(e) => setEditValues({ ...editValues, quantity: parseFloat(e.target.value) })}
                            placeholder="Cantidad"
                            aria-label="Cantidad"
                            className="hover:border-purple-300 focus-visible:border-purple-500 focus-visible:ring-purple-500/20"
                          />
                          <Input
                            type="number"
                            value={editValues.unit_price || 0}
                            onChange={(e) => setEditValues({ ...editValues, unit_price: parseFloat(e.target.value), total_price: parseFloat(e.target.value) * (editValues.quantity || 1) })}
                            placeholder="Precio unitario"
                            aria-label="Precio unitario"
                            className="hover:border-purple-300 focus-visible:border-purple-500 focus-visible:ring-purple-500/20"
                          />
                          <div className="col-span-2 flex gap-2">
                            <Button size="sm" onClick={() => saveItem(item.id)} className="bg-purple-600 hover:bg-purple-700 text-white">
                              <Save className="h-3 w-3 mr-1" aria-hidden="true" />
                              Guardar
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEditing}>
                              <X className="h-3 w-3 mr-1" aria-hidden="true" />
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                              {item.product_name}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-gray-500 tabular-nums">
                              <span>{item.quantity} x ${item.unit_price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                              {item.category && (
                                <Badge variant="outline" className="text-xs py-0 px-1.5">
                                  {item.category}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <span className="font-semibold text-sm text-purple-700 dark:text-purple-300 tabular-nums">
                            ${item.total_price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </span>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => startEditing(item)} className="h-7 w-7 p-0" aria-label={`Editar ${item.product_name}`}>
                              <Pencil className="h-3 w-3" aria-hidden="true" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setItemToDelete(item.id)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700" aria-label={`Eliminar ${item.product_name}`}>
                              <Trash2 className="h-3 w-3" aria-hidden="true" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete ticket confirmation */}
      <AlertDialog open={ticketToDelete} onOpenChange={setTicketToDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar ticket</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el ticket de {ticket.store_name}, todos sus items asociados y el gasto registrado en tu billetera (si existe).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onDelete(ticket.id)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete item confirmation */}
      <AlertDialog open={itemToDelete !== null} onOpenChange={(open) => { if (!open) setItemToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar item</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará este item del ticket.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (itemToDelete) {
                  await deleteItem(itemToDelete);
                  setItemToDelete(null);
                }
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
