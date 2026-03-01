import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Avatar,
  Badge,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  Skeleton,
  InputAdornment,
  alpha,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Send as SendIcon,
  Search as SearchIcon,
  AttachFile as AttachFileIcon,
  InsertDriveFile as FileIcon,
  Download as DownloadIcon,
  ChatBubbleOutline as EmptyIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import {
  useContactThreads,
  useThreadMessages,
  useReplyMessage,
  useMarkThreadAsRead,
} from '../../hooks/useContactMessages';
import { useContactWebSocket } from '../../hooks/useContactWebSocket';
import { contactApi } from '../../services/api';
import type { ContactThreadSummary, ContactAttachment } from '../../services/api/contactApi';
import PhotoLightbox from '../../components/PhotoLightbox';

// ─── Constants ──────────────────────────────────────────────────────────────

const IMAGE_CONTENT_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'image/heic', 'image/heif', 'image/bmp',
];
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp'];

const AVATAR_COLORS = [
  '#1976d2', '#388e3c', '#d32f2f', '#7b1fa2',
  '#c2185b', '#0097a7', '#f57c00', '#5d4037',
  '#455a64', '#00838f', '#ad1457', '#6a1b9a',
];

// ─── Utilities ──────────────────────────────────────────────────────────────

function getInitials(firstName: string, lastName: string): string {
  return `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase() || '?';
}

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function isImageAttachment(att: ContactAttachment): boolean {
  if (att.contentType && IMAGE_CONTENT_TYPES.includes(att.contentType.toLowerCase())) return true;
  const ext = att.originalName?.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTENSIONS.includes(ext);
}

function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatThreadTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) {
    return date.toLocaleDateString('fr-FR', { weekday: 'short' });
  }
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / 86400000);

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ─── Component ──────────────────────────────────────────────────────────────

const InternalChatTab: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // ── WebSocket temps reel ────────────────────────────────────────────────
  useContactWebSocket();

  // ── State ────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [selectedThread, setSelectedThread] = useState<ContactThreadSummary | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<File[]>([]);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: threads, isLoading: threadsLoading, error: threadsError } = useContactThreads();
  const { data: messages, isLoading: messagesLoading } = useThreadMessages(
    selectedThread?.counterpartKeycloakId ?? null,
  );
  const replyMutation = useReplyMessage();
  const markThreadAsReadMutation = useMarkThreadAsRead();

  // ── Mark unread messages as read when opening a thread ───────────────────
  useEffect(() => {
    if (!selectedThread || !user?.id) return;
    if (selectedThread.unreadCount === 0) return;
    markThreadAsReadMutation.mutate(selectedThread.counterpartKeycloakId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThread?.counterpartKeycloakId]);

  // ── Filtered threads ─────────────────────────────────────────────────────
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

  // ── Image URLs for attachments ───────────────────────────────────────────
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const blobUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    blobUrlsRef.current.forEach((url) => window.URL.revokeObjectURL(url));
    blobUrlsRef.current = [];
    setImageUrls({});

    if (!messages) return;

    let active = true;
    messages.forEach((msg) => {
      (msg.attachments || []).filter(isImageAttachment).forEach((att) => {
        const key = `${msg.id}-${att.id}`;
        contactApi
          .getAttachmentBlobUrl(msg.id, att.id)
          .then((url) => {
            if (!active) {
              window.URL.revokeObjectURL(url);
              return;
            }
            blobUrlsRef.current.push(url);
            setImageUrls((prev) => ({ ...prev, [key]: url }));
          })
          .catch(() => {});
      });
    });

    return () => {
      active = false;
    };
  }, [messages]);

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => window.URL.revokeObjectURL(url));
    };
  }, []);

  // ── Lightbox ─────────────────────────────────────────────────────────────
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const lightboxPhotos = useMemo(() => {
    if (!messages) return [];
    const photos: string[] = [];
    messages.forEach((msg) => {
      (msg.attachments || []).filter(isImageAttachment).forEach((att) => {
        const url = imageUrls[`${msg.id}-${att.id}`];
        if (url) photos.push(url);
      });
    });
    return photos;
  }, [messages, imageUrls]);

  const openLightbox = (msgId: number, attId: string) => {
    let idx = 0;
    if (!messages) return;
    for (const msg of messages) {
      for (const att of (msg.attachments || []).filter(isImageAttachment)) {
        const url = imageUrls[`${msg.id}-${att.id}`];
        if (url) {
          if (msg.id === msgId && att.id === attId) {
            setLightboxIndex(idx);
            setLightboxOpen(true);
            return;
          }
          idx++;
        }
      }
    }
  };

  // ── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (messages && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSelectThread = (thread: ContactThreadSummary) => {
    setSelectedThread(thread);
    setReplyText('');
    setReplyAttachments([]);
  };

  const handleBack = () => {
    setSelectedThread(null);
    setReplyText('');
    setReplyAttachments([]);
  };

  const handleSendReply = () => {
    if (!replyText.trim() || !messages || messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];

    replyMutation.mutate(
      {
        id: lastMessage.id,
        data: {
          message: replyText.trim(),
          attachments: replyAttachments.length > 0 ? replyAttachments : undefined,
        },
      },
      {
        onSuccess: () => {
          setReplyText('');
          setReplyAttachments([]);
        },
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setReplyAttachments((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeReplyAttachment = (index: number) => {
    setReplyAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const isMe = (senderId: string) => senderId === user?.id;

  // ── Date separators ──────────────────────────────────────────────────────
  const shouldShowDateSeparator = (index: number): boolean => {
    if (!messages || index === 0) return true;
    const current = new Date(messages[index].createdAt);
    const previous = new Date(messages[index - 1].createdAt);
    return (
      current.getDate() !== previous.getDate() ||
      current.getMonth() !== previous.getMonth() ||
      current.getFullYear() !== previous.getFullYear()
    );
  };

  // ── Determine layout visibility ──────────────────────────────────────────
  const showLeftPanel = !isMobile || !selectedThread;
  const showRightPanel = !isMobile || !!selectedThread;

  // ── Loading & error ──────────────────────────────────────────────────────
  if (threadsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, py: 8 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (threadsError) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{t('contact.errors.loadError')}</Alert>
      </Box>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* ── Left Panel: Conversation List ──────────────────────────────── */}
      {showLeftPanel && (
        <Box
          sx={{
            width: isMobile ? '100%' : '35%',
            minWidth: isMobile ? undefined : 280,
            maxWidth: isMobile ? undefined : 400,
            borderRight: isMobile ? 0 : 1,
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
          }}
        >
          {/* Search bar */}
          <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <TextField
              fullWidth
              size="small"
              placeholder={t('contact.searchContacts') || 'Rechercher un contact...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: '1.125rem', color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                  '& fieldset': { border: 'none' },
                },
                '& .MuiInputBase-input': { fontSize: '0.8125rem', py: 0.75 },
              }}
            />
          </Box>

          {/* Thread list */}
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {filteredThreads.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
                <EmptyIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary', fontWeight: 500 }}>
                  {t('contact.noConversations') || 'Aucune conversation'}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', mt: 0.5 }}>
                  {t('contact.noConversationsHint') || "Vos echanges apparaitront ici"}
                </Typography>
              </Box>
            ) : (
              filteredThreads.map((thread) => {
                const isSelected =
                  selectedThread?.counterpartKeycloakId === thread.counterpartKeycloakId;
                const avatarColor = getAvatarColor(thread.counterpartKeycloakId);
                const hasUnread = thread.unreadCount > 0;

                return (
                  <Box
                    key={thread.counterpartKeycloakId}
                    onClick={() => handleSelectThread(thread)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      px: 2,
                      py: 1.25,
                      cursor: 'pointer',
                      bgcolor: isSelected
                        ? alpha(theme.palette.primary.main, 0.08)
                        : 'transparent',
                      borderLeft: isSelected
                        ? `3px solid ${theme.palette.primary.main}`
                        : '3px solid transparent',
                      transition: 'all 0.15s',
                      '&:hover': {
                        bgcolor: isSelected
                          ? alpha(theme.palette.primary.main, 0.12)
                          : 'action.hover',
                      },
                    }}
                  >
                    {/* Avatar */}
                    <Badge
                      badgeContent={hasUnread ? thread.unreadCount : 0}
                      color="error"
                      max={99}
                      sx={{
                        '& .MuiBadge-badge': {
                          fontSize: '0.625rem',
                          height: 18,
                          minWidth: 18,
                        },
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 40,
                          height: 40,
                          bgcolor: avatarColor,
                          fontSize: '0.875rem',
                          fontWeight: 600,
                        }}
                      >
                        {getInitials(thread.counterpartFirstName, thread.counterpartLastName)}
                      </Avatar>
                    </Badge>

                    {/* Info */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography
                          sx={{
                            fontSize: '0.8125rem',
                            fontWeight: hasUnread ? 700 : 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {thread.counterpartFirstName} {thread.counterpartLastName}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: '0.6875rem',
                            color: hasUnread ? 'primary.main' : 'text.secondary',
                            fontWeight: hasUnread ? 600 : 400,
                            flexShrink: 0,
                            ml: 1,
                          }}
                        >
                          {formatThreadTime(thread.lastMessageAt)}
                        </Typography>
                      </Box>
                      <Typography
                        sx={{
                          fontSize: '0.75rem',
                          color: 'text.secondary',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontWeight: hasUnread ? 500 : 400,
                        }}
                      >
                        {thread.lastMessagePreview || '\u2014'}
                      </Typography>
                    </Box>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      )}

      {/* ── Right Panel: Chat ──────────────────────────────────────────── */}
      {showRightPanel && (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {!selectedThread ? (
            /* Placeholder when no conversation selected */
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.disabled',
              }}
            >
              <EmptyIcon sx={{ fontSize: 64, mb: 2 }} />
              <Typography sx={{ fontSize: '1rem', fontWeight: 500 }}>
                {t('contact.selectConversation') || 'Selectionnez une conversation'}
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', mt: 0.5 }}>
                {t('contact.noConversationsHint') || "Vos echanges apparaitront ici"}
              </Typography>
            </Box>
          ) : (
            <>
              {/* Chat header */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 2,
                  py: 1.5,
                  borderBottom: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  flexShrink: 0,
                }}
              >
                {isMobile && (
                  <IconButton size="small" onClick={handleBack} sx={{ mr: 0.5 }}>
                    <ArrowBackIcon />
                  </IconButton>
                )}
                <Avatar
                  sx={{
                    width: 36,
                    height: 36,
                    bgcolor: getAvatarColor(selectedThread.counterpartKeycloakId),
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                  }}
                >
                  {getInitials(
                    selectedThread.counterpartFirstName,
                    selectedThread.counterpartLastName,
                  )}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }} noWrap>
                    {selectedThread.counterpartFirstName} {selectedThread.counterpartLastName}
                  </Typography>
                  <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }} noWrap>
                    {selectedThread.counterpartEmail}
                  </Typography>
                </Box>
                <Chip
                  label={`${selectedThread.totalMessages} msg`}
                  size="small"
                  variant="outlined"
                  sx={{
                    fontSize: '0.625rem',
                    height: 22,
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              </Box>

              {/* Messages area */}
              <Box
                sx={{
                  flex: 1,
                  overflowY: 'auto',
                  px: 2,
                  py: 1.5,
                  bgcolor: 'background.paper',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5,
                  minHeight: 0,
                }}
              >
                {messagesLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : !messages || messages.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
                      {t('contact.noMessages') || 'Aucun message'}
                    </Typography>
                  </Box>
                ) : (
                  <>
                    {messages.map((msg, index) => {
                      const mine = isMe(msg.senderId);
                      const showDate = shouldShowDateSeparator(index);
                      const imgAtts = (msg.attachments || []).filter(isImageAttachment);
                      const fileAtts = (msg.attachments || []).filter(
                        (a) => !isImageAttachment(a),
                      );

                      return (
                        <React.Fragment key={msg.id}>
                          {/* Date separator */}
                          {showDate && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                              <Chip
                                label={formatDateSeparator(msg.createdAt)}
                                size="small"
                                sx={{
                                  fontSize: '0.75rem',
                                  fontWeight: 500,
                                  height: 28,
                                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                                  color: 'text.primary',
                                  '& .MuiChip-label': { px: 1.5 },
                                }}
                              />
                            </Box>
                          )}

                          {/* Message bubble */}
                          <Box
                            sx={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: mine ? 'flex-end' : 'flex-start',
                              mb: 0.25,
                            }}
                          >
                            {/* Sender name (for received messages) */}
                            {!mine && (
                              <Typography
                                sx={{
                                  fontSize: '0.8125rem',
                                  fontWeight: 700,
                                  color: 'text.primary',
                                  mb: 0.5,
                                  ml: 0.5,
                                }}
                              >
                                {msg.senderName || selectedThread.counterpartFirstName}
                              </Typography>
                            )}

                            {/* Message bubble — text + file chips + timestamp only */}
                            <Paper
                              elevation={0}
                              sx={{
                                maxWidth: '75%',
                                px: 1.5,
                                py: 1,
                                borderRadius: mine
                                  ? '12px 12px 4px 12px'
                                  : '12px 12px 12px 4px',
                                bgcolor: mine ? 'primary.main' : 'background.default',
                                color: mine ? 'primary.contrastText' : 'text.primary',
                                border: mine ? 'none' : '1px solid',
                                borderColor: mine ? 'transparent' : 'divider',
                              }}
                            >
                              <Typography
                                sx={{
                                  fontSize: '0.8125rem',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                  lineHeight: 1.45,
                                }}
                              >
                                {msg.message}
                              </Typography>

                              {/* File attachments (non-image) stay inside bubble */}
                              {fileAtts.length > 0 && (
                                <Box
                                  sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}
                                >
                                  {fileAtts.map((att) => (
                                    <Chip
                                      key={att.id}
                                      icon={<FileIcon sx={{ fontSize: '0.875rem' }} />}
                                      label={`${att.originalName} (${formatFileSize(att.size)})`}
                                      size="small"
                                      variant="outlined"
                                      clickable
                                      onClick={() =>
                                        contactApi.downloadAttachment(
                                          msg.id,
                                          att.id,
                                          att.originalName,
                                        )
                                      }
                                      deleteIcon={<DownloadIcon sx={{ fontSize: 14 }} />}
                                      onDelete={() =>
                                        contactApi.downloadAttachment(
                                          msg.id,
                                          att.id,
                                          att.originalName,
                                        )
                                      }
                                      sx={{
                                        maxWidth: 220,
                                        fontSize: '0.6875rem',
                                        height: 24,
                                        borderColor: mine
                                          ? 'rgba(255,255,255,0.4)'
                                          : 'divider',
                                        color: mine ? 'primary.contrastText' : 'text.primary',
                                        '& .MuiChip-icon': {
                                          color: mine
                                            ? 'rgba(255,255,255,0.7)'
                                            : 'text.secondary',
                                        },
                                        '& .MuiChip-deleteIcon': {
                                          color: mine
                                            ? 'rgba(255,255,255,0.7)'
                                            : 'text.secondary',
                                        },
                                      }}
                                    />
                                  ))}
                                </Box>
                              )}

                              {/* Timestamp */}
                              <Typography
                                sx={{
                                  fontSize: '0.5625rem',
                                  color: mine ? 'rgba(255,255,255,0.7)' : 'text.disabled',
                                  textAlign: 'right',
                                  mt: 0.5,
                                }}
                              >
                                {formatMessageTime(msg.createdAt)}
                              </Typography>
                            </Paper>

                            {/* Image attachments — displayed BELOW the bubble */}
                            {imgAtts.length > 0 && (
                              <Box
                                sx={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: 0.75,
                                  mt: 0.75,
                                  maxWidth: '75%',
                                }}
                              >
                                {imgAtts.map((att) => {
                                  const url = imageUrls[`${msg.id}-${att.id}`];
                                  if (!url) {
                                    return (
                                      <Skeleton
                                        key={att.id}
                                        variant="rectangular"
                                        width={200}
                                        height={150}
                                        sx={{ borderRadius: 2 }}
                                      />
                                    );
                                  }
                                  return (
                                    <Box
                                      key={att.id}
                                      component="img"
                                      src={url}
                                      alt={att.originalName}
                                      onClick={() => openLightbox(msg.id, att.id)}
                                      sx={{
                                        width: 200,
                                        height: 150,
                                        objectFit: 'cover',
                                        borderRadius: 2,
                                        cursor: 'pointer',
                                        border: 1,
                                        borderColor: 'divider',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                        transition: 'all 0.2s',
                                        '&:hover': {
                                          opacity: 0.9,
                                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                        },
                                      }}
                                    />
                                  );
                                })}
                              </Box>
                            )}
                          </Box>
                        </React.Fragment>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </Box>

              {/* Reply input area */}
              <Box
                sx={{
                  borderTop: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  flexShrink: 0,
                }}
              >
                {/* Reply attachments preview */}
                {replyAttachments.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, px: 2, pt: 1 }}>
                    {replyAttachments.map((file, index) => (
                      <Chip
                        key={index}
                        icon={<FileIcon sx={{ fontSize: '0.875rem' }} />}
                        label={`${file.name} (${formatFileSize(file.size)})`}
                        size="small"
                        variant="outlined"
                        onDelete={() => removeReplyAttachment(index)}
                        sx={{ fontSize: '0.6875rem', height: 24 }}
                      />
                    ))}
                  </Box>
                )}

                <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.75, p: 1.5 }}>
                  <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    id="internal-chat-file-input"
                  />
                  <IconButton
                    size="small"
                    onClick={() => fileInputRef.current?.click()}
                    sx={{ color: 'text.secondary' }}
                  >
                    <AttachFileIcon sx={{ fontSize: '1.25rem' }} />
                  </IconButton>

                  <TextField
                    fullWidth
                    multiline
                    maxRows={4}
                    size="small"
                    placeholder={t('contact.typeMessage') || 'Votre message...'}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={replyMutation.isPending}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 3,
                        bgcolor: 'action.hover',
                        '& fieldset': { borderColor: 'transparent' },
                        '&:hover fieldset': { borderColor: 'divider' },
                        '&.Mui-focused fieldset': { borderColor: 'primary.main' },
                      },
                      '& .MuiInputBase-input': { fontSize: '0.8125rem', py: 0.75 },
                    }}
                  />

                  <IconButton
                    color="primary"
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || replyMutation.isPending}
                    sx={{
                      bgcolor: replyText.trim() ? 'primary.main' : 'transparent',
                      color: replyText.trim() ? 'white' : 'text.disabled',
                      width: 36,
                      height: 36,
                      '&:hover': {
                        bgcolor: replyText.trim() ? 'primary.dark' : 'action.hover',
                      },
                      '&.Mui-disabled': {
                        bgcolor: 'transparent',
                        color: 'text.disabled',
                      },
                    }}
                  >
                    {replyMutation.isPending ? (
                      <CircularProgress size={18} color="inherit" />
                    ) : (
                      <SendIcon sx={{ fontSize: '1.125rem' }} />
                    )}
                  </IconButton>
                </Box>
              </Box>

              {/* Lightbox */}
              <PhotoLightbox
                open={lightboxOpen}
                photos={lightboxPhotos}
                initialIndex={lightboxIndex}
                onClose={() => setLightboxOpen(false)}
              />
            </>
          )}
        </Box>
      )}
    </Box>
  );
};

export default InternalChatTab;
