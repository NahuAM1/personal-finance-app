import React, { useState } from 'react';
import { Pressable, Text, View, ActivityIndicator, Alert } from 'react-native';
import { Mic, Square } from 'lucide-react-native';
import { Audio } from 'expo-av';
import { toast } from 'sonner-native';
import { apiPostMultipart } from '@/lib/api-client';
import { useFormContext } from '@/contexts/form-context';

interface TranscriptionResult {
  type?: 'income' | 'expense';
  amount?: number;
  category?: string;
  description?: string;
}

export function MicButton(): React.ReactElement {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [processing, setProcessing] = useState<boolean>(false);
  const form = useFormContext();

  const startRecording = async (): Promise<void> => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permiso', 'Necesito acceso al micrófono');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al grabar');
    }
  };

  const stopRecording = async (): Promise<void> => {
    if (!recording) return;
    setProcessing(true);
    try {
      await recording.stopAndUnloadAsync();
      const uri: string | null = recording.getURI();
      setRecording(null);
      if (!uri) return;

      const formData = new FormData();
      const fileObject = { uri, name: 'recording.m4a', type: 'audio/m4a' };
      formData.append('audio', fileObject as unknown as Blob);

      const res = await apiPostMultipart<TranscriptionResult>('/api/transcribe-transaction', formData);
      if (!res.ok || !res.data) {
        toast.error(res.error ?? 'Error transcribiendo');
        return;
      }
      const { type, amount, category, description } = res.data;
      if (type === 'income') {
        if (amount !== undefined) form.setIncomeAmount(String(amount));
        if (category) form.setIncomeCategory(category);
        if (description) form.setIncomeDescription(description);
      } else if (type === 'expense') {
        if (amount !== undefined) form.setExpenseAmount(String(amount));
        if (category) form.setExpenseCategory(category);
        if (description) form.setExpenseDescription(description);
      }
      toast.success('Transcripción completada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setProcessing(false);
    }
  };

  const handlePress = (): void => {
    if (processing) return;
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const isRecording = recording !== null;

  return (
    <Pressable
      onPress={handlePress}
      disabled={processing}
      className={`rounded-full w-16 h-16 items-center justify-center shadow-lg ${isRecording ? 'bg-red-500' : 'bg-brand'}`}
    >
      {processing ? (
        <ActivityIndicator color="white" />
      ) : isRecording ? (
        <Square size={24} color="white" fill="white" />
      ) : (
        <Mic size={28} color="white" />
      )}
    </Pressable>
  );
}
