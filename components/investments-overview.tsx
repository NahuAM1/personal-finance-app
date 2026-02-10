'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format, differenceInDays, isPast, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Investment } from '@/types/database';
import { TrendingUp, Calendar, DollarSign, CheckCircle2, Clock, Percent, Trash2, Edit2 } from 'lucide-react';

interface InvestmentsOverviewProps {
  investments: Investment[];
  onDelete: (investmentId: string) => void;
  onUpdate: (investmentId: string, updates: Partial<Investment>) => void;
}

const investmentTypeLabels: Record<string, string> = {
  plazo_fijo: 'Plazo Fijo',
  fci: 'FCI',
  bonos: 'Bonos',
  acciones: 'Acciones',
  crypto: 'Crypto',
  letras: 'Letras',
  cedears: 'CEDEARs',
  cauciones: 'Cauciones',
  fondos_comunes_inversion: 'Fondos Comunes de Inversión',
  compra_divisas: 'Compra de Divisas',
};

const cryptoIcons: Record<string, string> = {
  BTC: 'https://etoro-cdn.etorostatic.com/market-avatars/btc/150x150.png',
  ETH: 'https://etoro-cdn.etorostatic.com/market-avatars/eth-usd/150x150.png',
  SOL: 'https://etoro-cdn.etorostatic.com/market-avatars/100063/150x150.png',
  XRP: 'https://etoro-cdn.etorostatic.com/market-avatars/100003/150x150.png',
  ADA: 'https://etoro-cdn.etorostatic.com/market-avatars/100017/150x150.png',
  XLM: 'https://etoro-cdn.etorostatic.com/market-avatars/100020/150x150.png',
  BNB: 'https://etoro-cdn.etorostatic.com/market-avatars/100030/150x150.png',
  DOGE: 'https://etoro-cdn.etorostatic.com/market-avatars/100043/150x150.png',
  LINK: 'https://etoro-cdn.etorostatic.com/market-avatars/100040/150x150.png',
  USDC: 'https://etoro-cdn.etorostatic.com/market-avatars/100444/150x150.png',
};

const investmentTypeColors: Record<string, string> = {
  plazo_fijo: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  fci: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  bonos: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  acciones: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  crypto: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  letras: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  cedears: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  cauciones: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  fondos_comunes_inversion: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  compra_divisas: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
};

