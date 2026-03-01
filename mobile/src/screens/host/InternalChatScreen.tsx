import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
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
  Image,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/theme';
import { Skeleton } from '@/components/ui/Skeleton';
import { useThreadMessages, useReplyMessage, useMarkThreadAsRead } from '@/hooks/useMessages';
import { useContactWebSocket } from '@/hooks/useContactWebSocket';
import { useAuthStore } from '@/store/authStore';
import { contactApi } from '@/api/endpoints/contactApi';
import type { ContactMessage, ContactAttachment, ContactThreadSummary } from '@/api/endpoints/contactApi';

type IoniconsName = keyof typeof Ionicons.glyphMap;

type RouteParams = {
  InternalChat: { thread: ContactThreadSummary };
};

/* ─── Constants ─── */

const IMAGE_CONTENT_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'image/heic', 'image/heif', 'image/bmp', 'image/jpg',
];

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp'];

const AVATAR_COLORS = [
  '#1976d2', '#388e3c', '#d32f2f', '#7b1fa2',
  '#c2185b', '#0097a7', '#f57c00', '#5d4037',
  '#455a64', '#00838f', '#ad1457', '#6a1b9a',
];

/* ─── Helpers ─── */

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(firstName: string, lastName: string): string {
  return `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase() || '?';
}

function isImageAttachment(att: ContactAttachment): boolean {
  if (att.contentType && IMAGE_CONTENT_TYPES.includes(att.contentType.toLowerCase())) return true;
  const ext = att.originalName?.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTENSIONS.includes(ext);
}

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function isSameDay(d1: string, d2: string): boolean {
  try {
    return new Date(d1).toDateString() === new Date(d2).toDateString();
  } catch {
    return false;
  }
}

/* ─── Image Lightbox ─── */

function ImageLightbox({ visible, uri, onClose }: {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
}) {
  const { width, height } = Dimensions.get('window');

  if (!visible || !uri) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.92)',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <Pressable
          onPress={onClose}
          style={{
            position: 'absolute',
            top: Platform.OS === 'ios' ? 56 : 24,
            right: 20,
            zIndex: 10,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: 'rgba(255,255,255,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
        <Image
          source={{ uri }}
          style={{
            width: width * 0.92,
            height: height * 0.7,
            borderRadius: 8,
          }}
          resizeMode="contain"
        />
      </View>
    </Modal>
  );
}

/* ─── Message Bubble ─── */

function MessageBubble({
  message,
  isMine,
  showDateSeparator,
  showSenderName,
  counterpartName,
  imageData,
  onImagePress,
  theme,
}: {
  message: ContactMessage;
  isMine: boolean;
  showDateSeparator: boolean;
  showSenderName: boolean;
  counterpartName: string;
  imageData: Record<string, string>;
  onImagePress: (uri: string) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const imgAtts = useMemo(
    () => (message.attachments ?? []).filter(isImageAttachment),
    [message.attachments],
  );
  const fileAtts = useMemo(
    () => (message.attachments ?? []).filter((a) => !isImageAttachment(a)),
    [message.attachments],
  );

  return (
    <View style={{ marginBottom: 4 }}>
      {/* Date separator */}
      {showDateSeparator && (
        <View style={{ alignItems: 'center', marginVertical: 14 }}>
          <View style={{
            paddingHorizontal: 16,
            paddingVertical: 5,
            borderRadius: 12,
            backgroundColor: `${theme.colors.primary.main}12`,
          }}>
            <Text style={{
              fontSize: 12,
              fontWeight: '600',
              color: theme.colors.text.primary,
            }}>
              {formatDateSeparator(message.createdAt)}
            </Text>
          </View>
        </View>
      )}

      {/* Bubble wrapper */}
      <View style={{
        flexDirection: 'row',
        justifyContent: isMine ? 'flex-end' : 'flex-start',
        paddingHorizontal: 12,
        marginBottom: 2,
      }}>
        <View style={{
          maxWidth: '78%',
          alignItems: isMine ? 'flex-end' : 'flex-start',
        }}>
          {/* Sender name (received messages only) */}
          {!isMine && showSenderName && (
            <Text style={{
              fontSize: 13,
              fontWeight: '700',
              color: theme.colors.text.primary,
              marginBottom: 4,
              marginLeft: 4,
            }}>
              {message.senderName || counterpartName}
            </Text>
          )}

          {/* Bubble — text + file chips + timestamp */}
          <View style={{
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 18,
            borderTopLeftRadius: isMine ? 18 : 4,
            borderTopRightRadius: isMine ? 4 : 18,
            backgroundColor: isMine
              ? theme.colors.primary.main
              : theme.colors.background.paper,
            ...(isMine ? {} : {
              borderWidth: 0.5,
              borderColor: theme.colors.border.light,
            }),
          }}>
            {/* Message text */}
            <Text style={{
              ...theme.typography.body2,
              color: isMine ? '#FFFFFF' : theme.colors.text.primary,
              lineHeight: 20,
            }}>
              {message.message}
            </Text>

            {/* File attachments (non-image) inside bubble */}
            {fileAtts.length > 0 && (
              <View style={{ marginTop: 8, gap: 4 }}>
                {fileAtts.map((att) => (
                  <View key={att.id} style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 10,
                    backgroundColor: isMine ? 'rgba(255,255,255,0.15)' : `${theme.colors.primary.main}08`,
                    borderWidth: isMine ? 0 : 0.5,
                    borderColor: isMine ? 'transparent' : theme.colors.border.light,
                  }}>
                    <Ionicons
                      name="document-outline"
                      size={14}
                      color={isMine ? 'rgba(255,255,255,0.8)' : theme.colors.text.secondary}
                    />
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 11,
                        color: isMine ? 'rgba(255,255,255,0.9)' : theme.colors.text.primary,
                        fontWeight: '500',
                      }}
                      numberOfLines={1}
                    >
                      {att.originalName}
                    </Text>
                    <Text style={{
                      fontSize: 9,
                      color: isMine ? 'rgba(255,255,255,0.6)' : theme.colors.text.disabled,
                    }}>
                      {formatFileSize(att.size)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Timestamp */}
            <Text style={{
              fontSize: 10,
              color: isMine ? 'rgba(255,255,255,0.65)' : theme.colors.text.disabled,
              textAlign: 'right',
              marginTop: 4,
            }}>
              {formatMessageTime(message.createdAt)}
            </Text>
          </View>

          {/* Image attachments — BELOW the bubble */}
          {imgAtts.length > 0 && (
            <View style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 6,
              marginTop: 6,
            }}>
              {imgAtts.map((att) => {
                const key = `${message.id}-${att.id}`;
                const uri = imageData[key];

                if (!uri) {
                  return (
                    <Skeleton
                      key={att.id}
                      width={180}
                      height={130}
                      borderRadius={12}
                    />
                  );
                }

                return (
                  <Pressable
                    key={att.id}
                    onPress={() => onImagePress(uri)}
                  >
                    <Image
                      source={{ uri }}
                      style={{
                        width: 180,
                        height: 130,
                        borderRadius: 12,
                        backgroundColor: theme.colors.background.surface,
                      }}
                      resizeMode="cover"
                    />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

/* ─── Chat Skeleton ─── */

function ChatSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={{ flex: 1, padding: 16, gap: 12, justifyContent: 'flex-end' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-start' }}>
        <Skeleton width="60%" height={48} borderRadius={18} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Skeleton width="50%" height={40} borderRadius={18} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-start' }}>
        <Skeleton width="70%" height={56} borderRadius={18} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Skeleton width="45%" height={36} borderRadius={18} />
      </View>
    </View>
  );
}

/* ─── Main Screen ─── */

export function InternalChatScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'InternalChat'>>();
  const { thread } = route.params;
  const { user } = useAuthStore();

  // WebSocket temps reel
  useContactWebSocket();

  const [messageText, setMessageText] = useState('');
  const [attachments, setAttachments] = useState<{ uri: string; name: string; type: string }[]>([]);
  const flatListRef = useRef<FlatList>(null);

  // Lightbox state
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);

  // Data hooks
  const { data: messages, isLoading: msgsLoading } = useThreadMessages(thread.counterpartKeycloakId);
  const replyMutation = useReplyMessage();
  const markThreadAsReadMutation = useMarkThreadAsRead();

  // Mark unread messages as read on screen mount
  useEffect(() => {
    if (!thread.counterpartKeycloakId || !user?.id) return;
    if (thread.unreadCount === 0) return;
    markThreadAsReadMutation.mutate(thread.counterpartKeycloakId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.counterpartKeycloakId]);

  // Reverse messages for inverted FlatList (newest first)
  const reversedMessages = useMemo(() => {
    if (!messages) return [];
    return [...messages].reverse();
  }, [messages]);

  // Load image attachments as base64
  const [imageData, setImageData] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!messages) return;
    let active = true;

    messages.forEach((msg) => {
      (msg.attachments ?? []).filter(isImageAttachment).forEach((att) => {
        const key = `${msg.id}-${att.id}`;
        if (imageData[key]) return; // already loaded

        contactApi.getAttachmentBase64(msg.id, att.id)
          .then((result) => {
            if (!active) return;
            setImageData((prev) => ({ ...prev, [key]: result.data }));
          })
          .catch(() => {});
      });
    });

    return () => { active = false; };
  }, [messages]);

  const avatarColor = getAvatarColor(thread.counterpartKeycloakId);
  const counterpartName = `${thread.counterpartFirstName} ${thread.counterpartLastName}`.trim();
  const isMe = (senderId?: string) => senderId === user?.id;

  // ── Handlers ──

  const handleSend = useCallback(() => {
    const text = messageText.trim();
    if (!text || !messages || messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    replyMutation.mutate(
      { id: lastMessage.id, message: text, attachments: attachments.length > 0 ? attachments : undefined },
      {
        onSuccess: () => {
          setMessageText('');
          setAttachments([]);
        },
        onError: () => {
          Alert.alert('Erreur', "Impossible d'envoyer le message. Reessayez.");
        },
      },
    );
  }, [messageText, messages, attachments, replyMutation]);

  const handlePickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 5,
    });

    if (!result.canceled && result.assets) {
      const newFiles = result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.fileName || `image_${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      }));
      setAttachments((prev) => [...prev, ...newFiles]);
    }
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Render message ──

  const renderMessage = useCallback(({ item, index }: { item: ContactMessage; index: number }) => {
    const mine = isMe(item.senderId);

    // Show date separator: inverted list so index+1 is chronologically earlier
    const showDate = index === reversedMessages.length - 1 ||
      !isSameDay(item.createdAt, reversedMessages[index + 1]?.createdAt ?? '');

    // Show sender name for received messages when first in sequence or after date separator
    const showSender = !mine && (
      showDate ||
      index === reversedMessages.length - 1 ||
      isMe(reversedMessages[index + 1]?.senderId)
    );

    return (
      <MessageBubble
        message={item}
        isMine={mine}
        showDateSeparator={showDate}
        showSenderName={showSender}
        counterpartName={counterpartName}
        imageData={imageData}
        onImagePress={(uri) => setLightboxUri(uri)}
        theme={theme}
      />
    );
  }, [reversedMessages, imageData, counterpartName, theme, user?.id]);

  const keyExtractor = useCallback((item: ContactMessage) => String(item.id), []);

  const canSend = messageText.trim().length > 0 && !replyMutation.isPending;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Header ── */}
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
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: `${avatarColor}18`,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: avatarColor }}>
              {getInitials(thread.counterpartFirstName, thread.counterpartLastName)}
            </Text>
          </View>

          {/* Name + email */}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                ...theme.typography.body2,
                fontWeight: '600',
                color: theme.colors.text.primary,
              }}
              numberOfLines={1}
            >
              {counterpartName}
            </Text>
            <Text
              style={{
                ...theme.typography.caption,
                color: theme.colors.text.disabled,
              }}
              numberOfLines={1}
            >
              {thread.counterpartEmail}
            </Text>
          </View>

          {/* Message count badge */}
          <View style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: theme.BORDER_RADIUS.full,
            backgroundColor: theme.colors.background.surface,
            borderWidth: 0.5,
            borderColor: theme.colors.border.light,
          }}>
            <Text style={{
              fontSize: 10,
              fontWeight: '600',
              color: theme.colors.text.secondary,
            }}>
              {thread.totalMessages} msg
            </Text>
          </View>
        </View>

        {/* ── Messages list ── */}
        {msgsLoading ? (
          <ChatSkeleton theme={theme} />
        ) : (
          <FlatList
            ref={flatListRef}
            data={reversedMessages}
            renderItem={renderMessage}
            keyExtractor={keyExtractor}
            inverted
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 8 }}
            ListEmptyComponent={
              <View style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 60,
              }}>
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

        {/* ── Attachment preview bar ── */}
        {attachments.length > 0 && (
          <View style={{
            flexDirection: 'row',
            paddingHorizontal: theme.SPACING.md,
            paddingVertical: theme.SPACING.sm,
            gap: 8,
            borderTopWidth: 0.5,
            borderTopColor: theme.colors.border.light,
            backgroundColor: theme.colors.background.paper,
          }}>
            {attachments.map((file, i) => (
              <View key={i} style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor: theme.colors.background.surface,
                borderWidth: 0.5,
                borderColor: theme.colors.border.light,
              }}>
                <Ionicons name="image-outline" size={12} color={theme.colors.primary.main} />
                <Text style={{ fontSize: 10, color: theme.colors.text.secondary, maxWidth: 80 }} numberOfLines={1}>
                  {file.name}
                </Text>
                <Pressable onPress={() => removeAttachment(i)} hitSlop={4}>
                  <Ionicons name="close-circle" size={14} color={theme.colors.text.disabled} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* ── Input area ── */}
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
            {/* Attach button */}
            <Pressable
              onPress={handlePickImage}
              hitSlop={8}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: pressed ? `${theme.colors.primary.main}15` : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 4,
              })}
            >
              <Ionicons name="attach" size={22} color={theme.colors.text.secondary} />
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
                placeholder="Votre message..."
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
              {replyMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={18} color="#FFFFFF" />
              )}
            </Pressable>
          </View>
        </View>

        {/* Lightbox */}
        <ImageLightbox
          visible={!!lightboxUri}
          uri={lightboxUri}
          onClose={() => setLightboxUri(null)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
