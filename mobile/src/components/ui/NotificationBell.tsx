import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationStore } from '@/store/notificationStore';
import { useUnreadCount } from '@/hooks/useNotifications';
import { useTheme } from '@/theme';

/**
 * Notification bell icon with unread badge.
 * Polls unread count every 30s. Navigates to Notifications screen on press.
 * Drop this component into any screen header.
 */
export function NotificationBell() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  // Start polling unread count
  useUnreadCount();

  return (
    <Pressable
      onPress={() => navigation.navigate('Notifications')}
      hitSlop={10}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: pressed ? theme.colors.background.surface : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Ionicons name="notifications-outline" size={22} color={theme.colors.text.primary} />

      {/* Badge */}
      {unreadCount > 0 && (
        <View style={{
          position: 'absolute',
          top: 4,
          right: 2,
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: theme.colors.error.main,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 4,
          borderWidth: 2,
          borderColor: theme.colors.background.paper,
        }}>
          <Text style={{
            fontSize: 10,
            fontWeight: '700',
            color: '#FFFFFF',
            textAlign: 'center',
          }}>
            {unreadCount > 99 ? '99+' : String(unreadCount)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
