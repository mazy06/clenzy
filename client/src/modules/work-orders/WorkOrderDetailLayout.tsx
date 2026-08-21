import React from 'react';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  Progress,
  Separator,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import StatusChip from '../../components/StatusChip';
import StatTile from '../../components/baitly/StatTile';
import StatTileRow from '../../components/baitly/StatTileRow';
import { cn } from '../../utils/cn';
import {
  AccessTime,
  Assignment,
  AttachMoney,
  AutoAwesome,
  AutoFixHigh,
  Bathtub,
  Bed,
  BugReport,
  Build,
  CalendarMonth,
  CalendarToday,
  Category,
  Deck,
  Description,
  Euro,
  Flag,
  Group,
  Home,
  Layers,
  LocalLaundryService,
  LocationOn,
  NoteAlt,
  People,
  Person,
  ReportProblem,
  Schedule,
  SquareFoot,
  VpnKey,
  Yard,
} from '../../icons';
import { toApiMediaUrl } from '../../utils/mediaUrl';
import { useTranslation } from '../../hooks/useTranslation';
import { Money } from '../../components/Money';
import { formatDateTime, formatDuration } from '../../utils/formatUtils';
import DescriptionNotesDisplay from '../../components/DescriptionNotesDisplay';
import type { ConsigneVariant } from '../../components/DescriptionNotesDisplay';
import {
  getInterventionTypeLabel,
  getPropertyTypeLabel,
} from '../../utils/statusUtils';

// Source logos
import airbnbLogoSmall from '../../assets/logo/airbnb-logo-small.svg';
import bookingLogoSmall from '../../assets/logo/logo-booking-planning.png';
import homeAwayLogo from '../../assets/logo/HomeAway-logo.png';
import expediaLogo from '../../assets/logo/expedia-logo.png';
import leboncoinLogo from '../../assets/logo/Leboncoin-logo.png';
import baitlyMark from '../../assets/logo/baitly-mark.svg';

const ICAL_SOURCE_LOGOS: Record<string, string> = {
  airbnb: airbnbLogoSmall,
  'booking.com': bookingLogoSmall,
  booking: bookingLogoSmall,
  vrbo: homeAwayLogo,
  homeaway: homeAwayLogo,
  expedia: expediaLogo,
  leboncoin: leboncoinLogo,
  direct: baitlyMark,
};

// ─── Recettes de classes partagees (palette Baitly UI) ──────────────────────

/**
 * Peau de carte : filet sur surface de carte, rayon xl, rembourrage 12 px
 * (ex-`p: 2`). `border-solid` est indispensable — le projet n'a pas de preflight
 * Tailwind, une bordure sans style declare reste invisible.
 */
const CARD_CLASS =
  'border border-solid border-border bg-card shadow-none rounded-xl p-3';

/** Titre de section, en petites capitales discretes. */
/** Au-dela, une description merite sa propre carte ; en deca, elle se replie. */
const SHORT_DESCRIPTION_CHARS = 160;

const SECTION_TITLE_CLASS = 'text-2xs font-bold uppercase tracking-[.05em] text-faint mb-[9px]';

/** Libelle d'une ligne d'information. */
const INFO_LABEL_CLASS = 'text-[11px] font-medium text-muted-foreground';

/** Valeur d'une ligne d'information. */
const INFO_VALUE_CLASS = 'text-[13px] font-semibold text-foreground mt-px';

/**
 * Tuile de la rangee : rembourrage resserre par rapport au defaut du kit (p-4),
 * pour qu'une rangee de quatre tienne sur une largeur de tablette.
 */
const TILE_CLASS = 'p-3 gap-0.5';

/**
 * Tuile mise en avant : fond pastel et filet primaire. Pas de bande laterale ni
 * d'ombre coloree — le contrat les proscrit ; c'est la SURFACE qui distingue.
 */
const HERO_TILE_CLASS = 'border-primary/45 bg-primary-soft';

/** Valeur chiffree d'une tuile metrique. */
const METRIC_VALUE_CLASS =
  'text-[15px] font-semibold text-foreground leading-[1.2] font-[family-name:var(--font-display)] tabular-nums';

/** Libelle d'une tuile metrique. */
const METRIC_LABEL_CLASS = 'text-2xs font-bold text-faint uppercase tracking-[.05em] mt-[1.5px]';

/**
 * Puce « caracteristique du logement » : encre de corps sur fond de champ,
 * cernee d'un filet. Ce n'est pas un statut — la bordure vient donc d'une
 * classe, pas de la recette `-soft` de la primitive.
 *
 * `border-solid` est indispensable : le gabarit pose `border-none`
 * (border-STYLE), que tailwind-merge ne considere pas en conflit avec `border`
 * (border-WIDTH) — sans lui le lisere reste invisible.
 */
