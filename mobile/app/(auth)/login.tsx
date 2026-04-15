import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Link, router } from 'expo-router';
import { toast } from 'sonner-native';
import { useAuth } from '@/contexts/auth-context';

export default function LoginScreen(): React.ReactElement {
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleLogin = async (): Promise<void> => {
    if (!email || !password) {
      toast.error('Completá email y contraseña');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error(error.message);
        return;
      }
      router.replace('/(app)/(tabs)');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async (): Promise<void> => {
    setSubmitting(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-white"
    >
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-brand mb-2">Personal Finance</Text>
        <Text className="text-base text-gray-600 mb-8">Iniciá sesión en tu cuenta</Text>

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
          className="border border-gray-300 rounded-lg px-4 py-3 mb-6 text-base"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
        />

        <Pressable
          onPress={handleLogin}
          disabled={submitting}
          className="bg-brand rounded-lg py-3 items-center mb-3"
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-base">Ingresar</Text>
          )}
        </Pressable>

        <Pressable
          onPress={handleGoogle}
          disabled={submitting}
          className="border border-gray-300 rounded-lg py-3 items-center mb-4"
        >
          <Text className="text-gray-800 font-semibold text-base">Continuar con Google</Text>
        </Pressable>

        <View className="flex-row justify-center gap-2">
          <Text className="text-gray-600">¿No tenés cuenta?</Text>
          <Link href="/(auth)/register" className="text-brand font-semibold">Registrate</Link>
        </View>
        <Link href="/(auth)/reset-password" className="text-brand text-center mt-3">
          Olvidé mi contraseña
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}
