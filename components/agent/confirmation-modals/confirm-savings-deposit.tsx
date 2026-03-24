'use client';

import type { SavingsDepositPayload } from '@/types/agent';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ConfirmSavingsDepositProps {
  payload: SavingsDepositPayload;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmSavingsDeposit({ payload, onConfirm, onCancel }: ConfirmSavingsDepositProps) {
  const progress = Math.min(100, payload.progressPercent);

  return (
    <Card className="border-2 border-green-200 dark:border-green-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Depositar en Meta de Ahorro</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Meta:</span>
          <span className="font-semibold">{payload.goalName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Depósito:</span>
          <span className="font-semibold text-green-600 dark:text-green-400">
            +${payload.depositAmount.toLocaleString('es-AR')}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Nuevo total:</span>
          <span className="font-semibold">${payload.newTotal.toLocaleString('es-AR')}</span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Progreso</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button size="sm" onClick={onConfirm} className="flex-1 bg-green-500 hover:bg-green-600 text-white">
          Confirmar
        </Button>
      </CardFooter>
    </Card>
  );
}
