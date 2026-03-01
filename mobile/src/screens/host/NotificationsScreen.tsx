import React, { useCallback } from 'react';
import { View, Text, Pressable, FlatList, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications, useMarkNotificationRead, useMarkAllRead, useDismissNotification } from '@/hooks/useNotifications';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/theme';
import type { Notification } from '@/api/endpoints/notificationsApi';

type IoniconsName = keyof typeof Ionicons.glyphMap;

/* ─── Helpers ─── */

function formatRelativeDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "A l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

const TYPE_CONFIG: Record<string, { icon: IoniconsName; color: string }> = {
  info: { icon: 'information-circle', color: '#4F8EF7' },
  success: { icon: 'checkmark-circle', color: '#4A9B8E' },
  warning: { icon: 'alert-circle', color: '#D97706' },
  error: { icon: 'close-circle', color: '#C97A7A' },
};

const CATEGORY_ICONS: Record<string, IoniconsName> = {
  intervention: 'construct-outline',
  service_request: 'clipboard-outline',
  payment: 'card-outline',
  system: 'settings-outline',
  team: 'people-outline',
  contact: 'mail-outline',
  document: 'document-outline',
  guest_messaging: 'chatbubble-outline',
  noise_alert: 'volume-high-outline',
};

/* ─── Sub-components ─── */

function NotificationItem({ item, onRead, onDismiss, theme }: {
  item: Notification;
  onRead: (id: number) => void;
  onDismiss: (id: number) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const typeCfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.info;
  const categoryIcon = CATEGORY_ICONS[item.category] ?? 'notifications-outline';

  const handlePress = useCallback(() => {
    if (!item.read) {
      onRead(item.id);
    }
  }, [item.id, item.read, onRead]);

  const handleLongPress = useCallback(() => {
    Alert.alert(
      'Notification',
      'Que souhaitez-vous faire ?',
      [
        { text: 'Annuler', style: 'cancel' },
        ...(!item.read ? [{ text: 'Marquer comme lu', onPress: () => onRead(item.id) }] : []),
        { text: 'Supprimer', style: 'destructive' as const, onPress: () => onDismiss(item.id) },
      ],
    );
  }, [item.id, item.read, onRead, onDismiss]);

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        paddingHorizontal: theme.SPACING.lg,
        paddingVertical: theme.SPACING.md,
        backgroundColor: pressed
          ? theme.colors.background.surface
          : item.read
            ? theme.colors.background.default
            : `${theme.colors.primary.main}04`,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border.light,
        gap: theme.SPACING.md,
      })}
    >
      {/* Icon */}
      <View style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: `${typeCfg.color}12`,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
      }}>
        <Ionicons name={categoryIcon} size={18} color={typeCfg.color} />
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {/* Title + time */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.SPACING.sm }}>
          <Text
            style={{
              ...theme.typography.body2,
              fontWeight: item.read ? '500' : '700',
              color: theme.colors.text.primary,
              flex: 1,
            }}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, marginTop: 2 }}>
            {formatRelativeDate(item.createdAt)}
          </Text>
        </View>

        {/* Message */}
        <Text
          style={{
            ...theme.typography.caption,
            color: theme.colors.text.secondary,
            lineHeight: 18,
            marginTop: 2,
          }}
          numberOfLines={3}
        >
          {item.message}
        </Text>
      </View>

      {/* Unread dot */}
      {!item.read && (
        <View style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: theme.colors.primary.main,
          marginTop: 8,
        }} />
      )}
    </Pressable>
  );
}

function NotificationsSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ gap: 0 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={{
          flexDirection: 'row',
          paddingHorizontal: theme.SPACING.lg,
          paddingVertical: theme.SPACING.md,
          gap: theme.SPACING.md,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border.light,
        }}>
          <Skeleton width={40} height={40} borderRadius={20} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton height={14} width="70%" />
            <Skeleton height={12} width="90%" />
            <Skeleton height={10} width="40%" />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ─── Main Screen ─── */

export function NotificationsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { data: notifications, isLoading, isRefetching, refetch } = useNotifications();
  const markAsRead = useMarkNotificationRead();
  const markAllRead = useMarkAllRead();
  const dismiss = useDismissNotification();

  const hasUnread = notifications?.some((n) => !n.read) ?? false;

  const handleRead = useCallback((id: number) => {
    markAsRead.mutate(id);
  }, [markAsRead]);

  const handleDismiss = useCallback((id: number) => {
    dismiss.mutate(id);
  }, [dismiss]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.SPACING.lg,
        paddingVertical: theme.SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border.light,
        backgroundColor: theme.colors.background.paper,
        gap: theme.SPACING.md,
      }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text.primary} />
        </Pressable>
        <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary, flex: 1 }}>
          Notifications
        </Text>
        {hasUnread && (
          <Pressable
            onPress={() => markAllRead.mutate()}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={{ ...theme.typography.caption, color: theme.colors.primary.main, fontWeight: '700' }}>
              Tout lire
            </Text>
          </Pressable>
        )}
      </View>

      {/* Content */}
      {isLoading ? (
        <NotificationsSkeleton theme={theme} />
      ) : !notifications || notifications.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            iconName="notifications-off-outline"
            title="Aucune notification"
            description="Vous serez notifie lors de nouvelles activites"
          />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <NotificationItem
              item={item}
              onRead={handleRead}
              onDismiss={handleDismiss}
              theme={theme}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.colors.primary.main}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
