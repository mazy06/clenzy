import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Share, Linking, Image, Modal, Dimensions, ActionSheetIOS } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { File as ExpoFile, Paths } from 'expo-file-system';
import { useReplyMessage, useMarkAsRead } from '@/hooks/useMessages';
import { useSuggestResponse } from '@/hooks/useAiMessaging';
import { useAuthStore } from '@/store/authStore';
import { API_CONFIG } from '@/config/api';
import { contactApi } from '@/api/endpoints/contactApi';
import { useTheme } from '@/theme';
import type { ContactMessage, ContactAttachment } from '@/api/endpoints/contactApi';

type IoniconsName = keyof typeof Ionicons.glyphMap;

type RouteParams = {
  MessageDetail: {
    message: ContactMessage;
    isSent: boolean;
  };
};

/* ─── Helpers ─── */

function formatFullDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: IoniconsName }> = {
  HIGH: { label: 'Haute', color: '#D97706', icon: 'alert-circle' },
  MEDIUM: { label: 'Moyenne', color: '#6B8A9A', icon: 'remove-circle' },
  LOW: { label: 'Basse', color: '#64748B', icon: 'arrow-down-circle' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: IoniconsName }> = {
  SENT: { label: 'Envoye', color: '#6B8A9A', icon: 'paper-plane-outline' },
  DELIVERED: { label: 'Remis', color: '#4A9B8E', icon: 'checkmark-done-outline' },
  READ: { label: 'Lu', color: '#4A9B8E', icon: 'eye-outline' },
  PENDING: { label: 'En attente', color: '#D4A574', icon: 'time-outline' },
  FAILED: { label: 'Echoue', color: '#C97A7A', icon: 'close-circle-outline' },
};

const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: 'General',
  BILLING: 'Facturation',
  SUPPORT: 'Support',
  CLEANING: 'Menage',
  MAINTENANCE: 'Maintenance',
  INCIDENT: 'Incident',
};

/* ─── Sub-components ─── */

function MetadataRow({ icon, label, value, valueColor, theme }: {
  icon: IoniconsName;
  label: string;
  value: string;
  valueColor?: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
      <Ionicons name={icon} size={16} color={theme.colors.text.disabled} style={{ marginRight: 10, width: 20 }} />
      <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, width: 80 }}>{label}</Text>
      <Text style={{ ...theme.typography.body2, color: valueColor ?? theme.colors.text.primary, flex: 1 }}>{value}</Text>
    </View>
  );
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg', 'image/heic', 'image/heif'];

