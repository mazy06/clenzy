import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardActionArea,
  CardContent,
  Tabs,
  Tab,
  Button,
  Chip,
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
  Delete,
  Circle,
  NotificationsNone,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useAsync } from '../../hooks/useAsync';
import { notificationsApi } from '../../services/api';
import type { Notification } from '../../services/api';
import PageHeader from '../../components/PageHeader';
import DataFetchWrapper from '../../components/DataFetchWrapper';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type TabFilter = 'all' | 'unread' | 'intervention' | 'service_request' | 'payment' | 'system' | 'contact';

const CATEGORY_ICONS: Record<Notification['category'], React.ReactNode> = {
  intervention: <Build sx={{ fontSize: 20, color: '#1976d2' }} />,
  service_request: <Description sx={{ fontSize: 20, color: '#ed6c02' }} />,
  payment: <Payment sx={{ fontSize: 20, color: '#2e7d32' }} />,
  system: <Info sx={{ fontSize: 20, color: '#9c27b0' }} />,
  team: <Groups sx={{ fontSize: 20, color: '#0288d1' }} />,
  contact: <Email sx={{ fontSize: 20, color: '#e91e63' }} />,
};

function getTypeColor(type: Notification['type']): 'info' | 'success' | 'warning' | 'error' {
  return type;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = Math.max(0, now - date);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "A l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Il y a ${days}j`;
  return new Date(dateStr).toLocaleDateString('fr-FR');
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabFilter>('all');

  // Reset availability on mount so the page always tries to reach the backend
  React.useEffect(() => {
    notificationsApi.resetAvailability();
  }, []);

  // Fetch notifications
  const {
    data: notifications,
    loading,
    error,
    retry,
    setData,
  } = useAsync(() => notificationsApi.getAll(), { immediate: true });

  // Filter notifications based on active tab
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
        return notifications.filter((n) => n.category === activeTab);
      default:
        return notifications;
    }
  }, [notifications, activeTab]);

  // Mark a single notification as read
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

  // Mark all as read
  const handleMarkAllRead = useCallback(async () => {
    await notificationsApi.markAllAsRead();
    setData((notifications ?? []).map((n) => ({ ...n, read: true })));
  }, [notifications, setData]);

  // Delete a notification
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
    { value: 'all', label: t('notifications.tabs.all') || 'Toutes' },
    { value: 'unread', label: t('notifications.tabs.unread') || 'Non lues' },
    { value: 'intervention', label: t('notifications.tabs.interventions') || 'Interventions' },
    { value: 'service_request', label: t('notifications.tabs.requests') || 'Demandes' },
    { value: 'payment', label: t('notifications.tabs.payments') || 'Paiements' },
    { value: 'system', label: t('notifications.tabs.system') || 'Systeme' },
    { value: 'contact', label: t('notifications.tabs.contact') || 'Contact' },
  ];

  return (
    <Box>
      <PageHeader
        title={t('notifications.title') || 'Notifications'}
        subtitle={
          unreadCount > 0
            ? `${unreadCount} ${t('notifications.unread') || 'non lue(s)'}`
            : t('notifications.allRead') || 'Tout est lu'
        }
        backPath="/dashboard"
        backLabel={t('common.back') || 'Retour'}
        actions={
          unreadCount > 0 ? (
            <Button
              variant="outlined"
              size="small"
              startIcon={<DoneAll sx={{ fontSize: 18 }} />}
              onClick={handleMarkAllRead}
              sx={{ fontSize: '0.8125rem', py: 0.5 }}
            >
              {t('notifications.markAllRead') || 'Marquer tout comme lu'}
            </Button>
          ) : undefined
        }
      />

      {/* Filter Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          mb: 2,
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
              {t('notifications.empty') || 'Aucune notification'}
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
              {activeTab !== 'all'
                ? t('notifications.emptyFilter') || 'Aucune notification dans cette categorie.'
                : t('notifications.emptyAll') || "Vous n'avez aucune notification pour le moment."}
            </Typography>
          </Box>
        }
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {filtered.map((notification) => (
            <Card
              key={notification.id}
              sx={{
                borderLeft: 3,
                borderColor: notification.read ? 'divider' : `${getTypeColor(notification.type)}.main`,
                opacity: notification.read ? 0.75 : 1,
                transition: 'opacity 0.2s, box-shadow 0.2s',
                '&:hover': { boxShadow: 3 },
              }}
            >
              <CardActionArea onClick={() => handleClick(notification)} sx={{ p: 0 }}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    {/* Category icon */}
                    <Box sx={{ pt: 0.25, flexShrink: 0 }}>
                      {CATEGORY_ICONS[notification.category] ?? <Info sx={{ fontSize: 20 }} />}
                    </Box>

                    {/* Text content */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                        {!notification.read && (
                          <Circle sx={{ fontSize: 8, color: 'primary.main', flexShrink: 0 }} />
                        )}
                        <Typography
                          variant="body2"
                          fontWeight={notification.read ? 400 : 600}
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: '0.875rem',
                          }}
                        >
                          {notification.title}
                        </Typography>
                      </Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          fontSize: '0.8125rem',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {notification.message}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.75rem' }}>
                          {timeAgo(notification.createdAt)}
                        </Typography>
                        <Chip
                          label={notification.category.replace('_', ' ')}
                          size="small"
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.6875rem' }}
                        />
                      </Box>
                    </Box>

                    {/* Delete button */}
                    <Tooltip title={t('common.delete') || 'Supprimer'}>
                      <IconButton
                        size="small"
                        onClick={(e) => handleDelete(e, notification.id)}
                        sx={{ flexShrink: 0, mt: -0.25 }}
                      >
                        <Delete sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      </DataFetchWrapper>
    </Box>
  );
}
