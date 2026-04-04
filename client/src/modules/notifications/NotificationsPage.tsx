import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Build,
  Description,
  Payment,
  Info,
  Groups,
  Email,
  DoneAll,
  DeleteOutline,
  Circle,
  NotificationsNone,
  EventNote,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useAsync } from '../../hooks/useAsync';
import { notificationsApi } from '../../services/api';
import type { Notification } from '../../services/api';
import PageHeader from '../../components/PageHeader';
import DataFetchWrapper from '../../components/DataFetchWrapper';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type TabFilter = 'all' | 'unread' | 'intervention' | 'service_request' | 'payment' | 'reservation' | 'system' | 'contact' | 'document';

const CATEGORY_ICONS: Record<Notification['category'], React.ReactNode> = {
  intervention: <Build sx={{ fontSize: 18, color: 'primary.main' }} />,
  service_request: <Description sx={{ fontSize: 18, color: 'warning.main' }} />,
  payment: <Payment sx={{ fontSize: 18, color: 'success.main' }} />,
  system: <Info sx={{ fontSize: 18, color: 'secondary.main' }} />,
  team: <Groups sx={{ fontSize: 18, color: 'info.main' }} />,
  contact: <Email sx={{ fontSize: 18, color: 'error.main' }} />,
  document: <Description sx={{ fontSize: 18, color: 'warning.dark' }} />,
  reservation: <EventNote sx={{ fontSize: 18, color: 'info.main' }} />,
};

