import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BanknoteIcon,
  BrushIcon,
  CalendarSyncIcon,
  ChevronRightIcon,
  LogInIcon,
  LogOutIcon,
  StarIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui';
import GuestAvatar from '../../../components/baitly/GuestAvatar';
import ReviewReplyDialog from '../../../components/baitly/ReviewReplyDialog';
import StatusChip from '../../../components/baitly/StatusChip';
import { Money } from '../../../components/baitly/Money';
import { cn } from '../../../utils/cn';
import { useTranslation } from '../../../hooks/useTranslation';

import {
  useDashboardActionItems,
  useDashboardToday,
  useDashboardUpcomingArrivals,
} from '../../../hooks/useDashboardOperations';
import type {
  DashboardStaleFeed,
  DashboardUnansweredReview,
  DashboardUpcomingArrival,
} from '../../../services/api/dashboardOperationsApi';

/** Type exact du `t` du projet — les helpers ci-dessous le reçoivent en paramètre. */
type TranslateFn = ReturnType<typeof useTranslation>['t'];

/**
 * Blocs opérationnels du Dashboard, portés depuis la projection de galerie
 * (`DASHBOARD-PARITY.md` §5, §6, §8).
 *
 * Rendus en Baitly UI, alimentés par `/api/dashboard/operations/*`. Chaque bloc
 * gère son propre vide : un dashboard sans arrivée du jour doit le dire, pas
 * afficher une carte creuse.
 */

/** Couleurs de marque des canaux — alignées sur `PortfolioAnalyticsService`. */
export const CHANNEL_COLORS: Record<string, string> = {
  airbnb: '#FF5A5F',
  booking: '#003580',
  vrbo: '#14B8A6',
  expedia: '#00355F',
  direct: '#2563EB',
  other: '#94A3B8',
};

export function channelColor(source: string | null): string {
  return CHANNEL_COLORS[(source ?? 'other').toLowerCase()] ?? CHANNEL_COLORS.other;
}

