'use client';

import type { CreditPurchasePayload } from '@/types/agent';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ConfirmCreditPurchaseProps {
  payload: CreditPurchasePayload;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmCreditPurchase({ payload, onConfirm, onCancel }: ConfirmCreditPurchaseProps) {
  const monthlyAmount = Math.ceil((payload.totalAmount / payload.installments) * 100) / 100;

  return (
    <Card className="border-2 border-purple-200 dark:border-purple-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Confirmar Compra en Cuotas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Descripción:</span>
          <span className="font-semibold">{payload.description}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Categoría:</span>
          <span>{payload.category}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Total:</span>
          <span className="font-semibold">${payload.totalAmount.toLocaleString('es-AR')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Cuotas:</span>
          <span>{payload.installments} cuotas de ${monthlyAmount.toLocaleString('es-AR')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Inicio:</span>
          <span>{payload.startDate}</span>
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
