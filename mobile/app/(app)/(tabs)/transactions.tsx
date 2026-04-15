import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { cn } from '@/lib/utils';
import { TransactionForm } from '@/components/transaction-form';

type Tab = 'income' | 'expense';

export default function TransactionsScreen(): React.ReactElement {
  const [tab, setTab] = useState<Tab>('expense');

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-gray-50">
      <ScrollView keyboardShouldPersistTaps="handled">
        <View className="p-4">
          <View className="flex-row bg-gray-200 rounded-lg p-1 mb-4">
            <Pressable
              onPress={() => setTab('expense')}
              className="flex-1 py-2 rounded-md items-center"
              style={tab === 'expense' ? { backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 } : undefined}
            >
              <Text className="text-sm font-semibold" style={{ color: tab === 'expense' ? '#0F365D' : '#4B5563' }}>
                Gasto
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setTab('income')}
              className="flex-1 py-2 rounded-md items-center"
              style={tab === 'income' ? { backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 } : undefined}
            >
              <Text className="text-sm font-semibold" style={{ color: tab === 'income' ? '#0F365D' : '#4B5563' }}>
                Ingreso
              </Text>
            </Pressable>
          </View>

          <View className="bg-white rounded-xl p-4 shadow-sm">
            <TransactionForm type={tab} key={tab} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
