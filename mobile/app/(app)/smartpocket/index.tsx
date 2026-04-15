import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { Camera, Users, ShoppingBag, Mic } from 'lucide-react-native';

import { Card, CardContent } from '@/components/ui/card';

interface Item {
  href: '/(app)/smartpocket/scanner' | '/(app)/smartpocket/groups' | '/(app)/smartpocket/shopping' | '/(app)/smartpocket/voice';
  title: string;
  description: string;
  icon: React.ReactElement;
}

const ITEMS: Item[] = [
  { href: '/(app)/smartpocket/scanner', title: 'Escanear ticket', description: 'OCR con cámara', icon: <Camera color="#0F365D" size={28} /> },
  { href: '/(app)/smartpocket/voice', title: 'Transacción por voz', description: 'Grabá y se carga sola', icon: <Mic color="#0F365D" size={28} /> },
  { href: '/(app)/smartpocket/groups', title: 'Grupos de gastos', description: 'Dividí gastos compartidos', icon: <Users color="#0F365D" size={28} /> },
  { href: '/(app)/smartpocket/shopping', title: 'Lista de compras', description: 'Recomendaciones IA', icon: <ShoppingBag color="#0F365D" size={28} /> },
];

export default function SmartPocketHome(): React.ReactElement {
  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4">
        <Text className="text-2xl font-bold text-gray-900 mb-1">SmartPocket</Text>
        <Text className="text-sm text-gray-500 mb-4">Funciones IA de tu wallet</Text>
        {ITEMS.map((item) => (
          <Link key={item.href} href={item.href} asChild>
            <Card className="mb-3">
              <CardContent>
                <View className="flex-row items-center">
                  <View className="bg-blue-50 rounded-full w-12 h-12 items-center justify-center mr-3">{item.icon}</View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-900">{item.title}</Text>
                    <Text className="text-sm text-gray-500">{item.description}</Text>
                  </View>
                </View>
              </CardContent>
            </Card>
          </Link>
        ))}
      </View>
    </ScrollView>
  );
}
