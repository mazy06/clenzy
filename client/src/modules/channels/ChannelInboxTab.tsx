import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Drawer,
  Divider,
  TextField,
  Button,
  Badge,
} from '@mui/material';
import {
  Person as PersonIcon,
  ArrowForward as ArrowIcon,
  Close as CloseIcon,
  Send as SendIcon,
  Hub as AirbnbIcon,
  Hotel as BookingIcon,
  WhatsApp as WhatsAppIcon,
  Email as EmailIcon,
  Forum as ForumIcon,
  MarkEmailRead as ReadIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import {
  useChannelInbox,
  useConversationMessages,
  useMarkAsRead,
  useSendMessage,
} from '../../hooks/useConversations';
import type { ConversationDto } from '../../services/api/conversationApi';

// ─── Channel config ─────────────────────────────────────────────────────────

const CHANNEL_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  AIRBNB: { label: 'Airbnb', color: '#FF5A5F', icon: <AirbnbIcon sx={{ fontSize: '0.875rem' }} /> },
  BOOKING: { label: 'Booking.com', color: '#003580', icon: <BookingIcon sx={{ fontSize: '0.875rem' }} /> },
  WHATSAPP: { label: 'WhatsApp', color: '#25D366', icon: <WhatsAppIcon sx={{ fontSize: '0.875rem' }} /> },
  EMAIL: { label: 'Email', color: '#757575', icon: <EmailIcon sx={{ fontSize: '0.875rem' }} /> },
};

/** Channels OTA a afficher dans l'onglet Contact */
const OTA_CHANNELS = ['AIRBNB', 'BOOKING'];

