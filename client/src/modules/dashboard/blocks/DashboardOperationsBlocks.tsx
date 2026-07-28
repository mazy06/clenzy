import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BanknoteIcon,
  BanknoteXIcon,
  BookOpenIcon,
  BrushIcon,
  CalendarSyncIcon,
  CalendarXIcon,
  ChevronRightIcon,
  ClockAlertIcon,
  LockIcon,
  MailWarningIcon,
  VolumeXIcon,
  ClipboardListIcon,
  ZapOffIcon,
  SendHorizonalIcon,
  PlugZapIcon,
  FileWarningIcon,
  LandmarkIcon,
  ReceiptTextIcon,
  MessageCircleIcon,
  ShieldAlertIcon,
  LogInIcon,
  LogOutIcon,
  StarIcon,
  TriangleAlertIcon,
  UserSearchIcon,
  WrenchIcon,
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
import ReservationActionDialog from '../../../components/baitly/ReservationActionDialog';
import FeedSyncDialog from '../../../components/baitly/FeedSyncDialog';
import ActionGuidanceDialog from '../../../components/baitly/ActionGuidanceDialog';
import PaymentIncidentDialog from '../../../components/baitly/PaymentIncidentDialog';
import RetryDeliveryDialog from '../../../components/baitly/RetryDeliveryDialog';
import StuckServiceDialog from '../../../components/baitly/StuckServiceDialog';
import PaymentCheckoutModal from '../../../components/PaymentCheckoutModal';
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
  DashboardActionItem,
  DashboardActionItems,
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
  children,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  count?: number;
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
  // Le séjour s'ouvre sur place : `/reservations/:id` n'existe pas, et quitter
  // le tableau de bord pour lire deux dates n'aide personne.
  // ⚠️ Avant tout early return (règles des hooks).
  const [openedReservation, setOpenedReservation] =
    React.useState<{ id: number; guestName: string | null; propertyName: string | null } | null>(null);

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
                onClick={() =>
                  setOpenedReservation({
                    id: arrival.reservationId,
                    guestName: arrival.guestName,
                    propertyName: arrival.propertyName,
                  })
                }
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

      <ReservationActionDialog
        reservationId={openedReservation?.id ?? null}
        onClose={() => setOpenedReservation(null)}
        preview={{
          guestName: openedReservation?.guestName,
          propertyName: openedReservation?.propertyName,
        }}
        invalidateKeys={[['dashboard', 'operations', 'today']]}
      />
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
 * Lignes visibles avant dépliage. La file reste une liste de priorités : au-delà
 * de trois lignes par rubrique, on ne lit plus, on parcourt.
 */
const GROUP_PREVIEW = 3;

/**
 * Une nature d'action et sa présentation : icône, teinte, libellé de rubrique.
 *
 * L'ordre de ce tableau EST l'ordre d'affichage des rubriques — le même que la
 * priorité serveur (`ActionItemKind`) : ce qu'on n'a pas encaissé et ce qui peut
 * provoquer une double réservation passent avant la réputation.
 *
 * Les cartes des agents n'y figurent pas : elles vivent dans la constellation.
 */
