import React from 'react';
import { Pressable, Text, ActivityIndicator } from 'react-native';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost';

interface ButtonProps {
  onPress?: () => void | Promise<void>;
  children: React.ReactNode;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  textClassName?: string;
}

const VARIANTS: Record<Variant, { container: string; text: string }> = {
  primary: { container: 'bg-brand', text: 'text-white' },
  secondary: { container: 'bg-gray-100', text: 'text-gray-900' },
  destructive: { container: 'bg-red-500', text: 'text-white' },
  outline: { container: 'border border-gray-300 bg-white', text: 'text-gray-900' },
  ghost: { container: 'bg-transparent', text: 'text-brand' },
};

export function Button({
  onPress,
  children,
  variant = 'primary',
  loading = false,
  disabled = false,
  className,
  textClassName,
}: ButtonProps): React.ReactElement {
  const styles = VARIANTS[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={cn(
        'rounded-lg py-3 px-4 items-center justify-center flex-row',
        styles.container,
        isDisabled && 'opacity-50',
        className
      )}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'destructive' ? 'white' : '#0F365D'} />
      ) : typeof children === 'string' ? (
        <Text className={cn('font-semibold text-base', styles.text, textClassName)}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
