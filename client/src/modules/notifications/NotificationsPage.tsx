import React, { useState, useCallback, useMemo } from 'react';
import { cn } from '../../utils/cn';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import {
  Build,
  Description,
  Payment,
  Info,
  Groups,
  Email,
  DoneAll,
  DeleteOutline,
  NotificationsNone,
  EventNote,
  Settings as SettingsIcon,
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
import ShowcaseEmpty from '../../components/baitly/ShowcaseEmpty';
import DataFetchWrapper from '../../components/DataFetchWrapper';
import { parseApiDate } from '../../utils/formatUtils';
import PagePagination from '../../components/PagePagination';

// ─── Helpers ─────────────────────────────────────────────────────────────────

type TabFilter = 'all' | 'unread' | 'intervention' | 'service_request' | 'payment' | 'reservation' | 'system' | 'contact' | 'document' | 'guest_messaging';

// Valeurs d'onglet autorisees (= cles d'URL ?tab=<value>). 'all' est le defaut (URL propre).
const NOTIFICATION_TAB_VALUES: TabFilter[] = ['all', 'unread', 'intervention', 'service_request', 'payment', 'reservation', 'system', 'contact', 'document', 'guest_messaging'];

/**
 * Icone + teinte par categorie, selon la grille de la projection
 * (BNotificationsSectionDemo) : un carre teinte par nature d'evenement —
 * l'argent en succes, l'operationnel en info, ce qui attend une reaction en
 * warning, la messagerie entrante en destructif, le systeme en neutre.
 */
const CATEGORY_STYLE: Record<Notification['category'], { icon: React.ReactNode; accent: string }> = {
  reservation: { icon: <EventNote size={16} strokeWidth={1.75} />, accent: 'text-success bg-success-soft' },
  payment: { icon: <Payment size={16} strokeWidth={1.75} />, accent: 'text-success bg-success-soft' },
  intervention: { icon: <Build size={16} strokeWidth={1.75} />, accent: 'text-info bg-info-soft' },
  team: { icon: <Groups size={16} strokeWidth={1.75} />, accent: 'text-info bg-info-soft' },
  service_request: { icon: <Description size={16} strokeWidth={1.75} />, accent: 'text-warning bg-warning-soft' },
  document: { icon: <Description size={16} strokeWidth={1.75} />, accent: 'text-warning bg-warning-soft' },
  contact: { icon: <Email size={16} strokeWidth={1.75} />, accent: 'text-destructive bg-destructive-soft' },
  guest_messaging: { icon: <Email size={16} strokeWidth={1.75} />, accent: 'text-destructive bg-destructive-soft' },
  system: { icon: <Info size={16} strokeWidth={1.75} />, accent: 'text-muted-foreground bg-muted' },
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

/** Minuit local du jour d'une notification — la cle de regroupement. */
function startOfDay(dateStr: string): number {
  const d = parseApiDate(dateStr);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ─── Pagination ────────────────────────────────────────────────────────────

// Pas de scroll : le nombre de lignes par page s'ADAPTE à la hauteur d'écran
// disponible (mesure runtime, cf. measure() dans le composant). Ces constantes
// ne sont que des bornes/replis.
const MIN_PER_PAGE = 3;
const ROW_HEIGHT_FALLBACK = 74; // px — carte p-3 de la projection, mesurée dès la 1re peinture
const BOTTOM_RESERVE = 96; // px réservés sous la liste (pagination + mt + padding layout)

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
  // hauteur d'écran disponible (cf. PagePagination).
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

  // Regroupement par jour de la page courante (la projection groupe la liste
  // sous des entetes « Aujourd'hui » / « Hier » / date). Le tri serveur est
  // deja anteschronologique : les cles sortent dans le bon ordre.
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
    const locale = currentLanguage === 'ar' ? 'ar-SA' : currentLanguage === 'en' ? 'en-US' : 'fr-FR';
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
    <div>
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
            {/* La ou se reglent canaux et frequences : la page en est le
                debouche naturel, la projection lui donne un engrenage. */}
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

      {/* Les onglets restent pleine largeur : la projection n'en montrait que
          deux, l'ecran reel en a dix — contraints a la colonne ils se replient
          sur deux lignes qui chevauchent le premier groupe. */}
      <PageTabs
          options={tabs.map((tab) => ({
            value: tab.value,
            label: tab.label,
            // La pastille de la projection sur « Non lues » — meme primitive
            // que la sidebar (NavCountBadge), masquee a zero.
            badge: tab.value === 'unread' && unreadCount > 0 ? unreadCount : undefined,
            badgeColor: 'primary' as const,
          }))}
          value={activeTab}
          onChange={(v) => setActiveTab(v as typeof activeTab)}
          size="compact"
          paper={false}
          mb={1}
        />

      {/* Colonne etroite de la projection : une liste de notifications se lit,
          elle n'a rien a gagner a s'etaler sur un ecran large. */}
      <div className="flex max-w-xl flex-col gap-3">
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
            activeTab === 'all' ? (
              // Compte sans aucune notification : l'etat vide de la projection
              // (ShowcaseEmpty), qui oriente vers le reglage des canaux plutot
              // que de constater le vide.
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
              // Filtre sans resultat : l'etat vide leger suffit, le compte
              // recoit bien des notifications par ailleurs.
              <EmptyState
                icon={<NotificationsNone />}
                title={t('notifications.empty')}
                description={t('notifications.emptyFilter')}
                variant="transparent"
              />
            )
          }
        >
          <div ref={listRef} className="flex flex-col gap-4">
            {groups.map((group) => (
              <div className="flex flex-col gap-2" key={group.jour}>
                <h3 className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {group.label}
                </h3>
                {group.items.map((notification) => {
                  const style = CATEGORY_STYLE[notification.category] ?? CATEGORY_STYLE.system;
                  return (
                    // div cliquable et non <button> comme la projection : la
                    // ligne porte une corbeille, et un controle dans un
                    // controle est invalide — en HTML comme dans l'arbre
                    // d'accessibilite (verifie : role="button" sur la ligne y
                    // exposait un bouton imbrique).
                    <div
                      key={notification.id}
                      data-notif-row
                      onClick={() => handleClick(notification)}
                      className={cn(
                        'group/notification flex cursor-pointer items-start gap-3 rounded-xl border border-solid p-3 text-start transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
                        !notification.read ? 'border-primary/25 bg-card' : 'border-border bg-card/60',
                      )}
                    >
                      {/* Icone dans un carre teinte par nature d'evenement */}
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
                        {/* Corbeille revelee au survol de la ligne. span
                            intermediaire : TooltipTrigger asChild pose une ref
                            DOM sur son enfant. */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex opacity-0 transition-opacity duration-150 group-hover/notification:opacity-100">
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label={t('common.delete')}
                                onClick={(e) => handleDelete(e, notification.id)}
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
            />
          )}
        </DataFetchWrapper>
      </div>
    </div>
  );
}