export function InvestmentsOverview({ investments, onDelete, onUpdate }: InvestmentsOverviewProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [investmentToDelete, setInvestmentToDelete] = useState<string | null>(null);
  const [investmentToEdit, setInvestmentToEdit] = useState<Investment | null>(null);

  // Edit form state
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editAnnualRate, setEditAnnualRate] = useState('');
  const [editMaturityDate, setEditMaturityDate] = useState('');

  // Sort: Active first, then by start date
  const sortedInvestments = [...investments].sort((a, b) => {
    if (a.is_liquidated && !b.is_liquidated) return 1;
    if (!a.is_liquidated && b.is_liquidated) return -1;
    return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
  });

  const handleDeleteClick = (investment: Investment) => {
    setInvestmentToDelete(investment.id);
    setDeleteDialogOpen(true);
  };

  const handleEditClick = (investment: Investment) => {
    setInvestmentToEdit(investment);
    setEditDescription(investment.description);
    setEditAmount(investment.amount.toString());
    setEditAnnualRate(investment.annual_rate?.toString() || '');
    setEditMaturityDate(investment.maturity_date || '');
    setEditDialogOpen(true);
  };

  const confirmDelete = () => {
    if (investmentToDelete) {
      onDelete(investmentToDelete);
      setDeleteDialogOpen(false);
      setInvestmentToDelete(null);
    }
  };

  const confirmEdit = () => {
    if (!investmentToEdit) return;

    const updates: Partial<Investment> = {
      description: editDescription,
      amount: Number.parseFloat(editAmount),
      annual_rate: editAnnualRate ? Number.parseFloat(editAnnualRate) : null,
      maturity_date: editMaturityDate || null,
    };

    // Recalculate estimated return if dates and rate are available
    if (editAnnualRate && editMaturityDate && investmentToEdit.start_date) {
      const principal = Number.parseFloat(editAmount);
      const rate = Number.parseFloat(editAnnualRate) / 100;
      const days = differenceInDays(new Date(editMaturityDate), new Date(investmentToEdit.start_date));

      if (days > 0) {
        updates.estimated_return = principal * rate * (days / 365);
      }
    }

    onUpdate(investmentToEdit.id, updates);
    setEditDialogOpen(false);
    setInvestmentToEdit(null);
  };

  if (investments.length === 0) {
    return (
      <Card>
        <CardContent className='pt-6'>
          <div className='text-center py-12'>
            <TrendingUp className='h-16 w-16 text-gray-400 dark:text-gray-600 mx-auto mb-4' />
            <h3 className='text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2'>
              No hay inversiones registradas
            </h3>
            <p className='text-gray-500 dark:text-gray-400'>
              Las inversiones aparecerán aquí
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate totals
  const activeInvestments = investments.filter((inv) => !inv.is_liquidated);
  const totalInvested = activeInvestments.reduce((sum, inv) => sum + inv.amount, 0);
  const totalEstimatedReturns = activeInvestments.reduce(
    (sum, inv) => sum + inv.estimated_return,
    0
  );

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader>
          <CardTitle>Portafolio de Inversiones</CardTitle>
          <CardDescription>
            Visualiza todas tus inversiones activas y liquidadas
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Summary Card */}
      {activeInvestments.length > 0 && (
        <Card className='bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950 border-green-200 dark:border-green-800'>
          <CardContent className='pt-6'>
            <div className='grid grid-cols-3 gap-4'>
              <div className='text-center'>
                <div className='text-sm text-gray-600 dark:text-gray-400 mb-1'>
                  Inversiones Activas
                </div>
                <div className='text-sm md:text-2xl text-2xl font-bold text-gray-900 dark:text-gray-100'>
                  {activeInvestments.length}
                </div>
              </div>
              <div className='text-center'>
                <div className='text-sm text-gray-600 dark:text-gray-400 mb-1'>
                  Capital Invertido
                </div>
                <div className='text-sm md:text-2xl font-bold text-blue-600 dark:text-blue-400'>
                  ${totalInvested.toLocaleString('es-AR')}
                </div>
              </div>
              <div className='text-center'>
                <div className='text-sm text-gray-600 dark:text-gray-400 mb-1'>
                  Ganancia Estimada
                </div>
                <div className='text-sm md:text-2xl font-bold text-green-600 dark:text-green-400'>
                  +${totalEstimatedReturns.toLocaleString('es-AR')}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className='grid gap-4 md:grid-cols-2'>
        {sortedInvestments.map((investment) => {
          const daysElapsed = differenceInDays(
            new Date(),
            new Date(investment.start_date)
          );
          const isMatured = investment.maturity_date
            ? isPast(new Date(investment.maturity_date)) && !isToday(new Date(investment.maturity_date))
            : false;
          const daysUntilMaturity = investment.maturity_date
            ? differenceInDays(new Date(investment.maturity_date), new Date())
            : null;

          const totalDays = investment.maturity_date
            ? differenceInDays(
                new Date(investment.maturity_date),
                new Date(investment.start_date)
              )
            : null;
          const progressPercentage =
            totalDays && totalDays > 0 ? Math.min((daysElapsed / totalDays) * 100, 100) : 0;

          return (
            <Card
              key={investment.id}
              className={`${
                investment.is_liquidated
                  ? 'border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950'
                  : isMatured
                  ? 'border-amber-300 dark:border-amber-800'
                  : ''
              }`}
            >
              <CardHeader>
                <div className='flex items-start justify-between gap-2'>
                  <div className='flex-1'>
                    <CardTitle className='text-lg mb-2 flex items-center gap-2'>
                      {investment.investment_type === 'crypto' && investment.currency && cryptoIcons[investment.currency] && (
                        <img
                          src={cryptoIcons[investment.currency]}
                          alt={investment.currency}
                          className='w-7 h-7 rounded-full'
                        />
                      )}
                      {investment.description}
                    </CardTitle>
                    <div className='flex items-center gap-2'>
                      <Badge className={investmentTypeColors[investment.investment_type]}>
                        {investmentTypeLabels[investment.investment_type]}
                      </Badge>
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    {investment.is_liquidated ? (
                      <Badge className='bg-green-600 hover:bg-green-700'>
                        <CheckCircle2 className='h-3 w-3 mr-1' />
                        Liquidada
                      </Badge>
                    ) : isMatured ? (
                      <Badge className='bg-amber-600 hover:bg-amber-700'>
                        <TrendingUp className='h-3 w-3 mr-1' />
                        Vencida
                      </Badge>
                    ) : (
                      <Badge variant='secondary'>
                        <Clock className='h-3 w-3 mr-1' />
                        Activa
                      </Badge>
                    )}
                    {!investment.is_liquidated && (
                      <>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => handleEditClick(investment)}
                        >
                          <Edit2 className='h-4 w-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => handleDeleteClick(investment)}
                        >
                          <Trash2 className='h-4 w-4 text-red-600' />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className='space-y-4'>
                {/* Progress bar for maturity */}
                {investment.maturity_date && !investment.is_liquidated && (
                  <div className='space-y-2'>
                    <div className='flex items-center justify-between text-sm'>
                      <span className='text-gray-600 dark:text-gray-400'>
                        Progreso
                      </span>
                      <span className='font-semibold'>
                        {daysElapsed} / {totalDays} días
                      </span>
                    </div>
                    <Progress value={progressPercentage} className='h-2' />
                  </div>
                )}

                {/* Financial details */}
                {investment.investment_type === 'compra_divisas' && investment.currency && investment.exchange_rate ? (
                  <div className='space-y-3'>
                    {/* Currency info grid */}
                    <div className='grid grid-cols-2 gap-3 text-sm'>
                      <div className='p-3 bg-blue-100 dark:bg-blue-900 rounded'>
                        <div className='text-xs text-blue-700 dark:text-blue-300 mb-1'>
                          Invertido (ARS)
                        </div>
                        <div className='font-bold text-blue-900 dark:text-blue-100'>
                          ${investment.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className='p-3 bg-emerald-100 dark:bg-emerald-900 rounded'>
                        <div className='text-xs text-emerald-700 dark:text-emerald-300 mb-1'>
                          Unidades {investment.currency}
                        </div>
                        <div className='font-bold text-emerald-900 dark:text-emerald-100'>
                          {(investment.amount / investment.exchange_rate).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                    {/* Exchange rate info */}
                    <div className='flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm'>
                      <span className='text-gray-600 dark:text-gray-400 flex items-center gap-1'>
                        <DollarSign className='h-3 w-3' />
                        TC Compra:
                      </span>
                      <span className='font-semibold'>${investment.exchange_rate.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {/* Show actual return if liquidated */}
                    {investment.is_liquidated && (
                      <div className={`p-3 rounded ${(investment.actual_return || 0) >= 0 ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
                        <div className={`text-xs mb-1 ${(investment.actual_return || 0) >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                          {(investment.actual_return || 0) >= 0 ? 'Ganancia' : 'Pérdida'}
                        </div>
                        <div className={`font-bold ${(investment.actual_return || 0) >= 0 ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                          {(investment.actual_return || 0) >= 0 ? '+' : ''}${(investment.actual_return || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className='grid grid-cols-2 gap-3 text-sm'>
                    <div className='p-3 bg-blue-100 dark:bg-blue-900 rounded'>
                      <div className='text-xs text-blue-700 dark:text-blue-300 mb-1'>
                        Capital
                      </div>
                      <div className='font-bold text-blue-900 dark:text-blue-100'>
                        ${investment.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className='p-3 bg-green-100 dark:bg-green-900 rounded'>
                      <div className='text-xs text-green-700 dark:text-green-300 mb-1'>
                        {investment.is_liquidated ? 'Ganancia Real' : 'Ganancia Est.'}
                      </div>
                      <div className='font-bold text-green-800 dark:text-green-200'>
                        +${(investment.is_liquidated ? investment.actual_return || 0 : investment.estimated_return).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Dates */}
                <div className='space-y-2 text-sm'>
                  <div className='flex items-center justify-between'>
                    <span className='text-gray-600 dark:text-gray-400 flex items-center gap-1'>
                      <Calendar className='h-3 w-3' />
                      Inicio:
                    </span>
                    <span className='font-medium'>
                      {format(new Date(investment.start_date), 'dd/MM/yyyy')}
                    </span>
                  </div>

                  {investment.maturity_date && (
                    <div className='flex items-center justify-between'>
                      <span className='text-gray-600 dark:text-gray-400 flex items-center gap-1'>
                        <Calendar className='h-3 w-3' />
                        {investment.is_liquidated ? 'Vencimiento:' : 'Vence:'}
                      </span>
                      <span className={`font-medium ${isMatured && !investment.is_liquidated ? 'text-amber-600 font-semibold' : ''}`}>
                        {format(new Date(investment.maturity_date), 'dd/MM/yyyy')}
                        {isMatured && !investment.is_liquidated && ' ✓'}
                      </span>
                    </div>
                  )}

                  {investment.is_liquidated && investment.liquidation_date && (
                    <div className='flex items-center justify-between'>
                      <span className='text-gray-600 dark:text-gray-400 flex items-center gap-1'>
                        <CheckCircle2 className='h-3 w-3' />
                        Liquidada:
                      </span>
                      <span className='font-medium text-green-600'>
                        {format(new Date(investment.liquidation_date), 'dd/MM/yyyy')}
                      </span>
                    </div>
                  )}
                </div>

                {/* TNA if available */}
                {investment.annual_rate && (
                  <div className='flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm'>
                    <span className='text-gray-600 dark:text-gray-400 flex items-center gap-1'>
                      <Percent className='h-3 w-3' />
                      TNA:
                    </span>
                    <span className='font-semibold'>{investment.annual_rate}%</span>
                  </div>
                )}

                {/* Days until maturity for active investments */}
                {!investment.is_liquidated && investment.maturity_date && daysUntilMaturity !== null && (
                  <div className='text-center p-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded'>
                    <div className='text-sm text-blue-700 dark:text-blue-300'>
                      {daysUntilMaturity > 0
                        ? `Faltan ${daysUntilMaturity} días para el vencimiento`
                        : isMatured
                        ? '¡Ya venció! Puedes liquidarla'
                        : 'Vence hoy'}
                    </div>
                  </div>
                )}

                {/* Total return */}
                <div className='pt-3 border-t border-gray-200 dark:border-gray-700'>
                  {investment.investment_type === 'compra_divisas' && investment.is_liquidated ? (
                    <div className='flex items-center justify-between'>
                      <span className='text-sm font-semibold text-gray-700 dark:text-gray-300'>
                        Total Liquidado:
                      </span>
                      <span className={`text-xl font-bold ${(investment.amount + (investment.actual_return || 0)) >= investment.amount ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        ${(investment.amount + (investment.actual_return || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ) : investment.investment_type === 'compra_divisas' ? (
                    <div className='flex items-center justify-between'>
                      <span className='text-sm font-semibold text-gray-700 dark:text-gray-300'>
                        Capital Invertido:
                      </span>
                      <span className='text-xl font-bold text-gray-900 dark:text-gray-100'>
                        ${investment.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ) : (
                    <div className='flex items-center justify-between'>
                      <span className='text-sm font-semibold text-gray-700 dark:text-gray-300'>
                        Total {investment.is_liquidated ? 'Liquidado' : 'Esperado'}:
                      </span>
                      <span className='text-xl font-bold text-gray-900 dark:text-gray-100'>
                        ${(investment.amount + (investment.is_liquidated ? investment.actual_return || 0 : investment.estimated_return)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La inversión será eliminada permanentemente.
              {investmentToDelete && investments.find(inv => inv.id === investmentToDelete)?.is_liquidated &&
                ' La transacción de ingreso relacionada también será eliminada.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className='bg-red-600 hover:bg-red-700'
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className='sm:max-w-[500px]'>
          <DialogHeader>
            <DialogTitle>Editar Inversión</DialogTitle>
            <DialogDescription>
              Modifica los detalles de la inversión. La ganancia estimada se recalculará automáticamente.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='edit-description'>Descripción</Label>
              <Input
                id='edit-description'
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='edit-amount'>Monto</Label>
              <Input
                id='edit-amount'
                type='number'
                step='0.01'
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
              />
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='edit-rate'>TNA %</Label>
                <Input
                  id='edit-rate'
                  type='number'
                  step='0.01'
                  value={editAnnualRate}
                  onChange={(e) => setEditAnnualRate(e.target.value)}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='edit-maturity'>Vencimiento</Label>
                <Input
                  id='edit-maturity'
                  type='date'
                  value={editMaturityDate}
                  onChange={(e) => setEditMaturityDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmEdit} className='bg-blue-600 hover:bg-blue-700'>
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
