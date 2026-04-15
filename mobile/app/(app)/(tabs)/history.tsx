import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, Alert, RefreshControl } from 'react-native';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';

import { useTransactions } from '@/hooks/use-transactions';
import { formatCurrency } from '@/lib/format';
import type { Transaction } from '@/types/database';

export default function HistoryScreen(): React.ReactElement {
  const { transactions, loading, deleteTransaction, refetch } = useTransactions();
  const [monthOffset, setMonthOffset] = useState<number>(0);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const currentMonth = useMemo(() => addMonths(new Date(), monthOffset), [monthOffset]);

  const filtered: Transaction[] = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return transactions.filter((t) => isWithinInterval(parseISO(t.date), { start, end }));
  }, [transactions, currentMonth]);

  const onRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleDelete = (tx: Transaction): void => {
    Alert.alert('Borrar transacción', `¿Eliminar "${tx.description}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async (): Promise<void> => {
          try {
            await deleteTransaction(tx.id);
            toast.success('Eliminada');
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Error');
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Transaction }): React.ReactElement => {
    const isIncome = item.type === 'income';
    return (
      <View className="bg-white rounded-lg p-3 mb-2 flex-row items-center">
        <View className="flex-1">
          <Text className="text-base font-medium text-gray-900" numberOfLines={1}>{item.description}</Text>
          <Text className="text-xs text-gray-500">
            {item.category} · {format(parseISO(item.date), "d 'de' MMM", { locale: es })}
          </Text>
        </View>
        <Text className={`text-base font-semibold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
          {isIncome ? '+' : '-'}{formatCurrency(item.amount)}
        </Text>
        <Pressable onPress={() => handleDelete(item)} className="ml-3 p-1">
          <Trash2 size={18} color="#9CA3AF" />
        </Pressable>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="flex-row items-center justify-between bg-white border-b border-gray-100 px-4 py-3">
        <Pressable onPress={() => setMonthOffset((n) => n - 1)} className="p-2">
          <ChevronLeft size={20} color="#0F365D" />
        </Pressable>
        <Text className="text-base font-semibold text-gray-900">
          {format(currentMonth, 'MMMM yyyy', { locale: es })}
        </Text>
        <Pressable onPress={() => setMonthOffset((n) => Math.min(0, n + 1))} className="p-2" disabled={monthOffset >= 0}>
          <ChevronRight size={20} color={monthOffset >= 0 ? '#D1D5DB' : '#0F365D'} />
        </Pressable>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing || loading} onRefresh={onRefresh} tintColor="#0F365D" />}
        ListEmptyComponent={
          <View className="items-center justify-center py-12">
            <Text className="text-gray-400">Sin movimientos este mes</Text>
          </View>
        }
      />
    </View>
  );
}
