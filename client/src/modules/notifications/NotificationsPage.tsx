import React, { useState, useCallback, useMemo } from 'react';
import { cn } from '../../utils/cn';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import {
  DoneAll,
  DeleteOutline,
  NotificationsNone,
  Settings as SettingsIcon,
} from '../../icons';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { useIsMobile } from '../../hooks/use-mobile';
import { notificationsApi } from '../../services/api/notificationsApi';
import type { Notification } from '../../services/api';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import { useTabValueParam } from '../../components/tabKeyParam';
import EmptyState from '../../components/EmptyState';
import ShowcaseEmpty from '../../components/baitly/ShowcaseEmpty';
import DataFetchWrapper from '../../components/DataFetchWrapper';
import PagePagination from '../../components/PagePagination';
import NotificationDetailCard from './NotificationDetailCard';
import { categoryStyle, startOfDay, timeAgo, localeOf } from './notificationMeta';

type TabFilter = 'all' | 'unread' | 'intervention' | 'service_request' | 'payment' | 'reservation' | 'system' | 'contact' | 'document' | 'guest_messaging';

const NOTIFICATION_TAB_VALUES: TabFilter[] = ['all', 'unread', 'intervention', 'service_request', 'payment', 'reservation', 'system', 'contact', 'document', 'guest_messaging'];

const MIN_PER_PAGE = 3;
const ROW_HEIGHT_FALLBACK = 74; // px — carte p-3 de la projection, mesurée dès la 1re peinture

