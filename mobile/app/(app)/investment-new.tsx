import React, { useState } from 'react';
import { ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { router, Stack } from 'expo-router';
import { toast } from 'sonner-native';
import { format } from 'date-fns';

import { InputField } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CategoryPicker } from '@/components/ui/category-picker';
import { useAuth } from '@/contexts/auth-context';
import { useInvestments } from '@/hooks/use-investments';
import { INVESTMENT_TYPES } from '@/lib/categories';
import type { Database } from '@/types/database';

type InvestmentTypeValue = Database['public']['Tables']['investments']['Row']['investment_type'];

export default function InvestmentNewScreen(): React.ReactElement {
  const { user } = useAuth();
  const investments = useInvestments();
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [typeLabel, setTypeLabel] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async (): Promise<void> => {
    if (!user) return;
    const amt = parseFloat(amount.replace(',', '.'));
    if (!amt || amt <= 0) { toast.error('Monto inválido'); return; }
    if (!typeLabel) { toast.error('Elegí tipo'); return; }
    if (!description) { toast.error('Ingresá descripción'); return; }

    const typeEntry = INVESTMENT_TYPES.find((t) => t.label === typeLabel);
    const typeValue: InvestmentTypeValue = (typeEntry?.value ?? 'otros') as InvestmentTypeValue;

    setSubmitting(true);
    try {
      await investments.add({
        user_id: user.id,
        description,
        investment_type: typeValue,
        amount: amt,
        start_date: format(new Date(), 'yyyy-MM-dd'),
        maturity_date: null,
        annual_rate: null,
        estimated_return: 0,
        is_liquidated: false,
        liquidation_date: null,
        actual_return: null,
        transaction_id: null,
        currency: null,
        exchange_rate: null,
      });
      toast.success('Inversión creada');
      router.back();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-gray-50">
      <Stack.Screen options={{ headerShown: true, title: 'Nueva inversión', headerStyle: { backgroundColor: '#0F365D' }, headerTintColor: '#fff' }} />
      <ScrollView className="p-4" keyboardShouldPersistTaps="handled">
        <InputField label="Descripción" value={description} onChangeText={setDescription} />
        <InputField label="Monto" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <CategoryPicker
          label="Tipo"
          value={typeLabel}
          options={INVESTMENT_TYPES.map((t) => t.label)}
          onChange={setTypeLabel}
        />
        <Button onPress={handleSubmit} loading={submitting} className="mt-4">Crear inversión</Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
