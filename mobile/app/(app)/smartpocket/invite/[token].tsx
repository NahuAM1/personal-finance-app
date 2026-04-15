import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { toast } from 'sonner-native';
import { Button } from '@/components/ui/button';
import { apiPost } from '@/lib/api-client';

interface AcceptResponse {
  ok: boolean;
  groupId?: string;
}

export default function InviteScreen(): React.ReactElement {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [loading, setLoading] = useState<boolean>(false);

  const accept = async (): Promise<void> => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiPost<{ token: string }, AcceptResponse>(`/api/smartpocket/invite/${token}`, { token });
      if (!res.ok) {
        toast.error(res.error ?? 'Error');
        return;
      }
      toast.success('Te uniste al grupo');
      router.replace('/(app)/smartpocket/groups');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-50 justify-center p-6">
      <Stack.Screen options={{ title: 'Invitación' }} />
      <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">Unirte al grupo</Text>
      <Text className="text-sm text-gray-600 mb-6 text-center">Token: {token}</Text>
      <Button onPress={accept} loading={loading}>Aceptar invitación</Button>
    </View>
  );
}
