import React from 'react';
import {
  Badge,
  Progress,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import StatusChip from '../../components/StatusChip';
import StatTile from '../../components/baitly/StatTile';
import StatTileRow from '../../components/baitly/StatTileRow';
import { cn } from '../../utils/cn';
import {
  LocationOn,
  Person,
  Category,
  Schedule,
  CalendarToday,
  AccessTime,
  Assignment,
  AutoAwesome,
  Build,
  Group,
  Flag,
  Yard,
  BugReport,
  AutoFixHigh,
  Home,
  Bed,
  Bathtub,
  SquareFoot,
  People,
  Layers,
  Deck,
  LocalLaundryService,
  AttachMoney,
  Description,
  VpnKey,
  Euro,
  NoteAlt,
  CalendarMonth,
} from '../../icons';
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

/** Ligne supplémentaire dans la section « Détail du temps ». */
export interface WorkOrderTimeRow {
  icon: React.ReactNode;
  label: string;
  value: string;
}

export interface WorkOrderViewModel {
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

  const hasNotesSection = !!(p.description || p.cleaningNotes || vm.specialInstructions || vm.accessNotes);

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

  return (
    <div className="pt-1.5 flex-1 min-h-0 overflow-auto">

      {/* ── Status progress bar ──────────────────────────────────────── */}
      <div className={cn(CARD_CLASS, 'p-[9px] mb-[9px]')}>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <p className={cn(SECTION_TITLE_CLASS, 'mb-0')}>
            {t('serviceRequests.details.progression')}
          </p>
          {/* Statut et action groupes a droite : sans action, le statut garde
              exactement sa place d'avant. */}
          <div className="flex items-center gap-2">
            <p className="text-[12px] font-bold" style={{ color: statusTextColor }}>
              {vm.statusLabel}
            </p>
            {heroAction}
          </div>
        </div>
        {/* La teinte depend du statut (valeur d'execution) : elle transite par une
            variable CSS, une classe Tailwind ne pouvant pas naitre d'une variable. */}
        <Progress
          value={statusProgress}
          className="h-1.5 rounded-[3px] bg-field [&_[data-slot=progress-indicator]]:bg-[var(--wo-progress-tone)]"
          style={{ '--wo-progress-tone': statusBarColor } as React.CSSProperties}
        />
        <div className="flex justify-between mt-0.5">
          {progressSteps.map((label, i) => (
            <p className={cn('text-[10px]', statusProgress >= PROGRESS_VALUES[i] ? 'font-semibold' : 'font-normal')} style={{ color: statusProgress >= PROGRESS_VALUES[i] ? statusTextColor : 'var(--bui-faint)' }} key={label}>
              {label}
            </p>
          ))}
        </div>
      </div>

      {/* ── Rangee de tuiles ────────────────────────────────────────────
          `StatTileRow` + `StatTile` (kit Baitly) au lieu d'une grille 12
          colonnes redeclaree ici : sur telephone, la rangee DEFILE au lieu de
          s'empiler — quatre tuiles empilees mangeaient la moitie de l'ecran
          avant le premier contenu utile.

          Hierarchie : une tuile porte l'information qui commande l'action et se
          detache sur fond pastel — l'echeance tant que l'ordre est ouvert, le
          cout une fois qu'il est clos. Les autres restent neutres. C'est ce qui
          evite la « grille de cartes identiques » proscrite par le contrat. */}
      <StatTileRow className="mb-[9px]">
        <StatTile
          icon={getTypeIcon(vm.type)}
          label={t('common.type')}
          value={<span className="text-[15px]">{getInterventionTypeLabel(vm.type, t)}</span>}
          className={TILE_CLASS}
        />
        <StatTile
          icon={<CalendarToday />}
          label={t('serviceRequests.dueDateShort')}
          value={<span className="text-[15px]">{formatDateTime(vm.dueDate) || '—'}</span>}
          className={cn(TILE_CLASS, isHeroDueDate && HERO_TILE_CLASS)}
          iconClassName={isHeroDueDate ? 'text-primary' : undefined}
        />
        {vm.estimatedDurationHours != null && (
          <StatTile
            icon={<AccessTime />}
            label={t('serviceRequests.estimatedDurationLabel')}
            value={formatDuration(vm.estimatedDurationHours)}
            className={TILE_CLASS}
          />
        )}
        {costTile}
      </StatTileRow>

      {/* ── Two-column detail layout ────────────────────────────────── */}
      <div className="flex flex-wrap min-[900px]:flex-nowrap gap-[9px] mb-[9px]">
        {/* ── Left column ──────────────────────────────────────────── */}
        <div className="flex-[1_1_100%] min-[900px]:flex-[7] min-w-0 flex flex-col gap-[9px]">

          {/* Description */}
          {vm.description && (
            <div className={CARD_CLASS}>
              <p className={SECTION_TITLE_CLASS}>
                <Description size={14} strokeWidth={1.75} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                {t('serviceRequests.fields.detailedDescription')}
              </p>
              <div className="flex items-start gap-1.5">
                {vm.importSource && ICAL_SOURCE_LOGOS[vm.importSource.toLowerCase()] && (
                  <div className="size-[22px] min-w-[22px] rounded-full border-[1.5px] border-solid border-border bg-card flex items-center justify-center shrink-0 mt-[1.5px]">
                    <img
                      src={ICAL_SOURCE_LOGOS[vm.importSource.toLowerCase()]}
                      alt={vm.importSource}
                      width={15}
                      height={15}
                      style={{ objectFit: 'contain', borderRadius: '50%' }}
                    />
                  </div>
                )}
                <p className="text-[13px] text-foreground leading-[1.6] whitespace-pre-line">
                  {vm.description}
                </p>
              </div>
            </div>
          )}

          {/* Propriété */}
          <div className={CARD_CLASS}>
            <div className="flex items-center justify-between mb-1.5">
              <p className={cn(SECTION_TITLE_CLASS, 'mb-0')}>
                <Home size={14} strokeWidth={1.75} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                {t('serviceRequests.sections.property')}
              </p>
              {propertyAction}
            </div>

            <div className="flex items-center gap-1.5 py-[4.5px]">
              <span className="inline-flex text-muted-foreground"><LocationOn size={16} strokeWidth={1.75} /></span>
              <div className="flex-1">
                <p className={INFO_LABEL_CLASS}>{t('serviceRequests.propertyNameLabel')}</p>
                <p className={INFO_VALUE_CLASS}>{p.name}</p>
              </div>
            </div>

            {(p.address || p.city) && (
              <>
                <Separator className="my-[3px]" />
                <div className="flex items-center gap-1.5 py-[4.5px]">
                  <span className="inline-flex text-muted-foreground"><LocationOn size={16} strokeWidth={1.75} /></span>
                  <div className="flex-1">
                    <p className={INFO_LABEL_CLASS}>{t('serviceRequests.fullAddressLabel')}</p>
                    <p className={INFO_VALUE_CLASS}>{addressLine}</p>
                  </div>
                </div>
              </>
            )}

            {p.country && (
              <>
                <Separator className="my-[3px]" />
                <div className="flex items-center gap-1.5 py-[4.5px]">
                  <span className="inline-flex text-muted-foreground"><Flag size={16} strokeWidth={1.75} /></span>
                  <div className="flex-1">
                    <p className={INFO_LABEL_CLASS}>{t('properties.country')}</p>
                    <p className={INFO_VALUE_CLASS}>{p.country}</p>
                  </div>
                </div>
              </>
            )}

            {propertyTags.length > 0 && (
              <>
                <Separator className="my-[4.5px]" />
                <div className="flex flex-wrap gap-0.5 mt-0.5">
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
              </>
            )}
          </div>

          {/* Notes et Consignes */}
          {hasNotesSection && (
            <div className={CARD_CLASS}>
              <p className={SECTION_TITLE_CLASS}>
                <NoteAlt size={14} strokeWidth={1.75} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                {t('serviceRequests.details.notesInstructions')}
              </p>

              <DescriptionNotesDisplay
                description={p.description}
                notes={p.cleaningNotes}
                variant={consigneVariant}
              />

              {vm.specialInstructions && (
                <div className="mt-2">
                  <p className="text-[11px] font-semibold text-muted-foreground mb-0.5">
                    {t('serviceRequests.details.specialInstructions')}
                  </p>
                  <p className="text-[13px] text-foreground leading-[1.5] whitespace-pre-line bg-field p-2 rounded-md border border-solid border-field-line">
                    {vm.specialInstructions}
                  </p>
                </div>
              )}

              {vm.accessNotes && (
                <div className="mt-2">
                  <p className="text-[11px] font-semibold text-muted-foreground mb-0.5">
                    <VpnKey size={12} strokeWidth={1.75} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    {t('serviceRequests.details.accessNotes')}
                  </p>
                  <p className="text-[13px] text-foreground leading-[1.5] whitespace-pre-line bg-warning-soft p-[7.5px] rounded-md border border-solid border-warning/30">
                    {vm.accessNotes}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right column ─────────────────────────────────────────── */}
        <div className="flex-[1_1_100%] min-[900px]:flex-[5] min-w-0 flex flex-col gap-[9px]">

          {/* Personnes impliquées */}
          {(vm.requestor || vm.assignee) && (
            <div className={CARD_CLASS}>
              <p className={SECTION_TITLE_CLASS}>
                {t('serviceRequests.peopleInvolved')}
              </p>

              {vm.requestor && (
                <div className="flex items-center gap-1.5 py-[4.5px]">
                  <span className="inline-flex text-muted-foreground"><Person size={16} strokeWidth={1.75} /></span>
                  <div className="flex-1">
                    <p className={INFO_LABEL_CLASS}>{t('serviceRequests.fields.requestor')}</p>
                    <div className="flex items-center gap-1">
                      <p className={INFO_VALUE_CLASS}>{vm.requestor.name}</p>
                      {vm.requestor.roleLabel && (
                        <Badge variant="outline" className="h-[18px] text-[0.5625rem] px-0.5">{vm.requestor.roleLabel}</Badge>
                      )}
                    </div>
                    {vm.requestor.email && (
                      <p className="text-[11px] text-muted-foreground">
                        {vm.requestor.email}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {vm.requestor && vm.assignee && <Separator className="my-[3px]" />}

              {vm.assignee && (
                <div className="flex items-center gap-1.5 py-[4.5px]">
                  {vm.assignee.type === 'team' ? (
                    <span className="inline-flex text-muted-foreground"><Group size={16} strokeWidth={1.75} /></span>
                  ) : (
                    <span className="inline-flex text-muted-foreground"><Assignment size={16} strokeWidth={1.75} /></span>
                  )}
                  <div className="flex-1">
                    <p className={INFO_LABEL_CLASS}>{t('serviceRequests.assignedTo')}</p>
                    {vm.assignee.name ? (
                      <div className="flex items-center gap-1">
                        <p className={INFO_VALUE_CLASS}>{vm.assignee.name}</p>
                        {vm.assignee.typeLabel && (
                          <StatusChip
                            tone={vm.assignee.type === 'team' ? 'info' : 'neutral'}
                            label={vm.assignee.typeLabel}
                            size="sm"
                            className="h-[20px] text-[0.6rem]"
                          />
                        )}
                      </div>
                    ) : (
                      <p className={cn(INFO_VALUE_CLASS, 'text-faint italic')}>
                        {t('serviceRequests.fields.noAssignment')}
                      </p>
                    )}
                    {vm.assignee.email && vm.assignee.type === 'user' && (
                      <p className="text-[11px] text-muted-foreground">
                        {vm.assignee.email}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Détail du temps */}
          <div className={CARD_CLASS}>
            <p className={SECTION_TITLE_CLASS}>
              <AccessTime size={14} strokeWidth={1.75} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              {t('serviceRequests.layout.timeDetail', 'Détail du temps')}
            </p>

            <div className="flex items-center gap-1.5 py-[4.5px]">
              <span className="inline-flex text-muted-foreground"><CalendarToday size={16} strokeWidth={1.75} /></span>
              <div className="flex-1">
                <p className={INFO_LABEL_CLASS}>{t('serviceRequests.dueDateLabel')}</p>
                <p className={INFO_VALUE_CLASS}>{formatDateTime(vm.dueDate) || '—'}</p>
              </div>
            </div>

            {vm.estimatedDurationHours != null && (
              <>
                <Separator className="my-[3px]" />
                <div className="flex items-center gap-1.5 py-[4.5px]">
                  <span className="inline-flex text-muted-foreground"><Schedule size={16} strokeWidth={1.75} /></span>
                  <div className="flex-1">
                    <p className={INFO_LABEL_CLASS}>{t('serviceRequests.estimatedDurationLabel')}</p>
                    <p className={INFO_VALUE_CLASS}>{formatDuration(vm.estimatedDurationHours)}</p>
                  </div>
                </div>
              </>
            )}

            {vm.property.cleaningDurationMinutes != null && vm.property.cleaningDurationMinutes > 0 && (
              <>
                <Separator className="my-[3px]" />
                <div className="flex items-center gap-1.5 py-[4.5px]">
                  <span className="inline-flex text-muted-foreground"><Schedule size={16} strokeWidth={1.75} /></span>
                  <div className="flex-1">
                    <p className={INFO_LABEL_CLASS}>{t('serviceRequests.layout.propertyCleaningDuration', 'Durée ménage (propriété)')}</p>
                    <p className={INFO_VALUE_CLASS}>
                      {vm.property.cleaningDurationMinutes >= 60
                        ? `${Math.floor(vm.property.cleaningDurationMinutes / 60)}h${vm.property.cleaningDurationMinutes % 60 > 0 ? String(vm.property.cleaningDurationMinutes % 60).padStart(2, '0') : ''}`
                        : `${vm.property.cleaningDurationMinutes} min`}
                    </p>
                  </div>
                </div>
              </>
            )}

            {vm.extraTimeRows?.map((row) => (
              <React.Fragment key={`time-row-${row.label}`}>
                <Separator className="my-[3px]" />
                <div className="flex items-center gap-1.5 py-[4.5px]">
                  <span className="inline-flex text-muted-foreground">{row.icon}</span>
                  <div className="flex-1">
                    <p className={INFO_LABEL_CLASS}>{row.label}</p>
                    <p className={INFO_VALUE_CLASS}>{row.value}</p>
                  </div>
                </div>
              </React.Fragment>
            ))}

            {vm.createdAt && (
              <>
                <Separator className="my-[3px]" />
                <div className="flex items-center gap-1.5 py-[4.5px]">
                  <span className="inline-flex text-muted-foreground"><CalendarMonth size={16} strokeWidth={1.75} /></span>
                  <div className="flex-1">
                    <p className={INFO_LABEL_CLASS}>{t('serviceRequests.createdDateLabel')}</p>
                    <p className={INFO_VALUE_CLASS}>{formatDateTime(vm.createdAt)}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Extra rich section (ex: intervention stepper) ─────────────── */}
      {extraSection}
    </div>
  );
};

export default WorkOrderDetailLayout;
