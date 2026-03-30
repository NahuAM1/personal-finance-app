'use client';

import type React from 'react';
import { useState, useMemo } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Trash2,
  CheckCircle2,
  Clock,
  DollarSign,
  Percent,
  User,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Loan, LoanPayment } from '@/types/database';

interface LoansProps {
  loans: Loan[];
  loanPayments: LoanPayment[];
  onAddLoan: (data: {
    loan: Omit<Loan, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'transaction_id'>;
    payments: Omit<LoanPayment, 'id' | 'loan_id' | 'created_at' | 'updated_at'>[];
  }) => void;
  onPayLoanPayment: (paymentId: string) => void;
  onDeleteLoan: (loanId: string) => void;
  mode?: 'loans' | 'payment_plans';
}

interface NewLoanForm {
  loanType: 'given' | 'received' | 'payment_plan' | '';
  counterpartyName: string;
  description: string;
  principalAmount: string;
  interestRate: string;
  paymentMode: 'single' | 'installments' | '';
  installmentsCount: string;
  startDate: string;
  dueDate: string;
}

const initialFormState: NewLoanForm = {
  loanType: '',
  counterpartyName: '',
  description: '',
  principalAmount: '',
  interestRate: '0',
  paymentMode: '',
  installmentsCount: '1',
  startDate: new Date().toISOString().split('T')[0],
  dueDate: '',
};

