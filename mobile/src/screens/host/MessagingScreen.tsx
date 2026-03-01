import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, Pressable, RefreshControl, FlatList, Animated, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useInbox, useSentMessages, useGuestMessageHistory, useArchiveMessage, useDeleteMessage, useContactThreads } from '@/hooks/useMessages';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { useTheme } from '@/theme';
import type { ContactMessage, ContactThreadSummary } from '@/api/endpoints/contactApi';
import type { GuestMessageLog } from '@/api/endpoints/guestMessagingApi';
import type { MessagingStackParamList } from '@/navigation/HostNavigator';
import { ConversationScreen } from '@/screens/shared/ConversationScreen';

type MessagingNavProp = NativeStackNavigationProp<MessagingStackParamList, 'MessageList'>;

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
    if (diffMins < 60) return `${diffMins} min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}j`;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Admin',
  SUPER_MANAGER: 'Manager Clenzy',
  HOST: 'Proprietaire',
  SUPERVISOR: 'Superviseur',
  HOUSEKEEPER: 'Agent menage',
  TECHNICIAN: 'Technicien',
  LAUNDRY: 'Blanchisserie',
  EXTERIOR_TECH: 'Ext. technique',
};

const PRIORITY_CONFIG: Record<string, { color: string; icon: IoniconsName }> = {
  HIGH: { color: '#D97706', icon: 'alert-circle' },
  MEDIUM: { color: '#6B8A9A', icon: 'remove-circle' },
  LOW: { color: '#64748B', icon: 'arrow-down-circle' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  SENT: { label: 'Envoye', color: '#6B8A9A' },
  DELIVERED: { label: 'Remis', color: '#4A9B8E' },
  READ: { label: 'Lu', color: '#4A9B8E' },
  PENDING: { label: 'En attente', color: '#D4A574' },
  FAILED: { label: 'Echoue', color: '#C97A7A' },
};

const GUEST_MSG_STATUS: Record<string, { label: string; color: string; icon: IoniconsName }> = {
  SENT: { label: 'Envoye', color: '#4A9B8E', icon: 'checkmark-circle' },
  PENDING: { label: 'En attente', color: '#D4A574', icon: 'time' },
  FAILED: { label: 'Echoue', color: '#C97A7A', icon: 'close-circle' },
};

const TEMPLATE_TYPE_ICONS: Record<string, { icon: IoniconsName; color: string }> = {
  CHECK_IN: { icon: 'log-in-outline', color: '#4A9B8E' },
  CHECK_OUT: { icon: 'log-out-outline', color: '#D97706' },
  WELCOME: { icon: 'hand-left-outline', color: '#6B8A9A' },
  CUSTOM: { icon: 'create-outline', color: '#7BA3C2' },
};

type TabKey = 'interne' | 'voyageurs' | 'conversations';

/* ─── Sub-components ─── */

function TabBar({ activeTab, onTabChange, theme }: {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const tabs: { key: TabKey; label: string; icon: IoniconsName }[] = [
    { key: 'interne', label: 'Interne', icon: 'people-outline' },
    { key: 'voyageurs', label: 'Voyageurs', icon: 'airplane-outline' },
    { key: 'conversations', label: 'Conversations', icon: 'chatbubbles-outline' },
  ];

  return (
    <View style={{
      flexDirection: 'row',
      marginHorizontal: theme.SPACING.lg,
      marginTop: theme.SPACING.sm,
      backgroundColor: theme.colors.background.surface,
      borderRadius: theme.BORDER_RADIUS.lg,
      padding: 3,
    }}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onTabChange(tab.key)}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 10,
              borderRadius: theme.BORDER_RADIUS.md,
              backgroundColor: isActive ? theme.colors.background.paper : 'transparent',
              ...(isActive ? theme.shadows.sm : {}),
            }}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={isActive ? theme.colors.primary.main : theme.colors.text.disabled}
            />
            <Text style={{
              ...theme.typography.body2,
              fontWeight: isActive ? '700' : '500',
              color: isActive ? theme.colors.primary.main : theme.colors.text.disabled,
            }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Avatar circle with initials */
function AvatarCircle({ name, color, theme }: {
  name?: string | null;
  color: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: `${color}15`,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Text style={{
        ...theme.typography.body2,
        fontWeight: '700',
        color,
        fontSize: 15,
      }}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

/** Internal message card (inbox / sent) */
function InternalMessageCard({ message, isSent, onPress, theme }: {
  message: ContactMessage;
  isSent: boolean;
  onPress?: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const contactName = isSent ? message.recipientName : message.senderName;
  const priorityCfg = PRIORITY_CONFIG[message.priority];
  const statusCfg = STATUS_CONFIG[message.status];
  const isUnread = !isSent && message.status === 'SENT';

  return (
    <Card
      onPress={onPress}
      style={{
        marginBottom: theme.SPACING.sm,
        borderLeftWidth: isUnread ? 3 : 0,
        borderLeftColor: isUnread ? theme.colors.primary.main : 'transparent',
      }}
    >
      <View style={{ flexDirection: 'row', gap: theme.SPACING.md }}>
        {/* Avatar */}
        <AvatarCircle
          name={contactName}
          color={isSent ? theme.colors.secondary.main : theme.colors.primary.main}
          theme={theme}
        />

        {/* Content */}
        <View style={{ flex: 1 }}>
          {/* Name + time row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <Text
              style={{
                ...theme.typography.body2,
                fontWeight: isUnread ? '700' : '600',
                color: theme.colors.text.primary,
                flex: 1,
                marginRight: theme.SPACING.sm,
              }}
              numberOfLines={1}
            >
              {isSent && (
                <Text style={{ color: theme.colors.text.disabled }}>{'A: '}</Text>
              )}
              {contactName || 'Inconnu'}
            </Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
              {formatRelativeDate(message.createdAt)}
            </Text>
          </View>

          {/* Subject */}
          <Text
            style={{
              ...theme.typography.body2,
              fontWeight: isUnread ? '600' : '400',
              color: theme.colors.text.primary,
              marginBottom: 2,
            }}
            numberOfLines={1}
          >
            {message.subject}
          </Text>

          {/* Message preview */}
          <Text
            style={{ ...theme.typography.caption, color: theme.colors.text.secondary, lineHeight: 18 }}
            numberOfLines={2}
          >
            {message.message}
          </Text>

          {/* Bottom badges row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
            {/* Priority */}
            {priorityCfg && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name={priorityCfg.icon} size={12} color={priorityCfg.color} />
                <Text style={{ fontSize: 10, color: priorityCfg.color, fontWeight: '600' }}>
                  {message.priority}
                </Text>
              </View>
            )}
            {/* Status */}
            {statusCfg && (
              <View style={{
                paddingHorizontal: 6,
                paddingVertical: 1,
                borderRadius: theme.BORDER_RADIUS.full,
                backgroundColor: `${statusCfg.color}12`,
              }}>
                <Text style={{ fontSize: 10, color: statusCfg.color, fontWeight: '600' }}>
                  {statusCfg.label}
                </Text>
              </View>
            )}
            {/* Attachments count */}
            {message.attachments && message.attachments.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Ionicons name="attach" size={12} color={theme.colors.text.disabled} />
                <Text style={{ fontSize: 10, color: theme.colors.text.disabled }}>
                  {message.attachments.length}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Card>
  );
}

/** Swipeable wrapper for message cards with archive/delete actions */
function SwipeableMessageCard({ message, isSent, onPress, onArchive, onDelete, theme }: {
  message: ContactMessage;
  isSent: boolean;
  onPress?: () => void;
  onArchive: (id: number) => void;
  onDelete: (id: number) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = (_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const translateArchive = dragX.interpolate({
      inputRange: [-150, -75, 0],
      outputRange: [0, 0, 75],
      extrapolate: 'clamp',
    });
    const translateDelete = dragX.interpolate({
      inputRange: [-150, -75, 0],
      outputRange: [0, 75, 150],
      extrapolate: 'clamp',
    });

    return (
      <View style={{ flexDirection: 'row', marginBottom: theme.SPACING.sm }}>
        <Animated.View style={{ transform: [{ translateX: translateArchive }] }}>
          <Pressable
            onPress={() => {
              swipeableRef.current?.close();
              onArchive(message.id);
            }}
            style={{
              width: 72,
              height: '100%',
              backgroundColor: theme.colors.primary.main,
              justifyContent: 'center',
              alignItems: 'center',
              borderTopLeftRadius: theme.BORDER_RADIUS.lg,
              borderBottomLeftRadius: theme.BORDER_RADIUS.lg,
            }}
          >
            <Ionicons name="archive-outline" size={22} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600', marginTop: 2 }}>Archiver</Text>
          </Pressable>
        </Animated.View>
        <Animated.View style={{ transform: [{ translateX: translateDelete }] }}>
          <Pressable
            onPress={() => {
              swipeableRef.current?.close();
              Alert.alert(
                'Supprimer le message',
                'Cette action est irreversible. Confirmer la suppression ?',
                [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Supprimer', style: 'destructive', onPress: () => onDelete(message.id) },
                ],
              );
            }}
            style={{
              width: 72,
              height: '100%',
              backgroundColor: '#DC2626',
              justifyContent: 'center',
              alignItems: 'center',
              borderTopRightRadius: theme.BORDER_RADIUS.lg,
              borderBottomRightRadius: theme.BORDER_RADIUS.lg,
            }}
          >
            <Ionicons name="trash-outline" size={22} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600', marginTop: 2 }}>Supprimer</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      <InternalMessageCard message={message} isSent={isSent} onPress={onPress} theme={theme} />
    </Swipeable>
  );
}

/** Guest message log card */
function GuestMessageCard({ log, theme }: {
  log: GuestMessageLog;
  theme: ReturnType<typeof useTheme>;
}) {
  const statusCfg = GUEST_MSG_STATUS[log.status] ?? GUEST_MSG_STATUS.PENDING;
  const typeName = log.templateName?.includes('CHECK_IN') ? 'CHECK_IN'
    : log.templateName?.includes('CHECK_OUT') ? 'CHECK_OUT'
    : log.templateName?.includes('WELCOME') ? 'WELCOME'
    : 'CUSTOM';
  const typeCfg = TEMPLATE_TYPE_ICONS[typeName] ?? TEMPLATE_TYPE_ICONS.CUSTOM;

  return (
    <Card style={{ marginBottom: theme.SPACING.sm }}>
      <View style={{ flexDirection: 'row', gap: theme.SPACING.md }}>
        {/* Type icon */}
        <View style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: `${typeCfg.color}12`,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Ionicons name={typeCfg.icon} size={20} color={typeCfg.color} />
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          {/* Guest name + date */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <Text style={{ ...theme.typography.body2, fontWeight: '600', color: theme.colors.text.primary, flex: 1, marginRight: theme.SPACING.sm }} numberOfLines={1}>
              {log.guestName || log.recipient}
            </Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
              {formatRelativeDate(log.sentAt || log.createdAt)}
            </Text>
          </View>

          {/* Subject */}
          {log.subject && (
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.secondary, marginBottom: 2 }} numberOfLines={1}>
              {log.subject}
            </Text>
          )}

          {/* Template name */}
          {log.templateName && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <Ionicons name="document-text-outline" size={11} color={theme.colors.text.disabled} />
              <Text style={{ fontSize: 11, color: theme.colors.text.disabled }}>
                {log.templateName}
              </Text>
            </View>
          )}

          {/* Bottom row: channel + status */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            {/* Channel */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="mail-outline" size={11} color={theme.colors.text.disabled} />
              <Text style={{ fontSize: 10, color: theme.colors.text.disabled, fontWeight: '500' }}>
                {log.channel}
              </Text>
            </View>
            {/* Status badge */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: theme.BORDER_RADIUS.full,
              backgroundColor: `${statusCfg.color}12`,
            }}>
              <Ionicons name={statusCfg.icon} size={10} color={statusCfg.color} />
              <Text style={{ fontSize: 10, color: statusCfg.color, fontWeight: '600' }}>
                {statusCfg.label}
              </Text>
            </View>
            {/* Error message */}
            {log.errorMessage && (
              <Text style={{ fontSize: 10, color: theme.colors.error.main, flex: 1 }} numberOfLines={1}>
                {log.errorMessage}
              </Text>
            )}
          </View>
        </View>
      </View>
    </Card>
  );
}

function MessageListSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ padding: theme.SPACING.lg, gap: theme.SPACING.sm }}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={{ flexDirection: 'row', gap: theme.SPACING.md, padding: theme.SPACING.md }}>
          <Skeleton width={44} height={44} borderRadius={22} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton height={14} width="60%" />
            <Skeleton height={12} width="80%" />
            <Skeleton height={10} width="40%" />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ─── Avatar colors for threads ─── */

const THREAD_AVATAR_COLORS = [
  '#1976d2', '#388e3c', '#d32f2f', '#7b1fa2',
  '#c2185b', '#0097a7', '#f57c00', '#5d4037',
  '#455a64', '#00838f', '#ad1457', '#6a1b9a',
];

function getThreadAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return THREAD_AVATAR_COLORS[Math.abs(hash) % THREAD_AVATAR_COLORS.length];
}

function getThreadInitials(firstName: string, lastName: string): string {
  return `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase() || '?';
}

/* ─── Tab: Interne (WhatsApp-like thread list) ─── */

function InterneTab({ theme, navigation }: { theme: ReturnType<typeof useTheme>; navigation: MessagingNavProp }) {
  const [search, setSearch] = useState('');
  const { data: threads, isLoading, isRefetching, refetch } = useContactThreads();

  const filteredThreads = useMemo(() => {
    if (!threads) return [];
    if (!search.trim()) return threads;
    const q = search.toLowerCase();
    return threads.filter(
      (th) =>
        `${th.counterpartFirstName} ${th.counterpartLastName}`.toLowerCase().includes(q) ||
        th.counterpartEmail.toLowerCase().includes(q),
    );
  }, [threads, search]);

  const handleOpenThread = useCallback((thread: ContactThreadSummary) => {
    navigation.navigate('InternalChat', { thread });
  }, [navigation]);

  const renderThread = useCallback(({ item }: { item: ContactThreadSummary }) => {
    const avatarColor = getThreadAvatarColor(item.counterpartKeycloakId);
    const hasUnread = item.unreadCount > 0;
    const fullName = `${item.counterpartFirstName} ${item.counterpartLastName}`.trim();

    return (
      <Pressable
        onPress={() => handleOpenThread(item)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.SPACING.md,
          paddingHorizontal: theme.SPACING.lg,
          paddingVertical: theme.SPACING.md,
          backgroundColor: pressed ? theme.colors.background.surface : 'transparent',
          borderLeftWidth: hasUnread ? 3 : 0,
          borderLeftColor: hasUnread ? theme.colors.primary.main : 'transparent',
        })}
      >
        {/* Avatar */}
        <View style={{ position: 'relative' }}>
          <View style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: `${avatarColor}18`,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{
              fontSize: 16,
              fontWeight: '700',
              color: avatarColor,
            }}>
              {getThreadInitials(item.counterpartFirstName, item.counterpartLastName)}
            </Text>
          </View>
          {/* Unread badge */}
          {hasUnread && (
            <View style={{
              position: 'absolute',
              top: -2,
              right: -4,
              minWidth: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: theme.colors.error.main,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 5,
              borderWidth: 2,
              borderColor: theme.colors.background.paper,
            }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>
                {item.unreadCount > 99 ? '99+' : item.unreadCount}
              </Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
            <Text
              style={{
                ...theme.typography.body2,
                fontWeight: hasUnread ? '700' : '600',
                color: theme.colors.text.primary,
                flex: 1,
                marginRight: theme.SPACING.sm,
              }}
              numberOfLines={1}
            >
              {fullName || 'Inconnu'}
            </Text>
            <Text style={{
              ...theme.typography.caption,
              color: hasUnread ? theme.colors.primary.main : theme.colors.text.disabled,
              fontWeight: hasUnread ? '600' : '400',
            }}>
              {formatRelativeDate(item.lastMessageAt)}
            </Text>
          </View>

          <Text
            style={{
              ...theme.typography.caption,
              color: theme.colors.text.secondary,
              lineHeight: 18,
              fontWeight: hasUnread ? '500' : '400',
            }}
            numberOfLines={2}
          >
            {item.lastMessagePreview || '\u2014'}
          </Text>
        </View>

        {/* Chevron */}
        <Ionicons name="chevron-forward" size={16} color={theme.colors.text.disabled} />
      </Pressable>
    );
  }, [theme, handleOpenThread]);

  return (
    <View style={{ flex: 1 }}>
      {/* Search bar */}
      <View style={{
        paddingHorizontal: theme.SPACING.lg,
        paddingTop: theme.SPACING.md,
        paddingBottom: theme.SPACING.sm,
      }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: theme.colors.background.surface,
          borderRadius: theme.BORDER_RADIUS.lg,
          paddingHorizontal: theme.SPACING.md,
          height: 40,
          gap: 8,
        }}>
          <Ionicons name="search" size={16} color={theme.colors.text.disabled} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher un contact..."
            placeholderTextColor={theme.colors.text.disabled}
            style={{
              flex: 1,
              ...theme.typography.body2,
              color: theme.colors.text.primary,
              paddingVertical: 0,
            }}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={theme.colors.text.disabled} />
            </Pressable>
          )}
        </View>
      </View>

      {isLoading ? (
        <MessageListSkeleton theme={theme} />
      ) : filteredThreads.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 40 }}>
          <EmptyState
            iconName="chatbubbles-outline"
            title="Aucune conversation"
            description="Vos echanges avec les membres de l'organisation apparaitront ici"
          />
        </View>
      ) : (
        <FlatList
          data={filteredThreads}
          keyExtractor={(item) => item.counterpartKeycloakId}
          renderItem={renderThread}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          ItemSeparatorComponent={() => (
            <View style={{
              height: 0.5,
              backgroundColor: theme.colors.border.light,
              marginLeft: 80,
            }} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.colors.primary.main}
            />
          }
        />
      )}
    </View>
  );
}

/* ─── Tab: Voyageurs ─── */

function VoyageursTab({ theme }: { theme: ReturnType<typeof useTheme> }) {
  const { data: history, isLoading, isRefetching, refetch } = useGuestMessageHistory();

  const sortedHistory = useMemo(() => {
    if (!history) return [];
    return [...history].sort((a, b) =>
      new Date(b.sentAt || b.createdAt).getTime() - new Date(a.sentAt || a.createdAt).getTime()
    );
  }, [history]);

  if (isLoading) {
    return <MessageListSkeleton theme={theme} />;
  }

  if (!sortedHistory || sortedHistory.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 40 }}>
        <EmptyState
          iconName="airplane-outline"
          title="Aucun message voyageur"
          description="Les messages envoyes aux voyageurs via le channel manager apparaitront ici"
        />
      </View>
    );
  }

  return (
    <FlatList
      data={sortedHistory}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <GuestMessageCard log={item} theme={theme} />
      )}
      contentContainerStyle={{ padding: theme.SPACING.lg, paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={theme.colors.primary.main}
        />
      }
    />
  );
}

/* ─── Main Screen ─── */

export function MessagingScreen() {
  const theme = useTheme();
  const navigation = useNavigation<MessagingNavProp>();
  const [activeTab, setActiveTab] = useState<TabKey>('interne');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      {/* Header */}
      <View style={{
        paddingHorizontal: theme.SPACING.lg,
        paddingTop: theme.SPACING.lg,
        paddingBottom: theme.SPACING.sm,
        backgroundColor: theme.colors.background.paper,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border.light,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ ...theme.typography.h2, color: theme.colors.text.primary }}>
            Messagerie
          </Text>
          <NotificationBell />
        </View>

        {/* Tab bar */}
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} theme={theme} />
      </View>

      {/* Tab content */}
      {activeTab === 'interne' ? (
        <InterneTab theme={theme} navigation={navigation} />
      ) : activeTab === 'voyageurs' ? (
        <VoyageursTab theme={theme} />
      ) : (
        <ConversationScreen showHeader={false} title="Conversations" />
      )}
    </SafeAreaView>
  );
}