function actionKinds(t: TranslateFn) {
  return [
    {
      kind: 'GUEST_DECLARATION_MISSING' as const,
      icon: <ShieldAlertIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.declarationGroup', 'Déclarations voyageur manquantes'),
    },
    {
      kind: 'PAYMENT_INCIDENT' as const,
      icon: <LandmarkIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.incidentGroup', 'Incidents de règlement'),
    },
    {
      kind: 'RESERVATION_PENDING' as const,
      icon: <CalendarXIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.pendingGroup', 'Réservations à confirmer'),
    },
    {
      kind: 'INTERVENTION_OVERDUE' as const,
      icon: <ClockAlertIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.overdueGroup', 'Interventions en retard'),
    },
    {
      kind: 'CONVERSATION_UNANSWERED' as const,
      icon: <MessageCircleIcon />,
      tone: 'text-warning',
      label: t('dashboard.actionItems.conversationGroup', 'Messages sans réponse'),
    },
    {
      kind: 'BALANCE_DUE' as const,
      icon: <BanknoteIcon />,
      tone: 'text-warning',
      label: t('dashboard.actionItems.balancesGroup', 'Soldes à percevoir'),
    },
    {
      kind: 'BALANCE_ABANDONED' as const,
      icon: <BanknoteXIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.abandonedGroup', 'Soldes jamais encaissés'),
    },
    {
      kind: 'GUEST_MESSAGE_FAILED' as const,
      icon: <MailWarningIcon />,
      tone: 'text-warning',
      label: t('dashboard.actionItems.messageFailedGroup', 'Messages non délivrés'),
    },
    {
      kind: 'WELCOME_GUIDE_MISSING' as const,
      icon: <BookOpenIcon />,
      tone: 'text-warning',
      label: t('dashboard.actionItems.guideGroup', 'Livrets d’accueil à publier'),
    },
    {
      kind: 'DEPOSIT_STUCK' as const,
      icon: <LockIcon />,
      tone: 'text-warning',
      label: t('dashboard.actionItems.depositGroup', 'Cautions à libérer'),
    },
    {
      kind: 'SERVICE_UNPAID' as const,
      icon: <WrenchIcon />,
      tone: 'text-warning',
      label: t('dashboard.actionItems.servicesGroup', 'Prestations à régler'),
    },
    {
      kind: 'SERVICE_UNASSIGNED' as const,
      icon: <UserSearchIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.unassignedGroup', 'Prestations sans prestataire'),
    },
    {
      kind: 'FEED_STALE' as const,
      icon: <CalendarSyncIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.feedsGroup', 'Calendriers désynchronisés'),
    },
    {
      kind: 'REVIEW_UNANSWERED' as const,
      icon: <StarIcon />,
      tone: 'text-info',
      label: t('dashboard.actionItems.reviewsGroup', 'Avis sans réponse'),
    },
    {
      kind: 'INTERVENTION_UNASSIGNED' as const,
      icon: <UserSearchIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.interventionUnassignedGroup', 'Interventions sans exécutant'),
    },
    {
      kind: 'INTERVENTION_UNPAID' as const,
      icon: <WrenchIcon />,
      tone: 'text-warning',
      label: t('dashboard.actionItems.interventionUnpaidGroup', 'Interventions à régler'),
    },
    {
      kind: 'CHECKIN_NOT_STARTED' as const,
      icon: <LogInIcon />,
      tone: 'text-warning',
      label: t('dashboard.actionItems.checkinGroup', 'Check-in en ligne non commencés'),
    },
    {
      kind: 'NOISE_ALERT_UNACKNOWLEDGED' as const,
      icon: <VolumeXIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.noiseGroup', 'Alertes de bruit non acquittées'),
    },
    {
      kind: 'ISSUE_OPEN' as const,
      icon: <ClipboardListIcon />,
      tone: 'text-warning',
      label: t('dashboard.actionItems.issueGroup', 'Signalements à qualifier'),
    },
    {
      kind: 'OWNER_PAYOUT_PENDING' as const,
      icon: <BanknoteIcon />,
      tone: 'text-warning',
      label: t('dashboard.actionItems.payoutGroup', 'Reversements à approuver'),
    },
    {
      kind: 'PAYOUT_ONBOARDING_INCOMPLETE' as const,
      icon: <LandmarkIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.onboardingGroup', 'Comptes de paiement non finalisés'),
    },
    {
      kind: 'INVITATION_EXPIRED' as const,
      icon: <MailWarningIcon />,
      tone: 'text-warning',
      label: t('dashboard.actionItems.invitationGroup', 'Invitations expirées'),
    },
    {
      kind: 'DOCUMENT_DELIVERY_FAILED' as const,
      icon: <FileWarningIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.documentGroup', 'Documents non délivrés'),
    },
    {
      kind: 'EINVOICE_FAILED' as const,
      icon: <ReceiptTextIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.einvoiceGroup', 'Factures électroniques rejetées'),
    },
    {
      kind: 'AUTOMATION_FAILED' as const,
      icon: <ZapOffIcon />,
      tone: 'text-warning',
      label: t('dashboard.actionItems.automationGroup', 'Automatisations en échec'),
    },
    {
      kind: 'OUTBOX_DEAD_LETTER' as const,
      icon: <SendHorizonalIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.outboxGroup', 'Messages internes perdus'),
    },
    {
      kind: 'INTEGRATION_DISCONNECTED' as const,
      icon: <PlugZapIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.integrationGroup', 'Intégrations déconnectées'),
    },
  ];
}

/**
 * File unique de tout ce qui attend une décision : cartes des agents, soldes,
 * prestations impayées, calendriers muets, avis sans réponse.
 *
 * <p>Le serveur trie et plafonne par nature ; l'écran ne fait que regrouper pour
 * dire chaque libellé une fois. Le compteur du titre est le total <b>réel</b>,
 * pas le nombre de lignes visibles.</p>
 */
