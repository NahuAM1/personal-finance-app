'use client';

import type { CreditPurchasePayload } from '@/types/agent';
import type { Card as CreditCard } from '@/types/database';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCurrency } from '@/hooks/use-currency';
import { useCards } from '@/hooks/use-cards';
import { formatCardLabel } from '@/lib/cards';

const NO_CARD_VALUE = 'none';

interface ConfirmCreditPurchaseProps {
  payload: CreditPurchasePayload;
  onCardChange: (cardId: string | null) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmCreditPurchase({ payload, onCardChange, onConfirm, onCancel }: ConfirmCreditPurchaseProps) {
  const { format: formatCurrency } = useCurrency();
  const { cards, loading: cardsLoading } = useCards();
  const monthlyAmount = Math.ceil((payload.totalAmount / payload.installments) * 100) / 100;

  const handleCardChange = (value: string): void => {
    onCardChange(value === NO_CARD_VALUE ? null : value);
  };

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
          <span className="font-semibold">{formatCurrency(payload.totalAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Cuotas:</span>
          <span>{payload.installments} cuotas de {formatCurrency(monthlyAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Inicio:</span>
          <span>{payload.startDate}</span>
        </div>
        <div className="space-y-1 pt-1">
          <Label htmlFor="agent-credit-card" className="text-gray-500 font-normal">
            Tarjeta:
          </Label>
          <Select value={payload.cardId ?? NO_CARD_VALUE} onValueChange={handleCardChange} disabled={cardsLoading}>
            <SelectTrigger id="agent-credit-card" className="h-8">
              <SelectValue placeholder="Sin tarjeta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CARD_VALUE}>Sin tarjeta</SelectItem>
              {cards.map((card: CreditCard) => (
                <SelectItem key={card.id} value={card.id}>
                  {formatCardLabel(card)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
