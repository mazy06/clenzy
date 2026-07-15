import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Chip,
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
import clenzyLogo from '../../assets/logo/clenzy-logo.svg';

const ICAL_SOURCE_LOGOS: Record<string, string> = {
  airbnb: airbnbLogoSmall,
  'booking.com': bookingLogoSmall,
  booking: bookingLogoSmall,
  vrbo: homeAwayLogo,
  homeaway: homeAwayLogo,
  expedia: expediaLogo,
  leboncoin: leboncoinLogo,
  direct: clenzyLogo,
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

const INFO_ROW_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  py: 0.75,
} as const;

const INFO_LABEL_SX = {
  fontSize: '11px',
  fontWeight: 500,
  color: 'var(--muted)',
} as const;

const INFO_VALUE_SX = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--ink)',
  mt: '1px',
} as const;

const METRIC_CARD_SX = {
  p: 1.5,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  border: '1px solid var(--line)',
  bgcolor: 'var(--card)',
  borderRadius: '14px',
  boxShadow: 'none',
  minHeight: 72,
  justifyContent: 'center',
} as const;

const METRIC_VALUE_SX = {
  fontSize: '15px',
  fontWeight: 600,
  color: 'var(--ink)',
  lineHeight: 1.2,
  fontFamily: 'var(--font-display)',
  fontVariantNumeric: 'tabular-nums',
} as const;

const METRIC_LABEL_SX = {
  fontSize: '10.5px',
  fontWeight: 700,
  color: 'var(--faint)',
  textTransform: 'uppercase',
  letterSpacing: '.05em',
  mt: 0.25,
} as const;

