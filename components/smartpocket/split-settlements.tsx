'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, ArrowRightLeft, CheckCircle2 } from 'lucide-react';
import type { SplitGroupMember } from '@/types/database';

interface DebtSettlement {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}

interface SplitSettlementsProps {
  settlements: DebtSettlement[];
  members: SplitGroupMember[];
  onSettle: () => void;
}

export function SplitSettlements({ settlements, members }: SplitSettlementsProps) {
  const getMemberName = (memberId: string) =>
    members.find((m) => m.id === memberId)?.display_name || 'Desconocido';

  if (settlements.length === 0) {
    return (
      <Card className="border-purple-200 dark:border-purple-800">
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            Todas las deudas están saldadas
          </p>
          <p className="text-sm text-gray-500 mt-1">
            No hay transferencias pendientes
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-purple-200 dark:border-purple-800">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-purple-600" />
          Transferencias para saldar deudas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500 mb-4">
          Mínimo de transferencias necesarias para saldar todas las deudas del grupo:
        </p>
        <div className="space-y-3">
          {settlements.map((settlement, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-4 rounded-xl border border-purple-100 dark:border-purple-800 bg-purple-50/30 dark:bg-purple-900/10"
            >
              <div className="flex-1 flex items-center gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-sm font-bold text-red-700 dark:text-red-300">
                    {getMemberName(settlement.fromMemberId).charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-sm truncate">
                    {getMemberName(settlement.fromMemberId)}
                  </span>
                </div>

                <ArrowRight className="h-4 w-4 text-purple-500 flex-shrink-0" />

                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-sm font-bold text-green-700 dark:text-green-300">
                    {getMemberName(settlement.toMemberId).charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-sm truncate">
                    {getMemberName(settlement.toMemberId)}
                  </span>
                </div>
              </div>

              <Badge className="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 border-0 text-sm">
                ${settlement.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
