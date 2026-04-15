import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Link, router } from 'expo-router';
import { toast } from 'sonner-native';
import { useAuth } from '@/contexts/auth-context';

export default function ResetPasswordScreen(): React.ReactElement {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleReset = async (): Promise<void> => {
    if (!email) {
      toast.error('Ingresá tu email');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await resetPassword(email);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Te enviamos un email con instrucciones');
      router.replace('/(auth)/login');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-white">
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-brand mb-2">Recuperar contraseña</Text>
        <Text className="text-base text-gray-600 mb-8">Te enviaremos un link a tu email</Text>

        <Text className="text-sm font-medium text-gray-700 mb-1">Email</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-3 mb-6 text-base"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="tu@email.com"
        />

        <Pressable onPress={handleReset} disabled={submitting} className="bg-brand rounded-lg py-3 items-center mb-4">
          {submitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold text-base">Enviar</Text>}
        </Pressable>

        <Link href="/(auth)/login" className="text-brand text-center">Volver</Link>
      </View>
    </KeyboardAvoidingView>
  );
}
