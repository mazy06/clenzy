import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { guestPhotoSrc } from '../../../services/api/guestsApi';
import { useNavigate } from 'react-router-dom';
import {
  BanknoteIcon,
  BanknoteXIcon,
  BookOpenIcon,
  BrushIcon,
  CalendarSyncIcon,
  CalendarXIcon,
  ChevronDownIcon,
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
  buttonVariants,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui';
import ConfirmationModal from '../../../components/ConfirmationModal';
import GuestAvatar from '../../../components/baitly/GuestAvatar';
import ReviewReplyDialog from '../../../components/baitly/ReviewReplyDialog';
import ReservationActionDialog from '../../../components/baitly/ReservationActionDialog';
import FeedSyncDialog from '../../../components/baitly/FeedSyncDialog';
import ActionCardDialog from '../../../components/baitly/ActionCardDialog';
import { ACTION_CARDS } from '../../../components/baitly/actionCards';
import PaymentIncidentDialog from '../../../components/baitly/PaymentIncidentDialog';
import RetryDeliveryDialog from '../../../components/baitly/RetryDeliveryDialog';
import StuckServiceDialog from '../../../components/baitly/StuckServiceDialog';
import PaymentCheckoutModal from '../../../components/PaymentCheckoutModal';
import StatusChip from '../../../components/baitly/StatusChip';
import { Money } from '../../../components/baitly/Money';
import { cn } from '../../../utils/cn';
import { getInterventionTypeLabel } from '../../../utils/statusUtils';
import { useTranslation } from '../../../hooks/useTranslation';

import {
  useBulkGestures,
  useDashboardActionItems,
  useDashboardToday,
  useDashboardUpcomingArrivals,
} from '../../../hooks/useDashboardOperations';
import {
  actionItemsApi,
  refreshActionQueue,
  type BulkGestureResult,
} from '../../../services/api/actionItemsApi';
import type {
  DashboardActionItem,
  DashboardActionItems,
  DashboardActionKind,
  DashboardActionSeverity,
  DashboardUpcomingArrival,
} from '../../../services/api/dashboardOperationsApi';
import { useFitRows } from '../../../hooks/useFitRows';

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

export function BlockCard({
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
  /**
   * La carte remplit la hauteur qu'on lui donne, sans ascenseur : les rangs qui
   * ne tiennent pas se replient et se comptent.
   *
   * <p>Les rangs sont ceux du conteneur que l'appelant marque `data-fit-list` —
   * lui seul sait lequel de ses conteneurs porte une liste plutot qu'un bloc.
   * Sans marque, la carte ne replie rien : elle se contente d'annoncer a sa
   * ligne la hauteur qu'il lui faudrait.</p>
   */
  const { ref, hidden } = useFitRows<HTMLDivElement>('[data-fit-list] > *');
  return (
    // Contour en `ring-1`, jamais en `border` : c'est la métrique du `Card` du
    // design system (cf. `.cn-card`, baitly-nova.css). Un `ring` est un
    // box-shadow — il n'occupe aucune place et se dessine hors de la boîte,
    // là où une bordure de 1 px pousse le contenu vers l'intérieur. Mélanger
    // les deux sur une même ligne du tableau de bord décale les cartes et
    // leurs titres d'un pixel.
    <section
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 p-4',
        className,
      )}
    >
      <h3 className="m-0 mb-3 flex shrink-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {icon}
        {title}
        {count !== undefined && <span className="tabular-nums">({count})</span>}
      </h3>
      <div ref={ref} className="min-h-0 flex-1 overflow-hidden">
        {children}
      </div>
      {/* Frere du cadre, jamais dedans : la mention prend sa place sur la
          hauteur disponible au lieu de la disputer aux rangs. */}
      {hidden > 0 && (
        <p className="m-0 shrink-0 pt-1.5 text-2xs font-semibold text-muted-foreground tabular-nums">
          +{hidden}
        </p>
      )}
    </section>
  );
}

