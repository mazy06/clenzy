import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Skeleton,
  Alert,
  Button,
  Grid,
  Chip,
  Paper,
  Divider,
  LinearProgress,
} from '@mui/material';
import {
  Edit,
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
  CheckCircle,
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
  Gavel,
  Iron,
  Kitchen,
  Sanitizer,
  Window,
  DoorSliding,
  Login,
  Logout,
  CalendarMonth,
} from '../../icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useServiceRequestDetails } from '../../hooks/useServiceRequestDetails';
import type { ServiceRequestDetailsData } from '../../hooks/useServiceRequestDetails';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import { useCurrency } from '../../hooks/useCurrency';
import { formatDateTime, formatDuration } from '../../utils/formatUtils';
import DescriptionNotesDisplay from '../../components/DescriptionNotesDisplay';
import type { ConsigneVariant } from '../../components/DescriptionNotesDisplay';
import {
  getServiceRequestStatusLabel,
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

// Carte hairline plate (.pd-card) — r14, aucune ombre au repos.
const CARD_SX = {
  border: '1px solid var(--line)',
  bgcolor: 'var(--card)',
  boxShadow: 'none',
  borderRadius: '14px',
  p: 2,
} as const;

// Section overline 10.5 --faint.
const SECTION_TITLE_SX = {
  fontSize: '10.5px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.05em',
  color: 'var(--faint)',
  mb: 1.5,
} as const;

// .pd-kv — bloc label/valeur (label muted 11, valeur ink 13 fw600).
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

// Tuile métrique : carte plate hairline, valeur display tabular-nums, label overline.
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

const METRIC_ICON_SX = {
  fontSize: 18,
  color: 'var(--accent)',
  mb: 0.25,
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

// Chip neutre « champ » (.fr-chip) : fond --field, icône accent.
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

const ICON_SX = { fontSize: 16, color: 'var(--muted)' };

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
  if (upper === 'PREVENTIVE_MAINTENANCE') return <Build {...iconProps} />;
  if (upper === 'GARDENING') return <Yard {...iconProps} />;
  if (upper === 'PEST_CONTROL') return <BugReport {...iconProps} />;
  if (upper === 'RESTORATION') return <AutoFixHigh {...iconProps} />;
  return <Category {...iconProps} />;
}

// ─── Status progress helper ──────────────────────────────────────────────────

function getStatusProgress(status: string): number {
  const upper = status?.toUpperCase() || '';
  switch (upper) {
    case 'PENDING': return 15;
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

// ─── Service type → ConsigneVariant mapping ──────────────────────────────

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
    'RESTORATION',
  ];
  if (cleaningTypes.includes(upper)) return 'cleaning';
  if (maintenanceTypes.includes(upper)) return 'maintenance';
  return 'other';
}

// ─── Re-export type for backward compatibility ──────────────────────────────

export type { ServiceRequestDetailsData };

// ─── Main component ──────────────────────────────────────────────────────────

const ServiceRequestDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();
  const { t } = useTranslation();
  const { convertAndFormat } = useCurrency();

  const { serviceRequest, isLoading, isError, error } = useServiceRequestDetails(id);

  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    const checkPermissions = async () => {
      const canEditPermission = await hasPermissionAsync('service-requests:edit');
      setCanEdit(canEditPermission);
    };
    checkPermissions();
  }, [hasPermissionAsync]);

  if (isLoading) {
    // Skeletons calqués sur la structure (barre de progression + tuiles + 2 colonnes).
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Skeleton variant="rounded" height={64} sx={{ borderRadius: '14px' }} />
        <Box sx={{ display: 'flex', gap: 1 }}>
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} variant="rounded" height={72} sx={{ borderRadius: '14px', flex: 1 }} />
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Skeleton variant="rounded" height={260} sx={{ borderRadius: '14px', flex: 7 }} />
          <Skeleton variant="rounded" height={260} sx={{ borderRadius: '14px', flex: 5 }} />
        </Box>
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" sx={{ py: 0.75, fontSize: '0.8125rem' }}>
          {error || t('serviceRequests.loadError')}
        </Alert>
      </Box>
    );
  }

  if (!serviceRequest) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning" sx={{ py: 0.75, fontSize: '0.8125rem' }}>
          {t('serviceRequests.notFound')}
        </Alert>
      </Box>
    );
  }

  // ─── Computed values ────────────────────────────────────────────────────────

  const sr = serviceRequest;
  const statusProgress = getStatusProgress(sr.status);
  const statusProgressColor = getStatusProgressColor(sr.status);
  const consigneVariant = getConsigneVariant(sr.type);

  // Property tags
  const propertyTags: { icon: React.ReactElement; label: string }[] = [];
  if (sr.propertyType) propertyTags.push({ icon: <Category size={13} strokeWidth={1.75} />, label: getPropertyTypeLabel(sr.propertyType, t) });
  if (sr.propertySquareMeters) propertyTags.push({ icon: <SquareFoot size={13} strokeWidth={1.75} />, label: `${sr.propertySquareMeters} m²` });
  if (sr.propertyBedroomCount) propertyTags.push({ icon: <Bed size={13} strokeWidth={1.75} />, label: `${sr.propertyBedroomCount} ch.` });
  if (sr.propertyBathroomCount) propertyTags.push({ icon: <Bathtub size={13} strokeWidth={1.75} />, label: `${sr.propertyBathroomCount} SDB` });
  if (sr.propertyMaxGuests) propertyTags.push({ icon: <People size={13} strokeWidth={1.75} />, label: `${sr.propertyMaxGuests} voyag.` });
  if (sr.propertyNumberOfFloors && sr.propertyNumberOfFloors > 1) propertyTags.push({ icon: <Layers size={13} strokeWidth={1.75} />, label: `${sr.propertyNumberOfFloors} étages` });
  if (sr.propertyHasExterior) propertyTags.push({ icon: <Deck size={13} strokeWidth={1.75} />, label: 'Extérieur' });
  if (sr.propertyHasLaundry) propertyTags.push({ icon: <LocalLaundryService size={13} strokeWidth={1.75} />, label: 'Linge' });

  // Prestations à la carte
  const prestations: { icon: React.ReactElement; label: string; extraMins: number }[] = [];
  if (sr.propertyHasLaundry) prestations.push({ icon: <LocalLaundryService size={14} strokeWidth={1.75} />, label: 'Linge', extraMins: 10 });
  if (sr.propertyHasExterior) prestations.push({ icon: <Deck size={14} strokeWidth={1.75} />, label: 'Extérieur', extraMins: 25 });
  if (sr.propertyHasIroning) prestations.push({ icon: <Iron size={14} strokeWidth={1.75} />, label: 'Repassage', extraMins: 20 });
  if (sr.propertyHasDeepKitchen) prestations.push({ icon: <Kitchen size={14} strokeWidth={1.75} />, label: 'Cuisine profonde', extraMins: 30 });
  if (sr.propertyHasDisinfection) prestations.push({ icon: <Sanitizer size={14} strokeWidth={1.75} />, label: 'Désinfection', extraMins: 40 });
  if (sr.propertyWindowCount && sr.propertyWindowCount > 0) prestations.push({ icon: <Window size={14} strokeWidth={1.75} />, label: `Fenêtres (${sr.propertyWindowCount})`, extraMins: sr.propertyWindowCount * 5 });
  if (sr.propertyFrenchDoorCount && sr.propertyFrenchDoorCount > 0) prestations.push({ icon: <DoorSliding size={14} strokeWidth={1.75} />, label: `Portes-fenêtres (${sr.propertyFrenchDoorCount})`, extraMins: sr.propertyFrenchDoorCount * 8 });
  if (sr.propertySlidingDoorCount && sr.propertySlidingDoorCount > 0) prestations.push({ icon: <DoorSliding size={14} strokeWidth={1.75} />, label: `Baies vitrées (${sr.propertySlidingDoorCount})`, extraMins: sr.propertySlidingDoorCount * 12 });

  const hasCheckTimes = !!sr.guestCheckoutTime || !!sr.guestCheckinTime;

  const progressSteps = ['En attente', 'Approuvé', 'En cours', 'Terminé'];
  const progressValues = [15, 35, 70, 100];

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <Box sx={{ flexShrink: 0 }}>
        <PageHeader
          title={sr.title}
          subtitle={`${getInterventionTypeLabel(sr.type, t)} · ${sr.propertyName}`}
          backPath="/service-requests"
          actions={
            canEdit ? (
              <Button
                variant="outlined"
                startIcon={<Edit size={18} strokeWidth={1.75} />}
                onClick={() => navigate(`/service-requests/${id}/edit`)}
                size="small"
                title={t('serviceRequests.modify')}
              >
                {t('serviceRequests.modify')}
              </Button>
            ) : undefined
          }
        />
      </Box>

      {/* ─── Content ─────────────────────────────────────────────────────── */}
      <Box sx={{ pt: 1, flex: 1, minHeight: 0, overflow: 'auto' }}>

        {/* ── Status progress bar ──────────────────────────────────────── */}
        <Paper sx={{ ...CARD_SX, p: 1.5, mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography sx={{ ...SECTION_TITLE_SX, mb: 0 }}>
              {t('serviceRequests.details.progression')}
            </Typography>
            <Typography sx={{ fontSize: '12px', fontWeight: 700, color: `${statusProgressColor}.main` }}>
              {getServiceRequestStatusLabel(sr.status, t)}
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
              <Typography key={label} sx={{ fontSize: '10px', color: statusProgress >= progressValues[i] ? `${statusProgressColor}.main` : 'var(--faint)', fontWeight: statusProgress >= progressValues[i] ? 600 : 400 }}>
                {label}
              </Typography>
            ))}
          </Box>
        </Paper>

        {/* ── Key metrics grid ─────────────────────────────────────────── */}
        <Grid container spacing={1} sx={{ mb: 1.5 }}>
          <Grid item xs={6} sm={4} md={2}>
            <Box sx={METRIC_CARD_SX}>
              {getTypeIcon(sr.type)}
              <Typography sx={{ ...METRIC_VALUE_SX, fontSize: '12px' }}>
                {getInterventionTypeLabel(sr.type, t)}
              </Typography>
              <Typography sx={METRIC_LABEL_SX}>{t('common.type')}</Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Box sx={METRIC_CARD_SX}>
              <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)', mb: 0.25 }}><AccessTime size={18} strokeWidth={1.75} /></Box>
              <Typography sx={METRIC_VALUE_SX}>
                {formatDuration(sr.estimatedDuration)}
              </Typography>
              <Typography sx={METRIC_LABEL_SX}>{t('serviceRequests.estimatedDurationLabel')}</Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Box sx={METRIC_CARD_SX}>
              <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)', mb: 0.25 }}><CalendarToday size={18} strokeWidth={1.75} /></Box>
              <Typography sx={{ ...METRIC_VALUE_SX, fontSize: '12px' }}>
                {formatDateTime(sr.dueDate) || '—'}
              </Typography>
              <Typography sx={METRIC_LABEL_SX}>{t('serviceRequests.dueDateShort')}</Typography>
            </Box>
          </Grid>
          {sr.estimatedCost != null && (
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={METRIC_CARD_SX}>
                <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)', mb: 0.25 }}><Euro size={18} strokeWidth={1.75} /></Box>
                <Typography sx={METRIC_VALUE_SX}>
                  {convertAndFormat(sr.estimatedCost, 'EUR')}
                </Typography>
                <Typography sx={METRIC_LABEL_SX}>{t('serviceRequests.details.estimatedCost')}</Typography>
              </Box>
            </Grid>
          )}
          {sr.actualCost != null && (
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={METRIC_CARD_SX}>
                <Box component="span" sx={{ display: 'inline-flex', color: 'var(--ok)', mb: 0.25 }}><AttachMoney size={18} strokeWidth={1.75} /></Box>
                <Typography sx={{ ...METRIC_VALUE_SX, color: 'var(--ok)' }}>
                  {convertAndFormat(sr.actualCost, 'EUR')}
                </Typography>
                <Typography sx={METRIC_LABEL_SX}>{t('serviceRequests.details.actualCost')}</Typography>
              </Box>
            </Grid>
          )}
          <Grid item xs={6} sm={4} md={2}>
            <Box sx={METRIC_CARD_SX}>
              <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)', mb: 0.25 }}><Schedule size={18} strokeWidth={1.75} /></Box>
              <Typography sx={{ ...METRIC_VALUE_SX, fontSize: '12px' }}>
                {formatDateTime(sr.createdAt)}
              </Typography>
              <Typography sx={METRIC_LABEL_SX}>{t('serviceRequests.createdDateShort')}</Typography>
            </Box>
          </Grid>
        </Grid>

        {/* ── Two-column detail layout ────────────────────────────────── */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
          {/* ── Left column ──────────────────────────────────────────── */}
          <Box sx={{ flex: 7, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

            {/* Description */}
            {sr.description && (
              <Paper sx={CARD_SX}>
                <Typography sx={SECTION_TITLE_SX}>
                  <Description size={14} strokeWidth={1.75} style={{ marginRight: 4, verticalAlign: "middle" }} />
                  {t('serviceRequests.fields.detailedDescription')}
                </Typography>
                {/* Source logo + description text */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  {sr.importSource && ICAL_SOURCE_LOGOS[sr.importSource.toLowerCase()] && (
                    <Box
                      sx={{
                        width: 22,
                        height: 22,
                        minWidth: 22,
                        borderRadius: '50%',
                        border: '1.5px solid',
                        borderColor: 'var(--line)',
                        backgroundColor: '#fff', // pastille logo OTA fond blanc (pattern planning validé)
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        mt: 0.25,
                      }}
                    >
                      <img
                        src={ICAL_SOURCE_LOGOS[sr.importSource.toLowerCase()]}
                        alt={sr.importSource}
                        width={15}
                        height={15}
                        style={{ objectFit: 'contain', borderRadius: '50%' }}
                      />
                    </Box>
                  )}
                  <Typography sx={{ fontSize: '13px', color: 'var(--body)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                    {sr.description}
                  </Typography>
                </Box>
              </Paper>
            )}

            {/* Propriété */}
            <Paper sx={CARD_SX}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography sx={{ ...SECTION_TITLE_SX, mb: 0 }}>
                  <Home size={14} strokeWidth={1.75} style={{ marginRight: 4, verticalAlign: "middle" }} />
                  {t('serviceRequests.sections.property')}
                </Typography>
                <Button
                  size="small"
                  onClick={() => navigate(`/properties/${sr.propertyId}`)}
                  sx={{ fontSize: '0.6875rem', textTransform: 'none', py: 0, minHeight: 24 }}
                >
                  {t('serviceRequests.details.viewProperty')}
                </Button>
              </Box>

              <Box sx={INFO_ROW_SX}>
                <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><LocationOn size={16} strokeWidth={1.75} /></Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={INFO_LABEL_SX}>{t('serviceRequests.propertyNameLabel')}</Typography>
                  <Typography sx={INFO_VALUE_SX}>{sr.propertyName}</Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 0.5 }} />

              <Box sx={INFO_ROW_SX}>
                <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><LocationOn size={16} strokeWidth={1.75} /></Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={INFO_LABEL_SX}>{t('serviceRequests.fullAddressLabel')}</Typography>
                  <Typography sx={INFO_VALUE_SX}>
                    {sr.propertyAddress}, {sr.propertyCity}
                    {sr.propertyPostalCode && ` ${sr.propertyPostalCode}`}
                  </Typography>
                </Box>
              </Box>

              {sr.propertyCountry && (
                <>
                  <Divider sx={{ my: 0.5 }} />
                  <Box sx={INFO_ROW_SX}>
                    <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><Flag size={16} strokeWidth={1.75} /></Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={INFO_LABEL_SX}>{t('properties.country')}</Typography>
                      <Typography sx={INFO_VALUE_SX}>{sr.propertyCountry}</Typography>
                    </Box>
                  </Box>
                </>
              )}

              {/* Property characteristics tags */}
              {propertyTags.length > 0 && (
                <>
                  <Divider sx={{ my: 0.75 }} />
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                    {propertyTags.map((tag, idx) => (
                      <Chip
                        key={idx}
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

            {/* Notes et Consignes — Description du logement, Consignes, Instructions, Accès */}
            <Paper sx={CARD_SX}>
              <Typography sx={{ ...SECTION_TITLE_SX, mb: 1.5 }}>
                <NoteAlt size={14} strokeWidth={1.75} style={{ marginRight: 4, verticalAlign: "middle" }} />
                {t('serviceRequests.details.notesInstructions')}
              </Typography>

              {/* Description du logement + Consignes (shared component) */}
              <DescriptionNotesDisplay
                description={sr.propertyDescription}
                notes={sr.propertyCleaningNotes}
                variant={consigneVariant}
              />

              {/* Instructions spéciales */}
              {sr.specialInstructions && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography sx={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', mb: 0.5 }}>
                    {t('serviceRequests.details.specialInstructions')}
                  </Typography>
                  <Typography sx={{ fontSize: '13px', color: 'var(--body)', lineHeight: 1.5, whiteSpace: 'pre-line', bgcolor: 'var(--field)', p: 1.25, borderRadius: '9px', border: '1px solid var(--field-line)' }}>
                    {sr.specialInstructions}
                  </Typography>
                </Box>
              )}

              {/* Notes d'accès — alerte douce -soft (pattern .rm-alert) */}
              {sr.accessNotes && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography sx={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', mb: 0.5 }}>
                    <VpnKey size={12} strokeWidth={1.75} style={{ marginRight: 4, verticalAlign: "middle" }} />
                    {t('serviceRequests.details.accessNotes')}
                  </Typography>
                  <Typography sx={{ fontSize: '13px', color: 'var(--body)', lineHeight: 1.5, whiteSpace: 'pre-line', bgcolor: 'var(--warn-soft)', p: 1.25, borderRadius: '9px', border: '1px solid color-mix(in srgb, var(--warn) 30%, transparent)' }}>
                    {sr.accessNotes}
                  </Typography>
                </Box>
              )}
            </Paper>
          </Box>

          {/* ── Right column ─────────────────────────────────────────── */}
          <Box sx={{ flex: 5, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

            {/* Personnes impliquées */}
            <Paper sx={CARD_SX}>
              <Typography sx={SECTION_TITLE_SX}>
                {t('serviceRequests.peopleInvolved')}
              </Typography>

              {/* Demandeur */}
              <Box sx={INFO_ROW_SX}>
                <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><Person size={16} strokeWidth={1.75} /></Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={INFO_LABEL_SX}>{t('serviceRequests.fields.requestor')}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Typography sx={INFO_VALUE_SX}>{sr.requestorName}</Typography>
                    {sr.requestorRole && (
                      <Chip
                        label={sr.requestorRole}
                        size="small"
                        variant="outlined"
                        sx={{ height: 18, fontSize: '0.5625rem', '& .MuiChip-label': { px: 0.5 } }}
                      />
                    )}
                  </Box>
                  {sr.requestorEmail && (
                    <Typography sx={{ fontSize: '11px', color: 'var(--muted)' }}>
                      {sr.requestorEmail}
                    </Typography>
                  )}
                </Box>
              </Box>

              <Divider sx={{ my: 0.5 }} />

              {/* Assignation */}
              <Box sx={INFO_ROW_SX}>
                {sr.assignedToType === 'team' ? (
                  <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><Group size={16} strokeWidth={1.75} /></Box>
                ) : (
                  <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><Assignment size={16} strokeWidth={1.75} /></Box>
                )}
                <Box sx={{ flex: 1 }}>
                  <Typography sx={INFO_LABEL_SX}>{t('serviceRequests.assignedTo')}</Typography>
                  {sr.assignedToName ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography sx={INFO_VALUE_SX}>{sr.assignedToName}</Typography>
                      {sr.assignedToType === 'team' && (
                        <Chip
                          label={t('serviceRequests.team')}
                          size="small"
                          variant="outlined"
                          color="info"
                          sx={{ height: 20, fontSize: '0.6rem', '& .MuiChip-label': { px: 0.5 } }}
                        />
                      )}
                    </Box>
                  ) : (
                    <Typography sx={{ ...INFO_VALUE_SX, color: 'var(--faint)', fontStyle: 'italic' }}>
                      {t('serviceRequests.fields.noAssignment')}
                    </Typography>
                  )}
                  {sr.assignedToEmail && sr.assignedToType === 'user' && (
                    <Typography sx={{ fontSize: '11px', color: 'var(--muted)' }}>
                      {sr.assignedToEmail}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Paper>

            {/* Détail du temps */}
            <Paper sx={CARD_SX}>
              <Typography sx={SECTION_TITLE_SX}>
                <AccessTime size={14} strokeWidth={1.75} style={{ marginRight: 4, verticalAlign: "middle" }} />
                Détail du temps
              </Typography>

              <Box sx={INFO_ROW_SX}>
                <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><CalendarToday size={16} strokeWidth={1.75} /></Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={INFO_LABEL_SX}>{t('serviceRequests.dueDateLabel')}</Typography>
                  <Typography sx={INFO_VALUE_SX}>{formatDateTime(sr.dueDate) || '—'}</Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 0.5 }} />

              <Box sx={INFO_ROW_SX}>
                <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><Schedule size={16} strokeWidth={1.75} /></Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={INFO_LABEL_SX}>{t('serviceRequests.estimatedDurationLabel')}</Typography>
                  <Typography sx={INFO_VALUE_SX}>{formatDuration(sr.estimatedDuration)}</Typography>
                </Box>
              </Box>

              {sr.propertyCleaningDurationMinutes && sr.propertyCleaningDurationMinutes > 0 && (
                <>
                  <Divider sx={{ my: 0.5 }} />
                  <Box sx={INFO_ROW_SX}>
                    <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><Schedule size={16} strokeWidth={1.75} /></Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={INFO_LABEL_SX}>Durée ménage (propriété)</Typography>
                      <Typography sx={INFO_VALUE_SX}>
                        {sr.propertyCleaningDurationMinutes >= 60
                          ? `${Math.floor(sr.propertyCleaningDurationMinutes / 60)}h${sr.propertyCleaningDurationMinutes % 60 > 0 ? String(sr.propertyCleaningDurationMinutes % 60).padStart(2, '0') : ''}`
                          : `${sr.propertyCleaningDurationMinutes} min`}
                      </Typography>
                    </Box>
                  </Box>
                </>
              )}

              {hasCheckTimes && (
                <>
                  <Divider sx={{ my: 0.5 }} />
                  {sr.guestCheckoutTime && (
                    <Box sx={INFO_ROW_SX}>
                      <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><Logout size={16} strokeWidth={1.75} /></Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={INFO_LABEL_SX}>Départ voyageur</Typography>
                        <Typography sx={INFO_VALUE_SX}>{formatDateTime(sr.guestCheckoutTime)}</Typography>
                      </Box>
                    </Box>
                  )}
                  {sr.guestCheckinTime && (
                    <Box sx={INFO_ROW_SX}>
                      <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><Login size={16} strokeWidth={1.75} /></Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={INFO_LABEL_SX}>Arrivée voyageur</Typography>
                        <Typography sx={INFO_VALUE_SX}>{formatDateTime(sr.guestCheckinTime)}</Typography>
                      </Box>
                    </Box>
                  )}
                </>
              )}

              <Divider sx={{ my: 0.5 }} />
              <Box sx={INFO_ROW_SX}>
                <Box component="span" sx={{ display: 'inline-flex', color: 'var(--muted)' }}><CalendarMonth size={16} strokeWidth={1.75} /></Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={INFO_LABEL_SX}>{t('serviceRequests.createdDateLabel')}</Typography>
                  <Typography sx={INFO_VALUE_SX}>{formatDateTime(sr.createdAt)}</Typography>
                </Box>
              </Box>
            </Paper>

            {/* Prestations à la carte */}
            {prestations.length > 0 && (
              <Paper sx={CARD_SX}>
                <Typography sx={SECTION_TITLE_SX}>
                  Prestations à la carte
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {prestations.map((p, i) => (
                    <Chip
                      key={i}
                      icon={p.icon}
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <span>{p.label}</span>
                          <Typography component="span" sx={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                            +{p.extraMins} min
                          </Typography>
                        </Box>
                      }
                      size="small"
                      sx={{
                        height: 28,
                        fontSize: '11px',
                        fontWeight: 500,
                        border: 'none',
                        bgcolor: 'var(--accent-soft)',
                        color: 'var(--accent)',
                        '& .MuiChip-icon': { fontSize: 14, ml: 0.5, color: 'var(--accent)' },
                        '& .MuiChip-label': { px: 0.75 },
                      }}
                    />
                  ))}
                </Box>
              </Paper>
            )}

          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default ServiceRequestDetails;