const PROPERTY_TAG_TOKENS = { color: 'var(--bui-foreground)', bg: 'var(--bui-field)' } as const;
const PROPERTY_TAG_CLASS =
  'h-[26px] font-medium border border-solid border-field-line [&>svg]:text-primary';

// ─── Type icon helper ────────────────────────────────────────────────────────

function getTypeIcon(type: string) {
  const iconProps = { size: 18, color: 'var(--bui-primary)', strokeWidth: 1.75 };
  const upper = type?.toUpperCase() || '';

  const cleaningTypes = [
    'CLEANING', 'EXPRESS_CLEANING', 'DEEP_CLEANING', 'WINDOW_CLEANING',
    'FLOOR_CLEANING', 'KITCHEN_CLEANING', 'BATHROOM_CLEANING',
    'EXTERIOR_CLEANING', 'DISINFECTION',
  ];
  const repairTypes = [
    'EMERGENCY_REPAIR', 'ELECTRICAL_REPAIR', 'PLUMBING_REPAIR',
    'HVAC_REPAIR', 'APPLIANCE_REPAIR',
  ];

  if (cleaningTypes.includes(upper)) return <AutoAwesome {...iconProps} />;
  if (repairTypes.includes(upper)) return <Build {...iconProps} />;
  if (upper === 'PREVENTIVE_MAINTENANCE' || upper === 'MAINTENANCE' || upper === 'REPAIR') return <Build {...iconProps} />;
  if (upper === 'GARDENING') return <Yard {...iconProps} />;
  if (upper === 'PEST_CONTROL') return <BugReport {...iconProps} />;
  if (upper === 'RESTORATION') return <AutoFixHigh {...iconProps} />;
  return <Category {...iconProps} />;
}

// ─── Status progress helper ──────────────────────────────────────────────────

const PROGRESS_VALUES = [15, 35, 70, 100];

function getStatusProgress(status: string): number {
  const upper = status?.toUpperCase() || '';
  switch (upper) {
    case 'PENDING': return 15;
    case 'SCHEDULED': return 35;
    case 'ASSIGNED': return 35;
    case 'AWAITING_PAYMENT': return 50;
    case 'IN_PROGRESS': return 70;
    case 'COMPLETED': return 100;
    case 'CANCELLED': return 100;
    case 'REJECTED': return 100;
    default: return 0;
  }
}

function getStatusProgressColor(status: string): ProgressTone {
  const upper = status?.toUpperCase() || '';
  if (upper === 'COMPLETED') return 'success';
  if (upper === 'CANCELLED' || upper === 'REJECTED') return 'error';
  if (upper === 'IN_PROGRESS') return 'info';
  return 'primary';
}

type ProgressTone = 'primary' | 'success' | 'error' | 'info';

/**
 * `getStatusProgressColor` rend un nom de ton ; la barre comme le texte ont
 * besoin d'une VRAIE valeur CSS — la teinte est choisie a l'execution, aucune
 * classe Tailwind ne pourrait etre emise a la compilation.
 *
 * Deux tables et non une : un aplat de barre prend la teinte VIVE, un libelle
 * prend l'encre `-ink` (la teinte vive plafonne a ~2,2:1 en texte).
 */
const PROGRESS_BAR_TONE: Record<ProgressTone, string> = {
  primary: 'var(--bui-primary)',
  success: 'var(--bui-success)',
  error: 'var(--bui-destructive)',
  info: 'var(--bui-info)',
};

const PROGRESS_TEXT_TONE: Record<ProgressTone, string> = {
  primary: 'var(--bui-primary)',
  success: 'var(--bui-success-ink)',
  error: 'var(--bui-destructive-ink)',
  info: 'var(--bui-info-ink)',
};

// ─── View-model ──────────────────────────────────────────────────────────────

export interface WorkOrderProperty {
  id?: number;
  name: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  type?: string;
  squareMeters?: number;
  bedroomCount?: number;
  bathroomCount?: number;
  maxGuests?: number;
  numberOfFloors?: number;
  hasExterior?: boolean;
  hasLaundry?: boolean;
  cleaningDurationMinutes?: number;
  /** Description du logement (consignes). */
  description?: string;
  /** Consignes de ménage. */
  cleaningNotes?: string;
}

export interface WorkOrderPerson {
  name: string;
  email?: string;
  /** Rôle affiché en chip (libellé déjà traduit ou code brut). */
  roleLabel?: string;
}

export interface WorkOrderAssignee {
  name?: string;
  email?: string;
  type?: 'user' | 'team';
  /** Libellé du type (« Équipe », rôle, etc.) déjà résolu. */
  typeLabel?: string;
}

