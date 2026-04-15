import React, { useState } from 'react';
import { ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { router, Stack } from 'expo-router';
import { toast } from 'sonner-native';
import { format, addMonths } from 'date-fns';

import { InputField } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CategoryPicker } from '@/components/ui/category-picker';
import { useExpensePlans } from '@/hooks/use-expense-plans';
import { EXPENSE_CATEGORIES } from '@/lib/categories';

export default function PlanNewScreen(): React.ReactElement {
  const plans = useExpensePlans();
  const [name, setName] = useState<string>('');
  const [target, setTarget] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [months, setMonths] = useState<string>('6');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async (): Promise<void> => {
    const amt = parseFloat(target.replace(',', '.'));
    const nMonths = parseInt(months, 10) || 6;
    if (!name) { toast.error('Ingresá nombre'); return; }
    if (!amt || amt <= 0) { toast.error('Monto inválido'); return; }
    if (!category) { toast.error('Elegí categoría'); return; }

    setSubmitting(true);
    try {
      await plans.addExpensePlan({
        name,
        target_amount: amt,
        current_amount: 0,
        deadline: format(addMonths(new Date(), nMonths), 'yyyy-MM-dd'),
        category,
      });
      toast.success('Meta creada');
      router.back();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-gray-50">
      <Stack.Screen options={{ headerShown: true, title: 'Nueva meta', headerStyle: { backgroundColor: '#0F365D' }, headerTintColor: '#fff' }} />
      <ScrollView className="p-4" keyboardShouldPersistTaps="handled">
        <InputField label="Nombre" value={name} onChangeText={setName} />
        <InputField label="Monto objetivo" value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
        <CategoryPicker label="Categoría" value={category} options={EXPENSE_CATEGORIES} onChange={setCategory} />
        <InputField label="Plazo (meses)" value={months} onChangeText={setMonths} keyboardType="number-pad" />
        <Button onPress={handleSubmit} loading={submitting} className="mt-4">Crear meta</Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
