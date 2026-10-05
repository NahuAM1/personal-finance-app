'use client';

import type React from 'react';

import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PlusCircle,
  PiggyBank,
  Calendar,
  Plane,
  Car,
  Home,
  GraduationCap,
  DollarSign,
  Target,
  Trash2,
} from 'lucide-react';
import { differenceInDays } from 'date-fns';
import type { ExpensePlan, OmitNew } from '@/types/database';
import { CurrencySelect } from '@/components/currency/currency-select';
import { useCurrency } from '@/hooks/use-currency';
import { fetchRate } from '@/lib/exchange-rates/client';
import { roundAmount } from '@/lib/currency/money';

interface ExpensePlansProps {
  expensePlans: ExpensePlan[];
  onAddPlan: (
    plan: OmitNew<ExpensePlan, 'id' | 'user_id' | 'deleted_at' | 'created_at' | 'updated_at'>
  ) => void;
  /** `depositCurrency` defaults to the plan currency; other currencies are converted at the deposit date. */
  onUpdatePlan: (id: string, amount: number, depositCurrency?: string) => void;
  onDeletePlan: (id: string) => void;
}

const planCategories = [
  { value: 'Viajes', label: 'Viajes', icon: Plane },
  { value: 'Vehículo', label: 'Vehículo', icon: Car },
  { value: 'Hogar', label: 'Hogar', icon: Home },
  { value: 'Educación', label: 'Educación', icon: GraduationCap },
  { value: 'Otros', label: 'Otros', icon: PiggyBank },
];

