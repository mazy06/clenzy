import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { guestPhotoSrc } from '../../../services/api/guestsApi';
import { useNavigate } from 'react-router-dom';
import {
  BanknoteIcon,
  BanknoteXIcon,
  BookOpenIcon,
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
  StarIcon,
  CircleCheckIcon,
  UserSearchIcon,
  WrenchIcon,
} from '../../../icons/glyphs';
import {
  Button,
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
import { DashboardWidgetState } from '../DashboardWidgetState';
import { ActionGroup, ActionRow } from '../DashboardActionList';
import { DashboardQueue, DashboardQueueToggle } from '../DashboardQueue';
import { TodayOperationsView, type TodayReservation } from '../TodayOperationsView';
import { UpcomingArrivalsView } from '../UpcomingArrivalsView';
import { useDashboardPropertyPhotos } from '../useDashboardPropertyPhotos';
import { activeIntlLocale } from '../../../utils/activeLocale';

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

export function channelLabel(source: string | null, sourceName: string | null): string {
  if (sourceName && sourceName.trim()) return sourceName;
  const key = (source ?? 'other').toLowerCase();
  if (key === 'direct') return 'Direct';
  if (key === 'other') return 'Autre';
  if (key === 'booking') return 'Booking.com';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

// ─── Coquille de carte, commune aux blocs ───────────────────────────────────

export function BlockCard({
  icon,
  title,
  count,
  children,
  className,
  scrollable = false,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  count?: number;
  children: React.ReactNode;
  className?: string;
  scrollable?: boolean;
}) {
  return (
    // Contour en `ring-1`, jamais en `border` : c'est la métrique du `Card` du
    // design system (cf. `.cn-card`, baitly-nova.css). Un `ring` est un
    // box-shadow — il n'occupe aucune place et se dessine hors de la boîte,
    // là où une bordure de 1 px pousse le contenu vers l'intérieur. Mélanger
    // les deux sur une même ligne du tableau de bord décale les cartes et
    // leurs titres d'un pixel.
    <section
      className={cn(
        'flex flex-col rounded-lg bg-card ring-1 ring-foreground/10 p-4',
        scrollable && 'db-widget-surface',
        className,
      )}
    >
      <h3 className="m-0 mb-3 flex shrink-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-semibold text-foreground">
        {icon}
        {title}
        {count !== undefined && <span className="tabular-nums">({count})</span>}
      </h3>
      <div className={cn('min-w-0', scrollable && 'db-widget-body')}
        tabIndex={scrollable ? 0 : undefined} role={scrollable ? 'region' : undefined}
        aria-label={scrollable && typeof title === 'string' ? title : undefined}>
        {children}
      </div>
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
  const { data, isLoading, isError, refetch } = useDashboardToday();
  const [openedReservation, setOpenedReservation] = React.useState<TodayReservation | null>(null);

  if (isLoading || isError) return <DashboardWidgetState title={t('dashboard.widgets.todayOperations', 'Opérations du jour')} error={isError} onRetry={() => { void refetch(); }} />;

  return <>
    <TodayOperationsView data={data} onOpenReservation={setOpenedReservation}
      onOpenCleaning={(id) => navigate(`/interventions/${id}`)}
      onOpenDeposits={() => navigate('/billing?tab=deposits')} />
    <ReservationActionDialog reservationId={openedReservation?.reservationId ?? null}
      onClose={() => setOpenedReservation(null)}
      preview={{ guestName: openedReservation?.guestName, propertyName: openedReservation?.propertyName }}
      invalidateKeys={[['dashboard', 'operations', 'today']]} />
  </>;
}

// ─── §6 — À traiter ─────────────────────────────────────────────────────────

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
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useDashboardActionItems();
  if (isLoading || isError) return <DashboardWidgetState title={t('dashboard.actionItems.title', 'À traiter')} error={isError} onRetry={() => { void refetch(); }} />;
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
  const [showAllGroups, setShowAllGroups] = React.useState(false);
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
    <>
      <DashboardQueue title={t('dashboard.actionItems.title', 'À traiter')} count={total}
        caption={groups.length > 0 ? t('dashboard.actionItems.queueCaption', '{{count}} rubriques, par ordre de priorité', { count: groups.length }) : ''}
        footer={groups.length > 6 ? <DashboardQueueToggle expanded={showAllGroups} onToggle={() => setShowAllGroups((value) => !value)}
          moreLabel={t('dashboard.actionItems.showCategories', 'Voir les {{count}} autres rubriques', { count: groups.length - 6 })}
          lessLabel={t('dashboard.actionItems.showLess', 'Réduire')} /> : undefined}>
      {groups.length === 0 ? (
        <div className="db-queue__empty">
          <CircleCheckIcon aria-hidden="true" />
          <p>{t('dashboard.actionItems.empty', 'Rien à traiter. Tout est à jour.')}</p>
        </div>
      ) : (
        <div data-fit-list className="db-queue__list">
          {(showAllGroups ? groups : groups.slice(0, 6)).map((group) => (
            <ActionGroup
              key={group.kind}
              icon={group.icon}
              kind={group.kind}
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
                  leading={
                    item.subject ? (
                      <GuestAvatar
                        name={item.subject}
                        photoUrl={guestPhotoSrc(item.subjectAvatarUrl)}
                        size={30}
                      />
                    ) : undefined
                  }
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

      </DashboardQueue>

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
    </>
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
          currency: item?.currency,
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

// ─── §8 — Prochaines arrivées ───────────────────────────────────────────────

export function UpcomingArrivalsCard({ days = 7 }: { days?: number }) {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useDashboardUpcomingArrivals(days);
  const photos = useDashboardPropertyPhotos();
  const [opened, setOpened] = React.useState<DashboardUpcomingArrival | null>(null);
  if (isLoading || isError) return <DashboardWidgetState title={t('dashboard.upcomingArrivals.title', 'Prochaines arrivées')} error={isError} onRetry={() => { void refetch(); }} />;
  return <>
    <UpcomingArrivalsView rows={data ?? []} days={days} photos={photos} onOpen={setOpened} />
    <ReservationActionDialog reservationId={opened?.reservationId ?? null} onClose={() => setOpened(null)}
      preview={{ guestName: opened?.guestName, propertyName: opened?.propertyName, amountDue: opened?.amountDue }}
      invalidateKeys={[[ 'dashboard', 'upcoming-arrivals', days ]]} />
  </>;
}
