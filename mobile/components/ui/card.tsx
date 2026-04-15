import React from 'react';
import { View, Text } from 'react-native';
import type { ViewProps } from 'react-native';
import { cn } from '@/lib/utils';

interface CardProps extends ViewProps {
  className?: string;
}

export function Card({ className, children, ...rest }: CardProps): React.ReactElement {
  return (
    <View className={cn('bg-white rounded-xl shadow-sm border border-gray-100', className)} {...rest}>
      {children}
    </View>
  );
}

export function CardHeader({ className, children, ...rest }: CardProps): React.ReactElement {
  return (
    <View className={cn('p-4 border-b border-gray-100', className)} {...rest}>
      {children}
    </View>
  );
}

export function CardContent({ className, children, ...rest }: CardProps): React.ReactElement {
  return (
    <View className={cn('p-4', className)} {...rest}>
      {children}
    </View>
  );
}

interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function CardTitle({ children, className }: CardTitleProps): React.ReactElement {
  return <Text className={cn('text-lg font-semibold text-gray-900', className)}>{children}</Text>;
}

export function CardDescription({ children, className }: CardTitleProps): React.ReactElement {
  return <Text className={cn('text-sm text-gray-500', className)}>{children}</Text>;
}
