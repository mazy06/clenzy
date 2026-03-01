import React, { useEffect, useRef } from 'react';
import { Animated, Text, ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  visible: boolean;
  onHide: () => void;
  duration?: number;
}

export function Toast({
  message,
  type = 'info',
  visible,
  onHide,
  duration = 4000,
}: ToastProps) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -20, duration: 200, useNativeDriver: true }),
        ]).start(onHide);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  const colorMap: Record<ToastType, string> = {
    success: theme.colors.success.main,
    error: theme.colors.error.main,
    warning: theme.colors.warning.main,
    info: theme.colors.info.main,
  };

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 60,
        left: 16,
        right: 16,
        backgroundColor: colorMap[type],
        borderRadius: theme.BORDER_RADIUS.md,
        paddingHorizontal: 16,
        paddingVertical: 14,
        opacity,
        transform: [{ translateY }],
        zIndex: 9999,
        ...theme.shadows.lg,
      }}
    >
      <Text style={{ ...theme.typography.body2, color: '#ffffff', fontWeight: '500' }}>
        {message}
      </Text>
    </Animated.View>
  );
}