export function ActionItemsCard() {
  const { data, isLoading } = useDashboardActionItems();
  if (isLoading) return null;
  return <ActionItemsView data={data} />;
}

/**
 * Le rendu, séparé de sa source de données.
 *
 * Cette séparation n'est pas décorative : la carte a huit états visuels (une
 * seule rubrique, plusieurs, rubrique tronquée, montant, note, avatar ou non,
 * flux jamais synchronisé, vide) qu'aucun jeu de données réel ne présente en
 * même temps. La galerie les met tous à l'écran en passant `data` à la main,
 * sans réseau ni mode démo dans le produit.
 */
export function ActionItemsView({ data }: { data?: DashboardActionItems }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Répondre est le geste attendu ici : on ouvre l'avis sur place. Quitter le
  // tableau de bord reste possible, mais c'est le rôle du lien « Voir les avis ».
  // ⚠️ Avant tout early return (règles des hooks).
  const [active, setActive] = React.useState<DashboardActionItem | null>(null);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const totalsByKind = data?.totalsByKind ?? {};
  const groups = actionKinds(t)
    .map((meta) => {
      const rows = items.filter((item) => item.kind === meta.kind);
      // Le décompte vient du serveur : `rows` est déjà tronqué.
      return { ...meta, rows, kindTotal: totalsByKind[meta.kind] ?? rows.length };
    })
    .filter((group) => group.rows.length > 0);

  return (
    <BlockCard
      icon={<TriangleAlertIcon className="size-3.5 text-warning" />}
      title={t('dashboard.actionItems.title', 'À traiter')}
      count={total}
    >
      {groups.length === 0 ? (
        <BlockEmpty>
          {t('dashboard.actionItems.empty', 'Rien à traiter — tout est à jour.')}
        </BlockEmpty>
      ) : (
        // Hauteur bornée : avec vingt-deux actions la carte poussait tout le
        // reste du tableau de bord hors de l'écran, et son propre en-tête
        // disparaissait avant qu'on ait fini de lire.
        //
        // `max-h` et non `h` : une organisation qui n'a que deux actions ne doit
        // pas se voir servir un cadre aux trois quarts vide.
        //
        // `pe-2 -me-2` place l'ascenseur dans la gouttière de la carte plutôt
        // que par-dessus les chevrons : le contenu garde exactement la même
        // largeur qu'avant, seul le rail vient s'y ajouter.
        <div className="-me-2 flex max-h-[28rem] flex-col gap-4 overflow-y-auto pe-2">
          {groups.map((group) => (
            <ActionGroup
              key={group.kind}
              icon={group.icon}
              tone={group.tone}
              label={group.label}
              total={group.kindTotal}
              shown={group.rows.length}
              moreLabel={(count) =>
                t('dashboard.actionItems.showMore', {
                  count,
                  defaultValue: 'Voir les {{count}} autres',
                })
              }
              lessLabel={t('dashboard.actionItems.showLess', 'Réduire')}
            >
              {(expanded) => (group.rows.slice(0, expanded ? undefined : GROUP_PREVIEW)).map((item) => (
                <ActionRow
                  key={item.id}
                  /* On agit envers quelqu'un, pas envers une ligne de texte :
                     quand l'action concerne une personne, elle ouvre la ligne. */
                  leading={item.subject ? <GuestAvatar name={item.subject} size={30} /> : undefined}
                  primary={item.title}
                  secondary={actionSecondary(item, t)}
                  value={actionValue(item)}
                  // Toujours une modale, jamais une redirection : on traite
                  // depuis le tableau de bord, et c'est la modale qui propose
                  // ensuite d'ouvrir l'écran complet.
                  onClick={() => setActive(item)}
                />
              ))}
            </ActionGroup>
          ))}
        </div>
      )}

      {/* Traiter fait disparaître la ligne : la carte se recharge. */}
      <ActionItemDialog item={active} onClose={() => setActive(null)} />
    </BlockCard>
  );
}

/**
 * Seconde ligne : le contexte, sans jamais répéter la première.
 *
 * Le cas du calendrier est le seul où le serveur envoie un nombre plutôt qu'une
 * phrase — pour que la phrase reste traduisible.
 */