function channelLabel(source: string | null, sourceName: string | null): string {
  if (sourceName && sourceName.trim()) return sourceName;
  const key = (source ?? 'other').toLowerCase();
  if (key === 'direct') return 'Direct';
  if (key === 'other') return 'Autre';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

// ─── Coquille de carte, commune aux blocs ───────────────────────────────────

function BlockCard({
  icon,
  title,
  count,
  titleSuffix,
  children,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  count?: number;
  /** Prolonge le titre sur la MÊME ligne (ex. l'unique rubrique peuplée). */
  titleSuffix?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    // Contour en `ring-1`, jamais en `border` : c'est la métrique du `Card` du
    // design system (cf. `.cn-card`, baitly-nova.css). Un `ring` est un
    // box-shadow — il n'occupe aucune place et se dessine hors de la boîte,
    // là où une bordure de 1 px pousse le contenu vers l'intérieur. Mélanger
    // les deux sur une même ligne du tableau de bord décale les cartes et
    // leurs titres d'un pixel.
    <section className={cn('rounded-xl bg-card ring-1 ring-foreground/10 p-4', className)}>
      <h3 className="m-0 mb-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {icon}
        {title}
        {count !== undefined && <span className="tabular-nums">({count})</span>}
        {titleSuffix}
      </h3>
      {children}
    </section>
  );
}

/** Vide de carte : une phrase, pas une carte creuse. */
function BlockEmpty({ children }: { children: React.ReactNode }) {
  return <p className="m-0 py-2 text-sm text-muted-foreground">{children}</p>;
}

// ─── §5 — Opérations du jour ────────────────────────────────────────────────

export function TodayOperationsSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useDashboardToday();

  if (isLoading) return null;

  const arrivals = data?.arrivals ?? [];
  const departures = data?.departures ?? [];
  const cleanings = data?.cleanings ?? [];

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {/* 5.a Arrivées */}
      <BlockCard
        icon={<LogInIcon className="size-3.5 text-success" />}
        title={t('dashboard.today.arrivals', 'Arrivées aujourd’hui')}
        count={arrivals.length}
      >
        {arrivals.length === 0 ? (
          <BlockEmpty>{t('dashboard.today.noArrivals', 'Aucune arrivée aujourd’hui.')}</BlockEmpty>
        ) : (
          <div className="flex flex-col gap-2.5">
            {arrivals.map((arrival) => (
              <button
                key={arrival.reservationId}
                type="button"
                onClick={() => navigate(`/reservations/${arrival.reservationId}`)}
                className="flex cursor-pointer items-center gap-2.5 rounded-md text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <GuestAvatar name={arrival.guestName ?? '?'} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-foreground">
                      {arrival.guestName}
                    </span>
                    <StatusChip
                      color={channelColor(arrival.source)}
                      label={channelLabel(arrival.source, arrival.sourceName)}
                      size="sm"
                    />
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[arrival.propertyName, arrival.note].filter(Boolean).join(' · ')}
                  </span>
                </span>
                {arrival.checkInTime && (
                  <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">
                    {arrival.checkInTime}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </BlockCard>

      {/* 5.b Départs */}
      <BlockCard
        icon={<LogOutIcon className="size-3.5 text-info" />}
        title={t('dashboard.today.departures', 'Départs aujourd’hui')}
        count={departures.length}
      >
        {departures.length === 0 ? (
          <BlockEmpty>{t('dashboard.today.noDepartures', 'Aucun départ aujourd’hui.')}</BlockEmpty>
        ) : (
          <>
            <div className="flex flex-col gap-2.5">
              {departures.map((departure) => (
                <div key={departure.reservationId} className="flex items-center gap-2.5">
                  <GuestAvatar name={departure.guestName ?? '?'} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {departure.guestName}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {departure.propertyName}
                      {departure.depositToRelease != null && (
                        <> · {t('dashboard.today.depositToRelease', 'caution à libérer')}</>
                      )}
                    </div>
                  </div>
                  {departure.checkOutTime && (
                    <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">
                      {departure.checkOutTime}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {/* L'action n'apparaît que s'il y a réellement une caution retenue. */}
            {departures.some((d) => d.securityDepositId != null) && (
              <Button
                size="xs"
                variant="outline"
                className="mt-3"
                onClick={() => navigate('/billing?tab=deposits')}
              >
                {t('dashboard.today.releaseDeposit', 'Libérer la caution')}
              </Button>
            )}
          </>
        )}
      </BlockCard>

      {/* 5.c Ménages */}
      <BlockCard
        icon={<BrushIcon className="size-3.5 text-primary" />}
        title={t('dashboard.today.cleanings', 'Ménages du jour')}
        count={cleanings.length}
      >
        {cleanings.length === 0 ? (
          <BlockEmpty>{t('dashboard.today.noCleanings', 'Aucun ménage planifié aujourd’hui.')}</BlockEmpty>
        ) : (
          <div className="flex flex-col gap-2.5">
            {cleanings.map((cleaning) => (
              <div key={cleaning.interventionId} className="flex items-center gap-2.5">
                <GuestAvatar name={cleaning.assigneeName ?? '?'} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">
                    {cleaning.propertyName}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[cleaning.assigneeName, cleaningWindow(cleaning.windowStart, cleaning.windowEnd)]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                <StatusChip
                  tone={cleaning.status === 'IN_PROGRESS' ? 'warn' : 'neutral'}
                  label={
                    cleaning.status === 'IN_PROGRESS'
                      ? t('dashboard.today.inProgress', 'En cours')
                      : t('dashboard.today.planned', 'Planifié')
                  }
                  dot
                  size="sm"
                />
              </div>
            ))}
          </div>
        )}
      </BlockCard>
    </div>
  );
}

/** « 11:00 → 15:00 », « avant 15:00 », ou rien si aucune borne. */
function cleaningWindow(start: string | null, end: string | null): string | null {
  if (start && end) return `${start} → ${end}`;
  if (end) return `avant ${end}`;
  if (start) return `à partir de ${start}`;
  return null;
}

// ─── §6 — À traiter ─────────────────────────────────────────────────────────

/**
 * Lignes affichées par groupe. Le serveur en renvoie jusqu'à 20 par catégorie
 * (`DashboardOperationsService.MAX_ROWS`), soit 60 lignes possibles dans une
 * tuile de tableau de bord : à ce volume la carte n'est plus une liste de
 * priorités mais un backlog, qu'on ne lit plus. Au-delà, un lien renvoie vers
 * l'écran qui sait vraiment traiter le sujet.
 */
const GROUP_LIMIT = 3;

export function ActionItemsCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useDashboardActionItems();
  // Répondre est le geste attendu ici : on ouvre l'avis sur place. Quitter le
  // tableau de bord reste possible, mais c'est le rôle du lien « Voir les avis ».
  // ⚠️ Avant tout early return (règles des hooks).
  const [replyingTo, setReplyingTo] = React.useState<DashboardUnansweredReview | null>(null);

  if (isLoading) return null;

  const balances = data?.balancesDue ?? [];
  const reviews = data?.unansweredReviews ?? [];
  const feeds = data?.staleFeeds ?? [];
  const total = balances.length + reviews.length + feeds.length;
  // Une seule rubrique peuplée : elle remonte sur la ligne du titre de la carte,
  // et son compteur disparaît — il redirait celui de l'en-tête. Deux lignes
  // d'en-tête empilées pour dire la même chose gaspillaient de la hauteur.
  const populatedGroups = [
    { size: balances.length, icon: <BanknoteIcon />, tone: 'text-warning',
      label: t('dashboard.actionItems.balancesGroup', 'Soldes à percevoir') },
    { size: feeds.length, icon: <CalendarSyncIcon />, tone: 'text-destructive',
      label: t('dashboard.actionItems.feedsGroup', 'Calendriers désynchronisés') },
    { size: reviews.length, icon: <StarIcon />, tone: 'text-info',
      label: t('dashboard.actionItems.reviewsGroup', 'Avis sans réponse') },
  ].filter((group) => group.size > 0);
  const soleGroup = populatedGroups.length === 1 ? populatedGroups[0] : null;
  const showGroupCounts = soleGroup == null;

  return (
    <BlockCard
      icon={<TriangleAlertIcon className="size-3.5 text-warning" />}
      title={t('dashboard.actionItems.title', 'À traiter')}
      count={total}
      titleSuffix={
        soleGroup && (
          <span className="flex items-center gap-1.5 border-s border-border ps-1.5">
            <span className={cn('inline-flex [&>svg]:size-3.5', soleGroup.tone)}>
              {soleGroup.icon}
            </span>
            {soleGroup.label}
          </span>
        )
      }
    >
      {total === 0 ? (
        <BlockEmpty>
          {t('dashboard.actionItems.empty', 'Rien à traiter — tout est à jour.')}
        </BlockEmpty>
      ) : (
        /* Ordre d'urgence, et non ordre d'arrivée : de l'argent qu'on n'a pas
           encaissé, puis un calendrier muet (risque de double réservation),
           puis la réputation. Le plafond par groupe rend cet ordre décisif —
           sans lui, six avis pouvaient enterrer une synchro cassée. */
        <div className="flex flex-col gap-4">
          <ActionGroup
            icon={<BanknoteIcon />}
            tone="text-warning"
            label={t('dashboard.actionItems.balancesGroup', 'Soldes à percevoir')}
            total={balances.length}
            showCount={showGroupCounts}
            hideHeader={soleGroup != null}
            seeAllLabel={t('dashboard.actionItems.seeBilling', 'Voir la facturation')}
            onSeeAll={() => navigate('/billing')}
          >
            {balances.slice(0, GROUP_LIMIT).map((item) => (
              <ActionRow
                key={`balance-${item.reservationId}`}
                primary={item.guestName ?? item.reference}
                secondary={`${item.reference} · ${t('dashboard.actionItems.arrivingOn', 'arrivée')} ${formatArrivalDate(item.checkIn)}`}
                value={
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    <Money value={item.amountDue} decimals={0} />
                  </span>
                }
                onClick={() => navigate(`/reservations/${item.reservationId}`)}
              />
            ))}
          </ActionGroup>

          <ActionGroup
            icon={<CalendarSyncIcon />}
            tone="text-destructive"
            label={t('dashboard.actionItems.feedsGroup', 'Calendriers désynchronisés')}
            total={feeds.length}
            showCount={showGroupCounts}
            hideHeader={soleGroup != null}
            seeAllLabel={t('dashboard.actionItems.seeChannels', 'Voir les canaux')}
            onSeeAll={() => navigate('/channels')}
          >
            {feeds.slice(0, GROUP_LIMIT).map((item) => (
              <ActionRow
                key={`feed-${item.feedId}`}
                primary={item.sourceName ?? t('dashboard.actionItems.unnamedFeed', 'Flux sans nom')}
                secondary={[item.propertyName, feedDelay(item, t)].filter(Boolean).join(' · ')}
                onClick={() => navigate('/channels')}
              />
            ))}
          </ActionGroup>

          <ActionGroup
            icon={<StarIcon />}
            tone="text-info"
            label={t('dashboard.actionItems.reviewsGroup', 'Avis sans réponse')}
            total={reviews.length}
            showCount={showGroupCounts}
            hideHeader={soleGroup != null}
            seeAllLabel={t('dashboard.actionItems.seeReviews', 'Voir les avis')}
            onSeeAll={() => navigate('/channels/reviews')}
          >
            {reviews.slice(0, GROUP_LIMIT).map((item) => {
              const author = item.guestName?.trim() || null;
              const reviewedOn = formatReviewDate(item.reviewDate);
              return (
                <ActionRow
                  key={`review-${item.reviewId}`}
                  /* On répond à quelqu'un, pas à une ligne de texte : le
                     voyageur ouvre la ligne, son propos suit. Sans auteur
                     connu (avis importé anonyme), l'extrait reprend la tête
                     plutôt que d'afficher un avatar vide. */
                  leading={author ? <GuestAvatar name={author} size={30} /> : undefined}
                  primary={
                    author ? (
                      <>
                        <span className="font-medium">{author}</span>
                        {item.propertyName && ` · ${item.propertyName}`}
                      </>
                    ) : (
                      item.excerpt ? `« ${item.excerpt} »` : (item.propertyName ?? '—')
                    )
                  }
                  secondary={
                    author
                      ? item.excerpt && `« ${item.excerpt} »`
                      : [item.propertyName, reviewedOn].filter(Boolean).join(' · ')
                  }
                  value={
                    item.rating != null && (
                      <span className="flex shrink-0 flex-col items-end">
                        <span className="flex items-center gap-0.5 text-sm font-semibold text-foreground tabular-nums">
                          {item.rating}
                          <StarIcon className="size-3.5 fill-warning text-warning" />
                        </span>
                        {author && reviewedOn && (
                          <span className="text-2xs text-muted-foreground">{reviewedOn}</span>
                        )}
                      </span>
                    )
                  }
                  onClick={() => setReplyingTo(item)}
                />
              );
            })}
          </ActionGroup>
        </div>
      )}

      {/* Publier fait disparaître la ligne : la carte se recharge. */}
      <ReviewReplyDialog
        reviewId={replyingTo?.reviewId ?? null}
        onClose={() => setReplyingTo(null)}
        preview={{
          guestName: replyingTo?.guestName,
          propertyName: replyingTo?.propertyName,
          rating: replyingTo?.rating,
        }}
        invalidateKeys={[['dashboard', 'action-items']]}
      />
    </BlockCard>
  );
}

/** « il y a 30 h » / « jamais synchronisé ». */
function feedDelay(item: DashboardStaleFeed, t: TranslateFn): string {
  if (item.hoursSinceLastSync == null) {
    return t('dashboard.actionItems.neverSynced', 'jamais synchronisé');
  }
  return `${t('dashboard.actionItems.lastSuccess', 'dernier succès il y a')} ${item.hoursSinceLastSync} h`;
}

function formatReviewDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Groupe d'éléments d'un même type : le libellé est dit UNE fois, en en-tête,
 * au lieu d'être répété en tête de chaque ligne. C'est ce qui libère la place
 * pour ce qui distingue réellement les lignes entre elles.
 *
 * Ne rend rien si le groupe est vide — un dashboard ne montre pas une rubrique
 * pour dire qu'elle est vide, la carte a déjà son état vide global.
 */
function ActionGroup({
  icon,
  tone,
  label,
  total,
  showCount,
  hideHeader,
  seeAllLabel,
  onSeeAll,
  children,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  total: number;
  /** Faux quand ce groupe est le seul peuplé : son compte répéterait celui de la carte. */
  showCount: boolean;
  /** Vrai quand le libellé est déjà porté par le titre de la carte. */
  hideHeader: boolean;
  seeAllLabel: string;
  onSeeAll: () => void;
  children: React.ReactNode;
}) {
  if (total === 0) return null;
  const hidden = total - Math.min(total, GROUP_LIMIT);

  return (
    <section>
      {/* En-tête masqué quand cette rubrique est la seule peuplée : elle est alors
          affichée sur la ligne du titre de la carte (`titleSuffix`). */}
      {!hideHeader && (
        <h4 className="m-0 flex items-center gap-1.5 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
          <span className={cn('inline-flex [&>svg]:size-3.5', tone)}>{icon}</span>
          {label}
          {showCount && <span className="tabular-nums">({total})</span>}
        </h4>
      )}
      <div className={cn('flex flex-col', !hideHeader && 'mt-1')}>{children}</div>
      {hidden > 0 && (
        <button
          type="button"
          onClick={onSeeAll}
          className="mt-1 cursor-pointer rounded-md text-xs font-medium text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {`+${hidden} · ${seeAllLabel}`}
        </button>
      )}
    </section>
  );
}

/**
 * Ligne d'action : contenu à gauche, valeur à droite, la ligne entière est le
 * bouton. Un bouton d'action par ligne — six « Répondre » empilés — pesait plus
 * que l'information qu'il accompagnait, et le verbe est déjà porté par le
 * groupe. Même geste que les blocs Arrivées, qui naviguent aussi au clic.
 */
function ActionRow({
  leading,
  primary,
  secondary,
  value,
  onClick,
}: {
  /** Visuel d'entrée de ligne — avatar du voyageur pour les avis. */
  leading?: React.ReactNode;
  primary: React.ReactNode;
  secondary: React.ReactNode;
  value?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/row -mx-1.5 flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-start outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none"
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">{primary}</span>
        {/* Deux lignes, pas une : l'extrait d'avis est le contenu utile de la
            ligne, le tronquer au premier tiers n'aide personne. Les libellés
            courts (référence, délai de synchro) tiennent sur une ligne et ne
            sont pas affectés. */}
        <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">{secondary}</span>
      </span>
      {value}
      <ChevronRightIcon className="cn-rtl-flip size-4 shrink-0 text-muted-foreground/40 transition-transform duration-150 group-hover/row:translate-x-0.5 motion-reduce:transition-none" />
    </button>
  );
}

// ─── §8 — Prochaines arrivées ───────────────────────────────────────────────

export function UpcomingArrivalsCard({ days = 7 }: { days?: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useDashboardUpcomingArrivals(days);

  if (isLoading) return null;
  const rows = data ?? [];

  return (
    <section className="rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h3 className="cn-font-heading m-0 text-[15px] font-semibold tracking-tight text-foreground">
          {t('dashboard.upcomingArrivals.title', 'Prochaines arrivées')} ({days} j)
        </h3>
        <Button
          size="xs"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => navigate('/planning')}
        >
          {t('dashboard.upcomingArrivals.seePlanning', 'Tout le planning')}
          <ChevronRightIcon className="cn-rtl-flip" />
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 pb-4">
          <BlockEmpty>
            {t('dashboard.upcomingArrivals.empty', 'Aucune arrivée sur la période.')}
          </BlockEmpty>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('dashboard.upcomingArrivals.guest', 'Voyageur')}</TableHead>
              <TableHead>{t('dashboard.upcomingArrivals.property', 'Logement')}</TableHead>
              <TableHead>{t('dashboard.upcomingArrivals.checkIn', 'Arrivée')}</TableHead>
              <TableHead className="text-end">{t('dashboard.upcomingArrivals.nights', 'Nuits')}</TableHead>
              <TableHead>{t('dashboard.upcomingArrivals.channel', 'Canal')}</TableHead>
              <TableHead>{t('dashboard.upcomingArrivals.status', 'Statut')}</TableHead>
              <TableHead className="text-end">{t('dashboard.upcomingArrivals.total', 'Total')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.reservationId}
                className="cursor-pointer"
                onClick={() => navigate(`/reservations/${row.reservationId}`)}
              >
                <TableCell>
                  <span className="flex items-center gap-2">
                    <GuestAvatar name={row.guestName ?? '?'} size={24} />
                    <span className="font-medium">{row.guestName}</span>
                  </span>
                </TableCell>
                <TableCell>{row.propertyName}</TableCell>
                <TableCell>{formatArrivalDate(row.checkIn)}</TableCell>
                <TableCell className="text-end tabular-nums">{row.nights}</TableCell>
                <TableCell>
                  <StatusChip
                    color={channelColor(row.source)}
                    label={channelLabel(row.source, row.sourceName)}
                    dot
                    size="sm"
                  />
                </TableCell>
                <TableCell>
                  <StatusChip {...paymentChip(row, t)} dot size="sm" />
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {row.totalPrice != null && <Money value={row.totalPrice} decimals={0} />}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

/** « Ven. 25 juil. » — format court, dans la locale de l'utilisateur. */
function formatArrivalDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Statut de paiement : un solde restant dû prime sur le statut brut — c'est
 * l'information qui appelle une action.
 */
function paymentChip(
  row: DashboardUpcomingArrival,
  t: TranslateFn
): { tone: 'warn' | 'ok' | 'neutral'; label: string } {
  if (row.amountDue != null && row.amountDue > 0) {
    return { tone: 'warn', label: t('dashboard.upcomingArrivals.balanceDue', 'Solde dû') };
  }
  if (row.paymentStatus === 'PAID') {
    return { tone: 'ok', label: t('dashboard.upcomingArrivals.paid', 'Payée') };
  }
  return { tone: 'neutral', label: t('dashboard.upcomingArrivals.confirmed', 'Confirmée') };
}
