import React from 'react';
import { View, Text, TextInput } from 'react-native';
import type { TextInputProps } from 'react-native';
import { cn } from '@/lib/utils';

interface InputFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  containerClassName?: string;
}

export function InputField({ label, error, containerClassName, className, ...props }: InputFieldProps): React.ReactElement {
  return (
    <View className={cn('mb-3', containerClassName)}>
      {label ? <Text className="text-sm font-medium text-gray-700 mb-1">{label}</Text> : null}
      <TextInput
        className={cn(
          'border border-gray-300 rounded-lg px-3 py-3 text-base bg-white',
          error && 'border-red-500',
          className
        )}
        placeholderTextColor="#9CA3AF"
        {...props}
      />
      {error ? <Text className="text-xs text-red-500 mt-1">{error}</Text> : null}
    </View>
  );
}