export function ExpensePlans({ expensePlans, onAddPlan, onUpdatePlan, onDeletePlan }: ExpensePlansProps) {
  const [newPlan, setNewPlan] = useState({
    name: '',
    targetAmount: '',
    currency: null as string | null,
    deadline: '',
    category: '',
  });
  const { baseCurrency, rateType, format: formatCurrency } = useCurrency();
  const [addCurrency, setAddCurrency] = useState<Record<string, string>>({});
  // Current rate plan currency -> base, to show base equivalents (no rate: not shown).
  const [planRates, setPlanRates] = useState<Record<string, number>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [addAmount, setAddAmount] = useState<Record<string, string>>({});

  const planCurrencies = useMemo(
    () => Array.from(new Set(expensePlans.map((p) => p.currency).filter((c) => c !== baseCurrency))),
    [expensePlans, baseCurrency]
  );

  useEffect(() => {
    let cancelled = false;
    const today = new Date().toISOString().split('T')[0];
    for (const currency of planCurrencies) {
      fetchRate(currency, baseCurrency, today, rateType)
        .then((result) => {
          if (!cancelled) setPlanRates((prev) => ({ ...prev, [currency]: result.rate }));
        })
        .catch(() => {
          // Without a rate the base equivalent is simply not shown.
        });
    }
    return () => {
      cancelled = true;
    };
  }, [planCurrencies, baseCurrency, rateType]);

  const rateToBase = (currency: string): number | null =>
    currency === baseCurrency ? 1 : (planRates[currency] ?? null);

  // Totals are expressed in the base currency at the current rate; plans without a rate are skipped.
  const totalSaved = expensePlans.reduce(
    (sum, plan) => sum + plan.current_amount * (rateToBase(plan.currency) ?? 0),
    0
  );
  const totalTarget = expensePlans.reduce(
    (sum, plan) => sum + plan.target_amount * (rateToBase(plan.currency) ?? 0),
    0
  );
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  const handleAddPlan = (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !newPlan.name ||
      !newPlan.targetAmount ||
      !newPlan.deadline ||
      !newPlan.category
    )
      return;

    onAddPlan({
      name: newPlan.name,
      target_amount: Number.parseFloat(newPlan.targetAmount),
      currency: newPlan.currency ?? baseCurrency,
      current_amount: 0,
      deadline: newPlan.deadline,
      category: newPlan.category,
    });

    setNewPlan({ name: '', targetAmount: '', currency: null, deadline: '', category: '' });
    setIsDialogOpen(false);
  };

  const handleAddMoney = (planId: string) => {
    const amount = Number.parseFloat(addAmount[planId] || '0');
    if (amount > 0) {
      const plan = expensePlans.find((p) => p.id === planId);
      onUpdatePlan(planId, amount, addCurrency[planId] ?? plan?.currency);
      setAddAmount({ ...addAmount, [planId]: '' });
    }
  };

  return (
    <div className='space-y-6'>
      {expensePlans.length > 0 && (
        <Card className='bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-emerald-200 dark:border-emerald-800'>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <div className='p-2 bg-emerald-100 dark:bg-emerald-900 rounded-lg'>
                <Target className='h-5 w-5 text-emerald-600 dark:text-emerald-400' aria-hidden="true" />
              </div>
              Resumen de Planes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid gap-4 md:grid-cols-3'>
              <div className='text-center p-4 bg-white/50 dark:bg-gray-900/50 rounded-xl'>
                <div className='text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums'>
                  {formatCurrency(totalSaved)}
                </div>
                <div className='text-sm text-gray-600 dark:text-gray-400'>Total Ahorrado</div>
              </div>
              <div className='text-center p-4 bg-white/50 dark:bg-gray-900/50 rounded-xl'>
                <div className='text-2xl font-bold text-teal-600 dark:text-teal-400 tabular-nums'>
                  {formatCurrency(totalTarget)}
                </div>
                <div className='text-sm text-gray-600 dark:text-gray-400'>Meta Total</div>
              </div>
              <div className='text-center p-4 bg-white/50 dark:bg-gray-900/50 rounded-xl'>
                <div className='text-2xl font-bold text-cyan-600 dark:text-cyan-400 tabular-nums'>
                  {overallProgress.toFixed(1)}%
                </div>
                <div className='text-sm text-gray-600 dark:text-gray-400'>Progreso General</div>
              </div>
            </div>
            <div className='mt-4'>
              <Progress value={overallProgress} className='h-3' />
            </div>
          </CardContent>
        </Card>
      )}

      <div className='flex justify-between items-center'>
        <div>
          <h2 className='text-2xl font-bold'>Metas de Ahorros</h2>
          <p className='text-gray-600 dark:text-gray-400'>
            Planifica y ahorra para gastos futuros importantes
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className='h-4 w-4 mr-2' aria-hidden="true" />
              Nuevo Plan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nueva Meta de Ahorro</DialogTitle>
              <DialogDescription>
                Planifica un gasto futuro importante como un viaje o compra
                grande
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddPlan} className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='plan-name'>Nombre del Plan</Label>
                <Input
                  id='plan-name'
                  placeholder='ej. Vacaciones en Bariloche'
                  value={newPlan.name}
                  onChange={(e) =>
                    setNewPlan({ ...newPlan, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='plan-category'>Categoría</Label>
                <Select
                  value={newPlan.category}
                  onValueChange={(value) =>
                    setNewPlan({ ...newPlan, category: value })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Selecciona una categoría' />
                  </SelectTrigger>
                  <SelectContent>
                    {planCategories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        <div className='flex items-center gap-2'>
                          <category.icon className='h-4 w-4' />
                          {category.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-2 min-w-0'>
                <Label htmlFor='plan-amount'>Monto Estimado</Label>
                <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-2'>
                  <Input
                    id='plan-amount'
                    name='plan-amount'
                    type='number'
                    inputMode='decimal'
                    placeholder='0.00'
                    value={newPlan.targetAmount}
                    onChange={(e) =>
                      setNewPlan({ ...newPlan, targetAmount: e.target.value })
                    }
                    required
                    min={0}
                    step='0.01'
                    autoComplete='off'
                    className='min-w-0 tabular-nums'
                  />
                  <CurrencySelect
                    id='plan-currency'
                    value={newPlan.currency ?? baseCurrency}
                    onChange={(value) => setNewPlan({ ...newPlan, currency: value })}
                    className='w-[104px]'
                    aria-label='Moneda del plan'
                  />
                </div>
              </div>
              <div className='space-y-2'>
                <Label htmlFor='plan-deadline'>Fecha Objetivo</Label>
                <Input
                  id='plan-deadline'
                  type='date'
                  value={newPlan.deadline}
                  onChange={(e) =>
                    setNewPlan({ ...newPlan, deadline: e.target.value })
                  }
                  required
                />
              </div>
              <Button type='submit' className='w-full'>
                Crear Plan
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
        {expensePlans.map((plan) => {
          const progress = plan.target_amount > 0
            ? (plan.current_amount / plan.target_amount) * 100
            : 0;
          const remaining = plan.target_amount - plan.current_amount;
          const daysLeft = differenceInDays(
            new Date(plan.deadline),
            new Date()
          );
          const categoryInfo =
            planCategories.find((cat) => cat.value === plan.category) ||
            planCategories[4];
          const CategoryIcon = categoryInfo.icon;

          return (
            <Card key={plan.id} className='hover:shadow-lg transition-all duration-300 hover:border-emerald-200 dark:hover:border-emerald-800'>
              <CardHeader>
                <div className='flex items-start justify-between'>
                  <div className='flex items-center gap-3'>
                    <div className='p-2 bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900 dark:to-teal-900 rounded-xl'>
                      <CategoryIcon className='h-5 w-5 text-emerald-600 dark:text-emerald-400' />
                    </div>
                    <div>
                      <CardTitle className='text-lg'>{plan.name}</CardTitle>
                      <CardDescription>{plan.category}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={progress >= 100 ? 'default' : 'secondary'}>
                    {progress.toFixed(0)}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div>
                  <div className='flex justify-between text-sm mb-2 tabular-nums'>
                    <span className='font-medium'>
                      {formatCurrency(plan.current_amount, plan.currency)}
                    </span>
                    <span className='text-gray-600'>
                      {formatCurrency(plan.target_amount, plan.currency)}
                    </span>
                  </div>
                  <Progress value={progress} className='h-2' />
                  {plan.currency !== baseCurrency && rateToBase(plan.currency) !== null && (
                    <div className='mt-1 text-xs text-gray-500 tabular-nums'>
                      ≈ {formatCurrency(roundAmount(plan.current_amount * (rateToBase(plan.currency) ?? 0)))}{' '}
                      de {formatCurrency(roundAmount(plan.target_amount * (rateToBase(plan.currency) ?? 0)))}
                    </div>
                  )}
                  <div className='flex justify-between text-sm mt-2 text-gray-600'>
                    <span className='tabular-nums'>Faltan {formatCurrency(remaining, plan.currency)}</span>
                    <span className='flex items-center gap-1'>
                      <Calendar className='h-3 w-3' aria-hidden="true" />
                      {daysLeft > 0 ? `${daysLeft}d` : 'Vencido'}
                    </span>
                  </div>
                </div>

                <div className='pt-2 border-t border-emerald-100 dark:border-emerald-800'>
                  <div className='text-sm text-gray-600 dark:text-gray-400 mb-2'>
                    Ahorro mensual sugerido:
                  </div>
                  <div className='text-lg font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums'>
                    {formatCurrency(
                      daysLeft > 0 ? Math.ceil(remaining / Math.ceil(daysLeft / 30)) : 0,
                      plan.currency
                    )}
                  </div>
                  <div className='text-xs text-gray-500'>
                    para alcanzar la meta a tiempo
                  </div>
                </div>

                {progress < 100 && (
                  <div className='flex min-w-0 gap-2 pt-2 border-t border-emerald-100 dark:border-emerald-800'>
                    <Input
                      type='number'
                      inputMode='decimal'
                      placeholder='Agregar monto...'
                      value={addAmount[plan.id] || ''}
                      onChange={(e) =>
                        setAddAmount({ ...addAmount, [plan.id]: e.target.value })
                      }
                      min={0}
                      step='0.01'
                      autoComplete='off'
                      className='min-w-0 tabular-nums'
                    />
                    <CurrencySelect
                      value={addCurrency[plan.id] ?? plan.currency}
                      onChange={(value) => setAddCurrency({ ...addCurrency, [plan.id]: value })}
                      className='w-[96px] shrink-0'
                      aria-label='Moneda del depósito'
                    />
                    <Button
                      onClick={() => handleAddMoney(plan.id)}
                      disabled={
                        !addAmount[plan.id] ||
                        Number.parseFloat(addAmount[plan.id]) <= 0
                      }
                    >
                      <DollarSign className='h-4 w-4' aria-hidden="true" />
                    </Button>
                  </div>
                )}

                <Button
                  variant='ghost'
                  size='sm'
                  className='w-full text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30'
                  onClick={() => onDeletePlan(plan.id)}
                >
                  <Trash2 className='h-4 w-4 mr-2' aria-hidden="true" />
                  Eliminar Plan
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {expensePlans.length === 0 && (
        <Card>
          <CardContent className='text-center py-12'>
            <PiggyBank className='h-16 w-16 text-gray-400 mx-auto mb-4' aria-hidden="true" />
            <h3 className='text-xl font-medium text-gray-900 dark:text-gray-100 mb-2'>
              No tienes metas de ahorros
            </h3>
            <p className='text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto'>
              Crea planes para gastos futuros importantes como viajes, compras
              grandes o proyectos especiales
            </p>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size='lg'>
                  <PlusCircle className='h-5 w-5 mr-2' aria-hidden="true" />
                  Crear Primer Plan
                </Button>
              </DialogTrigger>
            </Dialog>
          </CardContent>
        </Card>
      )}

      <Card className='bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/50 dark:to-teal-950/50 border-emerald-200 dark:border-emerald-800'>
        <CardHeader>
          <CardTitle className='text-emerald-800 dark:text-emerald-200 flex items-center gap-2'>
            <span className='text-2xl'>💡</span>
            Consejos para tus metas
          </CardTitle>
        </CardHeader>
        <CardContent className='text-emerald-700 dark:text-emerald-300'>
          <ul className='space-y-3 text-sm'>
            <li className='flex items-start gap-2'>
              <span className='text-emerald-500'>•</span>
              Divide el monto total por los meses disponibles para saber
              cuánto ahorrar mensualmente
            </li>
            <li className='flex items-start gap-2'>
              <span className='text-emerald-500'>•</span>
              Considera crear una cuenta de ahorros separada para cada plan
              importante
            </li>
            <li className='flex items-start gap-2'>
              <span className='text-emerald-500'>•</span>
              Revisa y ajusta tus planes regularmente según cambien tus
              prioridades
            </li>
            <li className='flex items-start gap-2'>
              <span className='text-emerald-500'>•</span>
              Celebra cuando alcances tus metas para mantenerte motivado
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
