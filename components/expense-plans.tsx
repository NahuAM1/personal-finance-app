'use client';

import type React from 'react';

import { useState } from 'react';
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
  MapPin,
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
import type { ExpensePlan } from '@/types/database';

interface ExpensePlansProps {
  expensePlans: ExpensePlan[];
  onAddPlan: (
    plan: Omit<ExpensePlan, 'id' | 'user_id' | 'deleted_at' | 'created_at' | 'updated_at'>
  ) => void;
  onUpdatePlan: (id: string, amount: number) => void;
  onDeletePlan: (id: string) => void;
}

const planCategories = [
  { value: 'Viajes', label: 'Viajes', icon: Plane },
  { value: 'Vehículo', label: 'Vehículo', icon: Car },
  { value: 'Hogar', label: 'Hogar', icon: Home },
  { value: 'Educación', label: 'Educación', icon: GraduationCap },
  { value: 'Otros', label: 'Otros', icon: MapPin },
];

export function ExpensePlans({ expensePlans, onAddPlan, onUpdatePlan, onDeletePlan }: ExpensePlansProps) {
  const [newPlan, setNewPlan] = useState({
    name: '',
    targetAmount: '',
    deadline: '',
    category: '',
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [addAmount, setAddAmount] = useState<Record<string, string>>({});

  const totalSaved = expensePlans.reduce((sum, plan) => sum + plan.current_amount, 0);
  const totalTarget = expensePlans.reduce((sum, plan) => sum + plan.target_amount, 0);
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
      current_amount: 0,
      deadline: newPlan.deadline,
      category: newPlan.category,
    });

    setNewPlan({ name: '', targetAmount: '', deadline: '', category: '' });
    setIsDialogOpen(false);
  };

  const handleAddMoney = (planId: string) => {
    const amount = Number.parseFloat(addAmount[planId] || '0');
    if (amount > 0) {
      onUpdatePlan(planId, amount);
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
                  ${totalSaved.toLocaleString()}
                </div>
                <div className='text-sm text-gray-600 dark:text-gray-400'>Total Ahorrado</div>
              </div>
              <div className='text-center p-4 bg-white/50 dark:bg-gray-900/50 rounded-xl'>
                <div className='text-2xl font-bold text-teal-600 dark:text-teal-400 tabular-nums'>
                  ${totalTarget.toLocaleString()}
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
          <h2 className='text-2xl font-bold'>Planes de Gastos</h2>
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
              <DialogTitle>Crear Nuevo Plan de Gastos</DialogTitle>
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
              <div className='space-y-2'>
                <Label htmlFor='plan-amount'>Monto Estimado</Label>
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
                  className='tabular-nums'
                />
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
                      ${plan.current_amount.toLocaleString()}
                    </span>
                    <span className='text-gray-600'>
                      ${plan.target_amount.toLocaleString()}
                    </span>
                  </div>
                  <Progress value={progress} className='h-2' />
                  <div className='flex justify-between text-sm mt-2 text-gray-600'>
                    <span className='tabular-nums'>Faltan ${remaining.toLocaleString()}</span>
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
                    $
                    {daysLeft > 0
                      ? Math.ceil(
                          remaining / Math.ceil(daysLeft / 30)
                        ).toLocaleString()
                      : '0'}
                  </div>
                  <div className='text-xs text-gray-500'>
                    para alcanzar la meta a tiempo
                  </div>
                </div>

                {progress < 100 && (
                  <div className='flex gap-2 pt-2 border-t border-emerald-100 dark:border-emerald-800'>
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
                      className='tabular-nums'
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
            <MapPin className='h-16 w-16 text-gray-400 mx-auto mb-4' aria-hidden="true" />
            <h3 className='text-xl font-medium text-gray-900 dark:text-gray-100 mb-2'>
              No tienes planes de gastos
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
            Consejos para tus planes
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
