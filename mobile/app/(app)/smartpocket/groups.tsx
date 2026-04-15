import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { Card, CardContent } from '@/components/ui/card';

export default function GroupsScreen(): React.ReactElement {
  return (
    <ScrollView className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title: 'Grupos de gastos' }} />
      <View className="p-4">
        <Card>
          <CardContent>
            <Text className="text-gray-500 text-center py-6">Funcionalidad en desarrollo. Se conecta a /api/smartpocket/split-groups.</Text>
          </CardContent>
        </Card>
      </View>
    </ScrollView>
  );
}
