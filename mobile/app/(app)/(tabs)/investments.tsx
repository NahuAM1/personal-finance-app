import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Alert, RefreshControl } from 'react-native';
import { Link } from 'expo-router';
import { Plus, Target } from 'lucide-react-native';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner-native';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useInvestments } from '@/hooks/use-investments';
import { useExpensePlans } from '@/hooks/use-expense-plans';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

type Tab = 'investments' | 'goals';

export default function InvestmentsScreen(): React.ReactElement {
  const [tab, setTab] = useState<Tab>('investments');
  const investments = useInvestments();
  const plans = useExpensePlans();
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const onRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    await Promise.all([investments.refetch(), plans.refetch()]);
    setRefreshing(false);
  }, [investments, plans]);

  const active = investments.investments.filter((i) => !i.is_liquidated);

  const handleLiquidate = (id: string, description: string): void => {
    Alert.prompt?.('Liquidar', `Ganancia/pérdida final para "${description}"`, async (input) => {
      const n = parseFloat((input ?? '0').replace(',', '.'));
      try {
        await investments.liquidate(id, format(new Date(), 'yyyy-MM-dd'), isNaN(n) ? 0 : n);
        toast.success('Liquidada');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error');
      }
    });
  };

  const handleAddMoneyToPlan = (id: string, name: string): void => {
    Alert.prompt?.('Sumar a meta', `Monto a agregar a "${name}"`, async (input) => {
      const n = parseFloat((input ?? '0').replace(',', '.'));
      if (!n || n <= 0) {
        toast.error('Monto inválido');
        return;
      }
      try {
        await plans.addMoney(id, n);
        toast.success('Actualizada');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error');
      }
    });
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F365D" />}
    >
      <View className="p-4">
        <View className="flex-row bg-gray-200 rounded-lg p-1 mb-4">
          <Pressable
            onPress={() => setTab('investments')}
            className={cn('flex-1 py-2 rounded-md items-center', tab === 'investments' && 'bg-white shadow-sm')}
          >
            <Text className={cn('text-sm font-semibold', tab === 'investments' ? 'text-brand' : 'text-gray-600')}>Inversiones</Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('goals')}
            className={cn('flex-1 py-2 rounded-md items-center', tab === 'goals' && 'bg-white shadow-sm')}
          >
            <Text className={cn('text-sm font-semibold', tab === 'goals' ? 'text-brand' : 'text-gray-600')}>Metas</Text>
          </Pressable>
        </View>

        {tab === 'investments' ? (
          <>
            <Link href="/(app)/investment-new" asChild>
              <Button className="mb-4">
                <View className="flex-row items-center">
                  <Plus size={18} color="white" />
                  <Text className="text-white font-semibold ml-2">Nueva inversión</Text>
                </View>
              </Button>
            </Link>

            <Card>
              <CardHeader>
                <CardTitle>Activas</CardTitle>
              </CardHeader>
              <CardContent>
                {active.length === 0 ? (
                  <Text className="text-gray-400 text-sm text-center py-3">Sin inversiones activas</Text>
                ) : (
                  active.map((inv) => (
                    <View key={inv.id} className="py-3 border-b border-gray-50">
                      <View className="flex-row justify-between items-start">
                        <View className="flex-1">
                          <Text className="font-medium text-gray-800">{inv.description}</Text>
                          <Text className="text-xs text-gray-500">
                            {inv.investment_type.replace(/_/g, ' ')} · Inicio {format(parseISO(inv.start_date), 'd MMM yy', { locale: es })}
                          </Text>
                          <Text className="text-base font-semibold text-brand mt-1">{formatCurrency(inv.amount)}</Text>
                        </View>
                        <Pressable
                          onPress={() => handleLiquidate(inv.id, inv.description)}
                          className="border border-brand px-3 py-1.5 rounded-md"
                        >
                          <Text className="text-brand text-xs font-semibold">Liquidar</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Link href="/(app)/plan-new" asChild>
              <Button className="mb-4">
                <View className="flex-row items-center">
                  <Target size={18} color="white" />
                  <Text className="text-white font-semibold ml-2">Nueva meta</Text>
                </View>
              </Button>
            </Link>

            {plans.expensePlans.length === 0 ? (
              <Card>
                <CardContent>
                  <Text className="text-gray-400 text-sm text-center py-3">Sin metas</Text>
                </CardContent>
              </Card>
            ) : (
              plans.expensePlans.map((plan) => {
                const progress: number = plan.target_amount > 0 ? Math.min(plan.current_amount / plan.target_amount, 1) : 0;
                return (
                  <Card key={plan.id} className="mb-3">
                    <CardContent>
                      <View className="flex-row justify-between items-start mb-2">
                        <View className="flex-1">
                          <Text className="font-medium text-gray-900">{plan.name}</Text>
                          <Text className="text-xs text-gray-500">
                            {plan.category} · {format(parseISO(plan.deadline), 'd MMM yy', { locale: es })}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => handleAddMoneyToPlan(plan.id, plan.name)}
                          className="bg-brand px-3 py-1.5 rounded-md"
                        >
                          <Text className="text-white text-xs font-semibold">+</Text>
                        </Pressable>
                      </View>
                      <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <View className="h-full bg-brand" style={{ width: `${progress * 100}%` }} />
                      </View>
                      <View className="flex-row justify-between mt-1">
                        <Text className="text-xs text-gray-500">{formatCurrency(plan.current_amount)}</Text>
                        <Text className="text-xs text-gray-500">{formatCurrency(plan.target_amount)}</Text>
                      </View>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}