function isImageAttachment(attachment: ContactAttachment): boolean {
  if (attachment.contentType && IMAGE_TYPES.includes(attachment.contentType.toLowerCase())) return true;
  const ext = attachment.originalName?.split('.').pop()?.toUpperCase() ?? '';
  return ['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'HEIC', 'HEIF'].includes(ext);
}

function getAttachmentUrl(messageId: number, attachmentId: string): string {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}/contact/messages/${messageId}/attachments/${attachmentId}`;
}

function ImageAttachmentItem({ attachment, messageId, theme }: {
  attachment: ContactAttachment;
  messageId: number;
  theme: ReturnType<typeof useTheme>;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const ext = attachment.originalName?.split('.').pop()?.toUpperCase() ?? '';
  const screenWidth = Dimensions.get('window').width;

  // Fetch image as base64 data URI via the dedicated API endpoint
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await contactApi.getAttachmentBase64(messageId, attachment.id);
        if (!cancelled) setLocalUri(result.data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [messageId, attachment.id]);

  // Fallback to file display on error
  if (error) {
    return <FileAttachmentItem attachment={attachment} messageId={messageId} theme={theme} />;
  }

  return (
    <>
      <Pressable onPress={() => localUri && setFullscreen(true)} style={{ marginBottom: 8 }}>
        <View style={{
          width: '100%',
          height: 200,
          borderRadius: theme.BORDER_RADIUS.md,
          backgroundColor: theme.colors.background.surface,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {loading ? (
            <ActivityIndicator size="small" color={theme.colors.primary.main} />
          ) : localUri ? (
            <Image
              source={{ uri: localUri }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : null}
        </View>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 6,
          paddingHorizontal: 4,
        }}>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled, flex: 1 }} numberOfLines={1}>
            {attachment.originalName || attachment.filename}
          </Text>
          <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
            {formatFileSize(attachment.size)}{ext ? ` \u2022 ${ext}` : ''}
          </Text>
        </View>
      </Pressable>

      {/* Fullscreen modal */}
      <Modal visible={fullscreen} transparent animationType="fade" onRequestClose={() => setFullscreen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' }}>
          <Pressable
            onPress={() => setFullscreen(false)}
            style={{ position: 'absolute', top: 56, right: 20, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          {localUri && (
            <Image
              source={{ uri: localUri }}
              style={{ width: screenWidth, height: screenWidth }}
              resizeMode="contain"
            />
          )}
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 12 }}>
            {attachment.originalName || attachment.filename}
          </Text>
        </View>
      </Modal>
    </>
  );
}

function FileAttachmentItem({ attachment, messageId, theme }: {
  attachment: ContactAttachment;
  messageId: number;
  theme: ReturnType<typeof useTheme>;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const ext = attachment.originalName?.split('.').pop()?.toUpperCase() ?? '';
  const iconName: IoniconsName = ext === 'PDF' ? 'document-outline'
    : ['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP'].includes(ext) ? 'image-outline'
    : 'attach-outline';

  const handleDownload = useCallback(async () => {
    if (downloading) return;

    try {
      setDownloading(true);

      const token = useAuthStore.getState().accessToken;
      const url = getAttachmentUrl(messageId, attachment.id);
      const filename = attachment.originalName || attachment.filename || `attachment_${attachment.id}`;

      const destination = new ExpoFile(Paths.cache, filename);
      const downloadedFile = await ExpoFile.downloadFileAsync(url, destination, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      setDownloaded(true);

      if (Platform.OS === 'ios') {
        await Share.share({ url: downloadedFile.uri });
      } else {
        try {
          const supported = await Linking.canOpenURL(downloadedFile.uri);
          if (supported) {
            await Linking.openURL(downloadedFile.uri);
          } else {
            await Share.share({ message: downloadedFile.uri, title: filename });
          }
        } catch {
          Alert.alert('Telechargement termine', `Fichier telecharge : ${filename}`);
        }
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de telecharger le fichier. Veuillez reessayer.');
    } finally {
      setDownloading(false);
    }
  }, [downloading, messageId, attachment]);

  return (
    <Pressable
      onPress={handleDownload}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: pressed ? `${theme.colors.info.main}08` : theme.colors.background.surface,
        borderRadius: theme.BORDER_RADIUS.md,
        marginBottom: 6,
        overflow: 'hidden',
      })}
    >
      {downloading && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, backgroundColor: `${theme.colors.info.main}08` }}
        />
      )}

      <View style={{
        width: 36,
        height: 36,
        borderRadius: theme.BORDER_RADIUS.sm,
        backgroundColor: downloaded ? `${theme.colors.success.main}10` : `${theme.colors.info.main}10`,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {downloading ? (
          <ActivityIndicator size="small" color={theme.colors.info.main} />
        ) : downloaded ? (
          <Ionicons name="checkmark-circle" size={18} color={theme.colors.success.main} />
        ) : (
          <Ionicons name={iconName} size={18} color={theme.colors.info.main} />
        )}
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ ...theme.typography.body2, color: theme.colors.text.primary, fontWeight: '500' }} numberOfLines={1}>
          {attachment.originalName || attachment.filename}
        </Text>
        <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
          {downloading
            ? 'Telechargement en cours...'
            : `${formatFileSize(attachment.size)}${ext ? ` \u2022 ${ext}` : ''}`
          }
        </Text>
      </View>

      {!downloading && (
        <Ionicons
          name={downloaded ? 'open-outline' : 'download-outline'}
          size={18}
          color={downloaded ? theme.colors.success.main : theme.colors.info.main}
        />
      )}
    </Pressable>
  );
}

function AttachmentItem({ attachment, messageId, theme }: {
  attachment: ContactAttachment;
  messageId: number;
  theme: ReturnType<typeof useTheme>;
}) {
  if (isImageAttachment(attachment)) {
    return <ImageAttachmentItem attachment={attachment} messageId={messageId} theme={theme} />;
  }
  return <FileAttachmentItem attachment={attachment} messageId={messageId} theme={theme} />;
}

/* ─── Main Screen ─── */

export function MessageDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'MessageDetail'>>();
  const { message, isSent } = route.params;

  const scrollRef = useRef<ScrollView>(null);
  const [replyText, setReplyText] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<{ uri: string; name: string; type: string }[]>([]);
  const [replySent, setReplySent] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const replyMutation = useReplyMessage();
  const markAsReadMutation = useMarkAsRead();
  const suggestMutation = useSuggestResponse();

  // Mark as read on open (for inbox messages)
  useEffect(() => {
    if (!isSent && message.status === 'SENT') {
      markAsReadMutation.mutate(message.id);
    }
  }, [message.id]);

  const handleAiSuggest = useCallback(() => {
    suggestMutation.mutate(
      { message: message.message },
      {
        onSuccess: (result) => {
          setReplyText(result.suggestedResponse);
        },
        onError: () => {
          Alert.alert('Erreur', 'Impossible de generer une suggestion. Reessayez.');
        },
      },
    );
  }, [message.message, suggestMutation]);

  const contactName = isSent ? message.recipientName : message.senderName;
  const priorityCfg = PRIORITY_CONFIG[message.priority];
  const statusCfg = STATUS_CONFIG[message.status];
  const categoryLabel = CATEGORY_LABELS[message.category] ?? message.category;

  const handleReply = useCallback(() => {
    if (!replyText.trim() && replyAttachments.length === 0) return;

    replyMutation.mutate(
      {
        id: message.id,
        message: replyText.trim() || ' ',
        attachments: replyAttachments.length > 0 ? replyAttachments : undefined,
      },
      {
        onSuccess: () => {
          setReplyText('');
          setReplyAttachments([]);
          setReplySent(true);
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        },
        onError: (err: any) => {
          console.error('[Reply Error]', JSON.stringify(err, null, 2));
          const status = err?.status || 'unknown';
          const detail = err?.message || err?.details || JSON.stringify(err);
          Alert.alert('Erreur', `Impossible d'envoyer la reponse (${status}).\n${detail}`);
        },
      },
    );
  }, [replyText, replyAttachments, replyMutation, message.id]);

  const canSend = (replyText.trim().length > 0 || replyAttachments.length > 0) && !replyMutation.isPending;

  const MAX_ATTACHMENTS = 10;
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo

  const pickFromGallery = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: MAX_ATTACHMENTS - replyAttachments.length,
    });
    if (!result.canceled) {
      const newFiles = result.assets
        .filter((a) => !a.fileSize || a.fileSize <= MAX_FILE_SIZE)
        .map((asset) => ({
          uri: asset.uri,
          name: asset.fileName || `photo_${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
          type: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
        }));
      if (newFiles.length < result.assets.length) {
        Alert.alert('Attention', 'Certains fichiers depassent 10 Mo et ont ete ignores.');
      }
      setReplyAttachments((prev) => [...prev, ...newFiles].slice(0, MAX_ATTACHMENTS));
    }
  }, [replyAttachments.length]);

  const pickFromCamera = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission requise', 'L\'acces a l\'appareil photo est necessaire pour prendre une photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) {
        Alert.alert('Fichier trop volumineux', 'Le fichier depasse 10 Mo.');
        return;
      }
      setReplyAttachments((prev) => [
        ...prev,
        {
          uri: asset.uri,
          name: asset.fileName || `photo_${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
        },
      ].slice(0, MAX_ATTACHMENTS));
    }
  }, []);

  const showAttachmentPicker = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Annuler', 'Photo / Video', 'Appareil photo'],
          cancelButtonIndex: 0,
        },
        (index) => {
          if (index === 1) pickFromGallery();
          if (index === 2) pickFromCamera();
        },
      );
    } else {
      Alert.alert('Ajouter une piece jointe', undefined, [
        { text: 'Photo / Video', onPress: pickFromGallery },
        { text: 'Appareil photo', onPress: pickFromCamera },
        { text: 'Annuler', style: 'cancel' },
      ]);
    }
  }, [pickFromGallery, pickFromCamera]);

  const removeAttachment = useCallback((index: number) => {
    setReplyAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background.default }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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

          {/* Contact avatar + name */}
          <View style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: `${isSent ? theme.colors.secondary.main : theme.colors.primary.main}15`,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{
              ...theme.typography.caption,
              fontWeight: '700',
              color: isSent ? theme.colors.secondary.main : theme.colors.primary.main,
              fontSize: 13,
            }}>
              {getInitials(contactName)}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ ...theme.typography.body2, fontWeight: '600', color: theme.colors.text.primary }} numberOfLines={1}>
              {isSent ? `A: ${contactName || 'Inconnu'}` : contactName || 'Inconnu'}
            </Text>
            <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }} numberOfLines={1}>
              {message.subject}
            </Text>
          </View>

          {/* Status indicator */}
          {statusCfg && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: theme.BORDER_RADIUS.full,
              backgroundColor: `${statusCfg.color}12`,
            }}>
              <Ionicons name={statusCfg.icon} size={12} color={statusCfg.color} />
              <Text style={{ fontSize: 10, color: statusCfg.color, fontWeight: '600' }}>{statusCfg.label}</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Subject banner */}
          <View style={{
            paddingHorizontal: theme.SPACING.lg,
            paddingVertical: theme.SPACING.lg,
            backgroundColor: theme.colors.background.paper,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border.light,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: theme.SPACING.md }}>
                <Text style={{ ...theme.typography.h3, color: theme.colors.text.primary, marginBottom: 6 }}>
                  {message.subject}
                </Text>
                <Text style={{ ...theme.typography.caption, color: theme.colors.text.disabled }}>
                  {formatFullDate(message.createdAt)}
                </Text>
              </View>
              <Pressable
                onPress={() => setShowDetails(!showDetails)}
                hitSlop={12}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: showDetails ? `${theme.colors.primary.main}15` : `${theme.colors.text.disabled}10`,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 2,
                }}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={showDetails ? theme.colors.primary.main : theme.colors.text.disabled}
                />
              </Pressable>
            </View>

            {/* Details — inline, toggled by info icon */}
            {showDetails && (
              <View style={{ marginTop: theme.SPACING.md, borderTopWidth: 1, borderTopColor: theme.colors.border.light, paddingTop: theme.SPACING.md }}>
                {contactName && (
                  <MetadataRow
                    icon={isSent ? 'arrow-forward-outline' : 'arrow-back-outline'}
                    label={isSent ? 'Destinataire' : 'Expediteur'}
                    value={contactName}
                    theme={theme}
                  />
                )}
                <MetadataRow
                  icon="folder-outline"
                  label="Categorie"
                  value={categoryLabel}
                  theme={theme}
                />
                {priorityCfg && (
                  <MetadataRow
                    icon={priorityCfg.icon}
                    label="Priorite"
                    value={priorityCfg.label}
                    valueColor={priorityCfg.color}
                    theme={theme}
                  />
                )}
                {statusCfg && (
                  <MetadataRow
                    icon={statusCfg.icon}
                    label="Statut"
                    value={statusCfg.label}
                    valueColor={statusCfg.color}
                    theme={theme}
                  />
                )}
              </View>
            )}
          </View>

          {/* Message body */}
          <View style={{
            paddingHorizontal: theme.SPACING.lg,
            paddingVertical: theme.SPACING.xl,
          }}>
            <Text style={{
              ...theme.typography.body2,
              color: theme.colors.text.primary,
              lineHeight: 24,
            }}>
              {message.message}
            </Text>
          </View>

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <View style={{ paddingHorizontal: theme.SPACING.lg, marginBottom: theme.SPACING.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: theme.SPACING.sm }}>
                <Ionicons name="attach" size={16} color={theme.colors.text.secondary} />
                <Text style={{ ...theme.typography.body2, fontWeight: '600', color: theme.colors.text.secondary }}>
                  Pieces jointes ({message.attachments.length})
                </Text>
              </View>
              {message.attachments.map((att) => (
                <AttachmentItem key={att.id} attachment={att} messageId={message.id} theme={theme} />
              ))}
            </View>
          )}

          {/* Reply success banner */}
          {replySent && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginHorizontal: theme.SPACING.lg,
              marginTop: theme.SPACING.lg,
              paddingHorizontal: theme.SPACING.md,
              paddingVertical: theme.SPACING.sm,
              backgroundColor: `${theme.colors.success.main}10`,
              borderRadius: theme.BORDER_RADIUS.md,
              borderLeftWidth: 3,
              borderLeftColor: theme.colors.success.main,
            }}>
              <Ionicons name="checkmark-circle" size={18} color={theme.colors.success.main} />
              <Text style={{ ...theme.typography.body2, color: theme.colors.success.main, fontWeight: '500' }}>
                Reponse envoyee avec succes
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Reply input (only for inbox messages) */}
        {!isSent && (
          <View style={{
            borderTopWidth: 1,
            borderTopColor: theme.colors.border.light,
            backgroundColor: theme.colors.background.paper,
          }}>
            {/* Attachment previews */}
            {replyAttachments.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: theme.SPACING.md,
                  paddingTop: theme.SPACING.sm,
                  gap: 8,
                }}
              >
                {replyAttachments.map((file, index) => (
                  <View key={`${file.uri}-${index}`} style={{ position: 'relative' }}>
                    <Image
                      source={{ uri: file.uri }}
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: theme.BORDER_RADIUS.sm,
                        backgroundColor: theme.colors.background.surface,
                      }}
                    />
                    <Pressable
                      onPress={() => removeAttachment(index)}
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: theme.colors.error.main,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="close" size={12} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Input row */}
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

              {/* Attachment button */}
              <Pressable
                onPress={showAttachmentPicker}
                disabled={replyAttachments.length >= MAX_ATTACHMENTS || replyMutation.isPending}
                hitSlop={8}
                style={({ pressed }) => ({
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: pressed ? `${theme.colors.primary.main}15` : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 4,
                  opacity: replyAttachments.length >= MAX_ATTACHMENTS ? 0.4 : 1,
                })}
              >
                <Ionicons
                  name="attach-outline"
                  size={22}
                  color={replyAttachments.length > 0 ? theme.colors.primary.main : theme.colors.text.disabled}
                />
              </Pressable>

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
                  value={replyText}
                  onChangeText={setReplyText}
                  placeholder="Ecrire une reponse..."
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

              <Pressable
                onPress={handleReply}
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
                  <Ionicons name="hourglass-outline" size={18} color="#FFFFFF" />
                ) : (
                  <Ionicons name="send" size={18} color="#FFFFFF" />
                )}
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