export function Loans({ loans, loanPayments, onAddLoan, onPayLoanPayment, onDeleteLoan, mode = 'loans' }: LoansProps) {
  const isPaymentPlanMode = mode === 'payment_plans';

  const filteredLoans = useMemo(() => {
    return isPaymentPlanMode
      ? loans.filter(l => l.loan_type === 'payment_plan')
      : loans.filter(l => l.loan_type !== 'payment_plan');
  }, [loans, isPaymentPlanMode]);

  const filteredLoanIds = useMemo(() => new Set(filteredLoans.map(l => l.id)), [filteredLoans]);

  const filteredPayments = useMemo(() => {
    return loanPayments.filter(p => filteredLoanIds.has(p.loan_id));
  }, [loanPayments, filteredLoanIds]);

  const defaultFormState: NewLoanForm = isPaymentPlanMode
    ? { ...initialFormState, loanType: 'payment_plan', paymentMode: 'installments' }
    : initialFormState;

  const [form, setForm] = useState<NewLoanForm>(defaultFormState);
  const [confirmPayment, setConfirmPayment] = useState<(LoanPayment & { loan: Loan }) | null>(null);

  const totalAmount = useMemo(() => {
    const principal = Number.parseFloat(form.principalAmount) || 0;
    const rate = Number.parseFloat(form.interestRate) || 0;
    return principal * (1 + rate / 100);
  }, [form.principalAmount, form.interestRate]);

  const paymentPerInstallment = useMemo(() => {
    const count = Number.parseInt(form.installmentsCount) || 1;
    return totalAmount / count;
  }, [totalAmount, form.installmentsCount]);

  const unpaidPayments = useMemo(() => {
    return filteredPayments
      .filter(p => !p.paid)
      .map(p => {
        const loan = filteredLoans.find(l => l.id === p.loan_id);
        return loan ? { ...p, loan } : null;
      })
      .filter((p): p is LoanPayment & { loan: Loan } => p !== null)
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  }, [filteredPayments, filteredLoans]);

  const paidPayments = useMemo(() => {
    return filteredPayments
      .filter(p => p.paid)
      .map(p => {
        const loan = filteredLoans.find(l => l.id === p.loan_id);
        return loan ? { ...p, loan } : null;
      })
      .filter((p): p is LoanPayment & { loan: Loan } => p !== null)
      .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime());
  }, [filteredPayments, filteredLoans]);

  const activeLoansGiven = filteredLoans.filter(l => l.loan_type === 'given' && l.status === 'active');
  const activeLoansReceived = filteredLoans.filter(l => l.loan_type === 'received' && l.status === 'active');
  const activePaymentPlans = filteredLoans.filter(l => l.loan_type === 'payment_plan' && l.status === 'active');
  const totalGiven = activeLoansGiven.reduce((sum, l) => sum + l.total_amount, 0);
  const totalReceived = activeLoansReceived.reduce((sum, l) => sum + l.total_amount, 0);
  const totalPaymentPlans = activePaymentPlans.reduce((sum, l) => sum + l.total_amount, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.loanType || !form.counterpartyName || !form.principalAmount || !form.paymentMode) return;

    const loanType = form.loanType as 'given' | 'received' | 'payment_plan';
    const paymentMode = form.paymentMode as 'single' | 'installments';
    const installmentsCount = paymentMode === 'installments' ? Number.parseInt(form.installmentsCount) || 1 : 1;

    const loanData: Omit<Loan, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'transaction_id'> = {
      loan_type: loanType,
      counterparty_name: form.counterpartyName,
      description: form.description,
      principal_amount: Number.parseFloat(form.principalAmount),
      interest_rate: Number.parseFloat(form.interestRate) || 0,
      total_amount: totalAmount,
      payment_mode: paymentMode,
      installments_count: installmentsCount,
      status: 'active',
      start_date: form.startDate,
      due_date: form.dueDate || null,
    };

    // Generate payment schedule
    const payments: Omit<LoanPayment, 'id' | 'loan_id' | 'created_at' | 'updated_at'>[] = [];
    const startDate = new Date(form.startDate);

    for (let i = 1; i <= installmentsCount; i++) {
      const paymentDueDate = new Date(startDate);
      paymentDueDate.setMonth(paymentDueDate.getMonth() + i);

      payments.push({
        payment_number: i,
        due_date: paymentDueDate.toISOString().split('T')[0],
        amount: Math.round(paymentPerInstallment * 100) / 100,
        paid: false,
        paid_date: null,
        transaction_id: null,
      });
    }

    onAddLoan({ loan: loanData, payments });
    setForm(defaultFormState);
  };

  const getPaidCount = (loanId: string): number => {
    return filteredPayments.filter(p => p.loan_id === loanId && p.paid).length;
  };

  const getPaidAmount = (loanId: string): number => {
    return filteredPayments.filter(p => p.loan_id === loanId && p.paid).reduce((sum, p) => sum + p.amount, 0);
  };

  return (
    <div className='space-y-6'>
      <Tabs defaultValue='nuevo' className='space-y-4'>
        <div className='flex items-center justify-center'>
          <TabsList>
            <TabsTrigger value='nuevo'>{isPaymentPlanMode ? 'Nuevo Plan' : 'Nuevo Prestamo'}</TabsTrigger>
            <TabsTrigger value='pagos'>{isPaymentPlanMode ? 'Cuotas Pendientes' : 'Pagos Pendientes'}</TabsTrigger>
            <TabsTrigger value='ver'>{isPaymentPlanMode ? 'Mis Planes' : 'Mis Prestamos'}</TabsTrigger>
          </TabsList>
        </div>

        {filteredLoans.length > 0 && (
          <Card className='bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800'>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <div className='p-2 bg-amber-100 dark:bg-amber-900 rounded-lg'>
                  <ArrowLeftRight className='h-5 w-5 text-amber-600 dark:text-amber-400' aria-hidden="true" />
                </div>
                {isPaymentPlanMode ? 'Resumen de Planes de Pago' : 'Resumen de Prestamos'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`grid gap-4 ${isPaymentPlanMode ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
                {isPaymentPlanMode ? (
                  <>
                    <div className='text-center p-4 bg-white/50 dark:bg-gray-900/50 rounded-xl'>
                      <div className='text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums'>
                        ${totalPaymentPlans.toLocaleString()}
                      </div>
                      <div className='text-sm text-gray-600 dark:text-gray-400'>Total Comprometido</div>
                    </div>
                    <div className='text-center p-4 bg-white/50 dark:bg-gray-900/50 rounded-xl'>
                      <div className='text-2xl font-bold text-cyan-600 dark:text-cyan-400 tabular-nums'>
                        {unpaidPayments.length}
                      </div>
                      <div className='text-sm text-gray-600 dark:text-gray-400'>Cuotas Pendientes</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className='text-center p-4 bg-white/50 dark:bg-gray-900/50 rounded-xl'>
                      <div className='text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums'>
                        ${totalGiven.toLocaleString()}
                      </div>
                      <div className='text-sm text-gray-600 dark:text-gray-400'>Prestado (por cobrar)</div>
                    </div>
                    <div className='text-center p-4 bg-white/50 dark:bg-gray-900/50 rounded-xl'>
                      <div className='text-2xl font-bold text-orange-600 dark:text-orange-400 tabular-nums'>
                        ${totalReceived.toLocaleString()}
                      </div>
                      <div className='text-sm text-gray-600 dark:text-gray-400'>Recibido (por pagar)</div>
                    </div>
                    <div className='text-center p-4 bg-white/50 dark:bg-gray-900/50 rounded-xl'>
                      <div className='text-2xl font-bold text-cyan-600 dark:text-cyan-400 tabular-nums'>
                        {unpaidPayments.length}
                      </div>
                      <div className='text-sm text-gray-600 dark:text-gray-400'>Pagos Pendientes</div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <TabsContent value='nuevo'>
          <Card>
            <CardHeader>
              <CardTitle>{isPaymentPlanMode ? 'Registrar Nuevo Plan de Pago' : 'Registrar Nuevo Prestamo'}</CardTitle>
              <CardDescription>
                {isPaymentPlanMode
                  ? 'Registra un plan de pago en cuotas (ej. auto, electrodoméstico)'
                  : 'Registra un prestamo dado o recibido para hacer seguimiento'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className='space-y-4'>
                {!isPaymentPlanMode && (
                  <div className='space-y-2'>
                    <Label>Tipo de Prestamo</Label>
                    <Select
                      value={form.loanType}
                      onValueChange={(value) => setForm({ ...form, loanType: value as 'given' | 'received' })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Selecciona el tipo' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='given'>
                          <div className='flex items-center gap-2'>
                            <ArrowUpRight className='h-4 w-4 text-red-500' />
                            Prestado (di plata)
                          </div>
                        </SelectItem>
                        <SelectItem value='received'>
                          <div className='flex items-center gap-2'>
                            <ArrowDownLeft className='h-4 w-4 text-green-500' />
                            Recibido (me prestaron)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className='space-y-2'>
                  <Label htmlFor='counterparty'>
                    {isPaymentPlanMode
                      ? 'Vendedor / Institución'
                      : form.loanType === 'given' ? 'A quien le prestas' : form.loanType === 'received' ? 'Quien te presta' : 'Contraparte'}
                  </Label>
                  <Input
                    id='counterparty'
                    placeholder={isPaymentPlanMode ? 'ej. Concesionaria, Banco, Tienda' : 'Nombre de la persona'}
                    value={form.counterpartyName}
                    onChange={(e) => setForm({ ...form, counterpartyName: e.target.value })}
                    required
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='loan-description'>Descripcion</Label>
                  <Input
                    id='loan-description'
                    placeholder='ej. Para arreglo del auto'
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    required
                  />
                </div>

                <div className='grid gap-4 md:grid-cols-2'>
                  <div className='space-y-2'>
                    <Label htmlFor='principal-amount'>Monto Principal</Label>
                    <Input
                      id='principal-amount'
                      type='number'
                      inputMode='decimal'
                      placeholder='0.00'
                      value={form.principalAmount}
                      onChange={(e) => setForm({ ...form, principalAmount: e.target.value })}
                      required
                      min={0}
                      step='0.01'
                      autoComplete='off'
                      className='tabular-nums'
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='interest-rate'>Tasa de Interes (%)</Label>
                    <Input
                      id='interest-rate'
                      type='number'
                      inputMode='decimal'
                      placeholder='0'
                      value={form.interestRate}
                      onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
                      min={0}
                      step='0.01'
                      autoComplete='off'
                      className='tabular-nums'
                    />
                  </div>
                </div>

                {totalAmount > 0 && (
                  <div className='p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800'>
                    <div className='flex items-center justify-between'>
                      <span className='text-sm text-amber-700 dark:text-amber-300'>Monto Total (con interes):</span>
                      <span className='font-bold text-amber-800 dark:text-amber-200 tabular-nums'>
                        ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}

                {!isPaymentPlanMode && (
                  <div className='space-y-2'>
                    <Label>Modo de Pago</Label>
                    <Select
                      value={form.paymentMode}
                      onValueChange={(value) => setForm({ ...form, paymentMode: value as 'single' | 'installments' })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Selecciona el modo de pago' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='single'>Pago Unico</SelectItem>
                        <SelectItem value='installments'>En Cuotas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(form.paymentMode === 'installments' || isPaymentPlanMode) && (
                  <div className='space-y-2'>
                    <Label htmlFor='installments-count'>Cantidad de Cuotas</Label>
                    {isPaymentPlanMode && (
                      <div className='flex flex-wrap gap-2 mb-2'>
                        {[12, 24, 36, 48, 60].map((count) => (
                          <Button
                            key={count}
                            type='button'
                            variant={form.installmentsCount === String(count) ? 'default' : 'outline'}
                            size='sm'
                            onClick={() => setForm({ ...form, installmentsCount: String(count) })}
                          >
                            {count} cuotas
                          </Button>
                        ))}
                      </div>
                    )}
                    <Input
                      id='installments-count'
                      type='number'
                      inputMode='numeric'
                      placeholder='1'
                      value={form.installmentsCount}
                      onChange={(e) => setForm({ ...form, installmentsCount: e.target.value })}
                      required
                      min={2}
                      autoComplete='off'
                      className='tabular-nums'
                    />
                    {paymentPerInstallment > 0 && (
                      <p className='text-sm text-gray-500 tabular-nums'>
                        Cuota mensual: ${paymentPerInstallment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                )}

                <div className='grid gap-4 md:grid-cols-2'>
                  <div className='space-y-2'>
                    <Label htmlFor='start-date'>Fecha de Inicio</Label>
                    <Input
                      id='start-date'
                      type='date'
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      required
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='due-date'>Fecha de Vencimiento (opcional)</Label>
                    <Input
                      id='due-date'
                      type='date'
                      value={form.dueDate}
                      onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    />
                  </div>
                </div>

                <Button type='submit' className='w-full' disabled={!form.loanType || !form.counterpartyName || !form.principalAmount || !form.paymentMode}>
                  {isPaymentPlanMode ? 'Registrar Plan de Pago' : 'Registrar Prestamo'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='pagos'>
          <Card>
            <CardHeader>
              <CardTitle>{isPaymentPlanMode ? 'Cuotas Pendientes' : 'Pagos Pendientes'}</CardTitle>
              <CardDescription>
                {isPaymentPlanMode
                  ? 'Cuotas pendientes de todos tus planes de pago activos'
                  : 'Cuotas y pagos pendientes de todos tus prestamos activos'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {unpaidPayments.length === 0 ? (
                <div className='text-center py-8'>
                  <CheckCircle2 className='h-12 w-12 text-green-400 mx-auto mb-3' aria-hidden="true" />
                  <p className='text-gray-500'>No hay pagos pendientes</p>
                </div>
              ) : (
                <div className='space-y-3'>
                  {unpaidPayments.map((payment) => {
                    const isOverdue = new Date(payment.due_date) < new Date();
                    const isGiven = payment.loan.loan_type === 'given';
                    const isPlan = payment.loan.loan_type === 'payment_plan';

                    return (
                      <div
                        key={payment.id}
                        className={`flex items-center justify-between p-4 rounded-lg border ${
                          isOverdue
                            ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
                            : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
                        }`}
                      >
                        <div className='flex items-center gap-3'>
                          <div className={`p-2 rounded-lg ${
                            isPlan ? 'bg-purple-100 dark:bg-purple-900' :
                            isGiven ? 'bg-blue-100 dark:bg-blue-900' : 'bg-orange-100 dark:bg-orange-900'
                          }`}>
                            {isPlan ? (
                              <DollarSign className='h-4 w-4 text-purple-600 dark:text-purple-400' />
                            ) : isGiven ? (
                              <ArrowDownLeft className='h-4 w-4 text-blue-600 dark:text-blue-400' />
                            ) : (
                              <ArrowUpRight className='h-4 w-4 text-orange-600 dark:text-orange-400' />
                            )}
                          </div>
                          <div>
                            <div className='font-medium flex items-center gap-2'>
                              <User className='h-3 w-3' aria-hidden="true" />
                              {payment.loan.counterparty_name}
                              {!isPlan && (
                                <Badge variant={isGiven ? 'default' : 'secondary'} className='text-xs'>
                                  {isGiven ? 'Por cobrar' : 'Por pagar'}
                                </Badge>
                              )}
                            </div>
                            <div className='text-sm text-gray-500'>
                              {payment.loan.description} - Cuota {payment.payment_number}/{payment.loan.installments_count}
                            </div>
                            <div className='text-xs text-gray-400 flex items-center gap-1 mt-1'>
                              <Calendar className='h-3 w-3' aria-hidden="true" />
                              Vence: {format(parseISO(payment.due_date), 'dd MMM yyyy', { locale: es })}
                              {isOverdue && <Badge variant='destructive' className='text-xs ml-1'>Vencido</Badge>}
                            </div>
                          </div>
                        </div>
                        <div className='flex items-center gap-3'>
                          <span className='font-bold tabular-nums'>
                            ${payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                          <Button
                            size='sm'
                            onClick={() => setConfirmPayment(payment)}
                          >
                            {isPlan ? 'Pagar Cuota' : isGiven ? 'Cobrar' : 'Pagar'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {paidPayments.length > 0 && (
                <div className='mt-6'>
                  <h4 className='text-sm font-medium text-gray-400 mb-3'>Cuotas Pagadas</h4>
                  <div className='space-y-2'>
                    {paidPayments.map((payment) => (
                      <div
                        key={payment.id}
                        className='flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900 opacity-60'
                      >
                        <div className='flex items-center gap-3'>
                          <CheckCircle2 className='h-4 w-4 text-green-400 flex-shrink-0' aria-hidden="true" />
                          <div>
                            <div className='text-sm text-gray-500'>
                              {payment.loan.counterparty_name} - {payment.loan.description}
                            </div>
                            <div className='text-xs text-gray-400'>
                              Cuota {payment.payment_number}/{payment.loan.installments_count}
                              {payment.paid_date && (
                                <> - Pagada el {format(parseISO(payment.paid_date), 'dd MMM yyyy', { locale: es })}</>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className='text-sm text-gray-400 tabular-nums'>
                          ${payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='ver'>
          <div className='space-y-4'>
            {filteredLoans.length === 0 ? (
              <Card>
                <CardContent className='text-center py-12'>
                  <ArrowLeftRight className='h-16 w-16 text-gray-400 mx-auto mb-4' aria-hidden="true" />
                  <h3 className='text-xl font-medium text-gray-900 dark:text-gray-100 mb-2'>
                    {isPaymentPlanMode ? 'No tienes planes de pago registrados' : 'No tienes prestamos registrados'}
                  </h3>
                  <p className='text-gray-600 dark:text-gray-400 max-w-md mx-auto'>
                    {isPaymentPlanMode
                      ? 'Registra planes de pago para hacer seguimiento de tus cuotas mensuales'
                      : 'Registra prestamos dados o recibidos para hacer seguimiento de tus deudas y cobros'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className='grid gap-4 md:grid-cols-2'>
                {filteredLoans.map((loan) => {
                  const paidCount = getPaidCount(loan.id);
                  const paidAmount = getPaidAmount(loan.id);
                  const progress = loan.total_amount > 0 ? (paidAmount / loan.total_amount) * 100 : 0;
                  const isGiven = loan.loan_type === 'given';
                  const isPlan = loan.loan_type === 'payment_plan';
                  const isCompleted = loan.status === 'completed';

                  return (
                    <Card
                      key={loan.id}
                      className={`hover:shadow-lg transition-all duration-300 ${
                        isCompleted
                          ? 'border-green-200 dark:border-green-800 opacity-75'
                          : isPlan
                            ? 'hover:border-purple-200 dark:hover:border-purple-800'
                            : isGiven
                              ? 'hover:border-blue-200 dark:hover:border-blue-800'
                              : 'hover:border-orange-200 dark:hover:border-orange-800'
                      }`}
                    >
                      <CardHeader>
                        <div className='flex items-start justify-between'>
                          <div className='flex items-center gap-3'>
                            <div className={`p-2 rounded-xl ${
                              isPlan
                                ? 'bg-gradient-to-br from-purple-100 to-violet-100 dark:from-purple-900 dark:to-violet-900'
                                : isGiven
                                  ? 'bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900 dark:to-cyan-900'
                                  : 'bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900 dark:to-amber-900'
                            }`}>
                              {isPlan ? (
                                <DollarSign className='h-5 w-5 text-purple-600 dark:text-purple-400' />
                              ) : isGiven ? (
                                <ArrowUpRight className='h-5 w-5 text-blue-600 dark:text-blue-400' />
                              ) : (
                                <ArrowDownLeft className='h-5 w-5 text-orange-600 dark:text-orange-400' />
                              )}
                            </div>
                            <div>
                              <CardTitle className='text-lg flex items-center gap-2'>
                                {loan.counterparty_name}
                              </CardTitle>
                              <CardDescription>{loan.description}</CardDescription>
                            </div>
                          </div>
                          <div className='flex flex-col items-end gap-1'>
                            {!isPlan && (
                              <Badge variant={isGiven ? 'default' : 'secondary'}>
                                {isGiven ? 'Prestado' : 'Recibido'}
                              </Badge>
                            )}
                            {isPlan && (
                              <Badge variant='outline' className='text-purple-600 border-purple-300'>
                                Plan de Pago
                              </Badge>
                            )}
                            {isCompleted && (
                              <Badge variant='outline' className='text-green-600 border-green-300'>
                                <CheckCircle2 className='h-3 w-3 mr-1' />
                                Completado
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className='space-y-4'>
                        <div className='grid grid-cols-2 gap-3 text-sm'>
                          <div className='flex items-center gap-2'>
                            <DollarSign className='h-4 w-4 text-gray-400' aria-hidden="true" />
                            <div>
                              <div className='text-gray-500'>Capital</div>
                              <div className='font-medium tabular-nums'>${loan.principal_amount.toLocaleString()}</div>
                            </div>
                          </div>
                          {loan.interest_rate > 0 && (
                            <div className='flex items-center gap-2'>
                              <Percent className='h-4 w-4 text-gray-400' aria-hidden="true" />
                              <div>
                                <div className='text-gray-500'>Interes</div>
                                <div className='font-medium tabular-nums'>{loan.interest_rate}%</div>
                              </div>
                            </div>
                          )}
                          <div className='flex items-center gap-2'>
                            <DollarSign className='h-4 w-4 text-gray-400' aria-hidden="true" />
                            <div>
                              <div className='text-gray-500'>Total</div>
                              <div className='font-bold tabular-nums'>${loan.total_amount.toLocaleString()}</div>
                            </div>
                          </div>
                          <div className='flex items-center gap-2'>
                            <Clock className='h-4 w-4 text-gray-400' aria-hidden="true" />
                            <div>
                              <div className='text-gray-500'>Cuotas</div>
                              <div className='font-medium tabular-nums'>{paidCount}/{loan.installments_count}</div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className='flex justify-between text-sm mb-2 tabular-nums'>
                            <span className='font-medium'>${paidAmount.toLocaleString()}</span>
                            <span className='text-gray-600'>${loan.total_amount.toLocaleString()}</span>
                          </div>
                          <Progress value={progress} className='h-2' />
                        </div>

                        <div className='flex items-center justify-between text-xs text-gray-500'>
                          <span className='flex items-center gap-1'>
                            <Calendar className='h-3 w-3' aria-hidden="true" />
                            Inicio: {format(parseISO(loan.start_date), 'dd MMM yyyy', { locale: es })}
                          </span>
                          {loan.due_date && (
                            <span className='flex items-center gap-1'>
                              <Calendar className='h-3 w-3' aria-hidden="true" />
                              Vence: {format(parseISO(loan.due_date), 'dd MMM yyyy', { locale: es })}
                            </span>
                          )}
                        </div>

                        {!isCompleted && (
                          <Button
                            variant='ghost'
                            size='sm'
                            className='w-full text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30'
                            onClick={() => onDeleteLoan(loan.id)}
                          >
                            <Trash2 className='h-4 w-4 mr-2' aria-hidden="true" />
                            {isPaymentPlanMode ? 'Eliminar Plan' : 'Eliminar Prestamo'}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmPayment !== null} onOpenChange={(open) => { if (!open) setConfirmPayment(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar pago</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmPayment && (
                <>
                  {isPaymentPlanMode ? 'Vas a registrar el pago de la cuota' : 'Vas a registrar el pago'}{' '}
                  <strong>
                    {confirmPayment.loan.description} - Cuota {confirmPayment.payment_number}/{confirmPayment.loan.installments_count}
                  </strong>{' '}
                  por{' '}
                  <strong className='tabular-nums'>
                    ${confirmPayment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </strong>.
                  {' '}Se creará una transacción automáticamente.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmPayment) {
                  onPayLoanPayment(confirmPayment.id);
                  setConfirmPayment(null);
                }
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
