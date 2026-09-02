import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BanknoteIcon,
  CalendarClockIcon,
  CalendarOffIcon,
  CheckIcon,
  ClipboardListIcon,
  FileTextIcon,
  FileWarningIcon,
  MapPinIcon,
  ReceiptTextIcon,
  TriangleAlertIcon,
  UserIcon,
} from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
  Skeleton,
} from '../../../components/ui';
import StatusChip from '../../../components/baitly/StatusChip';
import { Money } from '../../../components/baitly/Money';
import EmptyState from '../../../components/EmptyState';
import { cn } from '../../../utils/cn';
import { toApiMediaUrl } from '../../../utils/mediaUrl';
import { useTranslation } from '../../../hooks/useTranslation';
import { useNotification } from '../../../hooks/useNotification';
import { BlockCard, BlockEmpty } from './DashboardOperationsBlocks';
import { interventionsApi, type Intervention, type QuoteLine } from '../../../services/api/interventionsApi';
import { housekeeperPayoutsApi } from '../../../services/api/housekeeperPayoutsApi';
import {
  providerDocumentsApi,
  REQUIRED_PROVIDER_DOCUMENTS,
  type ProviderDocument,
} from '../../../services/api/providerDocumentsApi';
import { issuesApi, type Issue } from '../../../services/api/issuesApi';
import { providerExpensesApi } from '../../../services/api/providerExpensesApi';
import { myAvailabilityApi } from '../../../services/api/myAvailabilityApi';
import { serviceQuotesApi, type MyQuote, type ServiceQuote } from '../../../services/api/serviceQuotesApi';
import { getInterventionTypeLabel } from '../../../utils/statusUtils';
import { formatDate } from '../../../utils/formatUtils';
import PagePagination from '../../../components/PagePagination';
import { technicianPrestationsApi } from '../../../services/api/technicianPrestationsApi';
import { housekeeperRatesApi } from '../../../services/api/housekeeperRatesApi';
import { useAuth } from '../../../hooks/useAuth';
import { TRADE_ROLES } from '../../../utils/fieldRoles';

/**
 * Blocs du tableau de bord des rôles TERRAIN — gouvernante, technicien,
 * blanchisserie, extérieurs.
 *
 * <p>Le tableau de bord leur servait la vue gestionnaire amputée : arrivées et
 * départs du parc, compteurs à zéro, aucun moyen de savoir <b>où aller</b>. Ces
 * blocs répondent aux quatre questions qu'un intervenant se pose en ouvrant
 * l'application : qu'est-ce que je fais maintenant, qu'est-ce qu'on me propose,
 * qu'est-ce qui me bloque, et combien j'ai gagné.</p>
 */

// ─── Fenêtres de travail ────────────────────────────────────────────────────

const WEEK_DAYS = 7;
/**
 * Fenêtre unique de chargement des missions. Les blocs coupent dedans plutôt
 * que d'interroger chacun la sienne : trois fenêtres différentes faisaient
 * trois clés de cache, donc trois appels HTTP pour un seul écran.
 *
 * <p>Elle démarre <b>dans le passé</b>. Une mission dont la date est dépassée
 * et qui n'est ni terminée ni annulée est en retard — c'est la chose la plus
 * urgente à montrer, pas celle à masquer. Une fenêtre qui commençait
 * aujourd'hui les faisait disparaître de l'écran.</p>
 */
const MISSION_WINDOW_PAST_DAYS = 60;
const MISSION_WINDOW_AHEAD_DAYS = 30;
/** Une pièce qui périme dans moins de 30 jours mérite d'être signalée avant. */
const EXPIRY_WARNING_DAYS = 30;

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

/** Missions a venir — le serveur les restreint deja a l'appelant. */
function useMyMissions() {
  const today = new Date();
  const startDate = isoDate(addDays(today, -MISSION_WINDOW_PAST_DAYS));
  const endDate = isoDate(addDays(today, MISSION_WINDOW_AHEAD_DAYS));
  return useQuery({
    queryKey: ['field', 'missions', startDate, endDate],
    queryFn: () => interventionsApi.getAll({
      startDate,
      endDate,
      sort: 'scheduledDate,asc',
      size: 100,
    }),
    staleTime: 60_000,
  });
}

function useMyPayoutRecords() {
  return useQuery({
    queryKey: ['field', 'payouts'],
    queryFn: () => housekeeperPayoutsApi.getMy(),
    staleTime: 60_000,
  });
}

function useMyDocuments() {
  return useQuery({
    queryKey: ['field', 'documents'],
    queryFn: () => providerDocumentsApi.listMine(),
    staleTime: 300_000,
  });
}

// ─── Ma prochaine mission ───────────────────────────────────────────────────

/** Une mission déjà terminée ou annulée n'est plus « à venir ». */
const isOpen = (mission: Intervention) =>
  mission.status !== 'COMPLETED' && mission.status !== 'CANCELLED';

/** Ouverte et déjà datée : personne n'est passé. */
const isOverdue = (mission: Intervention) =>
  isOpen(mission) && new Date(mission.scheduledDate).getTime() < Date.now();

const formatSlot = (iso: string, locale: string) => {
  const date = new Date(iso);
  return date.toLocaleString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * La mission en cours, ou la prochaine.
 *
 * <p>C'est le bloc qui manquait : l'écran affichait « Interventions du jour :
 * 0 » là où il fallait une adresse et une heure. Quelqu'un qui se déplace a
 * besoin de savoir où, pas combien.</p>
 */
/**
 * Vignette du logement : sa photo, ou ses initiales à défaut.
 *
 * <p>Un intervenant reconnaît un logement à sa façade bien avant de lire son
 * nom. Quand il n'y a pas de photo, les initiales valent mieux qu'un carré
 * vide — le repère reste au même endroit, la carte ne bouge pas.</p>
 */
function PropertyBubble({ mission }: { mission: Intervention }) {
  const [broken, setBroken] = React.useState(false);
  // Un prefixe entre crochets etiquette le jeu de donnees, il ne nomme pas le
  // logement : sans ce retrait, « [X] Villa Untel » donnait les initiales « [V ».
  // La garde reste apres la sortie du jeu de demonstration — un import de canal
  // peut tres bien reintroduire un nom prefixe.
  const initials = (mission.propertyName ?? '?')
    .replace(/^\s*\[[^\]]*\]\s*/, '')
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase() || '?';

  const showPhoto = Boolean(mission.propertyCoverPhotoUrl) && !broken;

  return showPhoto ? (
    <img
      src={toApiMediaUrl(mission.propertyCoverPhotoUrl)}
      alt=""
      className="size-12 shrink-0 rounded-xl border border-solid border-border object-cover"
      onError={() => setBroken(true)}
    />
  ) : (
    <span
      aria-hidden
      className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-semibold text-muted-foreground"
    >
      {initials}
    </span>
  );
}

