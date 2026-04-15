import React from 'react';
import { Stack } from 'expo-router';

export default function SmartPocketLayout(): React.ReactElement {
  return <Stack screenOptions={{ headerStyle: { backgroundColor: '#0F365D' }, headerTintColor: '#fff' }} />;
}