/** Seuil master-detail : le `md` de MUI, celui du reste de l'écran. */
const SPLIT_BREAKPOINT = 900;

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { t, currentLanguage } = useTranslation();
  const [activeTab, setActiveTab] = useTabValueParam<TabFilter>(NOTIFICATION_TAB_VALUES, 'all');
  const isMobile = useIsMobile(SPLIT_BREAKPOINT);

  const queryClient = useQueryClient();

  React.useEffect(() => {
    notificationsApi.resetAvailability();
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [queryClient]);

  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(10);
  // Instantané de l'événement lu, et non son seul identifiant : sur l'onglet
  // « Non lues », le marquer lu le fait sortir de la page au rechargement
  // suivant — la fiche ouverte ne doit pas se refermer sous le curseur.
  const [selectedSnapshot, setSelectedSnapshot] = useState<Notification | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

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

  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.getUnreadCount(),
  });
  const unreadCount = unreadData?.count ?? 0;

  const selected = useMemo(() => {
    if (!selectedSnapshot) return null;
    return notifications.find((n) => n.id === selectedSnapshot.id) ?? selectedSnapshot;
  }, [notifications, selectedSnapshot]);
  const selectedId = selected?.id ?? null;

  const listIsEmpty = !isLoading && !error && notifications.length === 0;

  const groups = useMemo(() => {
    const parJour = new Map<number, Notification[]>();
    for (const n of notifications) {
      const cle = startOfDay(n.createdAt);
      const liste = parJour.get(cle);
      if (liste) liste.push(n);
      else parJour.set(cle, [n]);
    }
    const aujourdHui = new Date();
    aujourdHui.setHours(0, 0, 0, 0);
    const unJour = 86_400_000;
    const locale = localeOf(currentLanguage);
    return [...parJour.entries()].map(([jour, items]) => {
      const ecart = aujourdHui.getTime() - jour;
      const label =
        ecart === 0
          ? t('notifications.groups.today')
          : ecart === unJour
            ? t('notifications.groups.yesterday')
            : new Date(jour).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
      return { jour, label, items };
    });
  }, [notifications, currentLanguage, t]);

  // La liste ne défile plus dans la fenêtre : elle occupe la hauteur de sa
  // colonne, et c'est la pagination qui absorbe le reste. La mesure porte donc
  // sur la ZONE de défilement (bornée par le flex), jamais sur `innerHeight`
  // moins sa position — cette dernière formule dérivait dès qu'un bloc
  // apparaissait au-dessus après la première peinture.
  React.useLayoutEffect(() => {
    const measure = () => {
      const zone = scrollRef.current;
      if (!zone || zone.clientHeight <= 0) return;
      const firstRow = zone.querySelector<HTMLElement>('[data-notif-row]');
      const rowH = firstRow?.offsetHeight || ROW_HEIGHT_FALLBACK;
      const n = Math.max(MIN_PER_PAGE, Math.floor(zone.clientHeight / rowH));
      setPerPage((prev) => (prev === n ? prev : n));
    };
    measure();
    const zone = scrollRef.current;
    const observer = zone ? new ResizeObserver(measure) : null;
    if (zone && observer) observer.observe(zone);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [isLoading, notifications.length]);

  React.useEffect(() => { setPage(0); setSelectedSnapshot(null); }, [activeTab]);
  React.useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(totalElements / perPage) - 1);
    setPage((p) => Math.min(p, maxPage));
  }, [totalElements, perPage]);

  const invalidateNotifications = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    [queryClient],
  );

  // Un clic n'emmène plus ailleurs : il ouvre le détail à droite. La navigation
  // reste offerte PAR la carte, quand l'événement pointe vers un écran.
  const handleSelect = useCallback(
    async (notification: Notification) => {
      setSelectedSnapshot(notification);
      if (!notification.read) {
        await notificationsApi.markAsRead(notification.id);
        setSelectedSnapshot((current) =>
          current && current.id === notification.id ? { ...current, read: true } : current,
        );
        invalidateNotifications();
      }
    },
    [invalidateNotifications],
  );

  const handleMarkAllRead = useCallback(async () => {
    await notificationsApi.markAllAsRead();
    invalidateNotifications();
  }, [invalidateNotifications]);

  const handleDelete = useCallback(
    async (id: number) => {
      await notificationsApi.delete(id);
      setSelectedSnapshot((current) => (current?.id === id ? null : current));
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
    <>
      {/* Le bandeau du header deborde du rembourrage du conteneur de contenu
          (marges negatives). Il vit donc HORS de la colonne ci-dessous, dont le
          `overflow-hidden` decoupait ce debordement sur les quatre cotes : le
          bandeau s'arretait au bord du rembourrage, comme une carte. */}
      <PageHeader
        title={t('notifications.title')}
        subtitle={
          unreadCount > 0
            ? `${unreadCount} ${t('notifications.unread')}`
            : t('notifications.allRead')
        }
        iconBadge={<NotificationsNone />}
        showBackButton={false}
        actions={
          <>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
                <DoneAll size={18} strokeWidth={1.75} />
                {t('notifications.markAllRead')}
              </Button>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('notifications.preferences')}
                  onClick={() => navigate('/settings?tab=notifications')}
                >
                  <SettingsIcon size={18} strokeWidth={1.75} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('notifications.preferences')}</TooltipContent>
            </Tooltip>
          </>
        }
      />
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">

        <PageTabs
            options={tabs.map((tab) => ({
              value: tab.value,
              label: tab.label,
              badge: tab.value === 'unread' && unreadCount > 0 ? unreadCount : undefined,
              badgeColor: 'primary' as const,
            }))}
            value={activeTab}
            onChange={(v) => setActiveTab(v as typeof activeTab)}
            size="compact"
            paper={false}
            mb={1}
          />

        {/* Deux colonnes distinctes plutôt qu'une carte scindée par un filet : la
            file d'événements et l'événement lu sont deux objets, séparés par une
            gouttière. Sous le seuil, le détail prend toute la place (master-detail
            mobile) et un bouton Retour ramène à la file. */}
        <div
          className={cn(
            'grid min-h-0 flex-1 grid-cols-1 gap-3',
            !listIsEmpty && 'min-[900px]:grid-cols-[minmax(320px,380px)_1fr]',
          )}
        >
          <div
            className={cn(
              'flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card',
              selected && 'hidden min-[900px]:flex',
            )}
          >
            <DataFetchWrapper
              loading={isLoading}
              error={error ? (error instanceof Error ? error.message : String(error)) : null}
              onRetry={() => {
                notificationsApi.resetAvailability();
                refetch();
              }}
              isEmpty={notifications.length === 0}
              emptyState={
                activeTab === 'all' ? (
                  <ShowcaseEmpty
                    eyebrow={{ icon: <NotificationsNone size={14} strokeWidth={1.75} />, label: t('notifications.title') }}
                    title={t('notifications.showcase.title')}
                    description={t('notifications.showcase.description')}
                    action={
                      <Button onClick={() => navigate('/settings?tab=notifications')}>
                        {t('notifications.showcase.action')}
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={<NotificationsNone />}
                    title={t('notifications.empty')}
                    description={t('notifications.emptyFilter')}
                    variant="transparent"
                  />
                )
              }
            >
              <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-2">
                {groups.map((group) => (
                  <div className="flex flex-col gap-2" key={group.jour}>
                    <h3 className="m-0 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {group.label}
                    </h3>
                    {group.items.map((notification) => {
                      const style = categoryStyle(notification.category);
                      const active = notification.id === selectedId;
                      return (
                        <div
                          key={notification.id}
                          data-notif-row
                          role="button"
                          tabIndex={0}
                          aria-current={active || undefined}
                          onClick={() => handleSelect(notification)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleSelect(notification);
                            }
                          }}
                          className={cn(
                            'group/notification flex cursor-pointer items-start gap-3 rounded-xl border border-solid p-3 text-start transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none',
                            active
                              ? 'border-primary/40 bg-primary-soft/50'
                              : cn('hover:bg-accent', !notification.read ? 'border-primary/25 bg-card' : 'border-border bg-card/60'),
                          )}
                        >
                          <span
                            className={cn(
                              'mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg',
                              style.accent,
                            )}
                          >
                            {style.icon}
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold text-foreground">
                                {notification.notificationKey
                                  ? t(`notifications.keys.${notification.notificationKey}`, { defaultValue: notification.title })
                                  : notification.title}
                              </span>
                              {!notification.read && (
                                <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                              )}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                              {notification.message}
                            </span>
                          </span>

                          <span className="flex shrink-0 items-center gap-1">
                            <span className="text-2xs text-faint whitespace-nowrap">
                              {timeAgo(notification.createdAt, t, currentLanguage)}
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex opacity-0 transition-opacity duration-150 group-hover/notification:opacity-100">
                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    aria-label={t('common.delete')}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(notification.id);
                                    }}
                                    className="text-faint hover:text-destructive"
                                  >
                                    <DeleteOutline size={15} strokeWidth={1.75} />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>{t('common.delete')}</TooltipContent>
                            </Tooltip>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              {totalElements > perPage && (
                <PagePagination
                  count={totalElements}
                  page={page}
                  onPageChange={(p) => setPage(p)}
                  rowsPerPage={perPage}
                  className="shrink-0 border-t border-border px-2"
                />
              )}
            </DataFetchWrapper>
          </div>

          {/* ── Volet droit : l'événement lu, ou l'invitation à en choisir un ── */}
          {!listIsEmpty && (
            <div className={cn('flex min-h-0 min-w-0 flex-col', !selected && 'hidden min-[900px]:flex')}>
              {selected ? (
                <NotificationDetailCard
                  key={selected.id}
                  notification={selected}
                  showBack={isMobile}
                  onClose={() => setSelectedSnapshot(null)}
                  onDelete={handleDelete}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-card p-4">
                  <EmptyState
                    variant="transparent"
                    icon={<NotificationsNone />}
                    title={t('notifications.detail.selectTitle', 'Sélectionnez une notification')}
                    description={t(
                      'notifications.detail.selectHint',
                      "Choisissez un événement à gauche pour lire son détail complet et les actions possibles.",
                    )}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
