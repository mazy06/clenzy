import React from 'react';
import { Badge } from '../../components/ui';
import StatusChip from '../../components/StatusChip';
import { cn } from '../../utils/cn';
import {
  Grid,
  Paper,
  Divider,
  LinearProgress,
  Tooltip,
} from '@mui/material';
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

// ─── Stable sx constants (tokens DESIGN_BASELINE) ───────────────────────────

const CARD_SX = {
  border: '1px solid var(--line)',
  bgcolor: 'var(--card)',
  boxShadow: 'none',
  borderRadius: '14px',
  p: 2,
} as const;

const SECTION_TITLE_SX = {
  fontSize: '10.5px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.05em',
  color: 'var(--faint)',
  mb: 1.5,
} as const;

/** Report en classes de `SECTION_TITLE_SX`. */
const SECTION_TITLE_CLASS = 'text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)] mb-[9px]';

const INFO_LABEL_SX = {
  fontSize: '11px',
  fontWeight: 500,
  color: 'var(--muted)',
} as const;

/** Report en classes de `INFO_LABEL_SX`. */
const INFO_LABEL_CLASS = 'text-[11px] font-medium text-[var(--muted)]';

const INFO_VALUE_SX = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--ink)',
  mt: '1px',
} as const;

/** Report en classes de `INFO_VALUE_SX`. */
const INFO_VALUE_CLASS = 'text-[13px] font-semibold text-[var(--ink)] mt-px';

const METRIC_VALUE_SX = {
  fontSize: '15px',
  fontWeight: 600,
  color: 'var(--ink)',
  lineHeight: 1.2,
  fontFamily: 'var(--font-display)',
  fontVariantNumeric: 'tabular-nums',
} as const;

/** Report en classes de `METRIC_VALUE_SX`. */
const METRIC_VALUE_CLASS =
  'text-[15px] font-semibold text-[var(--ink)] leading-[1.2] font-[family-name:var(--font-display)] tabular-nums';

const METRIC_LABEL_SX = {
  fontSize: '10.5px',
  fontWeight: 700,
  color: 'var(--faint)',
  textTransform: 'uppercase',
  letterSpacing: '.05em',
  mt: 0.25,
} as const;

/** Report en classes de `METRIC_LABEL_SX`. */
const METRIC_LABEL_CLASS = 'text-[10.5px] font-bold text-[var(--faint)] uppercase tracking-[.05em] mt-[1.5px]';

/**
 * Puce « caracteristique du logement » : encre de corps sur fond de champ,
 * cernee d'une hairline. Ce n'est pas un statut — la bordure vient donc d'une
 * classe, pas de la recette `-soft` de la primitive.
 *
 * `border-solid` est indispensable : le gabarit pose `border-none`
 * (border-STYLE), que tailwind-merge ne considere pas en conflit avec `border`
 * (border-WIDTH) — sans lui le lisere reste invisible.
 */
const PROPERTY_TAG_TOKENS = { color: 'var(--body)', bg: 'var(--field)' } as const;
const PROPERTY_TAG_CLASS =
  'h-[26px] font-medium border border-solid border-[var(--field-line)] [&>svg]:text-[var(--accent)]';

// ─── Type icon helper ────────────────────────────────────────────────────────

