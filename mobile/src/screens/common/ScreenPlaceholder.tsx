import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';

interface ScreenPlaceholderProps {
  title: string;
  subtitle?: string;
}

export function ScreenPlaceholder({ title, subtitle }: ScreenPlaceholderProps) {
  const theme = useTheme();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background.default }}
      edges={['top']}
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: theme.SPACING['3xl'],
        }}
      >
        <Text
          style={{
            ...theme.typography.h3,
            color: theme.colors.text.primary,
            textAlign: 'center',
            marginBottom: theme.SPACING.sm,
          }}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            style={{
              ...theme.typography.body2,
              color: theme.colors.text.secondary,
              textAlign: 'center',
            }}
          >
            {subtitle}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}
