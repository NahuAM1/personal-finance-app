'use client';

import type { AddTransactionPayload } from '@/types/agent';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ConfirmTransactionProps {
  payload: AddTransactionPayload;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmTransaction({ payload, onConfirm, onCancel }: ConfirmTransactionProps) {
  const isIncome = payload.type === 'income';

  return (
    <Card className="border-2 border-emerald-200 dark:border-emerald-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          Confirmar {isIncome ? 'Ingreso' : 'Gasto'}
          <Badge variant={isIncome ? 'default' : 'destructive'} className={isIncome ? 'bg-emerald-500' : ''}>
            {isIncome ? 'Ingreso' : 'Gasto'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
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
        <Button size="sm" onClick={onConfirm} className="flex-1 bg-emerald-500 hover:bg-emerald-600">
          Confirmar
        </Button>
      </CardFooter>
    </Card>
  );
}
