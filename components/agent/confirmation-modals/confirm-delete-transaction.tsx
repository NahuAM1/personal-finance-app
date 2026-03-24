'use client';

import type { DeleteTransactionPayload } from '@/types/agent';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ConfirmDeleteTransactionProps {
  payload: DeleteTransactionPayload;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDeleteTransaction({ payload, onConfirm, onCancel }: ConfirmDeleteTransactionProps) {
  const sign = payload.transactionType === 'income' ? '+' : '-';
  const amountColor = payload.transactionType === 'income'
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <Card className="border-2 border-red-200 dark:border-red-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-red-600 dark:text-red-400">Eliminar Transacción</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Descripción:</span>
          <span className="font-semibold">{payload.description}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Monto:</span>
          <span className={`font-semibold ${amountColor}`}>
            {sign}${Math.abs(payload.amount).toLocaleString('es-AR')}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Categoría:</span>
          <span>{payload.category}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Fecha:</span>
          <span>{payload.date}</span>
        </div>
        <p className="text-xs text-red-500 dark:text-red-400 mt-1">
          Esta acción no se puede deshacer.
        </p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={onConfirm}
          className="flex-1 bg-red-500 hover:bg-red-600 text-white"
        >
          Eliminar
        </Button>
      </CardFooter>
    </Card>
  );
}
