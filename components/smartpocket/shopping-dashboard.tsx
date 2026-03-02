'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, ShoppingBag, TrendingUp, Receipt, Loader2 } from 'lucide-react';
import type { Ticket, TicketItem } from '@/types/database';
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

  // Top 10 most purchased products
  const topProducts = useMemo(() => {
    const productCounts = new Map<string, { count: number; totalSpent: number }>();
    for (const item of allItems) {
      const name = item.product_name.toLowerCase().trim();
      const existing = productCounts.get(name) || { count: 0, totalSpent: 0 };
      productCounts.set(name, {
        count: existing.count + item.quantity,
        totalSpent: existing.totalSpent + item.total_price,
      });
    }
    return Array.from(productCounts.entries())
      .map(([name, data]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [allItems]);

  // Spending by category
  const categorySpending = useMemo(() => {
    const categories = new Map<string, number>();
    for (const item of allItems) {
      const cat = item.category || 'Otros';
      categories.set(cat, (categories.get(cat) || 0) + item.total_price);
    }
    return Array.from(categories.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
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
    const sorted = [...tickets].sort(
      (a, b) => new Date(a.ticket_date).getTime() - new Date(b.ticket_date).getTime()
    );
    let totalDays = 0;
    for (let i = 1; i < sorted.length; i++) {
      const diff = new Date(sorted[i].ticket_date).getTime() - new Date(sorted[i - 1].ticket_date).getTime();
      totalDays += diff / (1000 * 60 * 60 * 24);
    }
    return Math.round(totalDays / (sorted.length - 1));
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
    return (
      <Card className="border-purple-200 dark:border-purple-800">
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </CardContent>
      </Card>
    );
  }

  if (tickets.length === 0) {
    return (
      <Card className="border-purple-200 dark:border-purple-800">
        <CardContent className="py-12 text-center">
          <BarChart3 className="h-12 w-12 text-purple-300 dark:text-purple-700 mx-auto mb-4" />
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
                <Receipt className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Tickets</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{tickets.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 dark:border-purple-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Productos</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{allItems.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 dark:border-purple-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Promedio/Ticket</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
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
                <BarChart3 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Frecuencia</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {shoppingFrequency > 0 ? `Cada ${shoppingFrequency} días` : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Products */}
        {topProducts.length > 0 && (
          <Card className="border-purple-200 dark:border-purple-800">
            <CardHeader>
              <CardTitle className="text-base">Top 10 Productos</CardTitle>
              <CardDescription>Productos más comprados por cantidad</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value} unidades`, 'Cantidad']}
                    />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
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
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categorySpending}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
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
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyComparison}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => [
                      `$${value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
                      'Total',
                    ]}
                  />
                  <Bar dataKey="total" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
