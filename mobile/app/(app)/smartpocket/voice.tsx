import React from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack } from 'expo-router';

import { MicButton } from '@/components/mic-button';
import { TransactionForm } from '@/components/transaction-form';
import { useFormContext } from '@/contexts/form-context';

export default function VoiceScreen(): React.ReactElement {
  const form = useFormContext();
  const type: 'income' | 'expense' = form.incomeForm.amount ? 'income' : 'expense';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title: 'Transacción por voz' }} />
      <ScrollView className="p-4" keyboardShouldPersistTaps="handled">
        <View className="items-center mb-6">
          <MicButton />
          <Text className="text-sm text-gray-500 mt-3">Tocá para grabar / parar</Text>
        </View>
        <View className="bg-white rounded-xl p-4 shadow-sm">
          <TransactionForm type={type} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