function actionSecondary(item: DashboardActionItem, t: TranslateFn): React.ReactNode {
  if (item.kind === 'FEED_STALE') {
    // Interpolé et non concaténé : l'anglais place le complément après le
    // nombre (« 31 h ago »), le français avant. Coller deux morceaux de phrase
    // ne se traduit pas.
    const delay = item.amount == null
      ? t('dashboard.actionItems.neverSynced', 'jamais synchronisé')
      : t('dashboard.actionItems.lastSuccess', {
          hours: item.amount,
          defaultValue: 'dernier succès il y a {{hours}} h',
        });
    return [item.detail, delay].filter(Boolean).join(' · ');
  }
  if (item.kind === 'REVIEW_UNANSWERED') {
    return item.detail ? `« ${item.detail} »` : item.propertyName;
  }
  // Le logement complète le contexte quand il n'est pas déjà ce que dit `detail`.
  return [item.detail, item.detail === item.propertyName ? null : item.propertyName]
    .filter(Boolean)
    .join(' · ');
}

/** Fin de ligne : un montant, une mention courte, ou rien. */
function actionValue(item: DashboardActionItem): React.ReactNode {
  if (
    item.kind === 'BALANCE_DUE'
    || item.kind === 'SERVICE_UNPAID'
    || item.kind === 'SERVICE_UNASSIGNED'
    || item.kind === 'BALANCE_ABANDONED'
    || item.kind === 'DEPOSIT_STUCK'
  ) {
    return item.amount == null ? null : (
      <span className="text-sm font-semibold text-foreground tabular-nums">
        <Money value={item.amount} decimals={0} />
      </span>
    );
  }
  // Le badge arrive pr\u00eat \u00e0 afficher (\u00ab 4\u2605 \u00bb) : le front ne le red\u00e9core pas.
  if (item.badge) {
    return (
      <span className="text-sm font-semibold text-warning tabular-nums">{item.badge}</span>
    );
  }
  return null;
}

/**
 * Natures qui n'ont pas de geste sur place : la modale explique et renvoie vers
 * l'écran qui porte l'action. Les lister ici plutôt que dans une cascade de
 * conditions garde la sélection lisible à mesure qu'elles se multiplient.
 */
const GUIDED_KINDS = new Set<string>([
  'INTERVENTION_UNASSIGNED',
  'INTERVENTION_UNPAID',
  'CHECKIN_NOT_STARTED',
  'NOISE_ALERT_UNACKNOWLEDGED',
  'ISSUE_OPEN',
  'OWNER_PAYOUT_PENDING',
  'PAYOUT_ONBOARDING_INCOMPLETE',
  'INVITATION_EXPIRED',
  'EINVOICE_FAILED',
  'AUTOMATION_FAILED',
  'OUTBOX_DEAD_LETTER',
  'INTEGRATION_DISCONNECTED',
]);

/**
 * La modale qui traite l'élément cliqué, choisie par sa nature.
 *
 * Aucune de ces natures ne redirige : on reste sur le tableau de bord et c'est
 * la modale qui propose, en pied, d'ouvrir l'écran complet. La navigation
 * directe qu'on avait au départ envoyait d'ailleurs vers `/reservations/:id`,
 * une route qui n'existe pas.
 */
function ActionItemDialog({
  item,
  onClose,
}: {
  item: DashboardActionItem | null;
  onClose: () => void;
}) {
  const kind = item?.kind;
  // Les listes rechargent après traitement : la ligne traitée disparaît.
  const invalidateKeys = [['dashboard', 'action-items']] as const;

  return (
    <>
      <ReviewReplyDialog
        reviewId={kind === 'REVIEW_UNANSWERED' ? (item?.targetId ?? null) : null}
        onClose={onClose}
        preview={{ guestName: item?.subject, propertyName: item?.propertyName }}
        invalidateKeys={invalidateKeys}
      />

      <ReservationActionDialog
        reservationId={kind === 'BALANCE_DUE' ? (item?.targetId ?? null) : null}
        onClose={onClose}
        preview={{
          guestName: item?.subject,
          propertyName: item?.propertyName,
          amountDue: item?.amount,
        }}
        invalidateKeys={invalidateKeys}
      />

      <FeedSyncDialog
        feedId={kind === 'FEED_STALE' ? (item?.targetId ?? null) : null}
        onClose={onClose}
        feed={{
          sourceName: item?.title,
          propertyName: item?.propertyName,
          hoursSinceLastSync: item?.amount,
        }}
        invalidateKeys={invalidateKeys}
      />

      <PaymentIncidentDialog
        incidentId={kind === 'PAYMENT_INCIDENT' ? (item?.actionItemId ?? null) : null}
        onClose={onClose}
        incident={{
          type: item?.actionType,
          title: item?.title,
          detail: item?.detail,
          amount: item?.amount,
          badge: item?.badge,
        }}
        invalidateKeys={invalidateKeys}
      />

      <RetryDeliveryDialog
        item={
          kind === 'DOCUMENT_DELIVERY_FAILED' || kind === 'GUEST_MESSAGE_FAILED' ? item : null
        }
        onClose={onClose}
        invalidateKeys={invalidateKeys}
      />

      <ActionGuidanceDialog item={GUIDED_KINDS.has(kind ?? '') ? item : null} onClose={onClose} />

      <StuckServiceDialog
        serviceRequestId={kind === 'SERVICE_UNASSIGNED' ? (item?.targetId ?? null) : null}
        onClose={onClose}
        service={{
          title: item?.title,
          propertyId: item?.propertyId,
          propertyName: item?.propertyName,
          severity: item?.severity,
        }}
        invalidateKeys={invalidateKeys}
      />

      {/* Le règlement passe par le tunnel Stripe embarqué déjà en service
          ailleurs — on ne réécrit pas un formulaire de paiement. */}
      {kind === 'SERVICE_UNPAID' && item?.targetId != null && (
        <PaymentCheckoutModal
          open
          onClose={onClose}
          onSuccess={onClose}
          serviceRequestId={item.targetId}
          amount={item.amount ?? 0}
          interventionTitle={item.title}
        />
      )}
    </>
  );
}

