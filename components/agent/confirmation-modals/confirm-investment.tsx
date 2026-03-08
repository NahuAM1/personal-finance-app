'use client';

import type { CreateInvestmentPayload } from '@/types/agent';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ConfirmInvestmentProps {
  payload: CreateInvestmentPayload;
  onConfirm: () => void;
  onCancel: () => void;
}

const INVESTMENT_TYPE_LABELS: Record<string, string> = {
  plazo_fijo: 'Plazo Fijo',
  fci: 'FCI',
  bonos: 'Bonos',
  acciones: 'Acciones',
  crypto: 'Crypto',
  letras: 'Letras',
  cedears: 'CEDEARs',
  cauciones: 'Cauciones',
  fondos_comunes_inversion: 'Fondos Comunes',
  compra_divisas: 'Compra de Divisas',
};

export function ConfirmInvestment({ payload, onConfirm, onCancel }: ConfirmInvestmentProps) {
  return (
    <Card className="border-2 border-emerald-200 dark:border-emerald-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Confirmar Inversión</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Tipo:</span>
          <span className="font-semibold">{INVESTMENT_TYPE_LABELS[payload.investmentType] ?? payload.investmentType}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Monto:</span>
          <span className="font-semibold">${payload.amount.toLocaleString('es-AR')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Descripción:</span>
          <span>{payload.description}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Fecha:</span>
          <span>{payload.startDate}</span>
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
