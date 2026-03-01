import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useConversation,
  useConversationMessages,
  useSendConversationMessage,
  useMarkConversationRead,
  useUpdateConversationStatus,
} from '@/hooks/useConversations';
import { useSuggestResponse } from '@/hooks/useAiMessaging';
import type {
  ConversationMessageDto,
  ConversationChannel,
  ConversationStatus,
} from '@/api/endpoints/conversationApi';

type IoniconsName = keyof typeof Ionicons.glyphMap;

type RouteParams = {
  ConversationDetail: {
    conversationId: number;
  };
};

/* ─── Channel config ─── */

const CHANNEL_CONFIG: Record<string, { icon: IoniconsName; label: string; color: string }> = {
  AIRBNB: { icon: 'logo-no-smoking', label: 'Airbnb', color: '#FF5A5F' },
  BOOKING: { icon: 'bed-outline', label: 'Booking', color: '#003580' },
  WHATSAPP: { icon: 'logo-whatsapp', label: 'WhatsApp', color: '#25D366' },
  EMAIL: { icon: 'mail-outline', label: 'Email', color: '#6B7280' },
  SMS: { icon: 'chatbox-outline', label: 'SMS', color: '#8B5CF6' },
  INTERNAL: { icon: 'people-outline', label: 'Interne', color: '#059669' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: IoniconsName }> = {
  OPEN: { label: 'Ouverte', color: '#059669', icon: 'radio-button-on' },
  CLOSED: { label: 'Fermee', color: '#6B7280', icon: 'checkmark-circle' },
  ARCHIVED: { label: 'Archivee', color: '#9CA3AF', icon: 'archive' },
};

/* ─── Helpers ─── */

function formatMessageTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function formatDateSeparator(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
    if (d.toDateString() === yesterday.toDateString()) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return dateStr;
  }
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

function isSameDay(d1: string, d2: string): boolean {
  try {
    return new Date(d1).toDateString() === new Date(d2).toDateString();
  } catch {
    return false;
  }
}

/* ─── Message Bubble ─── */

function MessageBubble({
  message,
  showDateSeparator,
  theme,
}: {
  message: ConversationMessageDto;
  showDateSeparator: boolean;
  theme: ReturnType<typeof useTheme>;
}) {
  const isOutbound = message.direction === 'OUTBOUND';

  return (
    <View style={{ marginBottom: 4 }}>
      {/* Date separator */}
      {showDateSeparator && (
        <View style={{
          alignItems: 'center',
          marginVertical: 12,
        }}>
          <View style={{
            paddingHorizontal: 14,
            paddingVertical: 4,
            borderRadius: theme.BORDER_RADIUS.full,
            backgroundColor: theme.colors.background.surface,
          }}>
            <Text style={{
              ...theme.typography.caption,
              fontSize: 11,
              color: theme.colors.text.disabled,
              fontWeight: '600',
            }}>
              {formatDateSeparator(message.createdAt)}
            </Text>
          </View>
        </View>
      )}

      {/* Bubble */}
      <View style={{
        flexDirection: 'row',
        justifyContent: isOutbound ? 'flex-end' : 'flex-start',
        paddingHorizontal: 12,
        marginBottom: 2,
      }}>
        <View style={{
          maxWidth: '78%',
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 18,
          borderTopLeftRadius: isOutbound ? 18 : 4,
          borderTopRightRadius: isOutbound ? 4 : 18,
          backgroundColor: isOutbound
            ? theme.colors.primary.main
            : theme.colors.background.paper,
          ...(isOutbound ? {} : {
            borderWidth: 0.5,
            borderColor: theme.colors.border.light,
          }),
        }}>
          {/* Sender name (for inbound only) */}
          {!isOutbound && message.senderName && (
            <Text style={{
              ...theme.typography.caption,
              fontWeight: '700',
              color: theme.colors.primary.main,
              marginBottom: 3,
              fontSize: 11,
            }}>
              {message.senderName}
            </Text>
          )}

          {/* Message content */}
          <Text style={{
            ...theme.typography.body2,
            color: isOutbound ? '#FFFFFF' : theme.colors.text.primary,
            lineHeight: 20,
          }}>
            {message.content}
          </Text>

          {/* Time */}
          <Text style={{
            ...theme.typography.caption,
            fontSize: 10,
            color: isOutbound ? 'rgba(255,255,255,0.65)' : theme.colors.text.disabled,
            textAlign: 'right',
            marginTop: 4,
          }}>
            {formatMessageTime(message.createdAt)}
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ─── Loading Skeleton ─── */

function ChatSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ flex: 1, padding: 16, gap: 12, justifyContent: 'flex-end' }}>
      {/* Inbound */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-start' }}>
        <Skeleton width="60%" height={48} borderRadius={18} />
      </View>
      {/* Outbound */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Skeleton width="50%" height={40} borderRadius={18} />
      </View>
      {/* Inbound */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-start' }}>
        <Skeleton width="70%" height={56} borderRadius={18} />
      </View>
      {/* Outbound */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Skeleton width="45%" height={36} borderRadius={18} />
      </View>
    </View>
  );
}

/* ─── Main Screen ─── */

export function ConversationDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'ConversationDetail'>>();
  const { conversationId } = route.params;

  const [messageText, setMessageText] = useState('');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Data hooks
  const { data: conversation, isLoading: convLoading } = useConversation(conversationId);
  const {
    data: messagesData,
    isLoading: msgsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useConversationMessages(conversationId);
  const sendMutation = useSendConversationMessage();
  const markReadMutation = useMarkConversationRead();
  const statusMutation = useUpdateConversationStatus();
  const suggestMutation = useSuggestResponse();

  // Flatten paginated messages (oldest first for inverted FlatList)
  const messages = useMemo(() => {
    if (!messagesData?.pages) return [];
    // Pages come newest-first; flatten and reverse for inverted list
    const all = messagesData.pages.flatMap((page) => page.content);
    return all; // inverted FlatList renders bottom-up, so newest first is correct
  }, [messagesData]);

  // Mark as read on mount
  useEffect(() => {
    if (conversationId && conversation && conversation.unreadCount > 0) {
      markReadMutation.mutate(conversationId);
    }
  }, [conversationId, conversation?.unreadCount]);

  // Send message
  const handleSend = useCallback(() => {
    const text = messageText.trim();
    if (!text || sendMutation.isPending) return;

    sendMutation.mutate(
      { conversationId, content: text },
      {
        onSuccess: () => {
          setMessageText('');
        },
        onError: () => {
          Alert.alert('Erreur', "Impossible d'envoyer le message. Reessayez.");
        },
      },
    );
  }, [messageText, conversationId, sendMutation]);

  // AI suggest response
  const handleAiSuggest = useCallback(() => {
    // Find last inbound message
    const lastInbound = messages.find((m) => m.direction === 'INBOUND');
    if (!lastInbound) {
      Alert.alert('Info', 'Aucun message entrant pour generer une suggestion.');
      return;
    }

    suggestMutation.mutate(
      { message: lastInbound.content },
      {
        onSuccess: (result) => {
          setMessageText(result.suggestedResponse);
        },
        onError: () => {
          Alert.alert('Erreur', 'Impossible de generer une suggestion. Reessayez.');
        },
      },
    );
  }, [messages, suggestMutation]);

  // Change status
  const handleStatusChange = useCallback((newStatus: ConversationStatus) => {
    setShowStatusMenu(false);
    statusMutation.mutate(
      { conversationId, status: newStatus },
      {
        onError: () => {
          Alert.alert('Erreur', 'Impossible de changer le statut.');
        },
      },
    );
  }, [conversationId, statusMutation]);

  // Load older messages
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const channelCfg = CHANNEL_CONFIG[conversation?.channel ?? 'INTERNAL'] ?? CHANNEL_CONFIG.INTERNAL;
  const statusCfg = STATUS_CONFIG[conversation?.status ?? 'OPEN'] ?? STATUS_CONFIG.OPEN;
  const canSend = messageText.trim().length > 0 && !sendMutation.isPending;

  const renderMessage = useCallback(({ item, index }: { item: ConversationMessageDto; index: number }) => {
    // Show date separator if this is the first message or different day from next message
    // (inverted list, so index+1 is the previous message chronologically)
    const showDate = index === messages.length - 1 ||
      !isSameDay(item.createdAt, messages[index + 1]?.createdAt ?? '');

    return (
      <MessageBubble
        message={item}
        showDateSeparator={showDate}
        theme={theme}
      />
    );
  }, [messages, theme]);

  const keyExtractor = useCallback((item: ConversationMessageDto) => String(item.id), []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: theme.SPACING.md,
          paddingVertical: theme.SPACING.sm,
          borderBottomWidth: 0.5,
          borderBottomColor: theme.colors.border.light,
          backgroundColor: theme.colors.background.paper,
          gap: theme.SPACING.sm,
        }}>
          {/* Back */}
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.text.primary} />
          </Pressable>

          {/* Avatar */}
          <View style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: `${channelCfg.color}18`,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: channelCfg.color }}>
              {getInitials(conversation?.guestName ?? null)}
            </Text>
          </View>

          {/* Name + info */}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                ...theme.typography.body2,
                fontWeight: '600',
                color: theme.colors.text.primary,
              }}
              numberOfLines={1}
            >
              {convLoading ? '...' : conversation?.guestName || 'Sans nom'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {/* Property */}
              {conversation?.propertyName && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Ionicons name="home-outline" size={10} color={theme.colors.text.disabled} />
                  <Text style={{ fontSize: 10, color: theme.colors.text.disabled }} numberOfLines={1}>
                    {conversation.propertyName}
                  </Text>
                </View>
              )}
              {/* Channel badge */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 2,
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
          </View>

          {/* Status button */}
          <Pressable
            onPress={() => setShowStatusMenu(!showStatusMenu)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: theme.BORDER_RADIUS.full,
              backgroundColor: `${statusCfg.color}12`,
            }}
          >
            <Ionicons name={statusCfg.icon} size={12} color={statusCfg.color} />
            <Text style={{ fontSize: 10, color: statusCfg.color, fontWeight: '700' }}>
              {statusCfg.label}
            </Text>
            <Ionicons name="chevron-down" size={10} color={statusCfg.color} />
          </Pressable>
        </View>

        {/* Status dropdown */}
        {showStatusMenu && (
          <View style={{
            position: 'absolute',
            top: Platform.OS === 'ios' ? 100 : 60,
            right: theme.SPACING.lg,
            zIndex: 999,
            backgroundColor: theme.colors.background.paper,
            borderRadius: theme.BORDER_RADIUS.lg,
            paddingVertical: 4,
            ...theme.shadows.md,
            borderWidth: 0.5,
            borderColor: theme.colors.border.light,
          }}>
            {(['OPEN', 'CLOSED', 'ARCHIVED'] as ConversationStatus[]).map((s) => {
              const cfg = STATUS_CONFIG[s];
              const isActive = conversation?.status === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => handleStatusChange(s)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    backgroundColor: pressed
                      ? theme.colors.background.surface
                      : isActive
                      ? `${cfg.color}08`
                      : 'transparent',
                  })}
                >
                  <Ionicons name={cfg.icon} size={14} color={cfg.color} />
                  <Text style={{
                    ...theme.typography.body2,
                    color: cfg.color,
                    fontWeight: isActive ? '700' : '500',
                  }}>
                    {cfg.label}
                  </Text>
                  {isActive && (
                    <Ionicons name="checkmark" size={14} color={cfg.color} />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Messages list */}
        {msgsLoading ? (
          <ChatSkeleton theme={theme} />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={keyExtractor}
            inverted
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 8 }}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              isFetchingNextPage ? (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={theme.colors.primary.main} />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
                <Ionicons name="chatbubble-outline" size={40} color={theme.colors.text.disabled} />
                <Text style={{
                  ...theme.typography.body2,
                  color: theme.colors.text.disabled,
                  marginTop: 12,
                }}>
                  Aucun message
                </Text>
                <Text style={{
                  ...theme.typography.caption,
                  color: theme.colors.text.disabled,
                  marginTop: 4,
                }}>
                  Envoyez le premier message
                </Text>
              </View>
            }
          />
        )}

        {/* Dismiss status menu on tap */}
        {showStatusMenu && (
          <Pressable
            onPress={() => setShowStatusMenu(false)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 998,
            }}
          />
        )}

        {/* Input area */}
        <View style={{
          borderTopWidth: 0.5,
          borderTopColor: theme.colors.border.light,
          backgroundColor: theme.colors.background.paper,
        }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            paddingHorizontal: theme.SPACING.md,
            paddingVertical: theme.SPACING.sm,
            gap: theme.SPACING.sm,
          }}>
            {/* AI Suggest button */}
            <Pressable
              onPress={handleAiSuggest}
              disabled={suggestMutation.isPending}
              hitSlop={8}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: pressed
                  ? `${theme.colors.secondary.main}25`
                  : suggestMutation.isPending
                  ? `${theme.colors.secondary.main}10`
                  : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 4,
              })}
            >
              {suggestMutation.isPending ? (
                <ActivityIndicator size="small" color={theme.colors.secondary.main} />
              ) : (
                <Ionicons name="sparkles" size={20} color={theme.colors.secondary.main} />
              )}
            </Pressable>

            {/* Text input */}
            <View style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'flex-end',
              backgroundColor: theme.colors.background.surface,
              borderRadius: theme.BORDER_RADIUS.xl,
              paddingHorizontal: theme.SPACING.md,
              paddingVertical: Platform.OS === 'ios' ? 10 : 6,
              minHeight: 44,
            }}>
              <TextInput
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Ecrire un message..."
                placeholderTextColor={theme.colors.text.disabled}
                multiline
                style={{
                  flex: 1,
                  ...theme.typography.body2,
                  color: theme.colors.text.primary,
                  maxHeight: 120,
                  paddingTop: 0,
                  paddingBottom: 0,
                }}
              />
            </View>

            {/* Send button */}
            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: canSend
                  ? (pressed ? theme.colors.primary.dark : theme.colors.primary.main)
                  : theme.colors.border.main,
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              {sendMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={18} color="#FFFFFF" />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
