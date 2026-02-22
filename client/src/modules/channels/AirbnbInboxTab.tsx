import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Badge,
  IconButton,
} from '@mui/material';
import {
  MarkEmailRead as ReadIcon,
  Person as PersonIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import { airbnbApi } from '../../services/api/airbnbApi';
import type { AirbnbMessage } from '../../services/api/airbnbApi';

// ─── Component ──────────────────────────────────────────────────────────────

const AirbnbInboxTab: React.FC = () => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<AirbnbMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await airbnbApi.getMessages();
      setMessages(data);
    } catch {
      setError(t('channels.inbox.errorLoading'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Group by thread
  const threads = messages.reduce<Record<string, AirbnbMessage[]>>((acc, msg) => {
    const key = msg.threadId || msg.reservationId || msg.id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(msg);
    return acc;
  }, {});

  const unreadCount = messages.filter((m) => !m.read).length;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error" sx={{ fontSize: '0.8125rem' }}>{error}</Alert>;
  }

  if (messages.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
          {t('channels.inbox.noMessages')}
        </Typography>
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
          {t('channels.inbox.noMessagesHint')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
            {t('channels.inbox.title')}
          </Typography>
          <Chip
            label="Airbnb"
            size="small"
            sx={{ fontSize: '0.5625rem', height: 18 }}
            color="error"
            variant="outlined"
          />
          {unreadCount > 0 && (
            <Badge badgeContent={unreadCount} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.5625rem', height: 16, minWidth: 16 } }}>
              <ReadIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
            </Badge>
          )}
        </Box>
      </Box>

      {/* Thread list */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {Object.entries(threads).map(([threadId, threadMessages]) => {
          const latest = threadMessages[threadMessages.length - 1];
          const hasUnread = threadMessages.some((m) => !m.read);

          return (
            <Box
              key={threadId}
              sx={{
                border: '1px solid',
                borderColor: hasUnread ? 'primary.main' : 'divider',
                borderRadius: 1,
                p: 1.25,
                bgcolor: hasUnread ? 'primary.50' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.15s',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, flex: 1 }}>
                  <Box
                    sx={{
                      width: 28, height: 28, borderRadius: '50%', bgcolor: 'primary.main',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}
                  >
                    <PersonIcon sx={{ fontSize: '0.875rem', color: 'white' }} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: hasUnread ? 700 : 600 }}>
                        {latest.senderName}
                      </Typography>
                      <Chip
                        label={latest.senderRole === 'guest' ? 'Guest' : 'Host'}
                        size="small"
                        sx={{ fontSize: '0.5rem', height: 14 }}
                        variant="outlined"
                      />
                    </Box>
                    <Typography
                      sx={{
                        fontSize: '0.6875rem',
                        color: 'text.secondary',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {latest.content}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, ml: 1 }}>
                  <Typography sx={{ fontSize: '0.5625rem', color: 'text.secondary' }}>
                    {new Date(latest.sentAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                  {threadMessages.length > 1 && (
                    <Chip label={`${threadMessages.length}`} size="small" sx={{ fontSize: '0.5rem', height: 16, minWidth: 16 }} />
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
    </Box>
  );
};

export default AirbnbInboxTab;
