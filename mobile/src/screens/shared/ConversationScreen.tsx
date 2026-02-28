import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/theme';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { useConversations, useMyConversations } from '@/hooks/useConversations';
import type { ConversationDto, ConversationStatus, ConversationChannel } from '@/api/endpoints/conversationApi';

type IoniconsName = keyof typeof Ionicons.glyphMap;

/* ─── Channel config ─── */

const CHANNEL_CONFIG: Record<string, { icon: IoniconsName; label: string; color: string }> = {
  AIRBNB: { icon: 'logo-no-smoking', label: 'Airbnb', color: '#FF5A5F' },
  BOOKING: { icon: 'bed-outline', label: 'Booking', color: '#003580' },
  WHATSAPP: { icon: 'logo-whatsapp', label: 'WhatsApp', color: '#25D366' },
  EMAIL: { icon: 'mail-outline', label: 'Email', color: '#6B7280' },
  SMS: { icon: 'chatbox-outline', label: 'SMS', color: '#8B5CF6' },
  INTERNAL: { icon: 'people-outline', label: 'Interne', color: '#059669' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  OPEN: { label: 'Ouverte', color: '#059669' },
  CLOSED: { label: 'Fermee', color: '#6B7280' },
  ARCHIVED: { label: 'Archivee', color: '#9CA3AF' },
};

type FilterKey = 'all' | 'OPEN' | 'CLOSED';

/* ─── Helpers ─── */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "A l'instant";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}j`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/* ─── Props ─── */

export interface ConversationScreenProps {
  /** Show only conversations assigned to current user */
  mineOnly?: boolean;
  /** Filter by channel (e.g. 'INTERNAL' for field workers) */
  channelFilter?: ConversationChannel;
  /** Show back button (when used inside a stack) */
  showBack?: boolean;
  /** Show header (false when embedded as a tab) */
  showHeader?: boolean;
  /** Custom title */
  title?: string;
}

/* ─── Conversation Card ─── */

function ConversationCard({
  conversation,
  theme,
  onPress,
}: {
  conversation: ConversationDto;
  theme: ReturnType<typeof useTheme>;
  onPress: () => void;
}) {
  const channelCfg = CHANNEL_CONFIG[conversation.channel] ?? CHANNEL_CONFIG.INTERNAL;
  const statusCfg = STATUS_CONFIG[conversation.status] ?? STATUS_CONFIG.OPEN;
  const hasUnread = conversation.unreadCount > 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.SPACING.md,
        paddingHorizontal: theme.SPACING.lg,
        paddingVertical: theme.SPACING.md,
        backgroundColor: pressed
          ? theme.colors.background.surface
          : hasUnread
          ? `${theme.colors.primary.main}04`
          : theme.colors.background.default,
        borderBottomWidth: 0.5,
        borderBottomColor: theme.colors.border.light,
      })}
    >
      {/* Avatar */}
      <View style={{
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: `${channelCfg.color}18`,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: channelCfg.color }}>
          {getInitials(conversation.guestName)}
        </Text>
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <Text
            style={{
              ...theme.typography.body2,
              fontWeight: hasUnread ? '700' : '500',
              color: theme.colors.text.primary,
              flex: 1,
            }}
            numberOfLines={1}
          >
            {conversation.guestName || 'Sans nom'}
          </Text>
          {conversation.lastMessageAt && (
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, fontSize: 11 }}>
              {timeAgo(conversation.lastMessageAt)}
            </Text>
          )}
        </View>

        {/* Property + channel */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          {conversation.propertyName && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="home-outline" size={10} color={theme.colors.text.disabled} />
              <Text style={{ fontSize: 10, color: theme.colors.text.disabled }} numberOfLines={1}>
                {conversation.propertyName}
              </Text>
            </View>
          )}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            paddingHorizontal: 5,
            paddingVertical: 1,
            borderRadius: 4,
            backgroundColor: `${channelCfg.color}10`,
          }}>
            <Ionicons name={channelCfg.icon} size={9} color={channelCfg.color} />
            <Text style={{ fontSize: 9, color: channelCfg.color, fontWeight: '600' }}>
              {channelCfg.label}
            </Text>
          </View>
        </View>

        {/* Last message preview */}
        {conversation.lastMessageContent && (
          <Text
            style={{
              ...theme.typography.caption,
              color: hasUnread ? theme.colors.text.secondary : theme.colors.text.disabled,
              fontWeight: hasUnread ? '600' : '400',
            }}
            numberOfLines={1}
          >
            {conversation.lastMessageContent}
          </Text>
        )}
      </View>

      {/* Unread badge */}
      {hasUnread && (
        <View style={{
          minWidth: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: theme.colors.primary.main,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 5,
        }}>
          <Text style={{ fontSize: 11, color: '#fff', fontWeight: '800' }}>
            {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/* ─── Loading Skeleton ─── */

function ConversationSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ gap: 0 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.SPACING.md,
          paddingHorizontal: theme.SPACING.lg,
          paddingVertical: theme.SPACING.md,
        }}>
          <Skeleton width={46} height={46} borderRadius={23} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="80%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ─── Main Screen ─── */

export function ConversationScreen({
  mineOnly = false,
  channelFilter,
  showBack = false,
  showHeader = true,
  title = 'Messages',
}: ConversationScreenProps) {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState<FilterKey>('all');

  const statusParam = filter === 'all' ? undefined : filter as ConversationStatus;
  const { data: allConversations, isLoading, isRefetching, refetch } = mineOnly
    ? useMyConversations()
    : useConversations(statusParam);

  // Apply channel filter
  const conversations = useMemo(() => {
    if (!allConversations) return [];
    if (!channelFilter) return allConversations;
    return allConversations.filter((c) => c.channel === channelFilter);
  }, [allConversations, channelFilter]);

  const handleOpenConversation = useCallback((conversation: ConversationDto) => {
    navigation.navigate('ConversationDetail', { conversationId: conversation.id });
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: ConversationDto }) => (
    <ConversationCard
      conversation={item}
      theme={theme}
      onPress={() => handleOpenConversation(item)}
    />
  ), [theme, handleOpenConversation]);

  const keyExtractor = useCallback((item: ConversationDto) => String(item.id), []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={showHeader ? ['top'] : []}>
      {/* Header */}
      {showHeader && (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: theme.SPACING.lg,
          paddingVertical: theme.SPACING.md,
          borderBottomWidth: 0.5,
          borderBottomColor: theme.colors.border.light,
          backgroundColor: theme.colors.background.paper,
          gap: theme.SPACING.sm,
        }}>
          {showBack && (
            <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
              <Ionicons name="chevron-back" size={22} color={theme.colors.text.primary} />
            </Pressable>
          )}
          <Ionicons name="chatbubbles" size={22} color={theme.colors.primary.main} />
          <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary, flex: 1 }}>
            {title}
          </Text>
        </View>
      )}

      {/* Filter chips */}
      <View style={{
        flexDirection: 'row',
        gap: theme.SPACING.sm,
        paddingHorizontal: theme.SPACING.lg,
        paddingVertical: theme.SPACING.sm,
        borderBottomWidth: 0.5,
        borderBottomColor: theme.colors.border.light,
      }}>
        {([
          { key: 'all' as FilterKey, label: 'Toutes' },
          { key: 'OPEN' as FilterKey, label: 'Ouvertes' },
          { key: 'CLOSED' as FilterKey, label: 'Fermees' },
        ]).map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: theme.BORDER_RADIUS.full,
                backgroundColor: active ? `${theme.colors.primary.main}14` : theme.colors.background.surface,
                borderWidth: 1,
                borderColor: active ? theme.colors.primary.main : theme.colors.border.light,
              }}
            >
              <Text style={{
                ...theme.typography.caption,
                fontWeight: active ? '700' : '500',
                color: active ? theme.colors.primary.main : theme.colors.text.secondary,
              }}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Content */}
      {isLoading ? (
        <ConversationSkeleton theme={theme} />
      ) : conversations.length === 0 ? (
        <EmptyState
          iconName="chatbubbles-outline"
          title="Aucune conversation"
          description="Vos conversations apparaitront ici"
          compact
          style={{ marginTop: theme.SPACING['2xl'] }}
        />
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.colors.primary.main}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </SafeAreaView>
  );
}
