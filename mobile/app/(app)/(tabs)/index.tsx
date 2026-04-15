import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { LogOut, Sparkles } from 'lucide-react-native';
import { Link } from 'expo-router';
import { toast } from 'sonner-native';
import { parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

import { useAuth } from '@/contexts/auth-context';
import { useTransactions } from '@/hooks/use-transactions';
import { useExpensePlans } from '@/hooks/use-expense-plans';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CategoryPie } from '@/components/charts/category-pie';
import { MonthlyBars } from '@/components/charts/monthly-bars';
import { getMonthlyTrends, getBudgetDistribution } from '@/lib/chart-transforms';
import { formatCurrency } from '@/lib/format';
import type { Transaction } from '@/types/database';

export default function DashboardScreen(): React.ReactElement {
  const { user, signOut } = useAuth();
  const { transactions, loading, refetch } = useTransactions();
  const { expensePlans, refetch: refetchPlans } = useExpensePlans();
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const onRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchPlans()]);
    setRefreshing(false);
  }, [refetch, refetchPlans]);

  const { monthIncome, monthExpense, balance } = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    const monthTx: Transaction[] = transactions.filter((t) =>
      isWithinInterval(parseISO(t.date), { start, end })
    );
    const income: number = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense: number = monthTx.filter((t) => t.type === 'expense' || t.type === 'credit').reduce((s, t) => s + t.amount, 0);
    const totalBalance: number = transactions.reduce((b, t) => (t.type === 'income' ? b + t.amount : b - t.amount), 0);
    return { monthIncome: income, monthExpense: expense, balance: totalBalance };
  }, [transactions]);

  const expenseTxThisMonth = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    return transactions.filter((t) => {
      if (t.type !== 'expense' && t.type !== 'credit') return false;
      return isWithinInterval(parseISO(t.date), { start, end });
    });
  }, [transactions]);

  const trends = useMemo(() => getMonthlyTrends(transactions, 6), [transactions]);
  const budgetDistribution = useMemo(() => getBudgetDistribution(expenseTxThisMonth), [expenseTxThisMonth]);

  const handleSignOut = async (): Promise<void> => {
    const { error } = await signOut();
    if (error) toast.error(error.message);
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={<RefreshControl refreshing={refreshing || loading} onRefresh={onRefresh} tintColor="#0F365D" />}
    >
      <View className="p-4">
        <View className="flex-row justify-between items-center mb-4">
          <View className="flex-1">
            <Text className="text-sm text-gray-500">Hola,</Text>
            <Text className="text-lg font-semibold text-gray-900" numberOfLines={1}>{user?.email}</Text>
          </View>
          <Pressable onPress={handleSignOut} className="p-2">
            <LogOut size={22} color="#6B7280" />
          </Pressable>
        </View>

        <Link href="/(app)/smartpocket" asChild>
          <Pressable className="bg-brand rounded-xl p-4 mb-4 flex-row items-center">
            <Sparkles size={22} color="white" />
            <View className="ml-3 flex-1">
              <Text className="text-white font-semibold">SmartPocket</Text>
              <Text className="text-white/80 text-xs">IA voz · OCR · Splits</Text>
            </View>
          </Pressable>
        </Link>

        <Card className="mb-4">
          <CardContent>
            <Text className="text-sm text-gray-500 mb-1">Balance total</Text>
            <Text className={`text-3xl font-bold ${balance >= 0 ? 'text-brand' : 'text-red-600'}`}>
              {formatCurrency(balance)}
            </Text>
            <View className="flex-row justify-between mt-4 pt-3 border-t border-gray-100">
              <View>
                <Text className="text-xs text-gray-500">Ingresos del mes</Text>
                <Text className="text-base font-semibold text-green-600">{formatCurrency(monthIncome)}</Text>
              </View>
              <View>
                <Text className="text-xs text-gray-500">Gastos del mes</Text>
                <Text className="text-base font-semibold text-red-600">{formatCurrency(monthExpense)}</Text>
              </View>
            </View>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Tendencia mensual</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyBars data={trends} />
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Gastos por categoría (mes)</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryPie data={budgetDistribution} />
          </CardContent>
        </Card>

        {expensePlans.length > 0 && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Metas de ahorro</CardTitle>
            </CardHeader>
            <CardContent>
              {expensePlans.map((plan) => {
                const progress: number = plan.target_amount > 0 ? Math.min(plan.current_amount / plan.target_amount, 1) : 0;
                return (
                  <View key={plan.id} className="mb-3">
                    <View className="flex-row justify-between mb-1">
                      <Text className="text-sm font-medium text-gray-800">{plan.name}</Text>
                      <Text className="text-xs text-gray-500">{(progress * 100).toFixed(0)}%</Text>
                    </View>
                    <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <View className="h-full bg-brand" style={{ width: `${progress * 100}%` }} />
                    </View>
                    <View className="flex-row justify-between mt-1">
                      <Text className="text-xs text-gray-500">{formatCurrency(plan.current_amount)}</Text>
                      <Text className="text-xs text-gray-500">{formatCurrency(plan.target_amount)}</Text>
                    </View>
                  </View>
                );
              })}
            </CardContent>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}