const PROPERTY_TAG_SX = {
  height: 26,
  fontSize: '11px',
  fontWeight: 500,
  color: 'var(--body)',
  bgcolor: 'var(--field)',
  border: '1px solid var(--field-line)',
  '& .MuiChip-icon': { fontSize: 13, ml: 0.5, color: 'var(--accent)' },
  '& .MuiChip-label': { px: 0.75 },
} as const;

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
    <Box sx={{ pt: 1, flex: 1, minHeight: 0, overflow: 'auto' }}>

      {/* ── Status progress bar ──────────────────────────────────────── */}
      <Paper sx={{ ...CARD_SX, p: 1.5, mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
          <Typography sx={{ ...SECTION_TITLE_SX, mb: 0 }}>
            {t('serviceRequests.details.progression')}
          </Typography>
          <Typography sx={{ fontSize: '12px', fontWeight: 700, color: `${statusProgressColor}.main` }}>
            {vm.statusLabel}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={statusProgress}
          color={statusProgressColor}
          sx={{ height: 6, borderRadius: 3, bgcolor: 'var(--field)' }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          {progressSteps.map((label, i) => (
            <Typography key={label} sx={{ fontSize: '10px', color: statusProgress >= PROGRESS_VALUES[i] ? `${statusProgressColor}.main` : 'var(--faint)', fontWeight: statusProgress >= PROGRESS_VALUES[i] ? 600 : 400 }}>
              {label}
            </Typography>
          ))}
        </Box>
      </Paper>

      {/* ── Key metrics grid ─────────────────────────────────────────── */}
      <Grid container spacing={1} sx={{ mb: 1.5 }}>
        <Grid item xs={6} sm={4} md={2}>
          <Box sx={METRIC_CARD_SX}>
            {getTypeIcon(vm.type)}
            <Typography sx={{ ...METRIC_VALUE_SX, fontSize: '12px' }}>
              {getInterventionTypeLabel(vm.type, t)}
            </Typography>
            <Typography sx={METRIC_LABEL_SX}>{t('common.type')}</Typography>
          </Box>
        </Grid>
        {vm.estimatedDurationHours != null && (
          <Grid item xs={6} sm={4} md={2}>
            <Box sx={METRIC_CARD_SX}>
              <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)', mb: 0.25 }}><AccessTime size={18} strokeWidth={1.75} /></Box>
              <Typography sx={METRIC_VALUE_SX}>
                {formatDuration(vm.estimatedDurationHours)}
              </Typography>
              <Typography sx={METRIC_LABEL_SX}>{t('serviceRequests.estimatedDurationLabel')}</Typography>
            </Box>
          </Grid>
        )}
        <Grid item xs={6} sm={4} md={2}>
          <Box sx={METRIC_CARD_SX}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)', mb: 0.25 }}><CalendarToday size={18} strokeWidth={1.75} /></Box>
            <Typography sx={{ ...METRIC_VALUE_SX, fontSize: '12px' }}>
              {formatDateTime(vm.dueDate) || '—'}
            </Typography>
            <Typography sx={METRIC_LABEL_SX}>{t('serviceRequests.dueDateShort')}</Typography>
          </Box>
        </Grid>
        {vm.estimatedCost != null && (
          <Grid item xs={6} sm={4} md={2}>
            <Box sx={METRIC_CARD_SX}>
              <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)', mb: 0.25 }}><Euro size={18} strokeWidth={1.75} /></Box>
              <Typography sx={METRIC_VALUE_SX}>
                <Money value={vm.estimatedCost} from="EUR" />
              </Typography>
              <Typography sx={METRIC_LABEL_SX}>{t('serviceRequests.details.estimatedCost')}</Typography>
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
                    <Box
                      component="span"
                      sx={{
                        mt: 0.5,
                        fontSize: '10px',
                        fontWeight: 700,
                        borderRadius: '7px',
                        padding: '1px 6px',
                        whiteSpace: 'nowrap',
                        cursor: 'default',
                        fontVariantNumeric: 'tabular-nums',
                        ...(conform
                          ? { color: 'var(--ok, #4A9B8E)', backgroundColor: 'color-mix(in srgb, var(--ok, #4A9B8E) 12%, transparent)' }
                          : { color: 'var(--muted)', backgroundColor: 'var(--field)', border: '1px solid var(--field-line)' }),
                      }}
                    >
                      {label}
                    </Box>
                  </Tooltip>
                );
              })()}
            </Box>
          </Grid>
        )}
        {vm.actualCost != null && vm.actualCost > 0 && (
          <Grid item xs={6} sm={4} md={2}>
            <Box sx={METRIC_CARD_SX}>
              <Box component="span" sx={{ display: 'inline-flex', color: 'var(--ok)', mb: 0.25 }}><AttachMoney size={18} strokeWidth={1.75} /></Box>
              <Typography sx={{ ...METRIC_VALUE_SX, color: 'var(--ok)' }}>
                <Money value={vm.actualCost} from="EUR" />
              </Typography>
              <Typography sx={METRIC_LABEL_SX}>{t('serviceRequests.details.actualCost')}</Typography>
            </Box>
          </Grid>
        )}
        {vm.createdAt && (
          <Grid item xs={6} sm={4} md={2}>
            <Box sx={METRIC_CARD_SX}>
              <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)', mb: 0.25 }}><Schedule size={18} strokeWidth={1.75} /></Box>
              <Typography sx={{ ...METRIC_VALUE_SX, fontSize: '12px' }}>
                {formatDateTime(vm.createdAt)}
              </Typography>
              <Typography sx={METRIC_LABEL_SX}>{t('serviceRequests.createdDateShort')}</Typography>
            </Box>
          </Grid>
        )}
        {vm.extraMetrics?.map((m) => (
          <Grid item xs={6} sm={4} md={2} key={`extra-metric-${m.label}`}>
            <Box sx={METRIC_CARD_SX}>
              <Box component="span" sx={{ display: 'inline-flex', color: m.tone ?? 'var(--accent)', mb: 0.25 }}>{m.icon}</Box>
              <Typography sx={{ ...METRIC_VALUE_SX, fontSize: '12px', ...(m.tone ? { color: m.tone } : {}) }}>
                {m.value}
              </Typography>
              <Typography sx={METRIC_LABEL_SX}>{m.label}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      {/* ── Two-column detail layout ────────────────────────────────── */}
      <Box sx={{ display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, gap: 1.5, mb: 1.5 }}>
        {/* ── Left column ──────────────────────────────────────────── */}
        <Box sx={{ flex: { xs: '1 1 100%', md: 7 }, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

          {/* Description */}
          {vm.description && (
            <Paper sx={CARD_SX}>
              <Typography sx={SECTION_TITLE_SX}>
                <Description size={14} strokeWidth={1.75} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                {t('serviceRequests.fields.detailedDescription')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                {vm.importSource && ICAL_SOURCE_LOGOS[vm.importSource.toLowerCase()] && (
                  <Box
                    sx={{
                      width: 22,
                      height: 22,
                      minWidth: 22,
                      borderRadius: '50%',
                      border: '1.5px solid',
                      borderColor: 'var(--line)',
                      backgroundColor: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      mt: 0.25,
                    }}
                  >
                    <img
                      src={ICAL_SOURCE_LOGOS[vm.importSource.toLowerCase()]}
                      alt={vm.importSource}
                      width={15}
                      height={15}
                      style={{ objectFit: 'contain', borderRadius: '50%' }}
                    />
                  </Box>
                )}
                <Typography sx={{ fontSize: '13px', color: 'var(--body)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  {vm.description}
                </Typography>
              </Box>
            </Paper>
          )}

          {/* Propriété */}
          <Paper sx={CARD_SX}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={{ ...SECTION_TITLE_SX, mb: 0 }}>
                <Home size={14} strokeWidth={1.75} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                {t('serviceRequests.sections.property')}
              </Typography>
              {propertyAction}
            </Box>

            <Box sx={INFO_ROW_SX}>
              <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><LocationOn size={16} strokeWidth={1.75} /></Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={INFO_LABEL_SX}>{t('serviceRequests.propertyNameLabel')}</Typography>
                <Typography sx={INFO_VALUE_SX}>{p.name}</Typography>
              </Box>
            </Box>

            {(p.address || p.city) && (
              <>
                <Divider sx={{ my: 0.5 }} />
                <Box sx={INFO_ROW_SX}>
                  <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><LocationOn size={16} strokeWidth={1.75} /></Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={INFO_LABEL_SX}>{t('serviceRequests.fullAddressLabel')}</Typography>
                    <Typography sx={INFO_VALUE_SX}>{addressLine}</Typography>
                  </Box>
                </Box>
              </>
            )}

            {p.country && (
              <>
                <Divider sx={{ my: 0.5 }} />
                <Box sx={INFO_ROW_SX}>
                  <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><Flag size={16} strokeWidth={1.75} /></Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={INFO_LABEL_SX}>{t('properties.country')}</Typography>
                    <Typography sx={INFO_VALUE_SX}>{p.country}</Typography>
                  </Box>
                </Box>
              </>
            )}

            {propertyTags.length > 0 && (
              <>
                <Divider sx={{ my: 0.75 }} />
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                  {propertyTags.map((tag) => (
                    <Chip
                      key={tag.label}
                      icon={tag.icon}
                      label={tag.label}
                      size="small"
                      variant="outlined"
                      sx={PROPERTY_TAG_SX}
                    />
                  ))}
                </Box>
              </>
            )}
          </Paper>

          {/* Notes et Consignes */}
          {hasNotesSection && (
            <Paper sx={CARD_SX}>
              <Typography sx={{ ...SECTION_TITLE_SX, mb: 1.5 }}>
                <NoteAlt size={14} strokeWidth={1.75} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                {t('serviceRequests.details.notesInstructions')}
              </Typography>

              <DescriptionNotesDisplay
                description={p.description}
                notes={p.cleaningNotes}
                variant={consigneVariant}
              />

              {vm.specialInstructions && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography sx={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', mb: 0.5 }}>
                    {t('serviceRequests.details.specialInstructions')}
                  </Typography>
                  <Typography sx={{ fontSize: '13px', color: 'var(--body)', lineHeight: 1.5, whiteSpace: 'pre-line', bgcolor: 'var(--field)', p: 1.25, borderRadius: '9px', border: '1px solid var(--field-line)' }}>
                    {vm.specialInstructions}
                  </Typography>
                </Box>
              )}

              {vm.accessNotes && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography sx={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', mb: 0.5 }}>
                    <VpnKey size={12} strokeWidth={1.75} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    {t('serviceRequests.details.accessNotes')}
                  </Typography>
                  <Typography sx={{ fontSize: '13px', color: 'var(--body)', lineHeight: 1.5, whiteSpace: 'pre-line', bgcolor: 'var(--warn-soft)', p: 1.25, borderRadius: '9px', border: '1px solid color-mix(in srgb, var(--warn) 30%, transparent)' }}>
                    {vm.accessNotes}
                  </Typography>
                </Box>
              )}
            </Paper>
          )}
        </Box>

        {/* ── Right column ─────────────────────────────────────────── */}
        <Box sx={{ flex: { xs: '1 1 100%', md: 5 }, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

          {/* Personnes impliquées */}
          {(vm.requestor || vm.assignee) && (
            <Paper sx={CARD_SX}>
              <Typography sx={SECTION_TITLE_SX}>
                {t('serviceRequests.peopleInvolved')}
              </Typography>

              {vm.requestor && (
                <Box sx={INFO_ROW_SX}>
                  <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><Person size={16} strokeWidth={1.75} /></Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={INFO_LABEL_SX}>{t('serviceRequests.fields.requestor')}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography sx={INFO_VALUE_SX}>{vm.requestor.name}</Typography>
                      {vm.requestor.roleLabel && (
                        <Chip
                          label={vm.requestor.roleLabel}
                          size="small"
                          variant="outlined"
                          sx={{ height: 18, fontSize: '0.5625rem', '& .MuiChip-label': { px: 0.5 } }}
                        />
                      )}
                    </Box>
                    {vm.requestor.email && (
                      <Typography sx={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {vm.requestor.email}
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}

              {vm.requestor && vm.assignee && <Divider sx={{ my: 0.5 }} />}

              {vm.assignee && (
                <Box sx={INFO_ROW_SX}>
                  {vm.assignee.type === 'team' ? (
                    <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><Group size={16} strokeWidth={1.75} /></Box>
                  ) : (
                    <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><Assignment size={16} strokeWidth={1.75} /></Box>
                  )}
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={INFO_LABEL_SX}>{t('serviceRequests.assignedTo')}</Typography>
                    {vm.assignee.name ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Typography sx={INFO_VALUE_SX}>{vm.assignee.name}</Typography>
                        {vm.assignee.typeLabel && (
                          <Chip
                            label={vm.assignee.typeLabel}
                            size="small"
                            variant="outlined"
                            color={vm.assignee.type === 'team' ? 'info' : undefined}
                            sx={{ height: 20, fontSize: '0.6rem', '& .MuiChip-label': { px: 0.5 } }}
                          />
                        )}
                      </Box>
                    ) : (
                      <Typography sx={{ ...INFO_VALUE_SX, color: 'var(--faint)', fontStyle: 'italic' }}>
                        {t('serviceRequests.fields.noAssignment')}
                      </Typography>
                    )}
                    {vm.assignee.email && vm.assignee.type === 'user' && (
                      <Typography sx={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {vm.assignee.email}
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}
            </Paper>
          )}

          {/* Détail du temps */}
          <Paper sx={CARD_SX}>
            <Typography sx={SECTION_TITLE_SX}>
              <AccessTime size={14} strokeWidth={1.75} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              {t('serviceRequests.layout.timeDetail', 'Détail du temps')}
            </Typography>

            <Box sx={INFO_ROW_SX}>
              <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><CalendarToday size={16} strokeWidth={1.75} /></Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={INFO_LABEL_SX}>{t('serviceRequests.dueDateLabel')}</Typography>
                <Typography sx={INFO_VALUE_SX}>{formatDateTime(vm.dueDate) || '—'}</Typography>
              </Box>
            </Box>

            {vm.estimatedDurationHours != null && (
              <>
                <Divider sx={{ my: 0.5 }} />
                <Box sx={INFO_ROW_SX}>
                  <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><Schedule size={16} strokeWidth={1.75} /></Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={INFO_LABEL_SX}>{t('serviceRequests.estimatedDurationLabel')}</Typography>
                    <Typography sx={INFO_VALUE_SX}>{formatDuration(vm.estimatedDurationHours)}</Typography>
                  </Box>
                </Box>
              </>
            )}

            {vm.property.cleaningDurationMinutes != null && vm.property.cleaningDurationMinutes > 0 && (
              <>
                <Divider sx={{ my: 0.5 }} />
                <Box sx={INFO_ROW_SX}>
                  <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><Schedule size={16} strokeWidth={1.75} /></Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={INFO_LABEL_SX}>{t('serviceRequests.layout.propertyCleaningDuration', 'Durée ménage (propriété)')}</Typography>
                    <Typography sx={INFO_VALUE_SX}>
                      {vm.property.cleaningDurationMinutes >= 60
                        ? `${Math.floor(vm.property.cleaningDurationMinutes / 60)}h${vm.property.cleaningDurationMinutes % 60 > 0 ? String(vm.property.cleaningDurationMinutes % 60).padStart(2, '0') : ''}`
                        : `${vm.property.cleaningDurationMinutes} min`}
                    </Typography>
                  </Box>
                </Box>
              </>
            )}

            {vm.extraTimeRows?.map((row) => (
              <React.Fragment key={`time-row-${row.label}`}>
                <Divider sx={{ my: 0.5 }} />
                <Box sx={INFO_ROW_SX}>
                  <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}>{row.icon}</Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={INFO_LABEL_SX}>{row.label}</Typography>
                    <Typography sx={INFO_VALUE_SX}>{row.value}</Typography>
                  </Box>
                </Box>
              </React.Fragment>
            ))}

            {vm.createdAt && (
              <>
                <Divider sx={{ my: 0.5 }} />
                <Box sx={INFO_ROW_SX}>
                  <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><CalendarMonth size={16} strokeWidth={1.75} /></Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={INFO_LABEL_SX}>{t('serviceRequests.createdDateLabel')}</Typography>
                    <Typography sx={INFO_VALUE_SX}>{formatDateTime(vm.createdAt)}</Typography>
                  </Box>
                </Box>
              </>
            )}
          </Paper>
        </Box>
      </Box>

      {/* ── Extra rich section (ex: intervention stepper) ─────────────── */}
      {extraSection}
    </Box>
  );
};

export default WorkOrderDetailLayout;
