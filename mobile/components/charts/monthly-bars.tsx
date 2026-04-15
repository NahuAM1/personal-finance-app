import React from 'react';
import { View, Text } from 'react-native';
import { CartesianChart, Bar } from 'victory-native';
import type { MonthlyTrendPoint } from '@/lib/chart-transforms';
import { formatCurrency } from '@/lib/format';

interface MonthlyBarsProps {
  data: MonthlyTrendPoint[];
  title?: string;
}

interface ChartPoint {
  month: string;
  ingresos: number;
  gastos: number;
  [key: string]: string | number;
}

export function MonthlyBars({ data, title }: MonthlyBarsProps): React.ReactElement {
  if (data.length === 0) {
    return (
      <View className="items-center justify-center py-8">
        <Text className="text-gray-400 text-sm">Sin datos</Text>
      </View>
    );
  }

  const chartData: ChartPoint[] = data.map((d) => ({
    month: d.month,
    ingresos: d.ingresos,
    gastos: d.gastos,
  }));

  const current = data[data.length - 1];
  const net: number = (current?.ingresos ?? 0) - (current?.gastos ?? 0);

  return (
    <View>
      {title ? <Text className="text-base font-semibold text-gray-900 mb-3">{title}</Text> : null}
      <View style={{ height: 220 }}>
        <CartesianChart
          data={chartData}
          xKey="month"
          yKeys={['ingresos', 'gastos']}
          domainPadding={{ left: 30, right: 30, top: 20 }}
          axisOptions={{
            labelColor: '#6B7280',
            lineColor: '#E5E7EB',
            formatYLabel: (v): string => `$${(Number(v) / 1000).toFixed(0)}k`,
          }}
        >
          {({ points, chartBounds }) => (
            <>
              <Bar
                points={points.ingresos}
                chartBounds={chartBounds}
                color="#10b981"
                roundedCorners={{ topLeft: 4, topRight: 4 }}
                barWidth={12}
              />
              <Bar
                points={points.gastos}
                chartBounds={chartBounds}
                color="#ef4444"
                roundedCorners={{ topLeft: 4, topRight: 4 }}
                barWidth={12}
              />
            </>
          )}
        </CartesianChart>
      </View>
      <View className="flex-row justify-around mt-3 pt-3 border-t border-gray-100">
        <View className="items-center">
          <View className="flex-row items-center">
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981' }} className="mr-1" />
            <Text className="text-xs text-gray-500">Ingresos</Text>
          </View>
          <Text className="text-sm font-semibold text-green-600 mt-1">{formatCurrency(current?.ingresos ?? 0)}</Text>
        </View>
        <View className="items-center">
          <View className="flex-row items-center">
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' }} className="mr-1" />
            <Text className="text-xs text-gray-500">Gastos</Text>
          </View>
          <Text className="text-sm font-semibold text-red-600 mt-1">{formatCurrency(current?.gastos ?? 0)}</Text>
        </View>
        <View className="items-center">
          <Text className="text-xs text-gray-500">Neto</Text>
          <Text className={`text-sm font-semibold mt-1 ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(net)}
          </Text>
        </View>
      </View>
    </View>
  );
}