/** Tuile métrique secondaire (au-delà des tuiles standard type/durée/échéance). */
export interface WorkOrderMetric {
  icon: React.ReactNode;
  /** Couleur CSS de l'icône et de la valeur. Défaut : la teinte de marque. */
  tone?: string;
  value: string;
  label: string;
}

/**
 * Tache chiffree de la demande d'origine : {@code total = quantity × unitPrice}.
 * C'est le CONTENU du travail — une description generique ne le remplace pas.
 */
export interface WorkOrderTask {
  label: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Acces au logement, tel qu'il est renseigne sur la PROPRIETE.
 *
 * <p>Code de porte, stationnement, consignes d'arrivee : la seule information
 * qui laisse quelqu'un devant une porte fermee quand elle manque. Elle vivait
 * dans la fiche du logement, a deux ecrans de celui qui se deplace.</p>
 */
export interface WorkOrderAccess {
  code?: string | null;
  parking?: string | null;
  arrival?: string | null;
}

/**
 * Signalement a l'origine de l'ordre de travail.
 *
 * <p>Une intervention nee d'une anomalie ne disait pas POURQUOI elle existe :
 * l'intervenant lisait « Fuite sous evier » sans savoir qui l'avait constatee,
 * quand, ni ce qui avait ete decrit sur place.</p>
 */
export interface WorkOrderSourceIssue {
  id: number;
  title: string;
  description?: string | null;
  severity?: string | null;
  reportedByName?: string | null;
  createdAt?: string | null;
  /** Photos prises au moment du constat, avant toute intervention. */
  photoUrls?: string[];
}

/** Ligne supplémentaire dans la section « Détail du temps ». */
export interface WorkOrderTimeRow {
  icon: React.ReactNode;
  label: string;
  value: string;
}

export interface WorkOrderViewModel {
  /** Photo de couverture du logement — un lieu se reconnait avant de se lire. */
  propertyPhotoUrl?: string;
  /** Taches chiffrees de la demande. Vide pour un forfait sans devis structure. */
  tasks?: WorkOrderTask[];
  /** Acces au logement, renseigne sur la propriete. */
  access?: WorkOrderAccess;
  /** Signalement dont decoule ce travail, le cas echeant. */
  sourceIssue?: WorkOrderSourceIssue;
  type: string;
  status: string;
  /** Libellé de statut déjà traduit. */
  statusLabel: string;
  description?: string;
  /** Source OTA (airbnb/booking…) → pastille logo devant la description. */
  importSource?: string;

  // Métriques
  estimatedDurationHours?: number;
  dueDate?: string;
  estimatedCost?: number;
  /** Prix conseil plateforme (moteur ménage) snapshoté à la création — badge écart. */
  recommendedCost?: number;
  actualCost?: number;
  createdAt?: string;
  /** Tuiles métriques additionnelles (ex : début/fin pour une intervention). */
  extraMetrics?: WorkOrderMetric[];

  property: WorkOrderProperty;

  requestor?: WorkOrderPerson;
  assignee?: WorkOrderAssignee;

  /** Lignes additionnelles dans « Détail du temps » (départ/arrivée voyageur, etc.). */
  extraTimeRows?: WorkOrderTimeRow[];

  /** Section Notes & consignes (omise si rien à afficher). */
  specialInstructions?: string;
  accessNotes?: string;
}

export interface WorkOrderDetailLayoutProps {
  vm: WorkOrderViewModel;
  /** Slot d'action sur la carte Propriété (ex : bouton « Voir la propriété »). */
  propertyAction?: React.ReactNode;
  /**
   * Contenu riche additionnel rendu sous les deux colonnes (ex : le stepper
   * interactif d'une intervention). N'a pas d'équivalent côté demande de service.
   */
  extraSection?: React.ReactNode;
  /**
   * Action principale de l'ecran, posee DANS la carte de progression — c'est le
   * premier bloc de la page, donc le seul endroit ou un « Demarrer » se voit
   * sans defiler. Optionnelle : une demande de service n'en a pas.
   */
  heroAction?: React.ReactNode;
  /**
   * Bandeau rendu JUSTE SOUS la progression : l'etat d'assignation et les gestes
   * qui s'y rattachent. Le tableau de bord dit si une mission est a confirmer,
   * la fiche restait muette — il fallait revenir en arriere pour repondre.
   */
  statusBanner?: React.ReactNode;
}

// ─── Service type → ConsigneVariant ──────────────────────────────────────────

function getConsigneVariant(type: string): ConsigneVariant {
  const upper = type?.toUpperCase() || '';
  const cleaningTypes = [
    'CLEANING', 'EXPRESS_CLEANING', 'DEEP_CLEANING', 'WINDOW_CLEANING',
    'FLOOR_CLEANING', 'KITCHEN_CLEANING', 'BATHROOM_CLEANING',
    'EXTERIOR_CLEANING', 'DISINFECTION',
  ];
  const maintenanceTypes = [
    'EMERGENCY_REPAIR', 'ELECTRICAL_REPAIR', 'PLUMBING_REPAIR',
    'HVAC_REPAIR', 'APPLIANCE_REPAIR', 'PREVENTIVE_MAINTENANCE',
    'MAINTENANCE', 'REPAIR', 'RESTORATION',
  ];
  if (cleaningTypes.includes(upper)) return 'cleaning';
  if (maintenanceTypes.includes(upper)) return 'maintenance';
  return 'other';
}

/** Initiales d'une personne, pour l'avatar de repli. */
function initialsOf(name: string): string {
  return name
    .replace(/^\s*\[[^\]]*\]\s*/, '')
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase() || '?';
}