function getChannelConfig(channel: string) {
  return CHANNEL_CONFIG[channel] ?? {
    label: channel,
    color: '#9e9e9e',
    icon: <ForumIcon sx={{ fontSize: '0.875rem' }} />,
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

const ChannelInboxTab: React.FC = () => {
  const { t } = useTranslation();
  const [selectedConversation, setSelectedConversation] =
    useState<ConversationDto | null>(null);
  const [replyText, setReplyText] = useState('');

  // Fetch conversations for OTA channels
  const {
    data: inboxData,
    isLoading,
    error,
    refetch,
  } = useChannelInbox(OTA_CHANNELS);

  const conversations = useMemo(
    () => inboxData?.content ?? [],
    [inboxData],
  );

  const unreadCount = useMemo(
    () => conversations.filter((c) => c.unread).length,
    [conversations],
  );

  // Fetch messages for selected conversation
  const { data: messagesData, isLoading: messagesLoading } =
    useConversationMessages(selectedConversation?.id ?? null);
  const messages = useMemo(
    () => messagesData?.content ?? [],
    [messagesData],
  );

  // Mutations
  const markAsReadMutation = useMarkAsRead();
  const sendMessageMutation = useSendMessage();

  const handleOpenConversation = (conv: ConversationDto) => {
    setSelectedConversation(conv);
    setReplyText('');
    if (conv.unread) {
      markAsReadMutation.mutate(conv.id);
    }
  };

  const handleCloseDrawer = () => {
    setSelectedConversation(null);
    setReplyText('');
  };

  const handleSendReply = () => {
    if (!selectedConversation || !replyText.trim()) return;
    sendMessageMutation.mutate(
      {
        conversationId: selectedConversation.id,
        content: replyText.trim(),
      },
      { onSuccess: () => setReplyText('') },
    );
  };

  // ── Loading ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ fontSize: '0.8125rem' }}>
        {t('channelInbox.errorLoading')}
      </Alert>
    );
  }

  if (conversations.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
          {t('channelInbox.noConversations')}
        </Typography>
        <Typography
          sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}
        >
          {t('channelInbox.noConversationsHint')}
        </Typography>
      </Box>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
            {t('channelInbox.title')}
          </Typography>
          {unreadCount > 0 && (
            <Badge
              badgeContent={unreadCount}
              color="error"
              sx={{
                '& .MuiBadge-badge': {
                  fontSize: '0.5625rem',
                  height: 16,
                  minWidth: 16,
                },
              }}
            >
              <ReadIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
            </Badge>
          )}
        </Box>
        <IconButton size="small" onClick={() => refetch()} title={t('common.refresh')}>
          <RefreshIcon sx={{ fontSize: '1rem' }} />
        </IconButton>
      </Box>

      {/* Conversation list */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {conversations.map((conv) => {
          const channelCfg = getChannelConfig(conv.channel);

          return (
            <Box
              key={conv.id}
              onClick={() => handleOpenConversation(conv)}
              sx={{
                border: '1px solid',
                borderColor: conv.unread ? 'primary.main' : 'divider',
                borderRadius: 1,
                p: 1.25,
                bgcolor: conv.unread ? 'primary.50' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.15s',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  {/* Avatar with channel color */}
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      bgcolor: channelCfg.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {conv.guestName ? (
                      <PersonIcon
                        sx={{ fontSize: '0.875rem', color: 'white' }}
                      />
                    ) : (
                      <Box sx={{ color: 'white' }}>{channelCfg.icon}</Box>
                    )}
                  </Box>

                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <Typography
                        sx={{
                          fontSize: '0.75rem',
                          fontWeight: conv.unread ? 700 : 600,
                        }}
                      >
                        {conv.guestName || conv.subject || t('channelInbox.guest')}
                      </Typography>
                      <Chip
                        label={channelCfg.label}
                        size="small"
                        sx={{
                          fontSize: '0.5rem',
                          height: 14,
                          bgcolor: channelCfg.color,
                          color: 'white',
                          '& .MuiChip-label': { px: 0.5 },
                        }}
                      />
                    </Box>

                    {conv.propertyName && (
                      <Typography
                        sx={{
                          fontSize: '0.625rem',
                          color: 'text.secondary',
                          fontStyle: 'italic',
                        }}
                      >
                        {conv.propertyName}
                      </Typography>
                    )}

                    <Typography
                      sx={{
                        fontSize: '0.6875rem',
                        color: 'text.secondary',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {conv.lastMessagePreview || '—'}
                    </Typography>
                  </Box>
                </Box>

                {/* Right side: date + message count */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    flexShrink: 0,
                    ml: 1,
                  }}
                >
                  {conv.lastMessageAt && (
                    <Typography
                      sx={{ fontSize: '0.5625rem', color: 'text.secondary' }}
                    >
                      {new Date(conv.lastMessageAt).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Typography>
                  )}
                  {conv.messageCount > 1 && (
                    <Chip
                      label={`${conv.messageCount}`}
                      size="small"
                      sx={{
                        fontSize: '0.5rem',
                        height: 16,
                        minWidth: 16,
                      }}
                    />
                  )}
                  <IconButton size="small" sx={{ p: 0.25 }}>
                    <ArrowIcon sx={{ fontSize: '0.875rem' }} />
                  </IconButton>
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* ── Messages Drawer ────────────────────────────────────────────────── */}
      <Drawer
        anchor="right"
        open={!!selectedConversation}
        onClose={handleCloseDrawer}
        PaperProps={{ sx: { width: { xs: '100%', sm: 420 } } }}
      >
        {selectedConversation && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
            }}
          >
            {/* Drawer header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}
                >
                  <Typography variant="subtitle1" fontWeight={600}>
                    {selectedConversation.guestName ||
                      selectedConversation.subject ||
                      t('channelInbox.guest')}
                  </Typography>
                  <Chip
                    label={getChannelConfig(selectedConversation.channel).label}
                    size="small"
                    sx={{
                      fontSize: '0.625rem',
                      height: 18,
                      bgcolor: getChannelConfig(selectedConversation.channel)
                        .color,
                      color: 'white',
                    }}
                  />
                </Box>
                {selectedConversation.propertyName && (
                  <Typography variant="caption" color="text.secondary">
                    {selectedConversation.propertyName}
                  </Typography>
                )}
              </Box>
              <IconButton onClick={handleCloseDrawer} size="small">
                <CloseIcon />
              </IconButton>
            </Box>

            {/* Messages list */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
              {messagesLoading ? (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    py: 4,
                  }}
                >
                  <CircularProgress size={20} />
                </Box>
              ) : messages.length === 0 ? (
                <Typography
                  sx={{
                    fontSize: '0.8125rem',
                    color: 'text.secondary',
                    textAlign: 'center',
                    py: 4,
                  }}
                >
                  {t('channelInbox.noConversations')}
                </Typography>
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                  }}
                >
                  {messages.map((msg) => {
                    const isInbound = msg.direction === 'INBOUND';
                    return (
                      <Box
                        key={msg.id}
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isInbound ? 'flex-start' : 'flex-end',
                        }}
                      >
                        <Box
                          sx={{
                            maxWidth: '85%',
                            bgcolor: isInbound
                              ? 'grey.100'
                              : 'primary.main',
                            color: isInbound ? 'text.primary' : 'white',
                            borderRadius: 2,
                            px: 1.5,
                            py: 1,
                          }}
                        >
                          {isInbound && msg.senderName && (
                            <Typography
                              sx={{
                                fontSize: '0.625rem',
                                fontWeight: 700,
                                mb: 0.25,
                                color: isInbound
                                  ? 'text.secondary'
                                  : 'rgba(255,255,255,0.8)',
                              }}
                            >
                              {msg.senderName}
                            </Typography>
                          )}
                          <Typography sx={{ fontSize: '0.8125rem' }}>
                            {msg.content}
                          </Typography>
                        </Box>
                        <Typography
                          sx={{
                            fontSize: '0.5625rem',
                            color: 'text.secondary',
                            mt: 0.25,
                            px: 0.5,
                          }}
                        >
                          {new Date(msg.sentAt).toLocaleString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>

            {/* Reply input */}
            <Divider />
            <Box sx={{ display: 'flex', gap: 1, p: 1.5 }}>
              <TextField
                size="small"
                fullWidth
                placeholder={t('contact.replyPlaceholder') || 'Votre message...'}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendReply();
                  }
                }}
                multiline
                maxRows={3}
                sx={{ '& .MuiInputBase-input': { fontSize: '0.8125rem' } }}
              />
              <IconButton
                color="primary"
                onClick={handleSendReply}
                disabled={
                  !replyText.trim() || sendMessageMutation.isPending
                }
                sx={{ alignSelf: 'flex-end' }}
              >
                <SendIcon />
              </IconButton>
            </Box>
          </Box>
        )}
      </Drawer>
    </Box>
  );
};

export default ChannelInboxTab;
