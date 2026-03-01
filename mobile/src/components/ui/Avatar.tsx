import React from 'react';
import { View, Text, Image, ViewStyle, ImageStyle } from 'react-native';
import { useTheme } from '@/theme';

interface AvatarProps {
  name?: string;
  imageUri?: string;
  size?: number;
  style?: ViewStyle;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Avatar({ name, imageUri, size = 40, style }: AvatarProps) {
  const theme = useTheme();

  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: theme.colors.grey[200],
          } as ImageStyle,
          style as ImageStyle,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors.primary.light,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: theme.colors.primary.contrastText,
          fontSize: size * 0.38,
          fontWeight: '600',
        }}
      >
        {name ? getInitials(name) : '?'}
      </Text>
    </View>
  );
}
