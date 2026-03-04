'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { SplitGroup, SplitGroupMember } from '@/types/database';
import * as smartpocketApi from '@/lib/smartpocket-api';
import { useToast } from '@/hooks/use-toast';

interface SplitAddExpenseProps {
  group: SplitGroup;
  members: SplitGroupMember[];
  currentMember: SplitGroupMember | null;
  onClose: () => void;
  onExpenseAdded: () => void;
}

export function SplitAddExpense({
  group,
  members,
  currentMember,
  onClose,
  onExpenseAdded,
}: SplitAddExpenseProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidByMemberId, setPaidByMemberId] = useState(currentMember?.id || '');
  const [category, setCategory] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [splitMethod, setSplitMethod] = useState<'equal' | 'custom' | 'percentage'>('equal');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  const acceptedMembers = members.filter((m) => m.invite_status === 'accepted');

  const handleSave = async () => {
    if (!description.trim() || !amount || !paidByMemberId || !expenseDate) {
      toast({
        title: 'Error',
        description: 'Completa todos los campos requeridos',
        variant: 'destructive',
      });
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({
        title: 'Error',
        description: 'El monto debe ser un número positivo',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      let shares: { member_id: string; share_amount: number }[] = [];

      if (splitMethod === 'equal') {
        const shareAmount = Math.round((parsedAmount / acceptedMembers.length) * 100) / 100;
        shares = acceptedMembers.map((m) => ({
          member_id: m.id,
          share_amount: shareAmount,
        }));
      } else if (splitMethod === 'custom') {
        shares = acceptedMembers.map((m) => ({
          member_id: m.id,
          share_amount: parseFloat(customAmounts[m.id] || '0'),
        }));

        const totalShares = shares.reduce((sum, s) => sum + s.share_amount, 0);
        if (Math.abs(totalShares - parsedAmount) > 0.01) {
          toast({
            title: 'Error',
            description: `La suma de las partes ($${totalShares.toFixed(2)}) no coincide con el monto total ($${parsedAmount.toFixed(2)})`,
            variant: 'destructive',
          });
          setSaving(false);
          return;
        }
      } else if (splitMethod === 'percentage') {
        shares = acceptedMembers.map((m) => {
          const percentage = parseFloat(customAmounts[m.id] || '0');
          return {
            member_id: m.id,
            share_amount: Math.round((parsedAmount * percentage / 100) * 100) / 100,
          };
        });

        const totalPercentage = acceptedMembers.reduce(
          (sum, m) => sum + parseFloat(customAmounts[m.id] || '0'),
          0
        );
        if (Math.abs(totalPercentage - 100) > 0.01) {
          toast({
            title: 'Error',
            description: `Los porcentajes suman ${totalPercentage.toFixed(1)}%, deben sumar 100%`,
            variant: 'destructive',
          });
          setSaving(false);
          return;
        }
      }

      await smartpocketApi.createSplitExpense(
        {
          group_id: group.id,
          paid_by_member_id: paidByMemberId,
          description: description.trim(),
          amount: parsedAmount,
          category: category.trim() || null,
          expense_date: expenseDate,
          split_method: splitMethod,
        },
        shares
      );

      toast({
        title: 'Gasto agregado',
        description: `Se dividió $${parsedAmount.toFixed(2)} entre ${acceptedMembers.length} personas`,
      });

      onExpenseAdded();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo agregar el gasto',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar gasto compartido</DialogTitle>
          <DialogDescription>
            Registra un gasto y elige cómo dividirlo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="expense-desc">Descripción</Label>
            <Input
              id="expense-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ej: Cena en el restaurante\u2026"
              className="hover:border-purple-300 focus-visible:border-purple-500 focus-visible:ring-purple-500/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-amount">Monto ({group.currency})</Label>
            <Input
              id="expense-amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="hover:border-purple-300 focus-visible:border-purple-500 focus-visible:ring-purple-500/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-payer">Pagó</Label>
            <Select value={paidByMemberId} onValueChange={setPaidByMemberId}>
              <SelectTrigger id="expense-payer" className="hover:border-purple-300 focus-visible:border-purple-500 focus-visible:ring-purple-500/20">
                <SelectValue placeholder="¿Quién pagó?" />
              </SelectTrigger>
              <SelectContent>
                {acceptedMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-date">Fecha</Label>
            <Input
              id="expense-date"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="hover:border-purple-300 focus-visible:border-purple-500 focus-visible:ring-purple-500/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-category">Categoría (opcional)</Label>
            <Input
              id="expense-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="ej: Comida, Transporte\u2026"
              className="hover:border-purple-300 focus-visible:border-purple-500 focus-visible:ring-purple-500/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-split-method">Cómo dividir</Label>
            <Select value={splitMethod} onValueChange={(v) => setSplitMethod(v as 'equal' | 'custom' | 'percentage')}>
              <SelectTrigger id="expense-split-method" className="hover:border-purple-300 focus-visible:border-purple-500 focus-visible:ring-purple-500/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equal">Equitativo</SelectItem>
                <SelectItem value="custom">Montos personalizados</SelectItem>
                <SelectItem value="percentage">Por porcentaje</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {splitMethod === 'equal' && amount && (
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-sm">
              <p className="text-purple-700 dark:text-purple-300 tabular-nums">
                Cada persona paga: ${(parseFloat(amount) / acceptedMembers.length).toFixed(2)}
              </p>
            </div>
          )}

          {(splitMethod === 'custom' || splitMethod === 'percentage') && (
            <div className="space-y-2">
              {acceptedMembers.map((member) => (
                <div key={member.id} className="flex items-center gap-3">
                  <span className="text-sm flex-1 truncate">{member.display_name}</span>
                  <Input
                    type="number"
                    step="0.01"
                    className="w-28 hover:border-purple-300 focus-visible:border-purple-500 focus-visible:ring-purple-500/20"
                    placeholder={splitMethod === 'percentage' ? '%' : '$'}
                    aria-label={`${splitMethod === 'percentage' ? 'Porcentaje' : 'Monto'} para ${member.display_name}`}
                    value={customAmounts[member.id] || ''}
                    onChange={(e) =>
                      setCustomAmounts({ ...customAmounts, [member.id]: e.target.value })
                    }
                  />
                  <span className="text-xs text-gray-500 w-8">
                    {splitMethod === 'percentage' ? '%' : group.currency}
                  </span>
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={saving || !description.trim() || !amount || !paidByMemberId}
            className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                Guardando...
              </>
            ) : (
              'Agregar gasto'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
