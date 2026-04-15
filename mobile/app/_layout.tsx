import 'react-native-gesture-handler';
import '@/global.css';
import React from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Toaster } from 'sonner-native';

import { AuthProvider } from '@/contexts/auth-context';
import { FormProvider } from '@/contexts/form-context';
import { ChartPreferencesProvider } from '@/contexts/chart-preferences-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout(): React.ReactElement {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ChartPreferencesProvider>
          <FormProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(app)" />
              </Stack>
              <StatusBar style="auto" />
              <Toaster position="top-center" />
            </ThemeProvider>
          </FormProvider>
        </ChartPreferencesProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
