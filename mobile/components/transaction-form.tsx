import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { toast } from 'sonner-native';
import { format } from 'date-fns';

import { InputField } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CategoryPicker } from '@/components/ui/category-picker';
import { useTransactions } from '@/hooks/use-transactions';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '@/lib/categories';

type TxType = 'income' | 'expense';

interface TransactionFormProps {
  type: TxType;
  onSubmitted?: () => void;
}

export function TransactionForm({ type, onSubmitted }: TransactionFormProps): React.ReactElement {
  const { addTransaction } = useTransactions();
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const categories: string[] = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleSubmit = async (): Promise<void> => {
    const n = parseFloat(amount.replace(',', '.'));
    if (!n || n <= 0) {
      toast.error('Ingresá un monto válido');
      return;
    }
    if (!category) {
      toast.error('Elegí una categoría');
      return;
    }
    setSubmitting(true);
    try {
      await addTransaction({
        type,
        amount: n,
        category,
        description: description || category,
        date: format(new Date(), 'yyyy-MM-dd'),
        user_id: '',
        is_recurring: null,
        installments: null,
        current_installment: null,
        paid: null,
        parent_transaction_id: null,
        due_date: null,
        balance_total: null,
        ticket_id: null,
      });
      toast.success(type === 'income' ? 'Ingreso registrado' : 'Gasto registrado');
      setAmount('');
      setCategory('');
      setDescription('');
      onSubmitted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View>
      <Text className="text-lg font-semibold text-gray-900 mb-4">
        {type === 'income' ? 'Nuevo ingreso' : 'Nuevo gasto'}
      </Text>
      <InputField
        label="Monto"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0.00"
      />
      <CategoryPicker label="Categoría" value={category} options={categories} onChange={setCategory} />
      <InputField
        label="Descripción"
        value={description}
        onChangeText={setDescription}
        placeholder="Opcional"
      />
      <Button onPress={handleSubmit} loading={submitting} variant={type === 'income' ? 'primary' : 'destructive'}>
        {type === 'income' ? 'Agregar ingreso' : 'Agregar gasto'}
      </Button>
    </View>
  );
}