/** Gravite d'une anomalie → ton de pastille. */
const ISSUE_SEVERITY_TONE: Record<string, 'ok' | 'warn' | 'err' | 'neutral'> = {
  LOW: 'neutral',
  MEDIUM: 'warn',
  HIGH: 'err',
  CRITICAL: 'err',
};

// ─── Layout ──────────────────────────────────────────────────────────────────

/**
 * Présentation riche unifiée des « ordres de travail » (demandes de service +
 * interventions). Rend le même design — barre de progression, tuiles KPI,
 * colonnes Propriété / Notes / Personnes / Détail du temps — à partir d'un
 * view-model normalisé. Garantit un rendu visuellement identique entre les deux
 * pages de détail (DRY).
 */
const WorkOrderDetailLayout: React.FC<WorkOrderDetailLayoutProps> = ({
  vm,
  propertyAction,
  extraSection,
  heroAction,
  statusBanner,
}) => {
  const { t } = useTranslation();

  const statusProgress = getStatusProgress(vm.status);
  const statusProgressColor = getStatusProgressColor(vm.status);
  const statusBarColor = PROGRESS_BAR_TONE[statusProgressColor];
  const statusTextColor = PROGRESS_TEXT_TONE[statusProgressColor];
  const consigneVariant = getConsigneVariant(vm.type);

  const progressSteps = [
    t('serviceRequests.progressLabels.pending', 'En attente'),
    t('serviceRequests.progressLabels.approved', 'Approuvé'),
    t('serviceRequests.progressLabels.inProgress', 'En cours'),
    t('serviceRequests.progressLabels.completed', 'Terminé'),
  ];

  const p = vm.property;

  // Property characteristic tags (gracefully empty when not provided).
  const propertyTags: { icon: React.ReactElement; label: string }[] = [];
  if (p.type) propertyTags.push({ icon: <Category size={13} strokeWidth={1.75} />, label: getPropertyTypeLabel(p.type, t) });
  if (p.squareMeters) propertyTags.push({ icon: <SquareFoot size={13} strokeWidth={1.75} />, label: `${p.squareMeters} m²` });
  if (p.bedroomCount) propertyTags.push({ icon: <Bed size={13} strokeWidth={1.75} />, label: `${p.bedroomCount} ${t('serviceRequests.layout.bedroomsShort', 'ch.')}` });
  if (p.bathroomCount) propertyTags.push({ icon: <Bathtub size={13} strokeWidth={1.75} />, label: `${p.bathroomCount} ${t('serviceRequests.layout.bathroomsShort', 'SDB')}` });
  if (p.maxGuests) propertyTags.push({ icon: <People size={13} strokeWidth={1.75} />, label: `${p.maxGuests} ${t('serviceRequests.layout.guestsShort', 'voyag.')}` });
  if (p.numberOfFloors && p.numberOfFloors > 1) propertyTags.push({ icon: <Layers size={13} strokeWidth={1.75} />, label: `${p.numberOfFloors} ${t('serviceRequests.layout.floorsShort', 'étages')}` });
  if (p.hasExterior) propertyTags.push({ icon: <Deck size={13} strokeWidth={1.75} />, label: t('serviceRequests.layout.exterior', 'Extérieur') });
  if (p.hasLaundry) propertyTags.push({ icon: <LocalLaundryService size={13} strokeWidth={1.75} />, label: t('serviceRequests.layout.laundry', 'Linge') });

  const hasAccessSection = !!(vm.access?.code || vm.access?.parking || vm.access?.arrival || vm.accessNotes);
  const hasNotesSection = !!(p.description || p.cleaningNotes || vm.specialInstructions);

  const addressLine = [p.address, p.city].filter(Boolean).join(', ') + (p.postalCode ? ` ${p.postalCode}` : '');

  // L'ordre est-il encore en cours ? Tant qu'il l'est, c'est l'ECHEANCE qui
  // commande ; une fois clos, c'est le COUT qu'on vient relire.
  const isClosed = ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(vm.status);
  const isHeroDueDate = !isClosed && !!vm.dueDate;
  const hasActualCost = vm.actualCost != null && vm.actualCost > 0;

  const costTile = hasActualCost ? (
    <StatTile
      icon={<AttachMoney />}
      label={t('serviceRequests.details.actualCost')}
      value={<Money value={vm.actualCost!} from="EUR" />}
      iconClassName="text-success"
      className={cn(TILE_CLASS, isClosed && HERO_TILE_CLASS)}
    />
  ) : vm.estimatedCost != null ? (
    <StatTile
      icon={<Euro />}
      label={t('serviceRequests.details.estimatedCost')}
      value={<Money value={vm.estimatedCost} from="EUR" />}
      className={cn(TILE_CLASS, isClosed && HERO_TILE_CLASS)}
      hint={vm.recommendedCost != null && vm.recommendedCost > 0 ? (() => {
        // Moteur Menage 2A : ecart vs bareme conseil (snapshot recommended_cost).
        const delta = vm.estimatedCost! - vm.recommendedCost!;
        const conform = Math.abs(delta) <= 5;
        const deltaPct = Math.round((delta / vm.recommendedCost!) * 100);
        const label = conform
          ? t('workOrders.recommended.conform')
          : `${deltaPct > 0 ? '+' : ''}${deltaPct} % ${t('workOrders.recommended.vsScale')}`;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'inline-block rounded-[7px] px-1.5 py-px text-[10px] font-bold tabular-nums whitespace-nowrap cursor-default',
                  conform
                    ? 'text-success-ink bg-success-soft'
                    : 'text-muted-foreground bg-field border border-solid border-field-line',
                )}
              >
                {label}
              </span>
            </TooltipTrigger>
            <TooltipContent>{`${t('workOrders.recommended.scale')} : ${vm.recommendedCost} €`}</TooltipContent>
          </Tooltip>
        );
      })() : undefined}
    />
  ) : null;

  /** Fait saillant : un libelle discret, une valeur qui porte. */
  const Fact = ({ icon, label, value, strong }: {
    icon: React.ReactNode; label: string; value: React.ReactNode; strong?: boolean;
  }) => (
    <div className="flex min-w-0 items-start gap-2">
      <span className={cn('mt-[3px] inline-flex shrink-0', strong ? 'text-primary' : 'text-muted-foreground')}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="m-0 text-2xs font-semibold uppercase tracking-[.05em] text-faint">{label}</p>
        <p className={cn('m-0 truncate', strong ? 'text-[15px] font-semibold text-foreground' : 'text-[15px] text-foreground')}>
          {value}
        </p>
      </div>
    </div>
  );

  /** Titre de section : un filet et une capitale, pas un cadre de plus. */
  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <p className="m-0 mb-2 border-b border-solid border-border pb-1.5 text-2xs font-bold uppercase tracking-[.06em] text-faint">
      {children}
    </p>
  );

  const tasksTotal = (vm.tasks ?? []).reduce(
    (sum, task) => sum + task.unitPrice * (task.quantity || 1), 0);

  return (
    <div className="min-h-0 flex-1 overflow-auto pt-1.5">
      {/*
        Plus aucune carte. Chaque bloc etait encadre, ombre et espace : huit
        boites empilees pour un seul objet, et le regard butait sur les
        contours au lieu de suivre le contenu. La hierarchie tient desormais a
        la typographie et aux filets — un titre en capitales, un trait, du blanc.
      */}

      {/* ── Bandeau : ou, quoi, dans quel etat ───────────────────────────── */}
      <div className="flex flex-wrap items-start gap-4 pb-4">
        {vm.propertyPhotoUrl && (
          <img
            src={toApiMediaUrl(vm.propertyPhotoUrl)}
            alt=""
            className="size-20 shrink-0 rounded-xl border border-solid border-border object-cover"
          />
        )}

        <div className="min-w-0 flex-1">
          <p className="m-0 text-lg font-semibold leading-tight text-foreground">{p.name}</p>
          {addressLine.trim() && (
            <p className="m-0 mt-0.5 flex items-start gap-1 text-[13px] text-muted-foreground">
              <span className="inline-flex shrink-0 pt-[2px]"><LocationOn size={14} strokeWidth={1.75} /></span>
              <span>
                {addressLine}
                {p.country && <span className="text-faint"> · {p.country}</span>}
              </span>
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {addressLine.trim() && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressLine)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                <LocationOn size={12} strokeWidth={1.75} />
                {t('serviceRequests.details.directions', 'Itinéraire')}
              </a>
            )}
            {propertyAction}
          </div>
        </div>

        {heroAction && <div className="shrink-0">{heroAction}</div>}
      </div>

      {statusBanner && <div className="pb-4">{statusBanner}</div>}

      {/* ── Progression : une barre fine, sans cadre ─────────────────────── */}
      <div className="pb-4">
        <Progress
          value={statusProgress}
          className="h-1"
          style={{ ['--bui-primary' as string]: statusBarColor }}
        />
        <div className="mt-1 flex justify-between">
          {progressSteps.map((label, i) => (
            <p
              key={label}
              className={cn('m-0 text-[10px]', statusProgress >= PROGRESS_VALUES[i] ? 'font-semibold' : 'font-normal')}
              style={{ color: statusProgress >= PROGRESS_VALUES[i] ? statusTextColor : 'var(--bui-faint)' }}
            >
              {label}
            </p>
          ))}
        </div>
      </div>

      {/* ── Les quatre faits, en rangee separee par des filets ───────────── */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-solid border-border py-3 min-[900px]:grid-cols-4 min-[900px]:divide-x min-[900px]:divide-solid min-[900px]:divide-border">
        <div className="min-[900px]:pe-4">
          <Fact icon={getTypeIcon(vm.type)} label={t('common.type')}
            value={getInterventionTypeLabel(vm.type, t)} />
        </div>
        <div className="min-[900px]:px-4">
          <Fact icon={<CalendarToday size={16} strokeWidth={1.75} />} label={t('serviceRequests.dueDateShort')}
            value={formatDateTime(vm.dueDate) || '—'} strong={isHeroDueDate} />
        </div>
        <div className="min-[900px]:px-4">
          <Fact icon={<AccessTime size={16} strokeWidth={1.75} />} label={t('serviceRequests.estimatedDurationLabel')}
            value={vm.estimatedDurationHours != null ? formatDuration(vm.estimatedDurationHours) : '—'} />
        </div>
        <div className="min-[900px]:ps-4">
          <Fact
            icon={<AttachMoney size={16} strokeWidth={1.75} />}
            label={hasActualCost ? t('serviceRequests.details.actualCost') : t('serviceRequests.details.estimatedCost')}
            value={
              hasActualCost ? <Money value={vm.actualCost!} from="EUR" />
                : vm.estimatedCost != null ? <Money value={vm.estimatedCost} from="EUR" /> : '—'
            }
            strong={isClosed}
          />
        </div>
      </div>

      {/* ── Deux colonnes, sans boites ───────────────────────────────────── */}
      <div className="flex flex-wrap gap-x-8 gap-y-6 py-5 min-[900px]:flex-nowrap">
        <div className="min-w-0 flex-[1_1_100%] min-[900px]:flex-[7]">

          {/* L'acces passe AVANT le travail : sans code de porte, le reste ne
              sert a rien. Seule zone teintee de la colonne — elle signale ce qui
              bloque physiquement, pas une categorie de plus. */}
          {hasAccessSection && (
            <section className="mb-6 rounded-lg border border-solid border-warning/30 bg-warning-soft p-3">
              <p className="m-0 mb-2 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-[.06em] text-warning-ink">
                <VpnKey size={13} strokeWidth={1.75} />
                {t('serviceRequests.details.accessSection', 'Accès au logement')}
              </p>
              <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                {vm.access?.code && (
                  <>
                    <dt className="text-2xs font-semibold uppercase tracking-[.05em] text-warning-ink/80">
                      {t('serviceRequests.details.accessCode', 'Code')}
                    </dt>
                    <dd className="m-0 font-mono text-[15px] font-semibold tracking-[.08em] text-foreground">
                      {vm.access.code}
                    </dd>
                  </>
                )}
                {vm.access?.parking && (
                  <>
                    <dt className="text-2xs font-semibold uppercase tracking-[.05em] text-warning-ink/80">
                      {t('serviceRequests.details.accessParking', 'Stationnement')}
                    </dt>
                    <dd className="m-0 text-[13px] leading-[1.5] text-foreground">{vm.access.parking}</dd>
                  </>
                )}
                {vm.access?.arrival && (
                  <>
                    <dt className="text-2xs font-semibold uppercase tracking-[.05em] text-warning-ink/80">
                      {t('serviceRequests.details.accessArrival', 'Arrivée')}
                    </dt>
                    <dd className="m-0 whitespace-pre-line text-[13px] leading-[1.5] text-foreground">
                      {vm.access.arrival}
                    </dd>
                  </>
                )}
                {vm.accessNotes && (
                  <>
                    <dt className="text-2xs font-semibold uppercase tracking-[.05em] text-warning-ink/80">
                      {t('serviceRequests.details.accessNotes')}
                    </dt>
                    <dd className="m-0 whitespace-pre-line text-[13px] leading-[1.5] text-foreground">
                      {vm.accessNotes}
                    </dd>
                  </>
                )}
              </dl>
            </section>
          )}

          {vm.sourceIssue && (
            <section className="mb-6">
              <SectionTitle>
                {t('serviceRequests.details.sourceIssue', 'Signalement à l’origine')}
              </SectionTitle>
              <div className="flex items-start gap-2.5">
                <span className="mt-[3px] inline-flex shrink-0 text-warning-ink">
                  <ReportProblem size={16} strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="m-0 flex flex-wrap items-center gap-2 text-[14px] font-medium text-foreground">
                    {vm.sourceIssue.title}
                    {vm.sourceIssue.severity && (
                      <StatusChip
                        tone={ISSUE_SEVERITY_TONE[vm.sourceIssue.severity] ?? 'neutral'}
                        label={t(`issues.severity.${vm.sourceIssue.severity.toLowerCase()}`, vm.sourceIssue.severity)}
                        size="sm"
                        dot
                      />
                    )}
                  </p>
                  {vm.sourceIssue.description && (
                    <p className="m-0 mt-1 whitespace-pre-line text-[13px] leading-[1.6] text-muted-foreground">
                      {vm.sourceIssue.description}
                    </p>
                  )}
                  {(vm.sourceIssue.photoUrls?.length ?? 0) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {vm.sourceIssue.photoUrls!.map((url, index) => (
                        <a
                          key={url}
                          href={toApiMediaUrl(url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={toApiMediaUrl(url)}
                            alt={t('serviceRequests.details.issuePhotoAlt',
                              'Photo du signalement {{index}}', { index: index + 1 })}
                            loading="lazy"
                            className="size-20 rounded-md border border-solid border-border object-cover transition-opacity duration-150 hover:opacity-80"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                  <p className="m-0 mt-1.5 text-xs text-faint">
                    {[
                      vm.sourceIssue.reportedByName
                        && t('serviceRequests.details.reportedBy', 'Signalé par {{name}}', {
                          name: vm.sourceIssue.reportedByName,
                        }),
                      vm.sourceIssue.createdAt && formatDateTime(vm.sourceIssue.createdAt),
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
            </section>
          )}

          {vm.tasks && vm.tasks.length > 0 && (
            <section className="mb-6">
              <SectionTitle>{t('serviceRequests.details.tasks', 'Prestations demandées')}</SectionTitle>
              <Table>
                <TableBody>
                  {vm.tasks.map((task, index) => (
                    <TableRow key={`${task.label}-${index}`}>
                      <TableCell className="ps-0 text-[13px] text-foreground">
                        {task.label}
                        {task.quantity > 1 && (
                          <span className="ms-1 text-muted-foreground">×{task.quantity}</span>
                        )}
                      </TableCell>
                      <TableCell className="pe-0 text-end text-[13px] font-medium tabular-nums text-foreground">
                        <Money value={task.unitPrice * (task.quantity || 1)} decimals={0} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Le total ne se justifie qu'a plusieurs lignes. */}
                  {vm.tasks.length > 1 && (
                    <TableRow>
                      <TableCell className="ps-0 text-[13px] font-semibold text-foreground">
                        {t('field.proposals.total', 'Total')}
                      </TableCell>
                      <TableCell className="pe-0 text-end text-[13px] font-semibold tabular-nums text-foreground">
                        <Money value={tasksTotal} decimals={0} />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </section>
          )}

          {vm.description && (
            <section className="mb-6">
              <SectionTitle>{t('serviceRequests.fields.detailedDescription')}</SectionTitle>
              <div className="flex items-start gap-1.5">
                {vm.importSource && ICAL_SOURCE_LOGOS[vm.importSource.toLowerCase()] && (
                  <div className="mt-[1.5px] flex size-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-solid border-border bg-card">
                    <img
                      src={ICAL_SOURCE_LOGOS[vm.importSource.toLowerCase()]}
                      alt={vm.importSource}
                      width={15}
                      height={15}
                      style={{ objectFit: 'contain', borderRadius: '50%' }}
                    />
                  </div>
                )}
                <p className="m-0 whitespace-pre-line text-[13px] leading-[1.6] text-foreground">
                  {vm.description}
                </p>
              </div>
            </section>
          )}

          {hasNotesSection && (
            <section className="mb-6">
              <SectionTitle>{t('serviceRequests.details.notesInstructions')}</SectionTitle>
              <DescriptionNotesDisplay
                description={p.description}
                notes={p.cleaningNotes}
                variant={consigneVariant}
              />
              {vm.specialInstructions && (
                <p className="m-0 mt-2 whitespace-pre-line text-[13px] leading-[1.5] text-foreground">
                  {vm.specialInstructions}
                </p>
              )}
            </section>
          )}

          {propertyTags.length > 0 && (
            <section>
              <SectionTitle>{t('serviceRequests.sections.property')}</SectionTitle>
              <div className="flex flex-wrap gap-1">
                {propertyTags.map((tag) => (
                  <StatusChip
                    key={tag.label}
                    icon={tag.icon}
                    label={tag.label}
                    tokens={PROPERTY_TAG_TOKENS}
                    className={PROPERTY_TAG_CLASS}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="min-w-0 flex-[1_1_100%] min-[900px]:flex-[5]">
          {(vm.requestor || vm.assignee) && (
            <section className="mb-6">
              <SectionTitle>{t('serviceRequests.peopleInvolved')}</SectionTitle>
              <ItemGroup>
                {vm.requestor && (
                  <Item size="sm" className="px-0">
                    <ItemMedia>
                      <Avatar className="size-8">
                        <AvatarFallback className="text-2xs">{initialsOf(vm.requestor.name)}</AvatarFallback>
                      </Avatar>
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{vm.requestor.name}</ItemTitle>
                      <ItemDescription>
                        {[t('serviceRequests.fields.requestor'), vm.requestor.email].filter(Boolean).join(' · ')}
                      </ItemDescription>
                    </ItemContent>
                    {vm.requestor.roleLabel && (
                      <ItemActions>
                        <Badge variant="outline" className="h-[18px] px-1 text-[0.5625rem]">
                          {vm.requestor.roleLabel}
                        </Badge>
                      </ItemActions>
                    )}
                  </Item>
                )}
                {vm.assignee && (
                  <Item size="sm" className="px-0">
                    <ItemMedia>
                      <Avatar className="size-8">
                        <AvatarFallback className="text-2xs">
                          {vm.assignee.name ? initialsOf(vm.assignee.name) : '—'}
                        </AvatarFallback>
                      </Avatar>
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>
                        {vm.assignee.name ?? (
                          <span className="italic text-faint">{t('serviceRequests.fields.noAssignment')}</span>
                        )}
                      </ItemTitle>
                      <ItemDescription>
                        {[t('serviceRequests.assignedTo'), vm.assignee.email].filter(Boolean).join(' · ')}
                      </ItemDescription>
                    </ItemContent>
                    {vm.assignee.typeLabel && (
                      <ItemActions>
                        <StatusChip
                          tone={vm.assignee.type === 'team' ? 'info' : 'neutral'}
                          label={vm.assignee.typeLabel}
                          size="sm"
                        />
                      </ItemActions>
                    )}
                  </Item>
                )}
              </ItemGroup>
            </section>
          )}

          <section>
            <SectionTitle>{t('serviceRequests.layout.timeDetail', 'Détail du temps')}</SectionTitle>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              {vm.property.cleaningDurationMinutes != null && vm.property.cleaningDurationMinutes > 0 && (
                <>
                  <dt className="text-2xs font-semibold uppercase tracking-[.05em] text-faint">
                    {t('serviceRequests.layout.propertyCleaningDuration', 'Durée ménage (propriété)')}
                  </dt>
                  <dd className="m-0 text-[13px] tabular-nums text-foreground">
                    {vm.property.cleaningDurationMinutes >= 60
                      ? `${Math.floor(vm.property.cleaningDurationMinutes / 60)}h${vm.property.cleaningDurationMinutes % 60 > 0 ? String(vm.property.cleaningDurationMinutes % 60).padStart(2, '0') : ''}`
                      : `${vm.property.cleaningDurationMinutes} min`}
                  </dd>
                </>
              )}
              {vm.extraTimeRows?.map((row) => (
                <React.Fragment key={`time-row-${row.label}`}>
                  <dt className="text-2xs font-semibold uppercase tracking-[.05em] text-faint">{row.label}</dt>
                  <dd className="m-0 text-[13px] tabular-nums text-foreground">{row.value}</dd>
                </React.Fragment>
              ))}
              {vm.createdAt && (
                <>
                  <dt className="text-2xs font-semibold uppercase tracking-[.05em] text-faint">
                    {t('serviceRequests.createdAtLabel')}
                  </dt>
                  <dd className="m-0 text-[13px] tabular-nums text-foreground">{formatDateTime(vm.createdAt)}</dd>
                </>
              )}
            </dl>
          </section>
        </div>
      </div>

      {extraSection}
    </div>
  );
};

export default WorkOrderDetailLayout;
