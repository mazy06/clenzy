import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  IconButton,
  Badge,
  Popover,
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  Notifications,
  NotificationsNone,
  Build,
  Description,
  Payment,
  Info,
  Groups,
  Email,
  Circle,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { notificationsApi } from '../services/api';
import type { Notification } from '../services/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<Notification['category'], React.ReactNode> = {
  intervention: <Build sx={{ fontSize: 18, color: '#1976d2' }} />,
  service_request: <Description sx={{ fontSize: 18, color: '#ed6c02' }} />,
  payment: <Payment sx={{ fontSize: 18, color: '#2e7d32' }} />,
  system: <Info sx={{ fontSize: 18, color: '#9c27b0' }} />,
  team: <Groups sx={{ fontSize: 18, color: '#0288d1' }} />,
  contact: <Email sx={{ fontSize: 18, color: '#e91e63' }} />,
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = Math.max(0, now - date);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "A l'instant";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}j`;
  return new Date(dateStr).toLocaleDateString('fr-FR');
}

const POLL_INTERVAL = 30000; // 30 seconds

// ─── Component ───────────────────────────────────────────────────────────────

export default function NotificationBell() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recent, setRecent] = useState<Notification[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const open = Boolean(anchorEl);

  // Poll unread count — stops polling if endpoint is unavailable
  const fetchUnreadCount = useCallback(async () => {
    const result = await notificationsApi.getUnreadCount();
    setUnreadCount(result.count);
    // If endpoint became unavailable, stop polling to avoid noisy backend logs
    if (!notificationsApi._endpointAvailable && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    intervalRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchUnreadCount]);

  // Fetch recent notifications when popover opens — also retries availability
  const handleOpen = useCallback(
    async (event: React.MouseEvent<HTMLElement>) => {
      setAnchorEl(event.currentTarget);
      setLoadingRecent(true);
      // Retry availability check when user manually opens the bell
      notificationsApi.resetAvailability();
      const all = await notificationsApi.getAll();
      setRecent(all.slice(0, 5));
      setLoadingRecent(false);
      // If endpoint is now available, restart polling
      if (notificationsApi._endpointAvailable && !intervalRef.current) {
        fetchUnreadCount();
        intervalRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL);
      }
    },
    [fetchUnreadCount],
  );

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  // Click on a notification in the dropdown
  const handleNotificationClick = useCallback(
    async (notification: Notification) => {
      if (!notification.read) {
        await notificationsApi.markAsRead(notification.id);
        setUnreadCount((c) => Math.max(0, c - 1));
        setRecent((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
        );
      }
      handleClose();
      if (notification.actionUrl) {
        navigate(notification.actionUrl);
      }
    },
    [handleClose, navigate],
  );

  // Navigate to full notifications page
  const handleViewAll = useCallback(() => {
    handleClose();
    navigate('/notifications');
  }, [handleClose, navigate]);

  return (
    <>
      <IconButton
        size="small"
        onClick={handleOpen}
        sx={{
          color: '#A6C0CE',
          '&:hover': { backgroundColor: 'rgba(166, 192, 206, 0.1)' },
        }}
      >
        <Badge
          badgeContent={unreadCount}
          color="error"
          max={99}
          sx={{
            '& .MuiBadge-badge': {
              fontSize: '0.65rem',
              height: 16,
              minWidth: 16,
            },
          }}
        >
          {unreadCount > 0 ? (
            <Notifications sx={{ fontSize: 22 }} />
          ) : (
            <NotificationsNone sx={{ fontSize: 22 }} />
          )}
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              width: 340,
              maxHeight: 420,
              borderRadius: 1,
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              mt: 0.5,
            },
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 2,
            py: 1.25,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: '0.875rem' }}>
            {t('notifications.title') || 'Notifications'}
          </Typography>
          {unreadCount > 0 && (
            <Typography variant="caption" color="primary" sx={{ fontSize: '0.75rem' }}>
              {unreadCount} {t('notifications.new') || 'nouvelle(s)'}
            </Typography>
          )}
        </Box>

        {/* Notification list */}
        {loadingRecent ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : recent.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 3, px: 2 }}>
            <NotificationsNone sx={{ fontSize: 36, color: 'text.disabled', mb: 0.5 }} />
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
              {t('notifications.empty') || 'Aucune notification'}
            </Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ maxHeight: 300, overflow: 'auto' }}>
            {recent.map((notification, idx) => (
              <React.Fragment key={notification.id}>
                {idx > 0 && <Divider component="li" />}
                <ListItemButton
                  onClick={() => handleNotificationClick(notification)}
                  sx={{
                    py: 1,
                    px: 2,
                    alignItems: 'flex-start',
                    backgroundColor: notification.read ? 'transparent' : 'rgba(25, 118, 210, 0.04)',
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>
                    {CATEGORY_ICONS[notification.category] ?? <Info sx={{ fontSize: 18 }} />}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {!notification.read && (
                          <Circle sx={{ fontSize: 6, color: 'primary.main', flexShrink: 0 }} />
                        )}
                        <Typography
                          variant="body2"
                          fontWeight={notification.read ? 400 : 600}
                          sx={{
                            fontSize: '0.8125rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {notification.title}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            fontSize: '0.75rem',
                            display: '-webkit-box',
                            WebkitLineClamp: 1,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {notification.message}
                        </Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.6875rem' }}>
                          {timeAgo(notification.createdAt)}
                        </Typography>
                      </Box>
                    }
                    sx={{ my: 0 }}
                  />
                </ListItemButton>
              </React.Fragment>
            ))}
          </List>
        )}

        {/* Footer */}
        <Divider />
        <Box sx={{ p: 1, textAlign: 'center' }}>
          <Button
            size="small"
            onClick={handleViewAll}
            sx={{ fontSize: '0.8125rem', textTransform: 'none' }}
          >
            {t('notifications.viewAll') || 'Voir toutes les notifications'}
          </Button>
        </Box>
      </Popover>
    </>
  );
}
