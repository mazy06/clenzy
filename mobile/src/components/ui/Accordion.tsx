import React, { useState, useRef, useCallback } from 'react';
import { View, Text, Pressable, Animated, LayoutAnimation, Platform, UIManager, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface AccordionProps {
  title: string;
  iconName?: IoniconsName;
  iconColor?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  style?: ViewStyle;
  badge?: string;
}

export function Accordion({ title, iconName, iconColor, children, defaultOpen = false, style, badge }: AccordionProps) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const rotation = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(rotation, {
      toValue: isOpen ? 0 : 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
    setIsOpen((prev) => !prev);
  }, [isOpen, rotation]);

  const rotateInterpolate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={[{
      backgroundColor: theme.colors.background.paper,
      borderRadius: theme.BORDER_RADIUS.lg,
      overflow: 'hidden',
      ...theme.shadows.sm,
    }, style]}>
      <Pressable
        onPress={toggle}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: theme.SPACING.md,
          paddingHorizontal: theme.SPACING.lg,
          backgroundColor: pressed ? theme.colors.background.surface : 'transparent',
        })}
      >
        {iconName && (
          <View style={{
            width: 32,
            height: 32,
            borderRadius: theme.BORDER_RADIUS.sm,
            backgroundColor: `${iconColor || theme.colors.primary.main}0C`,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: theme.SPACING.md,
          }}>
            <Ionicons name={iconName} size={16} color={iconColor || theme.colors.primary.main} />
          </View>
        )}
        <Text style={{ ...theme.typography.body1, color: theme.colors.text.primary, fontWeight: '600', flex: 1 }}>
          {title}
        </Text>
        {badge && (
          <View style={{
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: theme.BORDER_RADIUS.full,
            backgroundColor: `${theme.colors.primary.main}0C`,
            marginRight: theme.SPACING.sm,
          }}>
            <Text style={{ ...theme.typography.caption, color: theme.colors.primary.main, fontWeight: '600' }}>
              {badge}
            </Text>
          </View>
        )}
        <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
          <Ionicons name="chevron-down" size={18} color={theme.colors.text.disabled} />
        </Animated.View>
      </Pressable>

      {isOpen && (
        <View style={{
          paddingHorizontal: theme.SPACING.lg,
          paddingBottom: theme.SPACING.lg,
          paddingTop: theme.SPACING.xs,
        }}>
          <View style={{
            height: 1,
            backgroundColor: theme.colors.border.light,
            marginBottom: theme.SPACING.md,
          }} />
          {children}
        </View>
      )}
    </View>
  );
}
