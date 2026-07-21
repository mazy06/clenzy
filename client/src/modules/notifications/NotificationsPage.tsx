import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
  TablePagination,
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
} from '../../icons';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { notificationsApi } from '../../services/api/notificationsApi';
import type { Notification } from '../../services/api';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import { useTabValueParam } from '../../components/tabKeyParam';
import EmptyState from '../../components/EmptyState';
import DataFetchWrapper from '../../components/DataFetchWrapper';
import { parseApiDate } from '../../utils/formatUtils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type TabFilter = 'all' | 'unread' | 'intervention' | 'service_request' | 'payment' | 'reservation' | 'system' | 'contact' | 'document' | 'guest_messaging';

// Valeurs d'onglet autorisees (= cles d'URL ?tab=<value>). 'all' est le defaut (URL propre).
const NOTIFICATION_TAB_VALUES: TabFilter[] = ['all', 'unread', 'intervention', 'service_request', 'payment', 'reservation', 'system', 'contact', 'document', 'guest_messaging'];

const CATEGORY_ICONS: Record<Notification['category'], React.ReactNode> = {
  intervention: <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}><Build size={18} strokeWidth={1.75} /></Box>,
  service_request: <Box component="span" sx={{ display: 'inline-flex', color: 'warning.main' }}><Description size={18} strokeWidth={1.75} /></Box>,
  payment: <Box component="span" sx={{ display: 'inline-flex', color: 'success.main' }}><Payment size={18} strokeWidth={1.75} /></Box>,
  system: <Box component="span" sx={{ display: 'inline-flex', color: 'secondary.main' }}><Info size={18} strokeWidth={1.75} /></Box>,
  team: <Box component="span" sx={{ display: 'inline-flex', color: 'info.main' }}><Groups size={18} strokeWidth={1.75} /></Box>,
  contact: <Box component="span" sx={{ display: 'inline-flex', color: 'error.main' }}><Email size={18} strokeWidth={1.75} /></Box>,
  document: <Box component="span" sx={{ display: 'inline-flex', color: 'warning.dark' }}><Description size={18} strokeWidth={1.75} /></Box>,
  reservation: <Box component="span" sx={{ display: 'inline-flex', color: 'info.main' }}><EventNote size={18} strokeWidth={1.75} /></Box>,
  guest_messaging: <Box component="span" sx={{ display: 'inline-flex', color: 'error.main' }}><Email size={18} strokeWidth={1.75} /></Box>,
};

