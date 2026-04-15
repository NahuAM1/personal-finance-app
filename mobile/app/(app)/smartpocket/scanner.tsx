import React, { useState } from 'react';
import { View, Text, Image, ScrollView, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { toast } from 'sonner-native';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiPostMultipart } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';

interface ScanResult {
  store_name?: string;
  total_amount?: number;
  ticket_date?: string;
  items?: { product_name: string; quantity: number; unit_price: number }[];
}

export default function ScannerScreen(): React.ReactElement {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [processing, setProcessing] = useState<boolean>(false);

  const pickOrCapture = async (source: 'camera' | 'library'): Promise<void> => {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso', 'Se necesita permiso para acceder a la cámara/galería');
      return;
    }
    const picker = source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const res = await picker({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: false });
    if (res.canceled) return;
    setImageUri(res.assets[0].uri);
    setResult(null);
  };

  const scan = async (): Promise<void> => {
    if (!imageUri) return;
    setProcessing(true);
    try {
      const form = new FormData();
      const file = { uri: imageUri, name: 'ticket.jpg', type: 'image/jpeg' };
      form.append('image', file as unknown as Blob);
      const res = await apiPostMultipart<ScanResult>('/api/smartpocket/scan-receipt', form);
      if (!res.ok || !res.data) {
        toast.error(res.error ?? 'Error escaneando');
        return;
      }
      setResult(res.data);
      toast.success('Ticket procesado');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title: 'Escanear ticket' }} />
      <View className="p-4">
        <View className="flex-row gap-2 mb-4">
          <Button onPress={() => pickOrCapture('camera')} className="flex-1">Cámara</Button>
          <Button onPress={() => pickOrCapture('library')} variant="outline" className="flex-1">Galería</Button>
        </View>

        {imageUri ? (
          <>
            <Image source={{ uri: imageUri }} style={{ width: '100%', height: 300, borderRadius: 12 }} className="mb-4" resizeMode="cover" />
            <Button onPress={scan} loading={processing} className="mb-4">Procesar ticket</Button>
          </>
        ) : (
          <Card className="mb-4">
            <CardContent>
              <Text className="text-gray-400 text-center py-6">Seleccioná una imagen para empezar</Text>
            </CardContent>
          </Card>
        )}

        {result ? (
          <Card>
            <CardContent>
              <Text className="text-lg font-semibold mb-2">{result.store_name ?? 'Ticket'}</Text>
              {result.total_amount ? <Text className="text-base text-brand font-semibold">{formatCurrency(result.total_amount)}</Text> : null}
              {result.ticket_date ? <Text className="text-xs text-gray-500">{result.ticket_date}</Text> : null}
              {result.items?.map((item, i) => (
                <View key={i} className="flex-row justify-between py-1 border-t border-gray-50 mt-1">
                  <Text className="text-sm text-gray-700 flex-1" numberOfLines={1}>{item.quantity}× {item.product_name}</Text>
                  <Text className="text-sm text-gray-900">{formatCurrency(item.unit_price * item.quantity)}</Text>
                </View>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </View>
    </ScrollView>
  );
}
