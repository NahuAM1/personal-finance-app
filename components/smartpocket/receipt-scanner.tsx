'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Camera, Upload, Loader2, ScanLine, ShoppingCart, Store, CalendarDays, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { addTransaction } from '@/lib/database-api';
import { expenseCategories } from '@/public/constants';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Image from 'next/image';

interface ScannedTicket {
  id: string;
  store_name: string;
  total_amount: number;
  ticket_date: string;
  notes: string | null;
}

interface ReceiptScannerProps {
  onScanComplete: () => void;
}

export function ReceiptScanner({ onScanComplete }: ReceiptScannerProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [pendingTicket, setPendingTicket] = useState<ScannedTicket | null>(null);
  const [expenseCategory, setExpenseCategory] = useState('Compras');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [savingExpense, setSavingExpense] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Error',
        description: 'Solo se permiten archivos de imagen',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleScan = async () => {
    if (!selectedFile) return;

    setScanning(true);
    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      const response = await fetch('/api/smartpocket/scan-receipt', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al escanear el ticket');
      }

      const data = await response.json();

      toast({
        title: 'Ticket escaneado',
        description: 'Los items fueron extraídos correctamente',
      });

      setSelectedFile(null);
      setPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      setPendingTicket(data.ticket);
      setExpenseCategory('Compras');
      setExpenseDescription(
        data.ticket.notes
          ? `${data.ticket.store_name}: ${data.ticket.notes}`
          : `Compra en ${data.ticket.store_name}`
      );
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo escanear el ticket',
        variant: 'destructive',
      });
    } finally {
      setScanning(false);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRegisterExpense = async () => {
    if (!pendingTicket || !user) return;

    setSavingExpense(true);
    try {
      await addTransaction({
        user_id: user.id,
        type: 'expense',
        amount: pendingTicket.total_amount,
        category: expenseCategory,
        description: expenseDescription,
        date: pendingTicket.ticket_date,
        is_recurring: null,
        installments: null,
        current_installment: null,
        paid: null,
        parent_transaction_id: null,
        due_date: null,
        balance_total: null,
        ticket_id: pendingTicket.id,
      });

      toast({
        title: 'Gasto registrado',
        description: `Se registró un gasto de $${pendingTicket.total_amount.toLocaleString()} en ${pendingTicket.store_name}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo registrar el gasto',
        variant: 'destructive',
      });
    } finally {
      setSavingExpense(false);
      setPendingTicket(null);
      onScanComplete();
    }
  };

  const handleSkipExpense = () => {
    setPendingTicket(null);
    onScanComplete();
  };

  return (
    <>
    <Card className="border-purple-200 dark:border-purple-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-purple-600" aria-hidden="true" />
          Scanner de Tickets
        </CardTitle>
        <CardDescription>
          Sube una foto de tu ticket y la IA extraerá los productos automáticamente
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {!preview ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full text-left border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-xl p-8 text-center cursor-pointer hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                  <Camera className="h-7 w-7 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Tomar foto o subir imagen
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    JPG, PNG - Máximo 10MB
                  </p>
                </div>
                <span className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background h-9 px-3 mt-2 pointer-events-none">
                  <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
                  Seleccionar archivo
                </span>
              </div>
            </button>
          ) : (
            <div className="space-y-4">
              <div className="relative w-full max-w-sm mx-auto aspect-[3/4] rounded-xl overflow-hidden border border-purple-200 dark:border-purple-800">
                <Image
                  src={preview}
                  alt="Preview del ticket"
                  fill
                  className="object-contain"
                />
              </div>
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={handleClear}
                  disabled={scanning}
                >
                  Cambiar imagen
                </Button>
                <Button
                  onClick={handleScan}
                  disabled={scanning}
                  className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white"
                >
                  {scanning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                      Escaneando...
                    </>
                  ) : (
                    <>
                      <ScanLine className="h-4 w-4 mr-2" aria-hidden="true" />
                      Escanear con IA
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>

    <Dialog open={!!pendingTicket} onOpenChange={(open) => { if (!open) handleSkipExpense(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-purple-600" />
            Registrar como gasto
          </DialogTitle>
          <DialogDescription>
            ¿Querés registrar esta compra como un gasto en tu billetera personal?
          </DialogDescription>
        </DialogHeader>

        {pendingTicket && (
          <div className="space-y-4">
            <div className="rounded-lg bg-purple-50 dark:bg-purple-950/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Store className="h-4 w-4 text-purple-600" />
                <span className="text-gray-500 dark:text-gray-400">Tienda:</span>
                <span className="font-medium">{pendingTicket.store_name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CalendarDays className="h-4 w-4 text-purple-600" />
                <span className="text-gray-500 dark:text-gray-400">Fecha:</span>
                <span className="font-medium">
                  {format(new Date(pendingTicket.ticket_date + 'T12:00:00'), 'dd MMMM yyyy', { locale: es })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-purple-600" />
                <span className="text-gray-500 dark:text-gray-400">Monto:</span>
                <span className="font-semibold text-lg">${pendingTicket.total_amount.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Descripción</label>
              <Input
                value={expenseDescription}
                onChange={(e) => setExpenseDescription(e.target.value)}
                placeholder="Descripción del gasto"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Categoría del gasto</label>
              <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleSkipExpense} disabled={savingExpense}>
            Solo guardar ticket
          </Button>
          <Button
            onClick={handleRegisterExpense}
            disabled={savingExpense}
            className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white"
          >
            {savingExpense ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Registrando...
              </>
            ) : (
              'Registrar como gasto'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
