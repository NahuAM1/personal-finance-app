'use client';

import type { AddTransactionPayload } from '@/types/agent';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ConfirmTransactionProps {
  payload: AddTransactionPayload;
  imagePreview?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmTransaction({ payload, imagePreview, onConfirm, onCancel }: ConfirmTransactionProps) {
  const isIncome = payload.type === 'income';

  return (
    <Card className="border-2 border-purple-200 dark:border-purple-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          Confirmar {isIncome ? 'Ingreso' : 'Gasto'}
          <Badge variant={isIncome ? 'default' : 'destructive'} className={isIncome ? 'bg-purple-500' : ''}>
            {isIncome ? 'Ingreso' : 'Gasto'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {imagePreview && (
          <div className="w-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreview}
              alt="Ticket escaneado"
              className="w-full max-h-32 object-contain"
            />
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500">Monto:</span>
          <span className="font-semibold">${payload.amount.toLocaleString('es-AR')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Categoría:</span>
          <span>{payload.category}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Descripción:</span>
          <span>{payload.description}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Fecha:</span>
          <span>{payload.date}</span>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button size="sm" onClick={onConfirm} className="flex-1 bg-purple-500 hover:bg-purple-600">
          Confirmar
        </Button>
      </CardFooter>
    </Card>
  );
}
