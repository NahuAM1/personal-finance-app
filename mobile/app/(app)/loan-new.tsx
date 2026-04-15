import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { router, Stack } from 'expo-router';
import { toast } from 'sonner-native';
import { format, addMonths } from 'date-fns';

import { InputField } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { useLoans } from '@/hooks/use-loans';
import { cn } from '@/lib/utils';

type LoanType = 'given' | 'received' | 'payment_plan';

const OPTIONS: { value: LoanType; label: string }[] = [
  { value: 'given', label: 'Presté' },
  { value: 'received', label: 'Recibí' },
  { value: 'payment_plan', label: 'Plan' },
];

export default function LoanNewScreen(): React.ReactElement {
  const { user } = useAuth();
  const loans = useLoans();
  const [loanType, setLoanType] = useState<LoanType>('given');
  const [counterparty, setCounterparty] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [principal, setPrincipal] = useState<string>('');
  const [installments, setInstallments] = useState<string>('1');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async (): Promise<void> => {
    if (!user) return;
    const amt = parseFloat(principal.replace(',', '.'));
    const n = parseInt(installments, 10);
    if (!amt || amt <= 0) { toast.error('Monto inválido'); return; }
    if (!n || n <= 0) { toast.error('Cuotas inválidas'); return; }
    if (!counterparty) { toast.error('Ingresá contraparte'); return; }

    const startDate = format(new Date(), 'yyyy-MM-dd');
    const perPayment = amt / n;
    const payments = Array.from({ length: n }, (_, i) => ({
      payment_number: i + 1,
      due_date: format(addMonths(new Date(), i + 1), 'yyyy-MM-dd'),
      amount: perPayment,
      paid: false,
      paid_date: null,
      transaction_id: null,
    }));

    setSubmitting(true);
    try {
      await loans.create(
        {
          user_id: user.id,
          loan_type: loanType,
          counterparty_name: counterparty,
          description: description || counterparty,
          principal_amount: amt,
          interest_rate: 0,
          total_amount: amt,
          payment_mode: n > 1 ? 'installments' : 'single',
          installments_count: n,
          status: 'active',
          start_date: startDate,
          due_date: null,
        },
        payments
      );
      toast.success('Préstamo creado');
      router.back();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-gray-50">
      <Stack.Screen options={{ headerShown: true, title: 'Nuevo préstamo', headerStyle: { backgroundColor: '#0F365D' }, headerTintColor: '#fff' }} />
      <ScrollView className="p-4" keyboardShouldPersistTaps="handled">
        <Text className="text-sm font-medium text-gray-700 mb-1">Tipo</Text>
        <View className="flex-row gap-2 mb-3">
          {OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => setLoanType(opt.value)}
              className={cn('flex-1 py-2 rounded-lg border items-center', loanType === opt.value ? 'border-brand bg-brand' : 'border-gray-300 bg-white')}
            >
              <Text className={cn('text-sm font-semibold', loanType === opt.value ? 'text-white' : 'text-gray-700')}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
        <InputField label="Contraparte" value={counterparty} onChangeText={setCounterparty} />
        <InputField label="Descripción" value={description} onChangeText={setDescription} />
        <InputField label="Monto" value={principal} onChangeText={setPrincipal} keyboardType="decimal-pad" />
        <InputField label="Cuotas" value={installments} onChangeText={setInstallments} keyboardType="number-pad" />
        <Button onPress={handleSubmit} loading={submitting} className="mt-4">Crear</Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
