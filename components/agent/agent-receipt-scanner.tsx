'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Upload, Loader2, ScanLine, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ScanResult {
  storeName: string;
  totalAmount: number;
  ticketDate: string;
  ticketId: string;
  notes: string | null;
  imagePreview: string;
}

interface AgentReceiptScannerProps {
  onComplete: (result: ScanResult) => void;
  onCancel: () => void;
}

const MAX_IMAGE_WIDTH = 1920;
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    if (file.size <= MAX_IMAGE_SIZE_BYTES && !file.type.includes('heic') && !file.type.includes('heif')) {
      resolve(file);
      return;
    }

    const img = document.createElement('img');
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > MAX_IMAGE_WIDTH) {
        height = Math.round((height * MAX_IMAGE_WIDTH) / width);
        width = MAX_IMAGE_WIDTH;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const compressedFile = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        },
        'image/jpeg',
        0.8,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo procesar la imagen'));
    };

    img.src = url;
  });
}

interface ScannedTicketResponse {
  ticket: {
    id: string;
    store_name: string;
    total_amount: number;
    ticket_date: string;
    notes: string | null;
  };
  items: { product_name: string; quantity: number; unit_price: number; total_price: number; category: string }[];
}

export function AgentReceiptScanner({ onComplete, onCancel }: AgentReceiptScannerProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|heic|heif|webp)$/i.test(file.name);
    if (!isImage) {
      toast({
        title: 'Error',
        description: 'Solo se permiten archivos de imagen',
        variant: 'destructive',
      });
      return;
    }

    try {
      const compressed = await compressImage(file);
      setSelectedFile(compressed);

      const reader = new FileReader();
      reader.onload = (ev) => {
        setPreview(ev.target?.result as string);
      };
      reader.readAsDataURL(compressed);
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo procesar la imagen. Intenta con otra foto.',
        variant: 'destructive',
      });
    }
  }, [toast]);

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
        let errorMessage = 'Error al escanear el ticket';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Response wasn't valid JSON
        }
        throw new Error(errorMessage);
      }

      let data: ScannedTicketResponse;
      try {
        data = await response.json();
      } catch {
        throw new Error('La respuesta del servidor no es valida. Intenta de nuevo.');
      }

      onComplete({
        storeName: data.ticket.store_name,
        totalAmount: data.ticket.total_amount,
        ticketDate: data.ticket.ticket_date,
        ticketId: data.ticket.id,
        notes: data.ticket.notes,
        imagePreview: preview!,
      });
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

  return (
    <div className="flex flex-col h-full p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-purple-600" aria-hidden="true" />
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Scanner de Tickets</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="rounded-full w-8 h-8"
          aria-label="Cerrar scanner"
          disabled={scanning}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

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
          className="flex-1 border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-xl p-6 text-center cursor-pointer hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
              <Camera className="h-6 w-6 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" aria-hidden="true" />
            </div>
            <div>
              <p className="font-medium text-sm text-gray-900 dark:text-white">
                Tomar foto o subir imagen
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                JPG, PNG - Maximo 10MB
              </p>
            </div>
            <span className="inline-flex items-center justify-center rounded-md text-xs font-medium border border-input bg-background h-8 px-3 mt-1 pointer-events-none">
              <Upload className="h-3 w-3 mr-1.5" aria-hidden="true" />
              Seleccionar archivo
            </span>
          </div>
        </button>
      ) : (
        <div className="flex-1 flex flex-col gap-3">
          <div className="flex-1 max-h-[40vh] rounded-xl overflow-hidden border border-purple-200 dark:border-purple-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Preview del ticket"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              disabled={scanning}
            >
              Cambiar
            </Button>
            <Button
              size="sm"
              onClick={handleScan}
              disabled={scanning}
              className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white"
            >
              {scanning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" aria-hidden="true" />
                  Escaneando...
                </>
              ) : (
                <>
                  <ScanLine className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                  Escanear con IA
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
