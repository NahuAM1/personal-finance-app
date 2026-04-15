import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { router, Stack } from 'expo-router';
import { toast } from 'sonner-native';
import { format, addMonths } from 'date-fns';

import { InputField } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CategoryPicker } from '@/components/ui/category-picker';
import { useAuth } from '@/contexts/auth-context';
import { useCredit } from '@/hooks/use-credit';
import { EXPENSE_CATEGORIES } from '@/lib/categories';

export default function CreditNewScreen(): React.ReactElement {
  const { user } = useAuth();
  const credit = useCredit();
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [installments, setInstallments] = useState<string>('1');
  const [category, setCategory] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async (): Promise<void> => {
    if (!user) return;
    const total = parseFloat(amount.replace(',', '.'));
    const nInstallments = parseInt(installments, 10);
    if (!total || total <= 0) { toast.error('Monto inválido'); return; }
    if (!nInstallments || nInstallments <= 0) { toast.error('Cuotas inválidas'); return; }
    if (!category) { toast.error('Elegí categoría'); return; }
    if (!description) { toast.error('Ingresá descripción'); return; }

    const monthly = total / nInstallments;
    const startDate = format(new Date(), 'yyyy-MM-dd');
    const instList = Array.from({ length: nInstallments }, (_, i) => ({
      installment_number: i + 1,
      due_date: format(addMonths(new Date(), i + 1), 'yyyy-MM-dd'),
      amount: monthly,
      paid: false,
      paid_date: null,
      transaction_id: null,
    }));

    setSubmitting(true);
    try {
      await credit.create(
        {
          user_id: user.id,
          description,
          category,
          total_amount: total,
          installments: nInstallments,
          monthly_amount: monthly,
          start_date: startDate,
        },
        instList
      );
      toast.success('Compra creada');
      router.back();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-gray-50">
      <Stack.Screen options={{ headerShown: true, title: 'Nueva compra en cuotas', headerStyle: { backgroundColor: '#0F365D' }, headerTintColor: '#fff' }} />
      <ScrollView className="p-4" keyboardShouldPersistTaps="handled">
        <InputField label="Descripción" value={description} onChangeText={setDescription} />
        <InputField label="Monto total" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <InputField label="Cantidad de cuotas" value={installments} onChangeText={setInstallments} keyboardType="number-pad" />
        <CategoryPicker label="Categoría" value={category} options={EXPENSE_CATEGORIES} onChange={setCategory} />
        <Button onPress={handleSubmit} loading={submitting} className="mt-4">Crear compra</Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
