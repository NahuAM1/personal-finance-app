'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, ShoppingBag, TrendingUp, Receipt } from 'lucide-react';
import type { Ticket, TicketItem } from '@/types/database';
import { Loader } from '@/components/loader';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import * as smartpocketApi from '@/lib/smartpocket-api';
import { useAuth } from '@/contexts/auth-context';

const COLORS = [
  '#8b5cf6', '#a78bfa', '#c4b5fd', '#7c3aed', '#6d28d9',
  '#5b21b6', '#ddd6fe', '#ede9fe', '#4c1d95', '#9333ea',
];

interface TicketItemWithTicket extends TicketItem {
  tickets: { ticket_date: string; store_name: string };
}

interface ShoppingDashboardProps {
  tickets: Ticket[];
}

export function ShoppingDashboard({ tickets }: ShoppingDashboardProps) {
  const { user } = useAuth();
  const [allItems, setAllItems] = useState<TicketItemWithTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadItems = async () => {
      if (!user) return;
      try {
        setLoading(true);
        const items = await smartpocketApi.getAllTicketItems(user.id);
        setAllItems((items || []) as TicketItemWithTicket[]);
      } catch {
        // Silently handle - dashboard will show empty state
      } finally {
        setLoading(false);
      }
    };
    loadItems();
  }, [user]);

  // Top stores by spending
  const topStores = useMemo(() => {
    const storeMap = new Map<string, { visits: number; totalSpent: number }>();
    for (const ticket of tickets) {
      const name = ticket.store_name.trim();
      const existing = storeMap.get(name) || { visits: 0, totalSpent: 0 };
      storeMap.set(name, {
        visits: existing.visits + 1,
        totalSpent: existing.totalSpent + ticket.total_amount,
      });
    }
    return Array.from(storeMap.entries())
      .map(([name, data]) => {
        const truncated = name.length > 18 ? name.slice(0, 16) + '\u2026' : name;
        const avgSpent = Math.round((data.totalSpent / data.visits) * 100) / 100;
        return { name: truncated, fullName: name, ...data, avgSpent };
      })
      .sort((a, b) => b.avgSpent - a.avgSpent)
      .slice(0, 10);
  }, [tickets]);

  // Spending by category
  const { categorySpending, categoryTotal } = useMemo(() => {
    const categories = new Map<string, number>();
    for (const item of allItems) {
      const cat = item.category || 'Otros';
      categories.set(cat, (categories.get(cat) || 0) + item.total_price);
    }
    const spending = Array.from(categories.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
    const total = spending.reduce((sum, c) => sum + c.value, 0);
    return { categorySpending: spending, categoryTotal: total };
  }, [allItems]);

  // Average ticket amount
  const avgTicketAmount = useMemo(() => {
    if (tickets.length === 0) return 0;
    const total = tickets.reduce((sum, t) => sum + t.total_amount, 0);
    return Math.round((total / tickets.length) * 100) / 100;
  }, [tickets]);

  // Shopping frequency (avg days between tickets)
  const shoppingFrequency = useMemo(() => {
    if (tickets.length < 2) return 0;
    let minTime = Infinity;
    let maxTime = -Infinity;
    for (const t of tickets) {
      const time = new Date(t.ticket_date).getTime();
      if (time < minTime) minTime = time;
      if (time > maxTime) maxTime = time;
    }
    const totalDays = (maxTime - minTime) / (1000 * 60 * 60 * 24);
    return Math.round(totalDays / (tickets.length - 1));
  }, [tickets]);

  // Monthly comparison (current month vs same month last year)
  const monthlyComparison = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let currentMonthTotal = 0;
    let lastYearMonthTotal = 0;

    for (const ticket of tickets) {
      const ticketDate = new Date(ticket.ticket_date);
      if (ticketDate.getMonth() === currentMonth && ticketDate.getFullYear() === currentYear) {
        currentMonthTotal += ticket.total_amount;
      }
      if (ticketDate.getMonth() === currentMonth && ticketDate.getFullYear() === currentYear - 1) {
        lastYearMonthTotal += ticket.total_amount;
      }
    }

    return [
      { name: 'Año pasado', total: Math.round(lastYearMonthTotal * 100) / 100 },
      { name: 'Este mes', total: Math.round(currentMonthTotal * 100) / 100 },
    ];
  }, [tickets]);

  if (loading) {
    return <Loader />;
  }

  if (tickets.length === 0) {
    return (
      <Card className="border-purple-200 dark:border-purple-800">
        <CardContent className="py-12 text-center">
          <BarChart3 className="h-12 w-12 text-purple-300 dark:text-purple-700 mx-auto mb-4" aria-hidden="true" />
          <p className="text-gray-500 dark:text-gray-400">
            Escanea tickets para ver tu dashboard de compras inteligente.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-purple-200 dark:border-purple-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <Receipt className="h-5 w-5 text-purple-600" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Tickets</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{tickets.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 dark:border-purple-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-purple-600" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Productos</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{allItems.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 dark:border-purple-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-purple-600" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Promedio/Ticket</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                  ${avgTicketAmount.toLocaleString('es-AR')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 dark:border-purple-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-purple-600" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Frecuencia</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                  {shoppingFrequency > 0 ? `Cada ${shoppingFrequency} días` : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Stores */}
        {topStores.length > 0 && (
          <Card className="border-purple-200 dark:border-purple-800">
            <CardHeader>
              <CardTitle className="text-base">Top Tiendas</CardTitle>
              <CardDescription>Promedio de gasto por visita</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topStores} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        `$${value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
                        'Promedio por visita',
                      ]}
                      labelFormatter={(label: string) => {
                        const store = topStores.find(s => s.name === label);
                        return store ? `${store.fullName} (${store.visits} visitas)` : label;
                      }}
                    />
                    <Bar dataKey="avgSpent" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Category Spending */}
        {categorySpending.length > 0 && (
          <Card className="border-purple-200 dark:border-purple-800">
            <CardHeader>
              <CardTitle className="text-base">Gasto por Categoría</CardTitle>
              <CardDescription>Distribución de gasto en productos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categorySpending}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      outerRadius={70}
                      innerRadius={30}
                      label={({ name, percent }) => {
                        const pct = percent * 100;
                        if (pct < 8) return '';
                        return `${name} ${pct.toFixed(0)}%`;
                      }}
                      labelLine={false}
                    >
                      {categorySpending.map((_entry, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [
                        `$${value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
                        'Gasto',
                      ]}
                    />
                    <Legend
                      layout="horizontal"
                      verticalAlign="bottom"
                      align="center"
                      wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                      formatter={(value: string) => {
                        const item = categorySpending.find(c => c.name === value);
                        const pct = item && categoryTotal > 0 ? ((item.value / categoryTotal) * 100).toFixed(0) : '0';
                        return `${value} (${pct}%)`;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Monthly Comparison */}
        <Card className="border-purple-200 dark:border-purple-800 md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Comparativa Mensual</CardTitle>
            <CardDescription>Gasto del mes actual vs mismo mes del año pasado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              {monthlyComparison.map((item) => {
                const isCurrentMonth = item.name === 'Este mes';
                return (
                  <div key={item.name} className="text-center space-y-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">{item.name}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                      ${item.total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </p>
                    {isCurrentMonth && monthlyComparison[0].total > 0 && (
                      <Badge
                        className={`${
                          item.total > monthlyComparison[0].total
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        } border-0`}
                      >
                        {item.total > monthlyComparison[0].total ? '+' : ''}
                        {(((item.total - monthlyComparison[0].total) / monthlyComparison[0].total) * 100).toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
