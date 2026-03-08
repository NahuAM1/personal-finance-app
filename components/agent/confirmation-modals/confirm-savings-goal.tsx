'use client';

import type { CreateSavingsGoalPayload } from '@/types/agent';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ConfirmSavingsGoalProps {
  payload: CreateSavingsGoalPayload;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmSavingsGoal({ payload, onConfirm, onCancel }: ConfirmSavingsGoalProps) {
  return (
    <Card className="border-2 border-emerald-200 dark:border-emerald-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Confirmar Meta de Ahorro</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Nombre:</span>
          <span className="font-semibold">{payload.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Objetivo:</span>
          <span className="font-semibold">${payload.targetAmount.toLocaleString('es-AR')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Fecha límite:</span>
          <span>{payload.deadline}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Categoría:</span>
          <span>{payload.category}</span>
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