function getTypeIcon(type: string) {
  const iconProps = { size: 18, color: 'var(--accent)', strokeWidth: 1.75 };
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

function getStatusProgressColor(status: string): 'primary' | 'success' | 'error' | 'info' {
  const upper = status?.toUpperCase() || '';
  if (upper === 'COMPLETED') return 'success';
  if (upper === 'CANCELLED' || upper === 'REJECTED') return 'error';
  if (upper === 'IN_PROGRESS') return 'info';
  return 'primary';
}

/**
 * La palette `LinearProgress color=...` reste un nom MUI, mais le texte l'a
 * besoin en VRAIE valeur CSS : hors de `sx`, `'success.main'` n'est plus resolu
 * par le theme et la declaration serait jetee sans erreur. Les ponts `--mui-*`
 * suivent deja le mode clair/sombre.
 */
const PROGRESS_TONE_VAR: Record<'primary' | 'success' | 'error' | 'info', string> = {
  primary: 'var(--mui-primary)',
  success: 'var(--ok)',
  error: 'var(--err)',
  info: 'var(--info)',
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
  /** Couleur de l'icône et de la valeur. Default --accent / --ink. */
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
}) => {
  const { t } = useTranslation();

  const statusProgress = getStatusProgress(vm.status);
  const statusProgressColor = getStatusProgressColor(vm.status);
  const statusToneColor = PROGRESS_TONE_VAR[statusProgressColor];
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

  return (
    <div className="pt-1.5 flex-1 min-h-0 overflow-auto">

      {/* ── Status progress bar ──────────────────────────────────────── */}
      <Paper sx={{ ...CARD_SX, p: 1.5, mb: 1.5 }}>
        <div className="flex items-center justify-between mb-1">
          <p className={cn(SECTION_TITLE_CLASS, 'cn-text-body1 mb-0')}>
            {t('serviceRequests.details.progression')}
          </p>
          <p className="cn-text-body1 text-[12px] font-bold" style={{ color: statusToneColor }}>
            {vm.statusLabel}
          </p>
        </div>
        <LinearProgress
          variant="determinate"
          value={statusProgress}
          color={statusProgressColor}
          sx={{ height: 6, borderRadius: 3, bgcolor: 'var(--field)' }}
        />
        <div className="flex justify-between mt-0.5">
          {progressSteps.map((label, i) => (
            <p className={cn('cn-text-body1 text-[10px]', statusProgress >= PROGRESS_VALUES[i] ? 'font-semibold' : 'font-normal')} style={{ color: statusProgress >= PROGRESS_VALUES[i] ? statusToneColor : 'var(--faint)' }} key={label}>
              {label}
            </p>
          ))}
        </div>
      </Paper>

      {/* ── Key metrics grid ─────────────────────────────────────────── */}
      <Grid container spacing={1} sx={{ mb: 1.5 }}>
        <Grid item xs={6} sm={4} md={2}>
          <div className="p-[9px] flex flex-col items-center text-center border border-solid border-[var(--line)] bg-[var(--card)] rounded-[14px] shadow-none min-h-[72px] justify-center">
            {getTypeIcon(vm.type)}
            <p className={cn(METRIC_VALUE_CLASS, 'cn-text-body1 text-[12px]')}>
              {getInterventionTypeLabel(vm.type, t)}
            </p>
            <p className={cn(METRIC_LABEL_CLASS, 'cn-text-body1')}>{t('common.type')}</p>
          </div>
        </Grid>
        {vm.estimatedDurationHours != null && (
          <Grid item xs={6} sm={4} md={2}>
            <div className="p-[9px] flex flex-col items-center text-center border border-solid border-[var(--line)] bg-[var(--card)] rounded-[14px] shadow-none min-h-[72px] justify-center">
              <span className="inline-flex text-[var(--accent)] mb-0.5"><AccessTime size={18} strokeWidth={1.75} /></span>
              <p className={cn(METRIC_VALUE_CLASS, 'cn-text-body1')}>
                {formatDuration(vm.estimatedDurationHours)}
              </p>
              <p className={cn(METRIC_LABEL_CLASS, 'cn-text-body1')}>{t('serviceRequests.estimatedDurationLabel')}</p>
            </div>
          </Grid>
        )}
        <Grid item xs={6} sm={4} md={2}>
          <div className="p-[9px] flex flex-col items-center text-center border border-solid border-[var(--line)] bg-[var(--card)] rounded-[14px] shadow-none min-h-[72px] justify-center">
            <span className="inline-flex text-[var(--accent)] mb-0.5"><CalendarToday size={18} strokeWidth={1.75} /></span>
            <p className={cn(METRIC_VALUE_CLASS, 'cn-text-body1 text-[12px]')}>
              {formatDateTime(vm.dueDate) || '—'}
            </p>
            <p className={cn(METRIC_LABEL_CLASS, 'cn-text-body1')}>{t('serviceRequests.dueDateShort')}</p>
          </div>
        </Grid>
        {vm.estimatedCost != null && (
          <Grid item xs={6} sm={4} md={2}>
            <div className="p-[9px] flex flex-col items-center text-center border border-solid border-[var(--line)] bg-[var(--card)] rounded-[14px] shadow-none min-h-[72px] justify-center">
              <span className="inline-flex text-[var(--accent)] mb-0.5"><Euro size={18} strokeWidth={1.75} /></span>
              <p className={cn(METRIC_VALUE_CLASS, 'cn-text-body1')}>
                <Money value={vm.estimatedCost} from="EUR" />
              </p>
              <p className={cn(METRIC_LABEL_CLASS, 'cn-text-body1')}>{t('serviceRequests.details.estimatedCost')}</p>
              {/* Moteur Ménage 2A : écart vs barème conseil (snapshot recommended_cost). */}
              {vm.recommendedCost != null && vm.recommendedCost > 0 && (() => {
                const delta = vm.estimatedCost! - vm.recommendedCost!;
                const conform = Math.abs(delta) <= 5;
                const deltaPct = Math.round((delta / vm.recommendedCost!) * 100);
                const label = conform
                  ? t('workOrders.recommended.conform')
                  : `${deltaPct > 0 ? '+' : ''}${deltaPct} % ${t('workOrders.recommended.vsScale')}`;
                return (
                  <Tooltip title={`${t('workOrders.recommended.scale')} : ${vm.recommendedCost} €`} arrow>
                    <span
                      className={cn(
                        'mt-[3px] text-[10px] font-bold rounded-[7px] px-1.5 py-px whitespace-nowrap cursor-default tabular-nums',
                        conform
                          ? 'text-[var(--ok,_#4A9B8E)] bg-[color-mix(in_srgb,_var(--ok,_#4A9B8E)_12%,_transparent)]'
                          : 'text-[var(--muted)] bg-[var(--field)] border border-solid border-[var(--field-line)]',
                      )}
                    >
                      {label}
                    </span>
                  </Tooltip>
                );
              })()}
            </div>
          </Grid>
        )}
        {vm.actualCost != null && vm.actualCost > 0 && (
          <Grid item xs={6} sm={4} md={2}>
            <div className="p-[9px] flex flex-col items-center text-center border border-solid border-[var(--line)] bg-[var(--card)] rounded-[14px] shadow-none min-h-[72px] justify-center">
              <span className="inline-flex text-[var(--ok)] mb-0.5"><AttachMoney size={18} strokeWidth={1.75} /></span>
              <p className={cn(METRIC_VALUE_CLASS, 'cn-text-body1 text-[var(--ok)]')}>
                <Money value={vm.actualCost} from="EUR" />
              </p>
              <p className={cn(METRIC_LABEL_CLASS, 'cn-text-body1')}>{t('serviceRequests.details.actualCost')}</p>
            </div>
          </Grid>
        )}
        {vm.createdAt && (
          <Grid item xs={6} sm={4} md={2}>
            <div className="p-[9px] flex flex-col items-center text-center border border-solid border-[var(--line)] bg-[var(--card)] rounded-[14px] shadow-none min-h-[72px] justify-center">
              <span className="inline-flex text-[var(--accent)] mb-0.5"><Schedule size={18} strokeWidth={1.75} /></span>
              <p className={cn(METRIC_VALUE_CLASS, 'cn-text-body1 text-[12px]')}>
                {formatDateTime(vm.createdAt)}
              </p>
              <p className={cn(METRIC_LABEL_CLASS, 'cn-text-body1')}>{t('serviceRequests.createdDateShort')}</p>
            </div>
          </Grid>
        )}
        {vm.extraMetrics?.map((m) => (
          <Grid item xs={6} sm={4} md={2} key={`extra-metric-${m.label}`}>
            <div className="p-[9px] flex flex-col items-center text-center border border-solid border-[var(--line)] bg-[var(--card)] rounded-[14px] shadow-none min-h-[72px] justify-center">
              <span className="inline-flex mb-[1.5px]" style={{ color: m.tone ?? 'var(--accent)' }}>{m.icon}</span>
              {/* `m.tone` est une valeur d'execution : elle ne peut pas donner
                  naissance a une classe Tailwind, d'ou le style inline. */}
              <p className={cn(METRIC_VALUE_CLASS, 'cn-text-body1 text-[12px]')} style={m.tone ? { color: m.tone } : undefined}>
                {m.value}
              </p>
              <p className={cn(METRIC_LABEL_CLASS, 'cn-text-body1')}>{m.label}</p>
            </div>
          </Grid>
        ))}
      </Grid>

      {/* ── Two-column detail layout ────────────────────────────────── */}
      <div className="flex flex-wrap min-[900px]:flex-nowrap gap-[9px] mb-[9px]">
        {/* ── Left column ──────────────────────────────────────────── */}
        <div className="flex-[1_1_100%] min-[900px]:flex-[7] min-w-0 flex flex-col gap-[9px]">

          {/* Description */}
          {vm.description && (
            <Paper sx={CARD_SX}>
              <p className={cn(SECTION_TITLE_CLASS, 'cn-text-body1')}>
                <Description size={14} strokeWidth={1.75} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                {t('serviceRequests.fields.detailedDescription')}
              </p>
              <div className="flex items-start gap-1.5">
                {vm.importSource && ICAL_SOURCE_LOGOS[vm.importSource.toLowerCase()] && (
                  <div className="w-[22px] h-[22px] min-w-[22px] rounded-[50%] border-[1.5px] border-solid border-[var(--line)] bg-[#fff] flex items-center justify-center shrink-0 mt-[1.5px]">
                    <img
                      src={ICAL_SOURCE_LOGOS[vm.importSource.toLowerCase()]}
                      alt={vm.importSource}
                      width={15}
                      height={15}
                      style={{ objectFit: 'contain', borderRadius: '50%' }}
                    />
                  </div>
                )}
                <p className="cn-text-body1 text-[13px] text-[var(--body)] leading-[1.6] whitespace-pre-line">
                  {vm.description}
                </p>
              </div>
            </Paper>
          )}

          {/* Propriété */}
          <Paper sx={CARD_SX}>
            <div className="flex items-center justify-between mb-1.5">
              <p className={cn(SECTION_TITLE_CLASS, 'cn-text-body1 mb-0')}>
                <Home size={14} strokeWidth={1.75} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                {t('serviceRequests.sections.property')}
              </p>
              {propertyAction}
            </div>

            <div className="flex items-center gap-1.5 py-[4.5px]">
              <span className="inline-flex text-[var(--muted)]"><LocationOn size={16} strokeWidth={1.75} /></span>
              <div className="flex-1">
                <p className={cn(INFO_LABEL_CLASS, 'cn-text-body1')}>{t('serviceRequests.propertyNameLabel')}</p>
                <p className={cn(INFO_VALUE_CLASS, 'cn-text-body1')}>{p.name}</p>
              </div>
            </div>

            {(p.address || p.city) && (
              <>
                <Divider sx={{ my: 0.5 }} />
                <div className="flex items-center gap-1.5 py-[4.5px]">
                  <span className="inline-flex text-[var(--muted)]"><LocationOn size={16} strokeWidth={1.75} /></span>
                  <div className="flex-1">
                    <p className={cn(INFO_LABEL_CLASS, 'cn-text-body1')}>{t('serviceRequests.fullAddressLabel')}</p>
                    <p className={cn(INFO_VALUE_CLASS, 'cn-text-body1')}>{addressLine}</p>
                  </div>
                </div>
              </>
            )}

            {p.country && (
              <>
                <Divider sx={{ my: 0.5 }} />
                <div className="flex items-center gap-1.5 py-[4.5px]">
                  <span className="inline-flex text-[var(--muted)]"><Flag size={16} strokeWidth={1.75} /></span>
                  <div className="flex-1">
                    <p className={cn(INFO_LABEL_CLASS, 'cn-text-body1')}>{t('properties.country')}</p>
                    <p className={cn(INFO_VALUE_CLASS, 'cn-text-body1')}>{p.country}</p>
                  </div>
                </div>
              </>
            )}

            {propertyTags.length > 0 && (
              <>
                <Divider sx={{ my: 0.75 }} />
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
          </Paper>

          {/* Notes et Consignes */}
          {hasNotesSection && (
            <Paper sx={CARD_SX}>
              <p className={cn(SECTION_TITLE_CLASS, 'cn-text-body1 mb-[9px]')}>
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
                  <p className="cn-text-body1 text-[11px] font-semibold text-[var(--muted)] mb-0.5">
                    {t('serviceRequests.details.specialInstructions')}
                  </p>
                  <p className="cn-text-body1 text-[13px] text-[var(--body)] leading-[1.5] whitespace-pre-line bg-[var(--field)] p-2 rounded-[9px] border border-[var(--field-line)]">
                    {vm.specialInstructions}
                  </p>
                </div>
              )}

              {vm.accessNotes && (
                <div className="mt-2">
                  <p className="cn-text-body1 text-[11px] font-semibold text-[var(--muted)] mb-0.5">
                    <VpnKey size={12} strokeWidth={1.75} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    {t('serviceRequests.details.accessNotes')}
                  </p>
                  <p className="cn-text-body1 text-[13px] text-[var(--body)] leading-[1.5] whitespace-pre-line bg-[var(--warn-soft)] p-[7.5px] rounded-[9px] border border-solid border-[color-mix(in_srgb,_var(--warn)_30%,_transparent)]">
                    {vm.accessNotes}
                  </p>
                </div>
              )}
            </Paper>
          )}
        </div>

        {/* ── Right column ─────────────────────────────────────────── */}
        <div className="flex-[1_1_100%] min-[900px]:flex-[5] min-w-0 flex flex-col gap-[9px]">

          {/* Personnes impliquées */}
          {(vm.requestor || vm.assignee) && (
            <Paper sx={CARD_SX}>
              <p className={cn(SECTION_TITLE_CLASS, 'cn-text-body1')}>
                {t('serviceRequests.peopleInvolved')}
              </p>

              {vm.requestor && (
                <div className="flex items-center gap-1.5 py-[4.5px]">
                  <span className="inline-flex text-[var(--muted)]"><Person size={16} strokeWidth={1.75} /></span>
                  <div className="flex-1">
                    <p className={cn(INFO_LABEL_CLASS, 'cn-text-body1')}>{t('serviceRequests.fields.requestor')}</p>
                    <div className="flex items-center gap-1">
                      <p className={cn(INFO_VALUE_CLASS, 'cn-text-body1')}>{vm.requestor.name}</p>
                      {vm.requestor.roleLabel && (
                        <Badge variant="outline" className="h-[18px] text-[0.5625rem] px-0.5">{vm.requestor.roleLabel}</Badge>
                      )}
                    </div>
                    {vm.requestor.email && (
                      <p className="cn-text-body1 text-[11px] text-[var(--muted)]">
                        {vm.requestor.email}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {vm.requestor && vm.assignee && <Divider sx={{ my: 0.5 }} />}

              {vm.assignee && (
                <div className="flex items-center gap-1.5 py-[4.5px]">
                  {vm.assignee.type === 'team' ? (
                    <span className="inline-flex text-[var(--muted)]"><Group size={16} strokeWidth={1.75} /></span>
                  ) : (
                    <span className="inline-flex text-[var(--muted)]"><Assignment size={16} strokeWidth={1.75} /></span>
                  )}
                  <div className="flex-1">
                    <p className={cn(INFO_LABEL_CLASS, 'cn-text-body1')}>{t('serviceRequests.assignedTo')}</p>
                    {vm.assignee.name ? (
                      <div className="flex items-center gap-1">
                        <p className={cn(INFO_VALUE_CLASS, 'cn-text-body1')}>{vm.assignee.name}</p>
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
                      <p className={cn(INFO_VALUE_CLASS, 'cn-text-body1 text-[var(--faint)] italic')}>
                        {t('serviceRequests.fields.noAssignment')}
                      </p>
                    )}
                    {vm.assignee.email && vm.assignee.type === 'user' && (
                      <p className="cn-text-body1 text-[11px] text-[var(--muted)]">
                        {vm.assignee.email}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </Paper>
          )}

          {/* Détail du temps */}
          <Paper sx={CARD_SX}>
            <p className={cn(SECTION_TITLE_CLASS, 'cn-text-body1')}>
              <AccessTime size={14} strokeWidth={1.75} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              {t('serviceRequests.layout.timeDetail', 'Détail du temps')}
            </p>

            <div className="flex items-center gap-1.5 py-[4.5px]">
              <span className="inline-flex text-[var(--muted)]"><CalendarToday size={16} strokeWidth={1.75} /></span>
              <div className="flex-1">
                <p className={cn(INFO_LABEL_CLASS, 'cn-text-body1')}>{t('serviceRequests.dueDateLabel')}</p>
                <p className={cn(INFO_VALUE_CLASS, 'cn-text-body1')}>{formatDateTime(vm.dueDate) || '—'}</p>
              </div>
            </div>

            {vm.estimatedDurationHours != null && (
              <>
                <Divider sx={{ my: 0.5 }} />
                <div className="flex items-center gap-1.5 py-[4.5px]">
                  <span className="inline-flex text-[var(--muted)]"><Schedule size={16} strokeWidth={1.75} /></span>
                  <div className="flex-1">
                    <p className={cn(INFO_LABEL_CLASS, 'cn-text-body1')}>{t('serviceRequests.estimatedDurationLabel')}</p>
                    <p className={cn(INFO_VALUE_CLASS, 'cn-text-body1')}>{formatDuration(vm.estimatedDurationHours)}</p>
                  </div>
                </div>
              </>
            )}

            {vm.property.cleaningDurationMinutes != null && vm.property.cleaningDurationMinutes > 0 && (
              <>
                <Divider sx={{ my: 0.5 }} />
                <div className="flex items-center gap-1.5 py-[4.5px]">
                  <span className="inline-flex text-[var(--muted)]"><Schedule size={16} strokeWidth={1.75} /></span>
                  <div className="flex-1">
                    <p className={cn(INFO_LABEL_CLASS, 'cn-text-body1')}>{t('serviceRequests.layout.propertyCleaningDuration', 'Durée ménage (propriété)')}</p>
                    <p className={cn(INFO_VALUE_CLASS, 'cn-text-body1')}>
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
                <Divider sx={{ my: 0.5 }} />
                <div className="flex items-center gap-1.5 py-[4.5px]">
                  <span className="inline-flex text-[var(--muted)]">{row.icon}</span>
                  <div className="flex-1">
                    <p className={cn(INFO_LABEL_CLASS, 'cn-text-body1')}>{row.label}</p>
                    <p className={cn(INFO_VALUE_CLASS, 'cn-text-body1')}>{row.value}</p>
                  </div>
                </div>
              </React.Fragment>
            ))}

            {vm.createdAt && (
              <>
                <Divider sx={{ my: 0.5 }} />
                <div className="flex items-center gap-1.5 py-[4.5px]">
                  <span className="inline-flex text-[var(--muted)]"><CalendarMonth size={16} strokeWidth={1.75} /></span>
                  <div className="flex-1">
                    <p className={cn(INFO_LABEL_CLASS, 'cn-text-body1')}>{t('serviceRequests.createdDateLabel')}</p>
                    <p className={cn(INFO_VALUE_CLASS, 'cn-text-body1')}>{formatDateTime(vm.createdAt)}</p>
                  </div>
                </div>
              </>
            )}
          </Paper>
        </div>
      </div>

      {/* ── Extra rich section (ex: intervention stepper) ─────────────── */}
      {extraSection}
    </div>
  );
};

export default WorkOrderDetailLayout;
