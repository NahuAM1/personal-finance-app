import React from 'react';
import { View, Text } from 'react-native';
import { Pie, PolarChart } from 'victory-native';
import type { BudgetSlice } from '@/lib/chart-transforms';
import { formatCurrency } from '@/lib/format';

const COLORS: string[] = ['#0F365D', '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

interface CategoryPieProps {
  data: BudgetSlice[];
  title?: string;
}

export function CategoryPie({ data, title }: CategoryPieProps): React.ReactElement {
  if (data.length === 0) {
    return (
      <View className="items-center justify-center py-8">
        <Text className="text-gray-400 text-sm">Sin datos para mostrar</Text>
      </View>
    );
  }

  const chartData = data.map((slice, i) => ({
    value: slice.value,
    color: COLORS[i % COLORS.length],
    label: slice.name,
  }));

  const total: number = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <View>
      {title ? <Text className="text-base font-semibold text-gray-900 mb-3">{title}</Text> : null}
      <View style={{ height: 220 }}>
        <PolarChart data={chartData} labelKey="label" valueKey="value" colorKey="color">
          <Pie.Chart innerRadius={50} />
        </PolarChart>
      </View>
      <View className="mt-4">
        {chartData.map((d, i) => (
          <View key={i} className="flex-row items-center justify-between py-1">
            <View className="flex-row items-center flex-1">
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: d.color }} className="mr-2" />
              <Text className="text-sm text-gray-700 flex-1" numberOfLines={1}>{d.label}</Text>
            </View>
            <Text className="text-sm font-medium text-gray-900">
              {formatCurrency(d.value)} ({((d.value / total) * 100).toFixed(0)}%)
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