function timeAgo(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string, lang = 'fr'): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = Math.max(0, now - date);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t('notifications.timeAgo.now');
  if (minutes < 60) return t('notifications.timeAgo.minutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('notifications.timeAgo.hours', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('notifications.timeAgo.days', { count: days });
  const locale = lang === 'ar' ? 'ar-SA' : lang === 'en' ? 'en-US' : 'fr-FR';
  return new Date(dateStr).toLocaleDateString(locale);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { t, currentLanguage } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabFilter>('all');

  // Reset availability on mount so the page always tries to reach the backend
  React.useEffect(() => {
    notificationsApi.resetAvailability();
  }, []);

  const {
    data: notifications,
    loading,
    error,
    retry,
    setData,
  } = useAsync(() => notificationsApi.getAll(), { immediate: true });

  const filtered = useMemo(() => {
    if (!notifications) return [];
    switch (activeTab) {
      case 'unread':
        return notifications.filter((n) => !n.read);
      case 'intervention':
      case 'service_request':
      case 'payment':
      case 'system':
      case 'contact':
      case 'document':
        return notifications.filter((n) => n.category === activeTab);
      default:
        return notifications;
    }
  }, [notifications, activeTab]);

  const handleClick = useCallback(
    async (notification: Notification) => {
      if (!notification.read) {
        await notificationsApi.markAsRead(notification.id);
        setData(
          (notifications ?? []).map((n) =>
            n.id === notification.id ? { ...n, read: true } : n,
          ),
        );
      }
      if (notification.actionUrl) {
        navigate(notification.actionUrl);
      }
    },
    [notifications, navigate, setData],
  );

  const handleMarkAllRead = useCallback(async () => {
    await notificationsApi.markAllAsRead();
    setData((notifications ?? []).map((n) => ({ ...n, read: true })));
  }, [notifications, setData]);

  const handleDelete = useCallback(
    async (e: React.MouseEvent, id: number) => {
      e.stopPropagation();
      await notificationsApi.delete(id);
      setData((notifications ?? []).filter((n) => n.id !== id));
    },
    [notifications, setData],
  );

  const unreadCount = (notifications ?? []).filter((n) => !n.read).length;

  const tabs: { value: TabFilter; label: string }[] = [
    { value: 'all', label: t('notifications.tabs.all') },
    { value: 'unread', label: t('notifications.tabs.unread') },
    { value: 'intervention', label: t('notifications.tabs.interventions') },
    { value: 'service_request', label: t('notifications.tabs.requests') },
    { value: 'payment', label: t('notifications.tabs.payments') },
    { value: 'reservation', label: t('notifications.tabs.reservations') },
    { value: 'system', label: t('notifications.tabs.system') },
    { value: 'contact', label: t('notifications.tabs.contact') },
    { value: 'document', label: t('notifications.tabs.document') },
  ];

  return (
    <Box>
      <PageHeader
        title={t('notifications.title')}
        subtitle={
          unreadCount > 0
            ? `${unreadCount} ${t('notifications.unread')}`
            : t('notifications.allRead')
        }
        backPath="/dashboard"
        backLabel={t('common.back')}
        actions={
          unreadCount > 0 ? (
            <Button
              variant="outlined"
              size="small"
              startIcon={<DoneAll sx={{ fontSize: 18 }} />}
              onClick={handleMarkAllRead}
              sx={{ fontSize: '0.8125rem', py: 0.5 }}
              title={t('notifications.markAllRead')}
            >
              {t('notifications.markAllRead')}
            </Button>
          ) : undefined
        }
      />

      <Box sx={{ maxWidth: 900, mx: 'auto', px: { xs: 1, sm: 2 } }}>
      {/* Filter Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          mb: 1,
          minHeight: 36,
          '& .MuiTab-root': { minHeight: 36, py: 0.5, fontSize: '0.8125rem', textTransform: 'none' },
        }}
      >
        {tabs.map((tab) => (
          <Tab key={tab.value} value={tab.value} label={tab.label} />
        ))}
      </Tabs>

      {/* Content */}
      <DataFetchWrapper
        loading={loading}
        error={error}
        onRetry={retry}
        isEmpty={filtered.length === 0}
        emptyState={
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <NotificationsNone sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography variant="h6" color="text.secondary" sx={{ fontSize: '1rem' }}>
              {t('notifications.empty')}
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
              {activeTab !== 'all'
                ? t('notifications.emptyFilter')
                : t('notifications.emptyAll')}
            </Typography>
          </Box>
        }
      >
        <Box>
          {filtered.map((notification, index) => (
            <Box
              key={notification.id}
              onClick={() => handleClick(notification)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 2,
                py: 1.5,
                cursor: 'pointer',
                borderBottom: index < filtered.length - 1 ? '1px solid' : 'none',
                borderColor: 'divider',
                transition: 'background-color 0.15s',
                bgcolor: notification.read ? 'transparent' : 'action.hover',
                '&:hover': {
                  bgcolor: 'action.selected',
                },
                '&:hover .delete-btn': {
                  opacity: 1,
                },
                borderRadius: index === 0 ? '8px 8px 0 0' : index === filtered.length - 1 ? '0 0 8px 8px' : 0,
              }}
            >
              {/* Icon */}
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'action.hover',
                  flexShrink: 0,
                }}
              >
                {CATEGORY_ICONS[notification.category] ?? <Info sx={{ fontSize: 18 }} />}
              </Box>

              {/* Text */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  {!notification.read && (
                    <Circle sx={{ fontSize: 7, color: 'primary.main', flexShrink: 0 }} />
                  )}
                  <Typography
                    variant="body2"
                    fontWeight={notification.read ? 400 : 600}
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '0.84rem',
                      color: notification.read ? 'text.secondary' : 'text.primary',
                    }}
                  >
                    {notification.notificationKey
                      ? t(`notifications.keys.${notification.notificationKey}`, { defaultValue: notification.title })
                      : notification.title}
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  color="text.disabled"
                  sx={{
                    fontSize: '0.78rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    mt: 0.15,
                  }}
                >
                  {notification.message}
                </Typography>
              </Box>

              {/* Time */}
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{
                  fontSize: '0.72rem',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {timeAgo(notification.createdAt, t, currentLanguage)}
              </Typography>

              {/* Delete — visible on hover */}
              <Tooltip title={t('common.delete')}>
                <IconButton
                  className="delete-btn"
                  size="small"
                  onClick={(e) => handleDelete(e, notification.id)}
                  sx={{
                    flexShrink: 0,
                    opacity: 0,
                    transition: 'opacity 0.15s',
                    color: 'text.disabled',
                    '&:hover': { color: 'error.main' },
                  }}
                >
                  <DeleteOutline sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Box>
      </DataFetchWrapper>
      </Box>
    </Box>
  );
}
