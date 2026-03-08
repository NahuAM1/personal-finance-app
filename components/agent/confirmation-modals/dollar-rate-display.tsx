'use client';

import type { DollarRatePayload } from '@/types/agent';

interface DollarRateDisplayProps {
  payload: DollarRatePayload;
}

export function DollarRateDisplay({ payload }: DollarRateDisplayProps) {
  return (
    <div className="grid grid-cols-1 gap-1.5 mt-1">
      {payload.rates.map(rate => (
        <div key={rate.casa} className="flex justify-between items-center bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-1.5 text-xs">
          <span className="font-medium text-gray-700 dark:text-gray-300">{rate.nombre}</span>
          <div className="flex gap-3">
            <span className="text-emerald-600">C: ${rate.compra?.toLocaleString('es-AR') ?? '-'}</span>
            <span className="text-red-500">V: ${rate.venta?.toLocaleString('es-AR') ?? '-'}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