/**
 * Carte d'une mission : le logement, quand, où, et quoi faire.
 *
 * <p>Disposition VERTICALE : les cartes vivent dans une grille de trois
 * colonnes, où chacune ne fait qu'un tiers de la largeur. Le couple
 * contenu-à-gauche / actions-à-droite n'y tiendrait pas.</p>
 */
function MissionCard({ mission, onOpen }: { mission: Intervention; onOpen: (id: number) => void }) {
  const { t, currentLanguage } = useTranslation();
  const running = mission.status === 'IN_PROGRESS';
  const overdue = !running && isOverdue(mission);
  const address = [mission.propertyAddress, mission.propertyPostalCode, mission.propertyCity]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="flex h-full flex-col gap-2.5 rounded-xl border border-solid border-border p-3">
      <div className="flex min-w-0 gap-2.5">
        <PropertyBubble mission={mission} />
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate font-semibold text-foreground">{mission.propertyName}</p>
          <p className="m-0 truncate text-sm text-muted-foreground">{mission.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {running && (
              <StatusChip tone="ok" size="sm" dot label={t('field.nextMission.inProgress', 'En cours')} />
            )}
            {overdue && (
              <StatusChip tone="err" size="sm" dot label={t('field.nextMission.late', 'En retard')} />
            )}
            {mission.assignmentResponse === 'PENDING' && !running && (
              <StatusChip tone="warn" size="sm" dot label={t('field.nextMission.toConfirm', 'À confirmer')} />
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5 text-sm tabular-nums">
        <span className="whitespace-nowrap font-medium text-foreground">
          {formatSlot(mission.scheduledDate, currentLanguage)}
        </span>
        {mission.estimatedDurationHours != null && (
          <span className="whitespace-nowrap text-muted-foreground">
            · {mission.estimatedDurationHours} h
          </span>
        )}
        {mission.estimatedCost != null && (
          <span className="whitespace-nowrap font-medium text-foreground">
            · <Money value={mission.estimatedCost} decimals={0} />
          </span>
        )}
      </div>

      {address && (
        <p className="m-0 flex items-start gap-1.5 text-sm text-muted-foreground">
          <MapPinIcon className="mt-0.5 size-3.5 shrink-0" />
          <span className="min-w-0">{address}</span>
        </p>
      )}

      {mission.propertyOwnerName && (
        <p className="m-0 flex items-center gap-1.5 text-sm text-muted-foreground">
          <UserIcon className="size-3.5 shrink-0" />
          <span className="truncate">{mission.propertyOwnerName}</span>
        </p>
      )}

      {/* `mt-auto` colle les actions en bas : dans une grille, les cartes ont la
          hauteur de la plus haute, et sans cela leurs boutons se decalent. */}
      <div className="mt-auto flex items-center gap-1.5 border-t border-solid border-border pt-2.5">
        {address && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => window.open(
              `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`,
              '_blank',
              'noopener',
            )}
          >
            <MapPinIcon className="size-4" />
            {t('field.nextMission.directions', 'Itinéraire')}
          </Button>
        )}
        <Button variant="secondary" size="sm" className="flex-1" onClick={() => onOpen(mission.id)}>
          {running
            ? t('field.nextMission.resume', 'Reprendre')
            : t('field.nextMission.open', 'Ouvrir')}
        </Button>
      </div>
    </div>
  );
}

/** Au-delà de ce nombre, le reste part dans une modale. */
const VISIBLE_MISSIONS = 3;

/**
 * Les missions qui appellent une action, en cartes.
 *
 * <p>Une seule mission était affichée : les autres retards restaient invisibles,
 * alors qu'un retard est précisément ce qu'il faut voir. Trois cartes tiennent
 * sans noyer le tableau de bord ; le reste s'ouvre dans une modale.</p>
 */
