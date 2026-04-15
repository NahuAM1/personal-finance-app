import React, { useState } from 'react';
import { View, Text, Pressable, Modal, FlatList } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { cn } from '@/lib/utils';

interface CategoryPickerProps {
  label?: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
}

export function CategoryPicker({ label, value, options, onChange, placeholder = 'Seleccionar' }: CategoryPickerProps): React.ReactElement {
  const [open, setOpen] = useState<boolean>(false);

  return (
    <View className="mb-3">
      {label ? <Text className="text-sm font-medium text-gray-700 mb-1">{label}</Text> : null}
      <Pressable
        onPress={() => setOpen(true)}
        className="border border-gray-300 rounded-lg px-3 py-3 flex-row items-center justify-between bg-white"
      >
        <Text className={cn('text-base', value ? 'text-gray-900' : 'text-gray-400')}>
          {value || placeholder}
        </Text>
        <ChevronDown size={20} color="#6B7280" />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/40 justify-end" onPress={() => setOpen(false)}>
          <Pressable className="bg-white rounded-t-2xl max-h-[60%]" onPress={(e) => e.stopPropagation()}>
            <View className="p-4 border-b border-gray-100">
              <Text className="text-lg font-semibold text-center">Categoría</Text>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                  className="px-4 py-3 flex-row items-center justify-between border-b border-gray-50"
                >
                  <Text className="text-base text-gray-800">{item}</Text>
                  {item === value ? <Check size={18} color="#0F365D" /> : null}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
