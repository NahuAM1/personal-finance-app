import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { Card, CardContent } from '@/components/ui/card';

export default function ShoppingScreen(): React.ReactElement {
  return (
    <ScrollView className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title: 'Recomendaciones' }} />
      <View className="p-4">
        <Card>
          <CardContent>
            <Text className="text-gray-500 text-center py-6">Se conecta a /api/smartpocket/shopping-recommendations.</Text>
          </CardContent>
        </Card>
      </View>
    </ScrollView>
  );
}
