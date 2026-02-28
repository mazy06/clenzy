import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, Pressable, RefreshControl, FlatList, Animated, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useInbox, useSentMessages, useGuestMessageHistory, useArchiveMessage, useDeleteMessage } from '@/hooks/useMessages';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Card } from '@/components/ui/Card';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { useTheme } from '@/theme';
import type { ContactMessage } from '@/api/endpoints/contactApi';
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

/* ─── Tab: Interne ─── */

function InterneTab({ theme, navigation }: { theme: ReturnType<typeof useTheme>; navigation: MessagingNavProp }) {
  const [subFilter, setSubFilter] = useState<'inbox' | 'sent'>('inbox');
  const { data: inboxData, isLoading: inboxLoading, isRefetching: inboxRefetching, refetch: refetchInbox } = useInbox();
  const { data: sentData, isLoading: sentLoading, isRefetching: sentRefetching, refetch: refetchSent } = useSentMessages();
  const archiveMutation = useArchiveMessage();
  const deleteMutation = useDeleteMessage();

  const handleArchive = useCallback((id: number) => {
    archiveMutation.mutate(id);
  }, [archiveMutation]);

  const handleDelete = useCallback((id: number) => {
    deleteMutation.mutate(id);
  }, [deleteMutation]);

  const isLoading = subFilter === 'inbox' ? inboxLoading : sentLoading;
  const isRefetching = subFilter === 'inbox' ? inboxRefetching : sentRefetching;
  const refetch = subFilter === 'inbox' ? refetchInbox : refetchSent;

  const messages = useMemo(() => {
    if (subFilter === 'inbox') {
      return inboxData?.pages.flatMap((p) => p.content) ?? [];
    }
    return sentData?.pages.flatMap((p) => p.content) ?? [];
  }, [subFilter, inboxData, sentData]);

  return (
    <View style={{ flex: 1 }}>
      {/* Sub-filter chips: Reçus / Envoyés */}
      <View style={{
        flexDirection: 'row',
        paddingHorizontal: theme.SPACING.lg,
        paddingTop: theme.SPACING.md,
        paddingBottom: theme.SPACING.sm,
        gap: theme.SPACING.sm,
      }}>
        {([
          { key: 'inbox' as const, label: 'Recus', icon: 'arrow-down-outline' as IoniconsName },
          { key: 'sent' as const, label: 'Envoyes', icon: 'arrow-up-outline' as IoniconsName },
        ]).map((f) => {
          const active = subFilter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setSubFilter(f.key)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: theme.BORDER_RADIUS.full,
                backgroundColor: active ? `${theme.colors.primary.main}12` : theme.colors.background.surface,
                borderWidth: 1,
                borderColor: active ? theme.colors.primary.main : theme.colors.border.light,
              }}
            >
              <Ionicons
                name={f.icon}
                size={13}
                color={active ? theme.colors.primary.main : theme.colors.text.disabled}
              />
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

      {isLoading ? (
        <MessageListSkeleton theme={theme} />
      ) : messages.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 40 }}>
          <EmptyState
            iconName={subFilter === 'inbox' ? 'mail-open-outline' : 'send-outline'}
            title={subFilter === 'inbox' ? 'Aucun message recu' : 'Aucun message envoye'}
            description={
              subFilter === 'inbox'
                ? 'Les messages de votre equipe et du manager apparaitront ici'
                : 'Vos messages envoyes apparaitront ici'
            }
          />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <SwipeableMessageCard
              message={item}
              isSent={subFilter === 'sent'}
              onPress={() => navigation.navigate('MessageDetail', { message: item, isSent: subFilter === 'sent' })}
              onArchive={handleArchive}
              onDelete={handleDelete}
              theme={theme}
            />
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
