import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';

export default function Index(): React.ReactElement {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#0F365D" />
      </View>
    );
  }

  return <Redirect href={user ? '/(app)/(tabs)' : '/(auth)/login'} />;
}
