import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Link, router } from 'expo-router';
import { toast } from 'sonner-native';
import { useAuth } from '@/contexts/auth-context';

export default function RegisterScreen(): React.ReactElement {
  const { signUp } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirm, setConfirm] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleRegister = async (): Promise<void> => {
    if (!email || !password) {
      toast.error('Completá email y contraseña');
      return;
    }
    if (password !== confirm) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await signUp(email, password);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Cuenta creada. Revisá tu email para confirmar.');
      router.replace('/(auth)/login');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-white">
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-brand mb-2">Crear cuenta</Text>
        <Text className="text-base text-gray-600 mb-8">Empezá a manejar tus finanzas</Text>

        <Text className="text-sm font-medium text-gray-700 mb-1">Email</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-3 mb-4 text-base"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="tu@email.com"
        />

        <Text className="text-sm font-medium text-gray-700 mb-1">Contraseña</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-3 mb-4 text-base"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
        />

        <Text className="text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-3 mb-6 text-base"
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
          placeholder="••••••••"
        />

        <Pressable onPress={handleRegister} disabled={submitting} className="bg-brand rounded-lg py-3 items-center mb-4">
          {submitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold text-base">Crear cuenta</Text>}
        </Pressable>

        <View className="flex-row justify-center gap-2">
          <Text className="text-gray-600">¿Ya tenés cuenta?</Text>
          <Link href="/(auth)/login" className="text-brand font-semibold">Ingresá</Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