/**
 * Groupe d'éléments d'un même type : le libellé est dit UNE fois, en en-tête,
 * au lieu d'être répété en tête de chaque ligne. C'est ce qui libère la place
 * pour ce qui distingue réellement les lignes entre elles.
 *
 * Ne rend rien si le groupe est vide — un dashboard ne montre pas une rubrique
 * pour dire qu'elle est vide, la carte a déjà son état vide global.
 */
/**
 * Rubrique de la file.
 *
 * <p>Le reste des lignes se déplie <b>ici</b>, dans la carte : quitter le
 * tableau de bord pour lire trois avis de plus n'aidait personne, et faisait
 * perdre le contexte des autres rubriques.</p>
 *
 * <p>Le compteur du titre est le décompte réel du serveur ; le bouton, lui,
 * n'annonce que ce qu'il peut réellement montrer. Quand le serveur a tronqué
 * au-delà de ce qui a été transmis, le reliquat est dit à part plutôt que promis
 * par un bouton qui ne le livrerait pas.</p>
 */
function ActionGroup({
  icon,
  tone,
  label,
  total,
  shown,
  moreLabel,
  lessLabel,
  children,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  /** Décompte réel de la rubrique, tel que compté par le serveur. */
  total: number;
  /** Nombre de lignes effectivement reçues — le serveur plafonne. */
  shown: number;
  moreLabel: (count: number) => string;
  lessLabel: string;
  /** Reçoit l'état de dépliage : la rubrique décide de ce qu'elle montre. */
  children: (expanded: boolean) => React.ReactNode;
}) {
  const [expanded, setExpanded] = React.useState(false);
  if (total === 0) return null;

  const expandable = Math.max(0, shown - GROUP_PREVIEW);
  const untransmitted = Math.max(0, total - shown);

  return (
    <section>
      <h4 className="m-0 flex items-center gap-1.5 text-2xs font-semibold tracking-wide text-muted-foreground uppercase">
        <span className={cn('inline-flex [&>svg]:size-3.5', tone)}>{icon}</span>
        {label}
        <span className="tabular-nums">({total})</span>
      </h4>
      <div className="mt-1 flex flex-col">{children(expanded)}</div>

      {expandable > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="mt-1 cursor-pointer rounded-md text-xs font-medium text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {expanded ? lessLabel : moreLabel(expandable)}
        </button>
      )}
      {expanded && untransmitted > 0 && (
        <p className="m-0 mt-1 text-2xs text-muted-foreground">
          {`+${untransmitted}`}
        </p>
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
  // Même règle que partout ailleurs sur cet écran : la ligne ouvre le séjour,
  // elle ne quitte pas le tableau de bord.
  // ⚠️ Avant tout early return (règles des hooks).
  const [opened, setOpened] = React.useState<DashboardUpcomingArrival | null>(null);

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
                onClick={() => setOpened(row)}
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

      <ReservationActionDialog
        reservationId={opened?.reservationId ?? null}
        onClose={() => setOpened(null)}
        preview={{
          guestName: opened?.guestName,
          propertyName: opened?.propertyName,
          amountDue: opened?.amountDue,
        }}
        invalidateKeys={[['dashboard', 'upcoming-arrivals', days]]}
      />
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
