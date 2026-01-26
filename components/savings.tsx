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
import { PlusCircle, Target, Calendar, DollarSign } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import type { SavingsGoal } from '@/types/database';

interface SavingsProps {
  savingsGoals: SavingsGoal[];
  onAddGoal: (
    goal: Omit<SavingsGoal, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ) => void;
  onUpdateGoal: (id: string, amount: number) => void;
}

export function Savings({
  savingsGoals,
  onAddGoal,
  onUpdateGoal,
}: SavingsProps) {
  const [newGoal, setNewGoal] = useState({
    name: '',
    targetAmount: '',
    deadline: '',
  });
  const [addAmount, setAddAmount] = useState<Record<string, string>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newGoal.name || !newGoal.targetAmount || !newGoal.deadline) return;

    onAddGoal({
      name: newGoal.name,
      target_amount: Number.parseFloat(newGoal.targetAmount),
      current_amount: 0,
      deadline: newGoal.deadline,
    });

    setNewGoal({ name: '', targetAmount: '', deadline: '' });
    setIsDialogOpen(false);
  };

  const handleAddMoney = (goalId: string) => {
    const amount = Number.parseFloat(addAmount[goalId] || '0');
    if (amount > 0) {
      onUpdateGoal(goalId, amount);
      setAddAmount({ ...addAmount, [goalId]: '' });
    }
  };

  const totalSaved = savingsGoals.reduce(
    (sum, goal) => sum + goal.current_amount,
    0
  );
  const totalTarget = savingsGoals.reduce(
    (sum, goal) => sum + goal.target_amount,
    0
  );
  const overallProgress =
    totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  return (
    <div className='space-y-6'>
      <Card className='bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-emerald-200 dark:border-emerald-800'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <div className='p-2 bg-emerald-100 dark:bg-emerald-900 rounded-lg'>
              <Target className='h-5 w-5 text-emerald-600 dark:text-emerald-400' aria-hidden="true" />
            </div>
            Resumen de Ahorros
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

      <div className='flex justify-between items-center'>
        <h2 className='text-xl font-semibold'>Metas de Ahorro</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className='h-4 w-4 mr-2' aria-hidden="true" />
              Nueva Meta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nueva Meta de Ahorro</DialogTitle>
              <DialogDescription>
                Define una nueva meta de ahorro con un objetivo y fecha límite
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddGoal} className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='goal-name'>Nombre de la Meta</Label>
                <Input
                  id='goal-name'
                  placeholder='ej. Viaje a Europa'
                  value={newGoal.name}
                  onChange={(e) =>
                    setNewGoal({ ...newGoal, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='goal-amount'>Monto Objetivo</Label>
                <Input
                  id='goal-amount'
                  name='goal-amount'
                  type='number'
                  inputMode='decimal'
                  placeholder='0.00'
                  value={newGoal.targetAmount}
                  onChange={(e) =>
                    setNewGoal({ ...newGoal, targetAmount: e.target.value })
                  }
                  required
                  min={0}
                  step='0.01'
                  autoComplete='off'
                  className='tabular-nums'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='goal-deadline'>Fecha Límite</Label>
                <Input
                  id='goal-deadline'
                  type='date'
                  value={newGoal.deadline}
                  onChange={(e) =>
                    setNewGoal({ ...newGoal, deadline: e.target.value })
                  }
                  required
                />
              </div>
              <Button type='submit' className='w-full'>
                Crear Meta
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className='grid gap-4 md:grid-cols-2'>
        {savingsGoals.map((goal) => {
          const progress = (goal.current_amount / goal.target_amount) * 100;
          const remaining = goal.target_amount - goal.current_amount;
          const daysLeft = differenceInDays(
            new Date(goal.deadline),
            new Date()
          );

          return (
            <Card key={goal.id}>
              <CardHeader>
                <div className='flex justify-between items-start'>
                  <div>
                    <CardTitle className='text-lg'>{goal.name}</CardTitle>
                    <CardDescription className='flex items-center gap-2 mt-1'>
                      <Calendar className='h-4 w-4' aria-hidden="true" />
                      {daysLeft > 0
                        ? `${daysLeft} días restantes`
                        : 'Fecha vencida'}
                    </CardDescription>
                  </div>
                  <Badge variant={progress >= 100 ? 'default' : 'secondary'}>
                    {progress.toFixed(1)}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div>
                  <div className='flex justify-between text-sm mb-2 tabular-nums'>
                    <span>${goal.current_amount.toLocaleString()}</span>
                    <span>${goal.target_amount.toLocaleString()}</span>
                  </div>
                  <Progress value={progress} className='h-2' />
                  <div className='text-sm text-gray-600 mt-1 tabular-nums'>
                    Faltan ${remaining.toLocaleString()}
                  </div>
                </div>

                <div className='flex gap-2'>
                  <label htmlFor={`add-amount-${goal.id}`} className='sr-only'>Monto a agregar</label>
                  <Input
                    id={`add-amount-${goal.id}`}
                    name={`add-amount-${goal.id}`}
                    type='number'
                    inputMode='decimal'
                    placeholder='Monto a agregar…'
                    value={addAmount[goal.id] || ''}
                    onChange={(e) =>
                      setAddAmount({ ...addAmount, [goal.id]: e.target.value })
                    }
                    min={0}
                    step='0.01'
                    autoComplete='off'
                    className='tabular-nums'
                  />
                  <Button
                    onClick={() => handleAddMoney(goal.id)}
                    disabled={
                      !addAmount[goal.id] ||
                      Number.parseFloat(addAmount[goal.id]) <= 0
                    }
                    aria-label='Agregar dinero a la meta'
                  >
                    <DollarSign className='h-4 w-4' aria-hidden="true" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {savingsGoals.length === 0 && (
        <Card>
          <CardContent className='text-center py-8'>
            <Target className='h-12 w-12 text-gray-400 mx-auto mb-4' aria-hidden="true" />
            <h3 className='text-lg font-medium text-gray-900 dark:text-gray-100 mb-2'>
              No tienes metas de ahorro
            </h3>
            <p className='text-gray-600 dark:text-gray-400 mb-4'>
              Crea tu primera meta de ahorro para comenzar a planificar tu
              futuro financiero
            </p>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle className='h-4 w-4 mr-2' aria-hidden="true" />
                  Crear Primera Meta
                </Button>
              </DialogTrigger>
            </Dialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