export function MyNextMissionCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: missions, isLoading } = useMyMissions();
  const [showAll, setShowAll] = React.useState(false);

  const open = (missions ?? [])
    .filter(isOpen)
    .filter((mission) => mission.assignmentResponse !== 'DECLINED');

  // Ordre : ce qu'on fait déjà, puis les retards (le plus ancien d'abord),
  // puis la journée en cours.
  const today = isoDate(new Date());
  const running = open.filter((mission) => mission.status === 'IN_PROGRESS');
  const late = open
    .filter((mission) => mission.status !== 'IN_PROGRESS' && isOverdue(mission))
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  const dueToday = open.filter((mission) =>
    mission.status !== 'IN_PROGRESS'
    && !isOverdue(mission)
    && mission.scheduledDate.slice(0, 10) === today);
  const upcoming = open.filter((mission) =>
    mission.status !== 'IN_PROGRESS'
    && !isOverdue(mission)
    && mission.scheduledDate.slice(0, 10) !== today);

  // Ce bloc porte ce qui appelle une action AUJOURD'HUI : ce qu'on fait, ce
  // qu'on a laissé filer, ce qui tombe dans la journée. Quand il n'y a rien de
  // tout cela, il se rabat sur la prochaine échéance plutôt que de laisser un
  // vide sur un écran ouvert chaque matin.
  const actionable = [...running, ...late, ...dueToday];
  const ordered = actionable.length > 0 ? actionable : upcoming.slice(0, 1);

  const openMission = (id: number) => {
    const mission = ordered.find((m) => m.id === id);
    navigate(mission?.status === 'IN_PROGRESS' ? `/interventions/${id}/suivi` : `/interventions/${id}`);
  };

  if (isLoading) return <Skeleton className="h-[168px] w-full rounded-xl" />;

  // Le titre nomme ce que la liste contient reellement, sinon il ment des que
  // les deux natures de mission cohabitent.
  const title = late.length > 0 && dueToday.length > 0
    ? t('field.nextMission.todayAndLateTitle', 'Missions du jour et en retard')
    : late.length > 0
      ? t('field.nextMission.lateTitle', 'Missions en retard')
      : dueToday.length > 0 || running.length > 0
        ? t('field.nextMission.todayTitle', 'Missions du jour')
        : t('field.nextMission.title', 'Ma prochaine mission');

  if (ordered.length === 0) {
    return (
      <BlockCard
        icon={<CalendarClockIcon className="size-3.5 text-muted-foreground" />}
        title={t('field.nextMission.title', 'Ma prochaine mission')}
      >
        <EmptyState
          icon={<CalendarClockIcon />}
          title={t('field.nextMission.none', 'Aucune mission planifiée')}
          description={t('field.nextMission.noneHelp',
            'Vérifiez votre zone d’intervention et vos disponibilités : sans elles, les missions ne vous sont pas proposées automatiquement.')}
          variant="dashed"
        />
      </BlockCard>
    );
  }

  const visible = ordered.slice(0, VISIBLE_MISSIONS);
  const remaining = ordered.length - visible.length;

  return (
    <BlockCard
      icon={<CalendarClockIcon className={cn('size-3.5', late.length > 0 ? 'text-destructive-ink' : 'text-muted-foreground')} />}
      title={title}
      count={ordered.length}
    >
      <div className="grid grid-cols-1 gap-2 min-[640px]:grid-cols-2 min-[900px]:grid-cols-3">
        {visible.map((mission) => (
          <MissionCard key={mission.id} mission={mission} onOpen={openMission} />
        ))}
      </div>

      {remaining > 0 && (
        <>
          <button
            type="button"
            className="mt-2.5 cursor-pointer self-start border-0 bg-transparent p-0 text-sm font-medium text-primary underline-offset-4 transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            onClick={() => setShowAll(true)}
          >
            {t('field.nextMission.showMore', 'Voir les {{count}} autres missions', { count: remaining })}
          </button>

          <Dialog open={showAll} onOpenChange={setShowAll}>
            <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-[720px]">
              <DialogHeader>
                <DialogTitle>{t('field.nextMission.allTitle', 'Toutes mes missions')}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-2 min-[640px]:grid-cols-2">
                {ordered.map((mission) => (
                  <MissionCard
                    key={mission.id}
                    mission={mission}
                    onOpen={(id) => { setShowAll(false); openMission(id); }}
                  />
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </BlockCard>
  );
}

// ─── Missions à confirmer ───────────────────────────────────────────────────

/**
 * Missions proposées, en attente de réponse.
 *
 * <p>Le bloc disparaît quand il n'y a rien à confirmer : une carte vide de plus
 * sur un tableau de bord déjà creux n'apporte rien.</p>
 */
/**
 * Tarifs que l'intervenant a lui-meme declares, indexes par type de prestation.
 *
 * <p>Deux catalogues selon le metier : les prestations travaux
 * ({@code ServicePriceConfig.basePrice}) pour un technicien, le forfait par
 * logement ou le taux horaire pour une gouvernante. Les deux repondent a la
 * meme question — « combien je demande, moi, pour ce travail ».</p>
 */
function useMyPricing() {
  const { hasAnyRole } = useAuth();
  const isTrade = hasAnyRole([...TRADE_ROLES]);

  const { data: prestations } = useQuery({
    queryKey: ['field', 'my-prestations'],
    queryFn: () => technicianPrestationsApi.getMine(),
    enabled: isTrade,
    staleTime: 300_000,
  });
  const { data: rates } = useQuery({
    queryKey: ['field', 'my-rates'],
    queryFn: () => housekeeperRatesApi.getMy(),
    enabled: !isTrade,
    staleTime: 300_000,
  });

  return React.useMemo(() => {
    const byType = new Map<string, number>();
    for (const p of prestations ?? []) {
      if (p.enabled && p.basePrice > 0) byType.set(p.interventionType, p.basePrice);
    }
    const flatByProperty = new Map<number, number>();
    for (const p of rates?.properties ?? []) {
      if (p.flatAmount != null) flatByProperty.set(p.propertyId, p.flatAmount);
    }
    return {
      /** Mon tarif pour ce type de prestation, ou `null` si non declare. */
      forType: (type?: string | null) => (type ? byType.get(type) ?? null : null),
      /** Mon forfait pour ce logement (menage), ou `null`. */
      forProperty: (propertyId?: number | null) =>
        (propertyId != null ? flatByProperty.get(propertyId) ?? null : null),
      declared: byType.size > 0 || flatByProperty.size > 0,
    };
  }, [prestations, rates]);
}

/** Couleur de l'ecart : ambre si je demande plus, vert si on m'offre plus. */
function gapTone(gap: number | null) {
  // Sous 1 €, l'ecart est du bruit d'arrondi : on ne colore rien.
  if (gap == null || Math.abs(gap) < 1) return 'neutral' as const;
  return gap > 0 ? ('over' as const) : ('under' as const);
}

/**
 * Le chiffrage d'une mission, d'un seul tenant.
 *
 * <p>Chaque tache avait son propre encadre, plus un troisieme pour le total :
 * trois blocs empiles pour une seule question — combien on me propose, et
 * combien je demande. Tout tient desormais dans un cadre unique, les taches en
 * lignes compactes et le total en pied, mis en evidence.</p>
 */
function MissionPricing({
  lines, asked, mine, carriedOver, rateOf,
}: {
  lines: QuoteLine[];
  asked: number | null;
  mine: number | null;
  carriedOver: number;
  rateOf: (type?: string | null) => number | null;
}) {
  const { t } = useTranslation();
  const tone = gapTone(mine != null && asked != null ? mine - asked : null);
  const detailed = lines.length > 1;

  return (
    <div className="rounded-lg bg-muted/40 p-2.5">
      {/* Le detail par tache n'a de sens qu'a plusieurs : avec une seule ligne,
          il repeterait mot pour mot le total juste en dessous. */}
      {detailed && (
        <div className="mb-2 flex flex-col gap-1 border-b border-solid border-border pb-2">
          {lines.map((line, index) => {
            const lineAsked = line.unitPrice * (line.quantity || 1);
            const rate = rateOf(line.interventionType);
            const lineMine = rate != null ? rate * (line.quantity || 1) : null;
            return (
              <div key={`${line.label}-${index}`} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-muted-foreground">
                  {line.quantity > 1 ? `${line.label} ×${line.quantity}` : line.label}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  <Money value={lineAsked} decimals={0} />
                  <span className="mx-1 opacity-60">→</span>
                  {lineMine != null ? (
                    <span className={cn(
                      'font-medium',
                      gapTone(lineMine - lineAsked) === 'over' && 'text-warning-ink',
                      gapTone(lineMine - lineAsked) === 'under' && 'text-success-ink',
                      gapTone(lineMine - lineAsked) === 'neutral' && 'text-foreground',
                    )}>
                      <Money value={lineMine} decimals={0} />
                    </span>
                  ) : (
                    <span className="italic">{t('field.proposals.sameAsAsked', 'idem')}</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 text-2xs uppercase tracking-wide text-muted-foreground">
            {t('field.proposals.asked', 'Proposé')}
          </p>
          <p className="m-0 text-base font-semibold tabular-nums text-foreground">
            {asked != null ? <Money value={asked} decimals={0} /> : '—'}
          </p>
        </div>

        {mine != null && asked != null ? (
          <>
            <span
              aria-hidden
              className={cn(
                'mb-1 shrink-0 rounded px-1.5 py-0.5 text-2xs font-semibold tabular-nums',
                tone === 'neutral' && 'bg-muted text-muted-foreground',
                tone === 'over' && 'bg-warning-soft text-warning-ink',
                tone === 'under' && 'bg-success-soft text-success-ink',
              )}
            >
              {mine - asked > 0 ? '+' : ''}{Math.round(mine - asked)} €
            </span>
            <div className="min-w-0 text-end">
              <p className="m-0 text-2xs uppercase tracking-wide text-muted-foreground">
                {t('field.proposals.myRate', 'Mon tarif')}
              </p>
              <p className={cn(
                'm-0 text-base font-semibold tabular-nums',
                tone === 'over' ? 'text-warning-ink'
                  : tone === 'under' ? 'text-success-ink' : 'text-foreground',
              )}>
                <Money value={mine} decimals={0} />
              </p>
            </div>
          </>
        ) : (
          <p className="m-0 text-xs text-muted-foreground">
            {t('field.proposals.noRate', 'Aucun tarif configuré')}
          </p>
        )}
      </div>

      {/* Sans cette mention, un total superieur au catalogue passe pour une
          erreur : il inclut les lignes qu'on ne tarife pas et qu'on reprend. */}
      {carriedOver > 0 && (
        <p className="m-0 mt-1.5 text-xs text-muted-foreground">
          {t('field.proposals.carriedOver', 'dont {{amount}} € repris au prix proposé', {
            amount: Math.round(carriedOver),
          })}
        </p>
      )}
    </div>
  );
}

/**
 * Missions proposees, en attente de reponse.
 *
 * <p>Le bloc disparait quand il n'y a rien a confirmer : une carte vide de plus
 * sur un tableau de bord deja creux n'apporte rien.</p>
 */
export function MissionProposalsCard() {
  const { t, currentLanguage } = useTranslation();
  const { notify } = useNotification();
  const queryClient = useQueryClient();
  const { data: missions } = useMyMissions();
  const pricing = useMyPricing();
  // Les accords deja scelles : tant que mon tarif y correspond, il n'y a rien
  // a reproposer — c'est ce qui evite un devis a chaque mission.
  const { data: agreedRates } = useQuery({
    queryKey: ['field', 'agreed-rates'],
    queryFn: () => serviceQuotesApi.myAgreedRates(),
    staleTime: 300_000,
  });
  const agreedFor = React.useCallback((propertyId?: number | null) => {
    if (propertyId == null) return null;
    return (agreedRates ?? []).find((rate) => rate.propertyId === propertyId)?.amount ?? null;
  }, [agreedRates]);

  const [decliningId, setDecliningId] = React.useState<number | null>(null);
  const [reason, setReason] = React.useState('');

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['field', 'missions'] });

  const acceptMutation = useMutation({
    mutationFn: (id: number) => interventionsApi.accept(id),
    onSuccess: () => {
      notify.success(t('field.proposals.accepted', 'Mission acceptée'));
      refresh();
    },
    onError: () => notify.error(t('field.proposals.error', 'L’action a échoué, réessayez.')),
  });

  const declineMutation = useMutation({
    mutationFn: ({ id, why }: { id: number; why: string }) => interventionsApi.decline(id, why),
    onSuccess: () => {
      notify.success(t('field.proposals.declined', 'Mission refusée'));
      setDecliningId(null);
      setReason('');
      refresh();
    },
    onError: () => notify.error(t('field.proposals.error', 'L’action a échoué, réessayez.')),
  });

  const quoteMutation = useMutation({
    mutationFn: ({ id, amount, note, lines }: {
      id: number; amount: number; note: string; lines: QuoteLine[];
    }) =>
      serviceQuotesApi.submitMine(id, {
        amount,
        currency: 'EUR',
        validUntil: null,
        earliestStartDate: null,
        description: note || null,
        // Le detail justifie le total : sans lui, le proprietaire ne voit
        // qu'un montant.
        lines,
      }),
    onSuccess: () => {
      notify.success(t('field.proposals.quoteSent', 'Tarif proposé — le gestionnaire est prévenu'));
      queryClient.invalidateQueries({ queryKey: ['field', 'quotes'] });
    },
    onError: () => notify.error(t('field.proposals.error', 'L’action a échoué, réessayez.')),
  });

  const proposals = (missions ?? []).filter(
    (mission) => mission.assignmentResponse === 'PENDING' && mission.status === 'PENDING',
  );
  if (proposals.length === 0) return null;

  /** Mon total pour cette mission : somme de mes tarifs, sinon rien. */
  const myTotalFor = (mission: Intervention): number | null => {
    const lines = mission.quoteLines ?? [];
    if (lines.length === 0) {
      return pricing.forProperty(mission.propertyId) ?? pricing.forType(mission.type);
    }
    let total = 0;
    let known = false;
    for (const line of lines) {
      const mine = pricing.forType(line.interventionType);
      if (mine != null) {
        total += mine * (line.quantity || 1);
        known = true;
      } else {
        total += line.unitPrice * (line.quantity || 1);
      }
    }
    return known ? total : null;
  };


  return (
    <BlockCard
      icon={<ClipboardListIcon className="size-3.5 text-warning-ink" />}
      title={t('field.proposals.title', 'Missions à confirmer')}
      count={proposals.length}
    >
      <div className="grid grid-cols-1 gap-2 min-[640px]:grid-cols-2 min-[900px]:grid-cols-3">
        {proposals.map((mission) => {
          const lines = mission.quoteLines ?? [];
          const mineTotal = myTotalFor(mission);
          // Part du total qui n'est PAS de mon tarif : les lignes sans equivalent
          // au catalogue, reprises au prix propose.
          const carriedOver = lines.reduce((sum, line) => (
            pricing.forType(line.interventionType) == null
              ? sum + line.unitPrice * (line.quantity || 1)
              : sum
          ), 0);
          const agreed = agreedFor(mission.propertyId);
          // L'accord vaut pour CE montant : s'il a change, il faut le represente.
          const rateAlreadyAgreed = agreed != null && mineTotal != null
            && Math.abs(agreed - mineTotal) < 1;

          return (
            <div
              key={mission.id}
              className="flex h-full flex-col gap-2.5 rounded-xl border border-solid border-border p-3"
            >
              <div className="flex min-w-0 gap-2.5">
                <PropertyBubble mission={mission} />
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate font-semibold text-foreground">{mission.propertyName}</p>
                  <p className="m-0 truncate text-sm text-muted-foreground">{mission.title}</p>
                  <p className="m-0 mt-1 text-sm tabular-nums text-muted-foreground">
                    {formatSlot(mission.scheduledDate, currentLanguage)}
                  </p>
                </div>
              </div>

              {/* Les taches chiffrees. Sans devis structure — cas du menage —, la
                  mission entiere fait office de ligne unique. */}
              <MissionPricing
                lines={lines}
                asked={mission.estimatedCost ?? null}
                mine={mineTotal}
                carriedOver={carriedOver}
                rateOf={pricing.forType}
              />

              {rateAlreadyAgreed && (
                <p className="m-0 flex items-center gap-1.5 text-xs text-success-ink">
                  <CheckIcon className="size-3.5 shrink-0" />
                  {t('field.proposals.agreed', 'Tarif déjà convenu pour ce logement')}
                </p>
              )}

              <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-solid border-border pt-2.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive-ink"
                  onClick={() => setDecliningId(decliningId === mission.id ? null : mission.id)}
                >
                  {t('field.proposals.decline', 'Refuser')}
                </Button>
                {/* Sans tarif configure, il n'y a rien a proposer : offrir le
                    bouton obligerait a inventer un montant. Et quand l'accord
                    porte deja ce montant, le redemander serait du bruit. */}
                {mineTotal != null && !rateAlreadyAgreed && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={quoteMutation.isPending}
                    onClick={() => quoteMutation.mutate({
                      id: mission.id,
                      amount: Math.round(mineTotal),
                      note: '',
                      lines: [{
                        label: getInterventionTypeLabel(mission.type, t),
                        quantity: 1,
                        unitPrice: Math.round(mineTotal),
                        interventionType: mission.type,
                      }],
                    })}
                  >
                    {t('field.proposals.proposeMine', 'Proposer {{amount}} €', {
                      amount: Math.round(mineTotal),
                    })}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  disabled={acceptMutation.isPending}
                  onClick={() => acceptMutation.mutate(mission.id)}
                >
                  {t('field.proposals.accept', 'Accepter')}
                </Button>
              </div>

              {/* Le motif reste facultatif : exiger une justification pour dire
                  « je ne peux pas » ferait accepter puis ne pas venir. */}
              {decliningId === mission.id && (
                <div className="flex flex-col gap-1.5 border-t border-solid border-border pt-2.5">
                  <Input
                    autoFocus
                    maxLength={500}
                    placeholder={t('field.proposals.reasonPlaceholder', 'Motif (facultatif)')}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      disabled={declineMutation.isPending}
                      onClick={() => declineMutation.mutate({ id: mission.id, why: reason })}
                    >
                      {t('field.proposals.confirmDecline', 'Confirmer le refus')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDecliningId(null)}>
                      {t('common.cancel', 'Annuler')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

    </BlockCard>
  );
}

// ─── Dossier bloquant ───────────────────────────────────────────────────────

const daysUntil = (iso: string) =>
  Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

/**
 * Ce qui empêchera de travailler si on le laisse filer.
 *
 * <p>L'attestation de vigilance URSSAF se périme tous les six mois. La rater
 * suspend les missions : mieux vaut le dire trente jours avant que le
 * découvrir le matin d'une intervention.</p>
 */
export function ProviderComplianceAlert() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: documents } = useMyDocuments();

  if (!documents) return null;

  const latestFor = (type: string): ProviderDocument | undefined =>
    documents.filter((doc) => doc.documentType === type)[0];

  const problems: string[] = [];
  for (const type of REQUIRED_PROVIDER_DOCUMENTS) {
    const doc = latestFor(type);
    if (!doc) {
      problems.push(t('field.compliance.missing', 'pièce manquante : {{type}}', {
        type: t(`providerDocuments.types.${type}`, type),
      }));
    } else if (doc.status === 'REJECTED') {
      problems.push(t('field.compliance.rejected', 'pièce refusée : {{type}}', {
        type: t(`providerDocuments.types.${type}`, type),
      }));
    }
  }
  for (const doc of documents) {
    if (!doc.expiresAt || doc.status === 'REJECTED') continue;
    const remaining = daysUntil(doc.expiresAt);
    if (remaining >= 0 && remaining <= EXPIRY_WARNING_DAYS) {
      problems.push(t('field.compliance.expiring', '{{type}} expire dans {{days}} j', {
        type: t(`providerDocuments.types.${doc.documentType}`, doc.documentType),
        days: remaining,
      }));
    }
  }

  if (problems.length === 0) return null;

  return (
    <Alert variant="warning" className="items-center">
      <FileWarningIcon />
      <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <b>{t('field.compliance.title', 'Votre dossier est incomplet.')}</b>{' '}
          {problems.join(' · ')}
        </span>
        <Button variant="secondary" size="sm" onClick={() => navigate('/account?tab=documents')}>
          {t('field.compliance.fix', 'Compléter')}
        </Button>
      </AlertDescription>
    </Alert>
  );
}

// ─── Ma semaine ─────────────────────────────────────────────────────────────

/**
 * Les sept prochains jours, et le geste qui manquait : se déclarer
 * indisponible demain sans traverser deux écrans.
 */
/**
 * Ma semaine — une bande de sept jours, pas sept lignes.
 *
 * <p>La liste verticale consommait sept rangées pour dire, la plupart du temps,
 * « libre » sept fois. La bande donne la FORME de la semaine d'un coup d'œil :
 * on voit immédiatement où la charge se concentre et où il reste de la place.
 * Le jour sélectionné déplie ses missions en dessous — l'information détaillée
 * ne coûte plus de la hauteur en permanence.</p>
 */
export function MyWeekCard() {
  const { t, currentLanguage } = useTranslation();
  const { notify } = useNotification();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: missions, isLoading } = useMyMissions();
  const [selected, setSelected] = React.useState(0);

  const tomorrow = isoDate(addDays(new Date(), 1));

  const absentTomorrow = useMutation({
    mutationFn: () => myAvailabilityApi.addAbsence(
      tomorrow,
      tomorrow,
      t('field.week.absenceReason', 'Indisponible'),
    ),
    onSuccess: () => {
      notify.success(t('field.week.absenceSaved', 'Indisponibilité enregistrée pour demain'));
      queryClient.invalidateQueries({ queryKey: ['field', 'missions'] });
    },
    onError: () => notify.error(t('field.week.absenceError', 'L’enregistrement a échoué.')),
  });

  if (isLoading) return <Skeleton className="h-[180px] w-full rounded-xl" />;

  const open = (missions ?? []).filter(isOpen);
  const lateCount = open.filter(isOverdue).length;

  const days = Array.from({ length: WEEK_DAYS }, (_, offset) => {
    const day = addDays(new Date(), offset);
    const key = isoDate(day);
    return {
      key,
      day,
      missions: open
        .filter((mission) => mission.scheduledDate.slice(0, 10) === key)
        .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)),
    };
  });

  const total = days.reduce((sum, day) => sum + day.missions.length, 0);
  const selectedDay = days[selected] ?? days[0];

  return (
    <BlockCard
      icon={<CalendarClockIcon className="size-3.5 text-muted-foreground" />}
      title={t('field.week.title', 'Ma semaine')}
      count={total}
    >
      {lateCount > 0 && (
        <p className="m-0 mb-2 text-sm text-destructive-ink">
          {t('field.week.lateCount', '{{count}} mission(s) en retard', { count: lateCount })}
        </p>
      )}

      <div className="grid grid-cols-7 gap-1">
        {days.map(({ key, day, missions: ofDay }, index) => {
          const isSelected = index === selected;
          const busy = ofDay.length > 0;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelected(index)}
              className={cn(
                'flex cursor-pointer flex-col items-center gap-0.5 rounded-lg border border-solid px-1 py-2',
                'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                isSelected ? 'border-primary bg-primary-soft' : 'border-border hover:bg-muted',
              )}
            >
              <span className="text-2xs uppercase text-muted-foreground">
                {day.toLocaleDateString(currentLanguage, { weekday: 'short' }).slice(0, 3)}
              </span>
              <span className={cn('text-sm tabular-nums', busy ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                {day.getDate()}
              </span>
              {/* Une pastille plutôt qu'un chiffre quand il n'y a qu'une mission :
                  « 1 » sur sept cases ajoute du bruit sans rien apprendre. */}
              {busy ? (
                <span className="rounded-full bg-success-soft px-1.5 text-2xs font-semibold tabular-nums text-success-ink">
                  {ofDay.length}
                </span>
              ) : (
                <span aria-hidden className="size-1 rounded-full bg-border" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 border-t border-solid border-border pt-2.5">
        <p className="m-0 mb-1.5 text-xs font-medium text-foreground">
          {selectedDay.day.toLocaleDateString(currentLanguage, {
            weekday: 'long', day: 'numeric', month: 'long',
          })}
          {selected === 0 && (
            <span className="ms-1.5 font-normal text-muted-foreground">
              {t('field.week.today', 'aujourd’hui')}
            </span>
          )}
        </p>

        {selectedDay.missions.length === 0 ? (
          <p className="m-0 text-sm text-muted-foreground">
            {t('field.week.freeDay', 'Journée libre.')}
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {selectedDay.missions.map((mission) => (
              <button
                key={mission.id}
                type="button"
                onClick={() => navigate(`/interventions/${mission.id}`)}
                className="flex cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent p-0 text-start hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="text-sm font-medium tabular-nums text-foreground">
                  {new Date(mission.scheduledDate).toLocaleTimeString(currentLanguage, {
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
                <span className="min-w-0 truncate text-sm text-muted-foreground">
                  {mission.propertyName}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-solid border-border pt-2.5">
        <Button
          variant="outline"
          size="sm"
          disabled={absentTomorrow.isPending}
          onClick={() => absentTomorrow.mutate()}
        >
          <CalendarOffIcon className="size-4" />
          {t('field.week.absentTomorrow', 'Je suis indisponible demain')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => navigate('/mes-disponibilites')}>
          {t('field.week.manage', 'Gérer mes disponibilités')}
        </Button>
      </div>
    </BlockCard>
  );
}

// ─── Mes suites : anomalies signalées et frais avancés ──────────────────────

const ISSUE_TONES: Record<Issue['status'], 'ok' | 'warn' | 'info' | 'neutral'> = {
  OPEN: 'warn',
  QUALIFIED: 'info',
  CONVERTED: 'ok',
  DISMISSED: 'neutral',
};

/**
 * Ce que deviennent les signalements et les frais.
 *
 * <p>Une anomalie levée pendant une intervention partait sans retour : ni
 * « prise en compte », ni « écartée, voici pourquoi ». Cette boucle se referme
 * ici.</p>
 */
export function MyFollowUpsSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: issues } = useQuery({
    queryKey: ['field', 'issues'],
    queryFn: () => issuesApi.list({ mine: true }),
    staleTime: 60_000,
  });
  const { data: expenses } = useQuery({
    queryKey: ['field', 'expenses'],
    queryFn: () => providerExpensesApi.getMine(),
    staleTime: 60_000,
  });

  const recentIssues = (issues ?? []).slice(0, 5);
  const pendingExpenses = (expenses ?? []).filter(
    (expense) => expense.status === 'DRAFT' || expense.status === 'APPROVED',
  );

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <BlockCard
        icon={<TriangleAlertIcon className="size-3.5 text-warning-ink" />}
        title={t('field.issues.title', 'Mes signalements')}
        count={recentIssues.length}
      >
        {recentIssues.length === 0 ? (
          <BlockEmpty>
            {t('field.issues.none', 'Aucune anomalie signalée pour le moment.')}
          </BlockEmpty>
        ) : (
          <div className="flex flex-col gap-1.5">
            {recentIssues.map((issue) => (
              <Item key={issue.id} variant="outline" size="sm">
                <ItemContent>
                  <ItemTitle>{issue.title}</ItemTitle>
                  <ItemDescription>
                    {[issue.propertyName, issue.dismissReason].filter(Boolean).join(' · ')}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <StatusChip
                    tone={ISSUE_TONES[issue.status]}
                    size="sm"
                    dot
                    label={t(`issues.status.${issue.status.toLowerCase()}`, issue.status)}
                  />
                </ItemActions>
              </Item>
            ))}
          </div>
        )}
      </BlockCard>

      <BlockCard
        icon={<ReceiptTextIcon className="size-3.5 text-muted-foreground" />}
        title={t('field.expenses.title', 'Mes frais avancés')}
        count={pendingExpenses.length}
      >
        {pendingExpenses.length === 0 ? (
          <BlockEmpty>
            {t('field.expenses.none', 'Aucun frais en attente de remboursement.')}
          </BlockEmpty>
        ) : (
          <div className="flex flex-col gap-1.5">
            {pendingExpenses.slice(0, 5).map((expense) => (
              <Item key={expense.id} variant="outline" size="sm">
                <ItemContent>
                  <ItemTitle>{expense.description}</ItemTitle>
                  <ItemDescription className="tabular-nums">
                    {[expense.propertyName, expense.expenseDate].filter(Boolean).join(' · ')}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    <Money value={expense.amountTtc} decimals={2} />
                  </span>
                </ItemActions>
              </Item>
            ))}
          </div>
        )}
      </BlockCard>
    </div>
  );
}

/** Nombre de devis par page dans la modale. */
const QUOTES_PER_PAGE = 8;

/**
 * Une ligne de devis. Extraite parce que le bloc et sa modale l'affichent
 * a l'identique — dupliquer le rendu, c'est le voir diverger.
 */
function QuoteRow({ quote, onOpen }: { quote: MyQuote; onOpen: (id: number) => void }) {
  const { t } = useTranslation();
  return (
          <Item
            key={quote.id}
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => onOpen(quote.interventionId)}
          >
            <ItemContent className="min-w-0 gap-0.5">
              {/* Reference + nature : de quoi citer le devis et savoir de quel
                  metier il releve, sans ouvrir la fiche. */}
              <span className="flex flex-wrap items-center gap-1.5">
                <ItemTitle className="truncate">
                  {quote.interventionTitle
                    || quote.description
                    || t('field.quotes.untitled', 'Intervention #{{id}}', { id: quote.interventionId })}
                </ItemTitle>
                {quote.interventionType && (
                  <StatusChip
                    tone="neutral"
                    size="sm"
                    className="shrink-0 font-normal"
                    label={getInterventionTypeLabel(quote.interventionType, t)}
                  />
                )}
              </span>
              {/* Le bien, puis A QUI le devis est adresse : « Intervention
                  #97 » ne disait ni ou, ni pour qui, ni quand. */}
              <ItemDescription className="truncate">
                {[
                  quote.propertyName,
                  quote.ownerName || quote.agencyName,
                  quote.scheduledDate ? formatDate(quote.scheduledDate) : null,
                ].filter(Boolean).join(' · ')}
              </ItemDescription>
              <ItemDescription className="truncate font-mono text-2xs">
                {[
                  quote.reference,
                  quote.validUntil
                    ? t('field.quotes.validUntil', 'valable jusqu’au {{date}}',
                        { date: formatDate(quote.validUntil) })
                    : null,
                ].filter(Boolean).join(' · ')}
              </ItemDescription>
            </ItemContent>
            <ItemActions className="shrink-0">
              {/* Ou en est l'argent : l'intervenant ne pouvait pas savoir si
                  son acompte etait tombe. */}
              {quote.status === 'APPROVED' && (
                <StatusChip
                  tone={quote.paymentState === 'PAID' ? 'ok'
                    : quote.paymentState === 'DEPOSIT_PAID' ? 'info' : 'warn'}
                  size="sm"
                  dot
                  label={quote.paymentState === 'PAID'
                    ? t('field.quotes.paid', 'Réglé')
                    : quote.paymentState === 'DEPOSIT_PAID'
                      ? t('field.quotes.depositPaid', 'Acompte reçu')
                      : quote.depositAmount
                        ? t('field.quotes.awaitingDeposit', 'Acompte attendu')
                        : t('field.quotes.awaitingPayment', 'Règlement attendu')}
                />
              )}
              <StatusChip
                tone={QUOTE_TONES[quote.status]}
                size="sm"
                dot
                label={t(`field.quotes.status.${quote.status}`, quote.status)}
              />
              {/* Le montant ferme la ligne : c'est la colonne qu'on balaie
                  pour comparer. Barre quand la proposition est ecartee — le
                  tarif a existe, il ne vaut plus. */}
              <span
                className={cn(
                  'ms-1 min-w-[64px] text-end text-sm font-semibold tabular-nums',
                  quote.status === 'REJECTED' || quote.status === 'EXPIRED'
                    ? 'text-muted-foreground line-through'
                    : 'text-foreground',
                )}
              >
                <Money value={quote.amount} decimals={0} />
              </span>
            </ItemActions>
          </Item>
  );
}

// ─── Mes devis (métiers de travaux) ─────────────────────────────────────────

function useMyQuotes() {
  return useQuery({
    queryKey: ['field', 'quotes'],
    queryFn: () => serviceQuotesApi.listMine(),
    staleTime: 60_000,
  });
}

const QUOTE_TONES: Record<ServiceQuote['status'], 'ok' | 'warn' | 'err' | 'neutral'> = {
  RECEIVED: 'warn',
  APPROVED: 'ok',
  REJECTED: 'err',
  EXPIRED: 'neutral',
};

/**
 * Agrégats de devis pour les tuiles d'en-tête.
 *
 * <p>Le devis est le levier économique du technicien : il chiffre, le
 * gestionnaire tranche. Le score qualité et les versements ménage ne le
 * concernent pas — le moteur qui les calcule ignore les types de travaux.</p>
 */
export function useMyQuoteTotals() {
  const { data } = useMyQuotes();
  return React.useMemo(() => {
    const quotes = data ?? [];
    let pendingCount = 0;
    let approvedCount = 0;
    let approvedAmount = 0;
    for (const quote of quotes) {
      if (quote.status === 'RECEIVED') pendingCount += 1;
      if (quote.status === 'APPROVED') {
        approvedCount += 1;
        approvedAmount += quote.amount;
      }
    }
    return { pendingCount, approvedCount, approvedAmount };
  }, [data]);
}

/** Mes devis, du plus récent au plus ancien, avec ce qu'ils sont devenus. */
export function MyQuotesCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: quotes, isLoading } = useMyQuotes();
  // Les hooks passent AVANT le retour anticipe : places apres, le premier rendu
  // (en chargement) en declarait moins que le suivant, et React refusait de
  // reconcilier — « Rendered more hooks than during the previous render ».
  const [showAll, setShowAll] = React.useState(false);
  const [page, setPage] = React.useState(0);

  if (isLoading) return <Skeleton className="h-[160px] w-full rounded-xl" />;

  const all = quotes ?? [];
  // Trois lignes sur le tableau de bord : au-dela, le bloc chasse ce qui vient
  // apres lui. Le reste vit dans la modale, paginee.
  const recent = all.slice(0, 3);
  const paged = all.slice(page * QUOTES_PER_PAGE, (page + 1) * QUOTES_PER_PAGE);

  return (
    <BlockCard
      icon={<FileTextIcon className="size-3.5 text-muted-foreground" />}
      title={t('field.quotes.title', 'Mes devis')}
      count={recent.length}
    >
      {recent.length === 0 ? (
        <EmptyState
          icon={<FileTextIcon />}
          title={t('field.quotes.none', 'Aucun devis soumis')}
          description={t('field.quotes.noneHelp',
            'Ouvrez une intervention et chiffrez-la : le gestionnaire reçoit votre devis et le valide depuis sa fiche.')}
          variant="dashed"
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          {recent.map((quote) => (
            <QuoteRow key={quote.id} quote={quote} onOpen={(id) => navigate(`/interventions/${id}`)} />
          ))}

          {all.length > recent.length && (
            <button
              type="button"
              onClick={() => { setPage(0); setShowAll(true); }}
              className={cn(
                'mt-0.5 self-start text-xs text-primary underline-offset-2',
                'transition-colors hover:underline',
                'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              )}
            >
              {t('field.quotes.seeAll', 'Voir mes {{count}} devis', { count: all.length })}
            </button>
          )}
        </div>
      )}

      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t('field.quotes.allTitle', 'Mes devis')}
              <span className="ms-2 text-sm font-normal tabular-nums text-muted-foreground">
                {all.length}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            {paged.map((quote) => (
              <QuoteRow
                key={quote.id}
                quote={quote}
                onOpen={(id) => { setShowAll(false); navigate(`/interventions/${id}`); }}
              />
            ))}
          </div>
          {all.length > QUOTES_PER_PAGE && (
            <PagePagination
              count={all.length}
              page={page}
              onPageChange={setPage}
              rowsPerPage={QUOTES_PER_PAGE}
            />
          )}
        </DialogContent>
      </Dialog>
    </BlockCard>
  );
}

// ─── Rémunération : ce qui est versé, ce qui reste dû ───────────────────────

/**
 * Agrégats de versement du mois en cours.
 *
 * <p>Le tableau de bord n'affichait que le « prochain versement ». Ce qui a
 * déjà été payé manquait — c'est pourtant la moitié de la question.</p>
 */
export function useMyEarnings() {
  const { data } = useMyPayoutRecords();
  return React.useMemo(() => {
    const records = data?.records ?? [];
    const monthPrefix = new Date().toISOString().slice(0, 7);
    let paidThisMonth = 0;
    let pending = 0;
    let pendingCount = 0;
    for (const record of records) {
      if (record.status === 'SENT' && record.createdAt.startsWith(monthPrefix)) {
        paidThisMonth += record.amount;
      }
      if (record.status === 'PENDING') {
        pending += record.amount;
        pendingCount += 1;
      }
    }
    return { paidThisMonth, pending, pendingCount, accountReady: data?.onboardingCompleted ?? false };
  }, [data]);
}

export { BanknoteIcon as EarningsIcon };
