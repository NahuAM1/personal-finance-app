import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Alert, RefreshControl } from 'react-native';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner-native';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCredit } from '@/hooks/use-credit';
import { useLoans } from '@/hooks/use-loans';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Link } from 'expo-router';
import { Plus } from 'lucide-react-native';

type Tab = 'cards' | 'loans';

export default function InstallmentsScreen(): React.ReactElement {
  const [tab, setTab] = useState<Tab>('cards');
  const credit = useCredit();
  const loans = useLoans();
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const onRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    await Promise.all([credit.refetch(), loans.refetch()]);
    setRefreshing(false);
  }, [credit, loans]);

  const upcomingInstallments = useMemo(() => {
    return credit.installments.filter((i) => !i.paid).sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 10);
  }, [credit.installments]);

  const activeLoans = useMemo(() => loans.loans.filter((l) => l.status === 'active'), [loans.loans]);

  const handlePayInstallment = (installmentId: string, description: string): void => {
    Alert.alert('Pagar cuota', `Registrar pago de "${description}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Pagar',
        onPress: async (): Promise<void> => {
          try {
            await credit.pay(installmentId, format(new Date(), 'yyyy-MM-dd'));
            toast.success('Cuota pagada');
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Error');
          }
        },
      },
    ]);
  };

  const handlePayLoan = (paymentId: string): void => {
    Alert.alert('Pagar cuota de préstamo', '¿Registrar este pago?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Pagar',
        onPress: async (): Promise<void> => {
          try {
            await loans.pay(paymentId, format(new Date(), 'yyyy-MM-dd'));
            toast.success('Pago registrado');
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Error');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F365D" />}
    >
      <View className="p-4">
        <View className="flex-row bg-gray-200 rounded-lg p-1 mb-4">
          <Pressable
            onPress={() => setTab('cards')}
            className={cn('flex-1 py-2 rounded-md items-center', tab === 'cards' && 'bg-white shadow-sm')}
          >
            <Text className={cn('text-sm font-semibold', tab === 'cards' ? 'text-brand' : 'text-gray-600')}>Tarjetas</Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('loans')}
            className={cn('flex-1 py-2 rounded-md items-center', tab === 'loans' && 'bg-white shadow-sm')}
          >
            <Text className={cn('text-sm font-semibold', tab === 'loans' ? 'text-brand' : 'text-gray-600')}>Préstamos</Text>
          </Pressable>
        </View>

        {tab === 'cards' ? (
          <>
            <Link href="/(app)/credit-new" asChild>
              <Button className="mb-4">
                <View className="flex-row items-center">
                  <Plus size={18} color="white" />
                  <Text className="text-white font-semibold ml-2">Nueva compra en cuotas</Text>
                </View>
              </Button>
            </Link>

            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Próximas cuotas</CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingInstallments.length === 0 ? (
                  <Text className="text-gray-400 text-sm text-center py-3">Sin cuotas pendientes</Text>
                ) : (
                  upcomingInstallments.map((inst) => {
                    const purchase = credit.purchases.find((p) => p.id === inst.credit_purchase_id);
                    return (
                      <View key={inst.id} className="flex-row items-center justify-between py-2 border-b border-gray-50">
                        <View className="flex-1">
                          <Text className="font-medium text-gray-800" numberOfLines={1}>
                            {purchase?.description ?? 'Compra'}
                          </Text>
                          <Text className="text-xs text-gray-500">
                            Cuota {inst.installment_number}/{purchase?.installments} · Vence {format(parseISO(inst.due_date), 'd MMM', { locale: es })}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => handlePayInstallment(inst.id, purchase?.description ?? '')}
                          className="bg-brand px-3 py-1.5 rounded-md ml-2"
                        >
                          <Text className="text-white text-xs font-semibold">{formatCurrency(inst.amount)}</Text>
                        </Pressable>
                      </View>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Compras activas</CardTitle>
              </CardHeader>
              <CardContent>
                {credit.purchases.length === 0 ? (
                  <Text className="text-gray-400 text-sm text-center py-3">Sin compras registradas</Text>
                ) : (
                  credit.purchases.map((p) => {
                    const pending = credit.installments.filter((i) => i.credit_purchase_id === p.id && !i.paid).length;
                    return (
                      <View key={p.id} className="py-2 border-b border-gray-50">
                        <Text className="font-medium text-gray-800">{p.description}</Text>
                        <Text className="text-xs text-gray-500">
                          {formatCurrency(p.total_amount)} · {pending}/{p.installments} cuotas pendientes
                        </Text>
                      </View>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Link href="/(app)/loan-new" asChild>
              <Button className="mb-4">
                <View className="flex-row items-center">
                  <Plus size={18} color="white" />
                  <Text className="text-white font-semibold ml-2">Nuevo préstamo</Text>
                </View>
              </Button>
            </Link>

            <Card>
              <CardHeader>
                <CardTitle>Préstamos activos</CardTitle>
              </CardHeader>
              <CardContent>
                {activeLoans.length === 0 ? (
                  <Text className="text-gray-400 text-sm text-center py-3">Sin préstamos</Text>
                ) : (
                  activeLoans.map((loan) => {
                    const loanPayments = loans.payments.filter((p) => p.loan_id === loan.id);
                    const paidCount: number = loanPayments.filter((p) => p.paid).length;
                    const nextPayment = loanPayments.find((p) => !p.paid);
                    return (
                      <View key={loan.id} className="py-3 border-b border-gray-50">
                        <View className="flex-row justify-between items-start">
                          <View className="flex-1">
                            <Text className="font-medium text-gray-800">{loan.counterparty_name}</Text>
                            <Text className="text-xs text-gray-500">
                              {loan.loan_type === 'given' ? 'Prestado a' : loan.loan_type === 'received' ? 'Recibido de' : 'Plan de pago'} · {formatCurrency(loan.total_amount)}
                            </Text>
                            <Text className="text-xs text-gray-400 mt-1">
                              {paidCount}/{loan.installments_count} cuotas pagas
                            </Text>
                          </View>
                          {nextPayment ? (
                            <Pressable
                              onPress={() => handlePayLoan(nextPayment.id)}
                              className="bg-brand px-3 py-1.5 rounded-md"
                            >
                              <Text className="text-white text-xs font-semibold">{formatCurrency(nextPayment.amount)}</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </>
        )}
      </View>
    </ScrollView>
  );
}