function timeAgo(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string, lang = 'fr'): string {
  const now = Date.now();
  const date = parseApiDate(dateStr).getTime();
  const diff = Math.max(0, now - date);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t('notifications.timeAgo.now');
  if (minutes < 60) return t('notifications.timeAgo.minutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('notifications.timeAgo.hours', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('notifications.timeAgo.days', { count: days });
  const locale = lang === 'ar' ? 'ar-SA' : lang === 'en' ? 'en-US' : 'fr-FR';
  return parseApiDate(dateStr).toLocaleDateString(locale);
}

// ─── Pagination ────────────────────────────────────────────────────────────

// Pas de scroll : le nombre de lignes par page s'ADAPTE à la hauteur d'écran
// disponible (mesure runtime, cf. measure() dans le composant). Ces constantes
// ne sont que des bornes/replis.
const MIN_PER_PAGE = 3;
const ROW_HEIGHT_FALLBACK = 61; // px — utilisé tant qu'aucune ligne n'est peinte
const BOTTOM_RESERVE = 96; // px réservés sous la liste (pagination + mt + padding layout)
const PAGINATION_SX = {
  bgcolor: 'var(--card)',
  borderTop: '1px solid var(--line)',
  mt: 1.5,
  borderRadius: '9px',
} as const;

// ─── Component ───────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { t, currentLanguage } = useTranslation();
  // Onglet actif = filtre string, persiste dans l'URL (?tab=<value>) — la valeur EST la cle stable.
  const [activeTab, setActiveTab] = useTabValueParam<TabFilter>(NOTIFICATION_TAB_VALUES, 'all');

  const queryClient = useQueryClient();

  // Reset availability on mount so the page always tries to reach the backend
  // (et refetch : la query a pu se resoudre a vide pendant l'indisponibilite).
  React.useEffect(() => {
    notificationsApi.resetAvailability();
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [queryClient]);

  // Pagination SERVEUR, SANS scroll : la taille de page s'adapte à la
  // hauteur d'écran disponible (pattern PAGINATION_SX / TablePagination).
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(10);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Onglets → filtres serveur exclusifs : unread=true OU category=<tab>.
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['notifications', 'list', activeTab, page, perPage],
    queryFn: () => notificationsApi.getPage({
      page,
      size: perPage,
      unread: activeTab === 'unread' ? true : undefined,
      category: activeTab !== 'all' && activeTab !== 'unread' ? activeTab : undefined,
    }),
    placeholderData: keepPreviousData,
  });

  const notifications = data?.content ?? [];
  const totalElements = data?.totalElements ?? 0;

  // Compteur non lues via l'endpoint dedie (meme cle que la Sidebar → cache partage).
  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.getUnreadCount(),
  });
  const unreadCount = unreadData?.count ?? 0;

  // Mesure : combien de lignes tiennent entre le haut de la liste et le bas du
  // viewport (moins la marge réservée à la pagination). Recalcul au resize et
  // dès que les lignes sont peintes (loading / taille de liste).
  React.useLayoutEffect(() => {
    const measure = () => {
      const list = listRef.current;
      if (!list) return;
      const firstRow = list.querySelector<HTMLElement>('[data-notif-row]');
      const rowH = firstRow?.offsetHeight || ROW_HEIGHT_FALLBACK;
      const top = list.getBoundingClientRect().top;
      const avail = window.innerHeight - top - BOTTOM_RESERVE;
      const n = Math.max(MIN_PER_PAGE, Math.floor(avail / rowH));
      setPerPage((prev) => (prev === n ? prev : n));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [isLoading, notifications.length]);

  // Nouveau filtre → on repart à la 1re page.
  React.useEffect(() => { setPage(0); }, [activeTab]);
  // Sécurité : si le total rétrécit (suppression / tout lu) ou si perPage change, on borne la page.
  React.useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(totalElements / perPage) - 1);
    setPage((p) => Math.min(p, maxPage));
  }, [totalElements, perPage]);

  // Toute action (lu / tout lu / suppression) invalide les pages ET le
  // compteur unread (prefixe commun ['notifications'], Sidebar comprise).
  const invalidateNotifications = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    [queryClient],
  );

  const handleClick = useCallback(
    async (notification: Notification) => {
      if (!notification.read) {
        await notificationsApi.markAsRead(notification.id);
        invalidateNotifications();
      }
      if (notification.actionUrl) {
        navigate(notification.actionUrl);
      }
    },
    [invalidateNotifications, navigate],
  );

  const handleMarkAllRead = useCallback(async () => {
    await notificationsApi.markAllAsRead();
    invalidateNotifications();
  }, [invalidateNotifications]);

  const handleDelete = useCallback(
    async (e: React.MouseEvent, id: number) => {
      e.stopPropagation();
      await notificationsApi.delete(id);
      invalidateNotifications();
    },
    [invalidateNotifications],
  );

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
    { value: 'guest_messaging', label: t('notifications.tabs.guestMessaging') },
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
        iconBadge={<NotificationsNone />}
        backPath="/dashboard"
        backLabel={t('common.back')}
        actions={
          unreadCount > 0 ? (
            <Button
              variant="outlined"
              size="small"
              startIcon={<DoneAll size={18} strokeWidth={1.75} />}
              onClick={handleMarkAllRead}
              sx={{ fontSize: '0.8125rem', py: 0.5 }}
              title={t('notifications.markAllRead')}
            >
              {t('notifications.markAllRead')}
            </Button>
          ) : undefined
        }
      />

      {/* Pleine largeur comme les autres écrans : le padding vient du layout
          (<main> p:{xs:1.5,md:2}). Pas de maxWidth ni mx:auto (anomalie retirée). */}
      <Box>
      {/* Filter Tabs */}
      <PageTabs
        options={tabs.map((tab) => ({ value: tab.value, label: tab.label }))}
        value={activeTab}
        onChange={(v) => setActiveTab(v as typeof activeTab)}
        size="compact"
        paper={false}
        mb={1}
      />

      {/* Content */}
      <DataFetchWrapper
        loading={isLoading}
        error={error ? (error instanceof Error ? error.message : String(error)) : null}
        onRetry={() => {
          notificationsApi.resetAvailability();
          refetch();
        }}
        isEmpty={notifications.length === 0}
        emptyState={
          <EmptyState
            icon={<NotificationsNone />}
            title={t('notifications.empty')}
            description={
              activeTab !== 'all'
                ? t('notifications.emptyFilter')
                : t('notifications.emptyAll')
            }
            variant="transparent"
          />
        }
      >
        <Box ref={listRef}>
          {notifications.map((notification, index) => (
            <Box
              key={notification.id}
              data-notif-row
              onClick={() => handleClick(notification)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 2,
                py: 1.5,
                cursor: 'pointer',
                borderBottom: index < notifications.length - 1 ? '1px solid' : 'none',
                borderColor: 'divider',
                transition: 'background-color 0.15s',
                bgcolor: notification.read ? 'transparent' : 'action.hover',
                '&:hover': {
                  bgcolor: 'action.selected',
                },
                '&:hover .delete-btn': {
                  opacity: 1,
                },
                borderRadius: index === 0 ? '8px 8px 0 0' : index === notifications.length - 1 ? '0 0 8px 8px' : 0,
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
                {CATEGORY_ICONS[notification.category] ?? <Info size={18} strokeWidth={1.75} />}
              </Box>

              {/* Text */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  {!notification.read && (
                    <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main', flexShrink: 0 }}><Circle size={7} strokeWidth={1.75} /></Box>
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
                  <DeleteOutline size={17} strokeWidth={1.75} />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Box>
        {totalElements > perPage && (
          <TablePagination
            component="div"
            count={totalElements}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={perPage}
            rowsPerPageOptions={[perPage]}
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
            sx={PAGINATION_SX}
          />
        )}
      </DataFetchWrapper>
      </Box>
    </Box>
  );
}