/** Vide de carte : une phrase, pas une carte creuse. */
export function BlockEmpty({ children }: { children: React.ReactNode }) {
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
          <div data-fit-list className="flex flex-col gap-2.5">
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
            <div data-fit-list className="flex flex-col gap-2.5">
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
          <div data-fit-list className="flex flex-col gap-2.5">
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
 * Lignes montrées d'emblée dans une rubrique dépliée.
 *
 * <p>Au-delà, on ne lit plus, on parcourt — et une rubrique de trente lignes
 * repousse hors de l'écran les onze autres rubriques. Le reste se déplie sur
 * demande, à l'intérieur de la rubrique.</p>
 */
const GROUP_PREVIEW = 3;

/** Pastille de gravité : la teinte vive porte l'aplat, jamais le texte. */
const SEVERITY_DOT: Record<DashboardActionSeverity, string> = {
  critical: 'bg-destructive',
  warning: 'bg-warning',
  info: 'bg-info',
};

/** Gravité la plus forte parmi les lignes reçues — celle que porte la rubrique. */
function worstSeverity(rows: DashboardActionItem[]): DashboardActionSeverity {
  if (rows.some((row) => row.severity === 'critical')) return 'critical';
  if (rows.some((row) => row.severity === 'warning')) return 'warning';
  return 'info';
}

/**
 * Depuis combien de temps la ligne attend — « 40 min », « 4 h », « 12 j ».
 *
 * <p>Une seule unité, la plus grande qui donne un nombre lisible : « 1 j 4 h »
 * demande à être lu, « 1 j » se voit. La précision perdue n'aide personne à
 * décider — au-delà d'une journée, c'est l'ordre de grandeur qui alarme.</p>
 *
 * <p>Rendue vide sous la minute : une ligne qui vient d'apparaître n'a pas de
 * retard à afficher.</p>
 */
function waitingFor(since: string | null, t: TranslateFn): string | null {
  if (!since) return null;
  const elapsed = Date.now() - new Date(since).getTime();
  if (Number.isNaN(elapsed) || elapsed < 60_000) return null;

  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return t('dashboard.actionItems.ageMinutes', { count: minutes, defaultValue: '{{count}} min' });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('dashboard.actionItems.ageHours', { count: hours, defaultValue: '{{count}} h' });
  return t('dashboard.actionItems.ageDays', { count: Math.floor(hours / 24), defaultValue: '{{count}} j' });
}

/**
 * Teinte de la pastille d'ancienneté : texte en `-ink`, fond en `-soft`.
 *
 * <p>Jamais la teinte vive en texte — elle plafonne à 2,2:1 sur le fond de
 * carte, et c'est précisément le chiffre qu'on veut voir de loin.</p>
 */
const AGE_TONE: Record<DashboardActionSeverity, string> = {
  critical: 'text-destructive-ink bg-destructive-soft',
  warning: 'text-warning-ink bg-warning-soft',
  info: 'text-muted-foreground bg-muted',
};

/**
 * Une nature d'action et sa présentation : icône, teinte, libellé de rubrique,
 * et le verbe de son bouton de fin de ligne.
 *
 * L'ordre de ce tableau EST l'ordre d'affichage des rubriques — le même que la
 * priorité serveur (`ActionItemKind`) : ce qu'on n'a pas encaissé et ce qui peut
 * provoquer une double réservation passent avant la réputation.
 *
 * `action` est le geste attendu, pas un « Ouvrir » générique : la rubrique dit
 * ce qui ne va pas, le bouton dit ce qu'on va en faire. Un même verbe peut
 * servir deux natures (« Assigner » pour une prestation et pour une
 * intervention) — c'est la rubrique qui lève l'ambiguïté.
 *
 * Les cartes des agents FIGURENT ici (nature `AGENT_CARD`) : les deux files ont
 * convergé — ce qui attend dans la constellation attend aussi dans « À traiter ».
 * Seule la décision reste là-bas, où les écrans de contexte existent (simulation
 * tarifaire, brouillon de réponse d'avis) ; la carte d'ici y renvoie.
 */
function actionKinds(t: TranslateFn) {
  return [
    {
      kind: 'GUEST_DECLARATION_MISSING' as const,
      icon: <ShieldAlertIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.declarationGroup', 'Déclarations voyageur manquantes'),
      action: t('dashboard.actionItems.declarationAction', 'Déclarer'),
    },
    {
      kind: 'PAYMENT_INCIDENT' as const,
      icon: <LandmarkIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.incidentGroup', 'Incidents de règlement'),
      action: t('dashboard.actionItems.incidentAction', 'Régulariser'),
    },
    {
      kind: 'RESERVATION_PENDING' as const,
      icon: <CalendarXIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.pendingGroup', 'Réservations à confirmer'),
      action: t('dashboard.actionItems.pendingAction', 'Confirmer'),
    },
    {
      kind: 'INTERVENTION_OVERDUE' as const,
      icon: <ClockAlertIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.overdueGroup', 'Interventions en retard'),
      action: t('dashboard.actionItems.overdueAction', 'Relancer'),
    },
    {
      kind: 'CONVERSATION_UNANSWERED' as const,
      icon: <MessageCircleIcon />,
      tone: 'text-warning',
      label: t('dashboard.actionItems.conversationGroup', 'Messages sans réponse'),
      action: t('dashboard.actionItems.conversationAction', 'Répondre'),
    },
    {
      kind: 'BALANCE_DUE' as const,
      icon: <BanknoteIcon />,
      tone: 'text-warning',
      label: t('dashboard.actionItems.balancesGroup', 'Soldes à percevoir'),
      action: t('dashboard.actionItems.balancesAction', 'Encaisser'),
    },
    {
      kind: 'BALANCE_ABANDONED' as const,
      icon: <BanknoteXIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.abandonedGroup', 'Soldes jamais encaissés'),
      action: t('dashboard.actionItems.abandonedAction', 'Encaisser'),
    },
    {
      kind: 'GUEST_MESSAGE_FAILED' as const,
      icon: <MailWarningIcon />,
      tone: 'text-warning',
      label: t('dashboard.actionItems.messageFailedGroup', 'Messages non délivrés'),
      action: t('dashboard.actionItems.messageFailedAction', 'Renvoyer'),
    },
    {
      kind: 'WELCOME_GUIDE_MISSING' as const,
      icon: <BookOpenIcon />,
      tone: 'text-warning',
      label: t('dashboard.actionItems.guideGroup', 'Livrets d’accueil à publier'),
      action: t('dashboard.actionItems.guideAction', 'Publier'),
    },
    {
      kind: 'DEPOSIT_STUCK' as const,
      icon: <LockIcon />,
      tone: 'text-warning',
      label: t('dashboard.actionItems.depositGroup', 'Cautions à libérer'),
      action: t('dashboard.actionItems.depositAction', 'Libérer'),
    },
    {
      kind: 'SERVICE_UNPAID' as const,
      icon: <WrenchIcon />,
      tone: 'text-warning',
      label: t('dashboard.actionItems.servicesGroup', 'Prestations à régler'),
      action: t('dashboard.actionItems.servicesAction', 'Régler'),
    },
    {
      kind: 'SERVICE_UNASSIGNED' as const,
      icon: <UserSearchIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.unassignedGroup', 'Prestations sans prestataire'),
      action: t('dashboard.actionItems.unassignedAction', 'Assigner'),
    },
    {
      kind: 'FEED_STALE' as const,
      icon: <CalendarSyncIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.feedsGroup', 'Calendriers désynchronisés'),
      action: t('dashboard.actionItems.feedsAction', 'Resynchroniser'),
    },
    {
      kind: 'REVIEW_UNANSWERED' as const,
      icon: <StarIcon />,
      tone: 'text-info',
      label: t('dashboard.actionItems.reviewsGroup', 'Avis sans réponse'),
      action: t('dashboard.actionItems.reviewsAction', 'Répondre'),
    },
    {
      kind: 'INTERVENTION_UNASSIGNED' as const,
      icon: <UserSearchIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.interventionUnassignedGroup', 'Interventions sans exécutant'),
      action: t('dashboard.actionItems.interventionUnassignedAction', 'Assigner'),
    },
    {
      kind: 'INTERVENTION_UNPAID' as const,
      icon: <WrenchIcon />,
      tone: 'text-warning',
      label: t('dashboard.actionItems.interventionUnpaidGroup', 'Interventions à régler'),
      action: t('dashboard.actionItems.interventionUnpaidAction', 'Régler'),
    },
    {
      kind: 'CHECKIN_NOT_STARTED' as const,
      icon: <LogInIcon />,
      tone: 'text-warning',
      label: t('dashboard.actionItems.checkinGroup', 'Check-in en ligne non commencés'),
      action: t('dashboard.actionItems.checkinAction', 'Relancer'),
    },
    {
      kind: 'NOISE_ALERT_UNACKNOWLEDGED' as const,
      icon: <VolumeXIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.noiseGroup', 'Alertes de bruit non acquittées'),
      action: t('dashboard.actionItems.noiseAction', 'Acquitter'),
    },
    {
      kind: 'ISSUE_OPEN' as const,
      icon: <ClipboardListIcon />,
      tone: 'text-warning',
      label: t('dashboard.actionItems.issueGroup', 'Signalements à qualifier'),
      action: t('dashboard.actionItems.issueAction', 'Qualifier'),
    },
    {
      kind: 'OWNER_PAYOUT_PENDING' as const,
      icon: <BanknoteIcon />,
      tone: 'text-warning',
      label: t('dashboard.actionItems.payoutGroup', 'Reversements à approuver'),
      action: t('dashboard.actionItems.payoutAction', 'Approuver'),
    },
    {
      kind: 'PAYOUT_ONBOARDING_INCOMPLETE' as const,
      icon: <LandmarkIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.onboardingGroup', 'Comptes de paiement non finalisés'),
      action: t('dashboard.actionItems.onboardingAction', 'Finaliser'),
    },
    {
      kind: 'INVITATION_EXPIRED' as const,
      icon: <MailWarningIcon />,
      tone: 'text-warning',
      label: t('dashboard.actionItems.invitationGroup', 'Invitations expirées'),
      action: t('dashboard.actionItems.invitationAction', 'Réinviter'),
    },
    {
      kind: 'DOCUMENT_DELIVERY_FAILED' as const,
      icon: <FileWarningIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.documentGroup', 'Documents non délivrés'),
      action: t('dashboard.actionItems.documentAction', 'Renvoyer'),
    },
    {
      kind: 'EINVOICE_FAILED' as const,
      icon: <ReceiptTextIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.einvoiceGroup', 'Factures électroniques rejetées'),
      action: t('dashboard.actionItems.einvoiceAction', 'Renvoyer'),
    },
    {
      kind: 'AUTOMATION_FAILED' as const,
      icon: <ZapOffIcon />,
      tone: 'text-warning',
      label: t('dashboard.actionItems.automationGroup', 'Automatisations en échec'),
      action: t('dashboard.actionItems.automationAction', 'Relancer'),
    },
    {
      kind: 'OUTBOX_DEAD_LETTER' as const,
      icon: <SendHorizonalIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.outboxGroup', 'Messages internes perdus'),
      action: t('dashboard.actionItems.outboxAction', 'Rejouer'),
    },
    {
      kind: 'INTEGRATION_DISCONNECTED' as const,
      icon: <PlugZapIcon />,
      tone: 'text-destructive',
      label: t('dashboard.actionItems.integrationGroup', 'Intégrations déconnectées'),
      action: t('dashboard.actionItems.integrationAction', 'Reconnecter'),
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
 * sans mode démo dans le produit.
 *
 * <p>Une seule chose n'arrive pas par `data` : la liste des rubriques qui
 * portent un geste de masse. Elle ne décrit pas une organisation mais une
 * décision de conception — « ce geste est répétable sans dommage » — et c'est
 * le service qui porte le geste qui la prend. La dupliquer ici ferait proposer
 * un bouton que le serveur refuse.</p>
 */
export function ActionItemsView({ data }: { data?: DashboardActionItems }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Répondre est le geste attendu ici : on ouvre l'avis sur place. Quitter le
  // tableau de bord reste possible, mais c'est le rôle du lien « Voir les avis ».
  // ⚠️ Avant tout early return (règles des hooks).
  const [active, setActive] = React.useState<DashboardActionItem | null>(null);
  /**
   * Rubrique dépliée, une seule à la fois. `undefined` = l'utilisateur n'a
   * encore rien choisi : la première rubrique — la plus prioritaire, l'ordre
   * vient du serveur — s'ouvre d'elle-même, pour qu'un sommaire entièrement
   * replié n'oblige pas à un clic avant de pouvoir agir.
   */
  const [openKind, setOpenKind] = React.useState<DashboardActionKind | null | undefined>(undefined);
  /** Rubrique dont le traitement de masse attend une confirmation. */
  const [bulkTarget, setBulkTarget] = React.useState<{
    kind: DashboardActionKind;
    label: string;
    verb: string;
    total: number;
  } | null>(null);

  // Quelles rubriques portent un geste de masse : c'est le serveur qui le dit.
  const { data: bulkGestures } = useBulkGestures();
  const bulkableKinds = React.useMemo(
    () => new Set((bulkGestures ?? []).map((gesture) => gesture.kind)),
    [bulkGestures],
  );

  const queryClient = useQueryClient();
  const runBulk = useMutation({
    mutationFn: (kind: DashboardActionKind) => actionItemsApi.bulk(kind),
    onSuccess: async (result) => {
      setBulkTarget(null);
      await refreshActionQueue(
        (key) => queryClient.invalidateQueries({ queryKey: key }),
        [['dashboard', 'action-items']],
      );
      announceBulkResult(result, t);
    },
    onError: () => {
      setBulkTarget(null);
      toast.error(t('dashboard.actionItems.bulkFailed', 'Le traitement n’a pas pu démarrer.'));
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const totalsByKind = data?.totalsByKind ?? {};
  const amountsByKind = data?.amountsByKind ?? {};
  const groups = actionKinds(t)
    .map((meta) => {
      const rows = items.filter((item) => item.kind === meta.kind);
      // Le décompte vient du serveur : `rows` est déjà tronqué.
      return { ...meta, rows, kindTotal: totalsByKind[meta.kind] ?? rows.length };
    })
    .filter((group) => group.rows.length > 0);

  const open = openKind === undefined ? (groups[0]?.kind ?? null) : openKind;

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
        // Plus de hauteur bornée ni d'ascenseur : c'est la LIGNE du tableau de
        // bord qui donne sa hauteur à la carte, et les rubriques qui n'y
        // tiennent pas se replient derrière un « +N » (cf. `BlockCard`).
        // L'ancien cadre à `max-h-[28rem]` réglait le même problème — vingt-deux
        // actions poussaient le reste de l'écran dehors — mais en cachant la
        // moitié de la file derrière un rail qu'on ne voyait qu'en la survolant.
        //
        // `data-fit-list` : les rangs à replier sont les RUBRIQUES, pas les
        // lignes d'action. Une rubrique repliée reste ouvrable d'un clic ; une
        // ligne masquée au milieu d'une rubrique dépliée ne se retrouve pas.
        <div data-fit-list className="flex flex-col">
          {groups.map((group) => (
            <ActionGroup
              key={group.kind}
              icon={group.icon}
              tone={group.tone}
              label={group.label}
              total={group.kindTotal}
              shown={group.rows.length}
              severity={worstSeverity(group.rows)}
              // Cumul calculé par le serveur sur TOUTES les lignes, pas sur les
              // dix reçues : c'est ce qui rend « Soldes jamais encaissés ·
              // 4 810 € » exact au premier coup d'œil.
              amount={amountsByKind[group.kind] ?? null}
              open={open === group.kind}
              onToggle={() => setOpenKind(open === group.kind ? null : group.kind)}
              // Un geste de masse n'a de sens qu'à partir de deux lignes : sur
              // une seule, il double le bouton qui est déjà sur la ligne.
              bulkLabel={
                bulkableKinds.has(group.kind) && group.kindTotal > 1
                  ? t('dashboard.actionItems.bulkAction', {
                      verb: group.action,
                      count: group.kindTotal,
                      defaultValue: '{{verb}} les {{count}}',
                    })
                  : undefined
              }
              onBulk={() =>
                setBulkTarget({
                  kind: group.kind,
                  label: group.label,
                  verb: group.action,
                  total: group.kindTotal,
                })
              }
              shownOfLabel={(visible, counted) =>
                t('dashboard.actionItems.shownOf', {
                  shown: visible,
                  total: counted,
                  defaultValue: '{{shown}} affichées sur {{total}}',
                })
              }
              moreLabel={(count) =>
                t('dashboard.actionItems.showMore', {
                  count,
                  defaultValue: 'Voir les {{count}} autres',
                })
              }
              lessLabel={t('dashboard.actionItems.showLess', 'Réduire')}
            >
              {group.rows.map((item) => (
                <ActionRow
                  key={item.id}
                  /* On agit envers quelqu'un, pas envers une ligne de texte :
                     quand l'action concerne une personne, elle ouvre la ligne. */
                  leading={item.subject ? <GuestAvatar name={item.subject} size={30} /> : undefined}
                  primary={actionPrimary(item, t)}
                  secondary={actionSecondary(item, t)}
                  age={waitingFor(item.waitingSince, t)}
                  ageTone={AGE_TONE[item.severity]}
                  ageTitle={t('dashboard.actionItems.waitingSince', {
                    age: waitingFor(item.waitingSince, t) ?? '',
                    defaultValue: 'En attente depuis {{age}}',
                  })}
                  value={actionValue(item)}
                  actionLabel={group.action}
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

      {/* Un clic, des dizaines d'effets : le seul endroit de cette carte où une
          confirmation se justifie. Elle nomme le nombre exact, pas « ces
          éléments ». */}
      <ConfirmationModal
        open={bulkTarget !== null}
        onClose={() => setBulkTarget(null)}
        onConfirm={() => bulkTarget && runBulk.mutate(bulkTarget.kind)}
        loading={runBulk.isPending}
        severity="warning"
        confirmIcon={null}
        title={t('dashboard.actionItems.bulkTitle', {
          verb: bulkTarget?.verb ?? '',
          count: bulkTarget?.total ?? 0,
          defaultValue: '{{verb}} les {{count}} lignes ?',
        })}
        message={t('dashboard.actionItems.bulkMessage', {
          label: bulkTarget?.label ?? '',
          defaultValue:
            'Le geste sera appliqué à toute la rubrique « {{label}} », par lots de 50. '
            + 'Chaque ligne est traitée séparément : un échec n’arrête pas les autres, et vous saurez lesquelles.',
        })}
        confirmText={bulkTarget?.verb}
      />
    </BlockCard>
  );
}

/**
 * Dit ce que le lot a fait — y compris quand il a échoué en partie.
 *
 * <p>« C'est fait » sur un lot dont deux lignes ont échoué est un mensonge que
 * l'utilisateur ne découvrirait qu'au balayage suivant, sans savoir lesquelles.
 * Les échecs sont donc nommés, dans la limite de ce qu'une notification peut
 * porter — le reste attend dans la file, qui vient d'être rechargée.</p>
 */
function announceBulkResult(result: BulkGestureResult, t: TranslateFn): void {
  const summary = t('dashboard.actionItems.bulkDone', {
    succeeded: result.succeeded,
    requested: result.requested,
    defaultValue: '{{succeeded}} sur {{requested}} traitées',
  });
  const remainder = result.remaining > 0
    ? t('dashboard.actionItems.bulkRemaining', {
        count: result.remaining,
        defaultValue: 'Il en reste {{count}} : relancez pour le lot suivant.',
      })
    : undefined;

  if (result.failed === 0) {
    toast.success(summary, { description: remainder });
    return;
  }
  toast.warning(summary, {
    description: [
      result.failures
        .slice(0, 3)
        .map((failure) => `${failure.title ?? `#${failure.actionItemId}`} — ${failure.reason}`)
        .join(' · '),
      remainder,
    ]
      .filter(Boolean)
      .join(' · '),
  });
}

/**
 * Les natures portées par une intervention.
 *
 * <p>Elles ont ceci de particulier que leur titre se compose : le serveur donne
 * le logement et le type, l'écran les assemble — un libellé de type écrit côté
 * serveur ne se traduirait pas.</p>
 */
const INTERVENTION_KINDS: ReadonlySet<string> = new Set([
  'INTERVENTION_OVERDUE',
  'INTERVENTION_UNASSIGNED',
  'INTERVENTION_UNPAID',
]);

/**
 * Première ligne : « Ménage — Appartement Médina ».
 *
 * <p>Le titre d'origine de l'intervention vient du canal (« Menage Airbnb —
 * Appartement Duplex Paris ») et nomme souvent un autre logement que celui de
 * la ligne. Deux logements sur une même ligne, et l'on ne sait plus lequel est
 * vrai — c'est le défaut que cette composition corrige.</p>
 */
function actionPrimary(item: DashboardActionItem, t: TranslateFn): React.ReactNode {
  if (!INTERVENTION_KINDS.has(item.kind) || !item.actionType) return item.title;
  return [getInterventionTypeLabel(item.actionType, t), item.title].filter(Boolean).join(' — ');
}

/**
 * Seconde ligne : le contexte, sans jamais répéter la première.
 *
 * Le cas du calendrier est le seul où le serveur envoie un nombre plutôt qu'une
 * phrase — pour que la phrase reste traduisible.
 */
function actionSecondary(item: DashboardActionItem, t: TranslateFn): React.ReactNode {
  if (INTERVENTION_KINDS.has(item.kind)) {
    // Le logement est déjà dans le titre : le répéter ici prendrait la place
    // du seul contexte utile, le créneau et son dépassement.
    const late = item.kind === 'INTERVENTION_OVERDUE' ? waitingFor(item.waitingSince, t) : null;
    return [
      item.detail,
      late && t('dashboard.actionItems.overdueBy', {
        age: late,
        defaultValue: '{{age}} de retard',
      }),
    ]
      .filter(Boolean)
      .join(' · ');
  }
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

/**
 * Chiffre du bouton : un montant, une mention courte, ou rien.
 *
 * <p>Aucune couleur ici : le chiffre s'affiche <b>dans</b> le bouton et h\u00e9rite
 * de sa teinte. Lui en imposer une (le `text-foreground` d'avant) le rendait
 * illisible sur le fond plein.</p>
 */
function actionValue(item: DashboardActionItem): React.ReactNode {
  if (
    item.kind === 'BALANCE_DUE'
    || item.kind === 'SERVICE_UNPAID'
    || item.kind === 'SERVICE_UNASSIGNED'
    || item.kind === 'BALANCE_ABANDONED'
    || item.kind === 'DEPOSIT_STUCK'
  ) {
    return item.amount == null ? null : (
      <span className="font-semibold tabular-nums">
        <Money value={item.amount} decimals={0} />
      </span>
    );
  }
  // Le badge arrive pr\u00eat \u00e0 afficher (\u00ab 4\u2605 \u00bb) : le front ne le red\u00e9core pas.
  if (item.badge) {
    return <span className="font-semibold tabular-nums">{item.badge}</span>;
  }
  return null;
}

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

      <ActionCardDialog
        item={kind && ACTION_CARDS[kind] ? item : null}
        onClose={onClose}
        invalidateKeys={invalidateKeys}
      />

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
 * Rubrique de la file, repliée : une ligne de sommaire, dépliable sur place.
 *
 * <p>Vingt-sept rubriques déroulées d'un bloc ne se lisaient plus, elles se
 * parcouraient à l'ascenseur. Repliée, chaque rubrique dit en une ligne ce
 * qu'elle est, combien elle en compte et ce qu'elle pèse ; le sommaire tient
 * alors dans la carte, et c'est lui qui porte la comparaison entre natures.</p>
 *
 * <p>Une seule rubrique ouverte à la fois — l'état vit dans la carte, pas ici :
 * deux rubriques ouvertes ramènent le mur qu'on vient d'enlever.</p>
 *
 * <p>Les compteurs sont enfin réconciliés. Le sommaire annonce le décompte
 * <b>réel</b> du serveur ; une fois dépliée, la rubrique montre TOUT ce qui lui
 * a été transmis et dit à part combien elle en montre sur combien. L'ancien
 * enchaînement « (30) », trois lignes, « Voir les 7 autres » posait trois
 * nombres qui ne se recoupaient pas.</p>
 */
function ActionGroup({
  icon,
  tone,
  label,
  total,
  shown,
  severity,
  amount,
  open,
  onToggle,
  shownOfLabel,
  moreLabel,
  lessLabel,
  bulkLabel,
  onBulk,
  children,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  /** Décompte réel de la rubrique, tel que compté par le serveur. */
  total: number;
  /** Nombre de lignes effectivement reçues — le serveur plafonne. */
  shown: number;
  /** Gravité la plus forte de la rubrique — porte la pastille du sommaire. */
  severity: DashboardActionSeverity;
  /** Cumul en jeu, quand il est exact et que la nature en a un. */
  amount: number | null;
  open: boolean;
  onToggle: () => void;
  shownOfLabel: (shown: number, total: number) => string;
  /** « Voir les 7 autres » — les lignes reçues que l'aperçu ne montre pas. */
  moreLabel: (count: number) => string;
  lessLabel: string;
  /** Verbe du geste de masse, quand la rubrique en porte un. */
  bulkLabel?: string;
  onBulk: () => void;
  children: React.ReactNode;
}) {
  const panelId = React.useId();
  /**
   * Rubrique dépliée jusqu'au bout, ou réduite à son aperçu.
   *
   * <p>Refermée quand la rubrique se referme : la rouvrir doit la rendre telle
   * qu'on l'ouvre pour la première fois, pas telle qu'on l'avait laissée trente
   * lignes plus bas.</p>
   */
  const [showAll, setShowAll] = React.useState(false);
  React.useEffect(() => {
    if (!open) setShowAll(false);
  }, [open]);

  const rows = React.Children.toArray(children);
  const hiddenHere = Math.max(0, rows.length - GROUP_PREVIEW);
  if (total === 0) return null;

  return (
    <section className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="-mx-1.5 flex w-full cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-2 text-start outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none"
      >
        {/* Pastille de gravité : 6 px d'aplat vif. Un liseré latéral coloré ou
            un fond plein sur la ligne teindrait toute la rubrique du rouge de
            sa pire ligne. */}
        <span className={cn('size-1.5 shrink-0 rounded-full', SEVERITY_DOT[severity])} />
        <span className={cn('inline-flex shrink-0 [&>svg]:size-3.5', tone)}>{icon}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{label}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{total}</span>
        {amount != null && (
          <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
            <Money value={amount} decimals={0} />
          </span>
        )}
        {/* Deux icônes plutôt qu'une rotation : `cn-rtl-flip` pose déjà un
            `transform` en RTL, et un `rotate-90` par-dessus le remplacerait. */}
        {open ? (
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="cn-rtl-flip size-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        // Un retrait, pas un aplat : `accent` (le survol des lignes) et `muted`
        // résolvent vers la MÊME teinte — un fond ici effacerait le survol des
        // lignes qu'il contient. Le décalage suffit à dire la subordination.
        <div id={panelId} className="mb-2 flex flex-col ps-4">
          {showAll ? rows : rows.slice(0, GROUP_PREVIEW)}

          {/* Pas de pied vide : une rubrique de deux lignes sans geste de masse
              n'a rien à y mettre, et le creux se verrait. */}
          {(hiddenHere > 0 || bulkLabel) && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 pb-0.5">
            <span className="flex min-w-0 items-baseline gap-2">
              {hiddenHere > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAll((all) => !all)}
                  aria-expanded={showAll}
                  className="cursor-pointer rounded-md text-xs font-medium text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {showAll ? lessLabel : moreLabel(hiddenHere)}
                </button>
              )}
              {/* Dit ce qui n'a PAS été transmis, une fois tout déplié : le
                  serveur plafonne, et « Voir les 7 autres » ne doit jamais
                  promettre les vingt qu'il n'a pas envoyées. */}
              {showAll && shown < total && (
                <span className="text-2xs tabular-nums text-muted-foreground">
                  {shownOfLabel(shown, total)}
                </span>
              )}
            </span>

            {/* Le seul bouton plein de la rubrique. Les lignes ne visent
                qu'elles-mêmes et restent en bouton clair ; ici, c'est toute la
                rubrique qui bascule. */}
            {bulkLabel && (
              <Button size="xs" onClick={onBulk}>
                {bulkLabel}
              </Button>
            )}
          </div>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Ligne d'action : contenu à gauche, geste attendu à droite, la ligne entière
 * est le bouton. Même geste que les blocs Arrivées, qui ouvrent aussi au clic.
 *
 * <p>Le chevron a laissé place au verbe : « ceci s'ouvre » ne disait pas ce
 * qu'on allait y faire, et une file de priorités se parcourt en lisant les
 * gestes, pas en devinant les destinations. Le montant vit <b>dans</b> le
 * bouton — « Encaisser 75 € » est une seule phrase, là où un chiffre posé à
 * côté du verbe obligeait à recoller les deux.</p>
 *
 * <p>Le verbe est rendu en <b>span</b> habillé par `buttonVariants`, pas en
 * `<Button>` : la ligne est déjà un bouton, et un bouton dans un bouton est du
 * HTML invalide. Le clic sur la pastille est donc exactement le clic sur la
 * ligne — un seul contrôle, un seul nom accessible (« … · Encaisser 75 € »),
 * aucune cible morte à côté de la cible utile.</p>
 */
function ActionRow({
  leading,
  primary,
  secondary,
  age,
  ageTone,
  ageTitle,
  value,
  actionLabel,
  onClick,
}: {
  /** Visuel d'entrée de ligne — avatar du voyageur pour les avis. */
  leading?: React.ReactNode;
  primary: React.ReactNode;
  secondary: React.ReactNode;
  /** Depuis combien de temps la ligne attend — « 4 h », « 2 j ». */
  age?: string | null;
  /** Couple `-ink` / `-soft` de la pastille d'ancienneté, selon la gravité. */
  ageTone?: string;
  /** Libellé complet de l'ancienneté — « En attente depuis 4 h ». */
  ageTitle?: string;
  /** Montant ou mention courte, rendu dans le bouton, après le verbe. */
  value?: React.ReactNode;
  /** Verbe du geste attendu, propre à la nature de l'action. */
  actionLabel: string;
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
      {/* L'ancienneté avant le verbe : c'est ce qui fait décider si l'on agit
          maintenant, et le verbe est le même sur toutes les lignes de la
          rubrique. Texte en `-ink` sur fond `-soft` — la teinte vive en texte
          plafonne à 2,2:1, et c'est justement le chiffre à voir de loin. */}
      {age && (
        <span
          // La pastille ne dit qu'un nombre : le libellé complet est au survol
          // et pour les lecteurs d'écran, faute de place sur une ligne dense.
          title={ageTitle}
          className={cn(
            'shrink-0 rounded-full px-1.5 py-0.5 text-2xs font-semibold tabular-nums',
            ageTone,
          )}
        >
          {age}
        </span>
      )}
      <span
        className={cn(
          buttonVariants({ variant: 'outline', size: 'xs' }),
          // Bouton clair, et non plein : la ligne ne vise qu'elle-même. Le seul
          // plein encrier de la rubrique est le geste de masse, en pied — trente
          // pastilles noires en concurrence n'en laissaient plus aucune primaire.
          'shrink-0 bg-card',
          'group-hover/row:bg-background',
        )}
      >
        {actionLabel}
        {value}
      </span>
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
  // Le tableau ne defile pas : il montre les arrivees qui tiennent dans la
  // hauteur de sa ligne, et compte les autres. La plus proche est la plus
  // utile — c'est donc la FIN de la liste qu'on abrege.
  const { ref: bodyRef, hidden } = useFitRows<HTMLDivElement>('tbody > tr');

  if (isLoading) return null;
  const rows = data ?? [];

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="flex shrink-0 items-center justify-between px-4 pt-4 pb-2">
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
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-hidden">
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
                    <GuestAvatar name={row.guestName ?? '?'} photoUrl={guestPhotoSrc(row.guestAvatarUrl)} size={24} />
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
        </div>
      )}
      {hidden > 0 && (
        <p className="m-0 shrink-0 px-4 py-1.5 text-2xs font-semibold text-muted-foreground">
          {t('dashboard.upcomingArrivals.more', {
            count: hidden,
            defaultValue: '+ {{count}} autres arrivées',
          })}
        </p>
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
