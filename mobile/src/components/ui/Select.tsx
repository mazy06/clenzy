import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';

interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  label?: string;
  placeholder?: string;
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  error?: string;
  containerStyle?: ViewStyle;
}

export function Select({
  label,
  placeholder = 'Selectionner...',
  options,
  value,
  onChange,
  error,
  containerStyle,
}: SelectProps) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={containerStyle}>
      {label && (
        <Text
          style={{
            ...theme.typography.caption,
            color: error ? theme.colors.error.main : theme.colors.text.secondary,
            marginBottom: 6,
            fontWeight: '500',
          }}
        >
          {label}
        </Text>
      )}
      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={{
          borderWidth: 1.5,
          borderColor: error ? theme.colors.error.main : theme.colors.border.light,
          borderRadius: theme.BORDER_RADIUS.sm,
          paddingHorizontal: 14,
          paddingVertical: 12,
          minHeight: theme.TOUCH_TARGET.minHeight,
          backgroundColor: theme.colors.background.paper,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={{
            ...theme.typography.body2,
            color: selected ? theme.colors.text.primary : theme.colors.text.disabled,
          }}
        >
          {selected?.label || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={theme.colors.text.secondary} />
      </TouchableOpacity>

      {error && (
        <Text style={{ ...theme.typography.caption, color: theme.colors.error.main, marginTop: 4 }}>
          {error}
        </Text>
      )}

      <Modal visible={visible} transparent animationType="slide">
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View
            style={{
              backgroundColor: theme.colors.background.paper,
              borderTopLeftRadius: theme.BORDER_RADIUS.xl,
              borderTopRightRadius: theme.BORDER_RADIUS.xl,
              maxHeight: '50%',
              paddingTop: theme.SPACING.lg,
              paddingBottom: theme.SPACING['2xl'],
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.colors.border.main,
                alignSelf: 'center',
                marginBottom: theme.SPACING.lg,
              }}
            />
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    onChange(item.value);
                    setVisible(false);
                  }}
                  style={{
                    paddingHorizontal: theme.SPACING['2xl'],
                    paddingVertical: theme.SPACING.lg,
                    minHeight: theme.TOUCH_TARGET.minHeight,
                    justifyContent: 'center',
                    backgroundColor:
                      item.value === value ? `${theme.colors.primary.main}10` : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      ...theme.typography.body1,
                      color:
                        item.value === value
                          ? theme.colors.primary.main
                          : theme.colors.text.primary,
                      fontWeight: item.value === value ? '600' : '400',
                    }}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
