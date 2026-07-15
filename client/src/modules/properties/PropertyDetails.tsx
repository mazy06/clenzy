import React, { useState, useEffect, useMemo } from 'react';
import { useTabKeyParam } from '../../components/tabKeyParam';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Paper,
  Divider,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
} from '@mui/material';
import {  Edit,
  Home,
  LocationOn,
  Bed,
  Bathroom,
  SquareFoot,
  Person,
  CleaningServices,
  Build,
  Info,
  CalendarMonth,
  Schedule,
  Stairs,
  Deck,
  LocalLaundryService,
  Timer,
  Payments,
  Window,
  Iron,
  Kitchen,
  Sanitizer,
  Login,
  Logout,
  Flag,
  Group,
  Hub,
  Sync,
  CheckCircle,
  Error as ErrorMuiIcon,
  FlightLand,
  Wifi,
  VpnKey,
  LocalParking,
  Gavel,
  Phone,
  OpenInNew,
  PhotoLibrary,
  Inventory2,
  Send,
} from '../../icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { documentsApi } from '../../services/api/documentsApi';
import { usePropertyDetails } from '../../hooks/usePropertyDetails';
import type { PropertyDetailsData } from '../../hooks/usePropertyDetails';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import { Money } from '../../components/Money';
import { useTranslation } from '../../hooks/useTranslation';
import { formatDate } from '../../utils/formatUtils';
import DescriptionNotesDisplay from '../../components/DescriptionNotesDisplay';
import CheckInInstructionsForm from '../channels/CheckInInstructionsForm';
import PropertyPhotosTab from './PropertyPhotosTab';
import PropertyInventoryTab from './PropertyInventoryTab';
import PropertyInterventionsTab from './PropertyInterventionsTab';
import airbnbLogoSmall from '../../assets/logo/airbnb-logo-small.svg';
import bookingLogoSmall from '../../assets/logo/booking-logo-small.svg';
import hotelsComLogo from '../../assets/logo/hotels-com-logo-small.svg';
import agodaLogo from '../../assets/logo/agoda-logo-small.svg';
import vrboLogo from '../../assets/logo/vrbo-logo-small.svg';
import abritelLogo from '../../assets/logo/abritel-logo-small.svg';
import expediaLogo from '../../assets/logo/expedia-logo.png';
import {
  getPropertyStatusLabel,
  getPropertyTypeLabel,
  getCleaningFrequencyLabel,
} from '../../utils/statusUtils';
import { propertyStatusChipSx, FIELD_CHIP_SX } from './propertiesListConstants';
import { airbnbApi } from '../../services/api/airbnbApi';
import { MapboxPropertyMap } from '../../components/MapboxPropertyMap';
import { PropertyImageCarousel } from '../../components/PropertyImageCarousel';
import { propertyPhotosApi } from '../../services/api/propertyPhotosApi';
import { useQuery } from '@tanstack/react-query';

// ─── Stable sx constants ────────────────────────────────────────────────────

// ── Constantes sx alignées DESIGN_BASELINE (réf maquette screen-property .pd-*) ──

// .pd-kpi — tuile KPI centrée : icône accent-soft, valeur display tabular-nums, label overline.
const METRIC_CARD_SX = {
  p: '14px 12px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  bgcolor: 'var(--card)',
  border: '1px solid var(--line)',
  borderRadius: '13px',
  boxShadow: 'none',
  minHeight: 72,
  justifyContent: 'center',
  transition: 'border-color .14s',
  '&:hover': { borderColor: 'var(--line-2)' },
} as const;

const METRIC_ICON_BADGE_SX = {
  width: 32,
  height: 32,
  borderRadius: '10px',
  bgcolor: 'var(--accent-soft)',
  color: 'var(--accent)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  mb: '8px',
} as const;

const METRIC_VALUE_SX = {
  fontFamily: 'var(--font-display)',
  fontSize: '18px',
  fontWeight: 600,
  color: 'var(--ink)',
  lineHeight: 1.2,
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: '-.01em',
} as const;

const METRIC_LABEL_SX = {
  fontSize: '10px',
  fontWeight: 700,
  color: 'var(--faint)',
  textTransform: 'uppercase',
  letterSpacing: '.04em',
  mt: '3px',
} as const;

// .fr-sec / .pd-sec — overline de section.
const SECTION_TITLE_SX = {
  fontSize: '10.5px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  color: 'var(--faint)',
  mb: 1,
} as const;

// .pd-kv — bloc label/valeur (icône accent, label muted 11, valeur ink 13 fw600).
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

// .pd-card — carte hairline r14 plate.
const CARD_SX = {
  border: '1px solid var(--line)',
  bgcolor: 'var(--card)',
  boxShadow: 'none',
  borderRadius: '14px',
  p: '16px 18px',
} as const;

// ─── Cleaning price estimation (mirrored from CleaningPriceEstimator) ───────

const SURFACE_BASE_PRICE: { maxSurface: number | null; base: number }[] = [
  { maxSurface: 30, base: 35 },
  { maxSurface: 50, base: 45 },
  { maxSurface: 70, base: 55 },
  { maxSurface: 100, base: 70 },
  { maxSurface: 150, base: 90 },
  { maxSurface: null, base: 110 },
];

const SURCHARGES = {
  perBedroom: 5,
  perBathroom: 4,
  perFloor: 8,
  exterior: 12,
  laundry: 8,
  perGuestAbove4: 3,
} as const;

function getSurfaceBasePrice(sqm: number): number {
  for (const tier of SURFACE_BASE_PRICE) {
    if (tier.maxSurface === null || sqm <= tier.maxSurface) return tier.base;
  }
  return SURFACE_BASE_PRICE[SURFACE_BASE_PRICE.length - 1].base;
}

function computeCleaningEstimate(
  sqm: number,
  bedrooms: number,
  bathrooms: number,
  maxGuests: number,
  floors: number | undefined,
  hasExterior: boolean,
  hasLaundry: boolean,
  cleaningBasePrice: number | undefined,
): { min: number; max: number } {
  const base = (cleaningBasePrice != null && cleaningBasePrice > 0)
    ? cleaningBasePrice
    : getSurfaceBasePrice(sqm);

  let surcharge = 0;
  surcharge += Math.max(0, bedrooms - 1) * SURCHARGES.perBedroom;
  surcharge += Math.max(0, bathrooms - 1) * SURCHARGES.perBathroom;
  if (floors != null && floors > 1) surcharge += (floors - 1) * SURCHARGES.perFloor;
  if (hasExterior) surcharge += SURCHARGES.exterior;
  if (hasLaundry) surcharge += SURCHARGES.laundry;
  if (maxGuests > 4) surcharge += (maxGuests - 4) * SURCHARGES.perGuestAbove4;

  const raw = base + surcharge;
  const min = Math.max(30, Math.round(raw / 5) * 5);
  const max = min; // Standard type (coeff 1.0)
  return { min, max };
}

// ─── Re-export type for backward compatibility ─────────────────────────────

export type { PropertyDetailsData };

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(time: string | undefined): string {
  if (!time) return '—';
  // Handle "HH:mm:ss" or "HH:mm" formats
  return time.substring(0, 5);
}

// ─── Main component ─────────────────────────────────────────────────────────

const PropertyDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();
  const { t } = useTranslation();

  // ─── React Query ────────────────────────────────────────────────────────
  const { property, interventions, isLoading, isError, error } = usePropertyDetails(id);

  // ─── Photos pour le carrousel (source de verite : endpoint photos) ──────
  const photosQuery = useQuery({
    queryKey: ['property-photos', id],
    queryFn: () => propertyPhotosApi.list(Number(id)),
    enabled: !!id,
    staleTime: 60_000,
  });

  const photoUrls = useMemo(() => {
    const photos = photosQuery.data ?? [];
    return [...photos]
      .sort((a, b) => {
        const s = a.sortOrder - b.sortOrder;
        return s !== 0 ? s : a.id - b.id;
      })
      .map((p) => propertyPhotosApi.getPhotoUrl(Number(id), p.id));
  }, [photosQuery.data, id]);

  const [canEdit, setCanEdit] = useState(false);
  // Devis ménage (Moteur Ménage 3A) : confirmation + envoi au propriétaire.
  const [cleaningQuoteDialogOpen, setCleaningQuoteDialogOpen] = useState(false);
  const [cleaningQuoteSending, setCleaningQuoteSending] = useState(false);
  const [cleaningQuoteSnackbar, setCleaningQuoteSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const handleSendCleaningQuote = async () => {
    setCleaningQuoteSending(true);
    try {
      await documentsApi.sendCleaningQuote(Number(id));
      setCleaningQuoteSnackbar({ open: true, message: t('properties.cleaningQuote.sent'), severity: 'success' });
      setCleaningQuoteDialogOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error && err.message ? err.message : t('properties.cleaningQuote.error');
      setCleaningQuoteSnackbar({ open: true, message, severity: 'error' });
    } finally {
      setCleaningQuoteSending(false);
    }
  };
  // Onglets de la fiche bien — `key` stable pour l'URL (?tab=<key>). L'onglet "settings" (dernier)
  // est masque sans droit d'edition ; useTabKeyParam derive l'index visible depuis la cle.
  const detailTabs = [
    { key: 'overview', hidden: false },
    { key: 'interventions', hidden: false },
    { key: 'channels', hidden: false },
    { key: 'check-in', hidden: false },
    { key: 'photos', hidden: false },
    { key: 'inventory', hidden: false },
  ];
  const [tabValue, setTabValue] = useTabKeyParam(detailTabs);
  const [channelStatus, setChannelStatus] = useState<{ airbnb: { linked: boolean; syncEnabled: boolean; lastSyncAt: string | null; status: string } } | null>(null);

  // ─── Permissions (lightweight, kept as useEffect) ───────────────────────
  useEffect(() => {
    const checkPermissions = async () => {
      const canEditPermission = await hasPermissionAsync('properties:edit');
      setCanEdit(canEditPermission);
    };
    checkPermissions();
  }, [hasPermissionAsync]);

  // ─── Channel status ───────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    airbnbApi.getPropertyChannelStatus(Number(id))
      .then(setChannelStatus)
      .catch(() => { /* No channel data yet */ });
  }, [id]);

  // ─── Cleaning price estimation ───────────────────────────────────────────
  const cleaningEstimate = useMemo(() => {
    if (!property) return null;
    const sqm = property.surfaceArea ?? 0;
    const bedrooms = property.bedrooms ?? 1;
    if (sqm <= 0 && !(property.cleaningBasePrice != null && property.cleaningBasePrice > 0)) return null;

    return computeCleaningEstimate(
      sqm,
      bedrooms,
      property.bathrooms ?? 1,
      property.maxGuests ?? 2,
      property.numberOfFloors ?? undefined,
      property.hasExterior ?? false,
      property.hasLaundry ?? false,
      property.cleaningBasePrice ?? undefined,
    );
  }, [property]);

  // ─── Feature chips (active options) ─────────────────────────────────────
  const featureChips = useMemo(() => {
    if (!property) return [];
    const chips: { label: string }[] = [];

    if (property.hasExterior) chips.push({ label: t('properties.hasExterior') });
    if (property.hasLaundry) chips.push({ label: t('properties.hasLaundry') });
    if ((property.windowCount ?? 0) > 0 || (property.frenchDoorCount ?? 0) > 0 || (property.slidingDoorCount ?? 0) > 0) {
      const parts = [
        (property.windowCount ?? 0) > 0 && `${property.windowCount} ${t('properties.addOnServices.windowCountShort')}`,
        (property.frenchDoorCount ?? 0) > 0 && `${property.frenchDoorCount} ${t('properties.addOnServices.frenchDoorCountShort')}`,
        (property.slidingDoorCount ?? 0) > 0 && `${property.slidingDoorCount} ${t('properties.addOnServices.slidingDoorCountShort')}`,
      ].filter(Boolean).join(', ');
      chips.push({ label: `${t('properties.addOnServices.windows')}: ${parts}` });
    }
    if (property.hasIroning) chips.push({ label: t('properties.addOnServices.hasIroning') });
    if (property.hasDeepKitchen) chips.push({ label: t('properties.addOnServices.hasDeepKitchen') });
    if (property.hasDisinfection) chips.push({ label: t('properties.addOnServices.hasDisinfection') });
    if (property.numberOfFloors != null && property.numberOfFloors > 1) {
      chips.push({ label: `${property.numberOfFloors} ${t('properties.numberOfFloors').toLowerCase()}` });
    }

    return chips;
  }, [property, t]);

  // ─── Loading / Error states ─────────────────────────────────────────────

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" sx={{ py: 0.75, fontSize: '0.8125rem' }}>{error || t('properties.loadError')}</Alert>
      </Box>
    );
  }

  if (!property) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning" sx={{ py: 0.75, fontSize: '0.8125rem' }}>{t('properties.notFound')}</Alert>
      </Box>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <Box sx={{ flexShrink: 0 }}>
        <PageHeader
          title={property.name}
          subtitle={`${getPropertyTypeLabel(property.propertyType, t)} · ${property.city}`}
          iconBadge={<Home />}
          backPath="/properties"
          actions={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              {canEdit && (
                <Button
                  variant="outlined"
                  startIcon={<Send size={16} strokeWidth={1.75} />}
                  onClick={() => setCleaningQuoteDialogOpen(true)}
                  size="small"
                  title={t('properties.cleaningQuote.button')}
                >
                  {t('properties.cleaningQuote.button')}
                </Button>
              )}
              {canEdit && (
                <Button
                  variant="contained"
                  startIcon={<Edit size={16} strokeWidth={1.75} />}
                  onClick={() => navigate(`/properties/${id}/edit`)}
                  size="small"
                  title={t('properties.modify')}
                >
                  {t('properties.modify')}
                </Button>
              )}
            </Box>
          }
        />
      </Box>

      {/* ─── Tabs (primitive PageTabs — onglets niveau 1 soulignés accent) ── */}
      <Box sx={{ flexShrink: 0 }}>
        <PageTabs
          ariaLabel={t('properties.details')}
          mb={0}
          options={[
            { key: 'overview', label: t('properties.tabs.overview'), icon: <Info /> },
            { key: 'interventions', label: `${t('properties.tabs.interventions')} (${interventions.length})`, icon: <Build /> },
            { key: 'channels', label: t('channels.title'), icon: <Hub /> },
            { key: 'check-in', label: t('channels.checkIn.title'), icon: <FlightLand /> },
            { key: 'photos', label: t('properties.tabs.photos'), icon: <PhotoLibrary /> },
            { key: 'inventory', label: 'Inventaire', icon: <Inventory2 /> },
          ]}
          value={tabValue}
          onChange={setTabValue}
        />
      </Box>

      {/* ─── Tab 0: Vue d'ensemble ───────────────────────────────────────── */}
      {tabValue === 0 && (
        <Box
          role="tabpanel"
          id="property-tabpanel-0"
          aria-labelledby="property-tab-0"
          sx={{ pt: 1.5, flex: 1, minHeight: 0, overflow: 'auto' }}
        >
          {/* ── Key metrics grid ──────────────────────────────────────── */}
          <Grid container spacing={1} sx={{ mb: featureChips.length > 0 ? 1 : 1.5 }}>
            <Grid item xs={6} sm={4} md={2}>
              <Tooltip title={t('properties.cleaningEstimateTooltip')} arrow placement="top">
                <Box sx={{ ...METRIC_CARD_SX, cursor: 'help' }}>
                  <Box sx={METRIC_ICON_BADGE_SX}><Payments size={16} strokeWidth={1.75} /></Box>
                  <Typography sx={METRIC_VALUE_SX}>
                    {cleaningEstimate ? <Money value={cleaningEstimate.min} from="EUR" decimals={0} /> : '—'}
                  </Typography>
                  <Typography sx={METRIC_LABEL_SX}>{t('properties.cleaningEstimate')}</Typography>
                </Box>
              </Tooltip>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={METRIC_CARD_SX}>
                <Box sx={METRIC_ICON_BADGE_SX}><Bed size={16} strokeWidth={1.75} /></Box>
                <Typography sx={METRIC_VALUE_SX}>{property.bedrooms}</Typography>
                <Typography sx={METRIC_LABEL_SX}>{t('properties.bedrooms')}</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={METRIC_CARD_SX}>
                <Box sx={METRIC_ICON_BADGE_SX}><Bathroom size={16} strokeWidth={1.75} /></Box>
                <Typography sx={METRIC_VALUE_SX}>{property.bathrooms}</Typography>
                <Typography sx={METRIC_LABEL_SX}>{t('properties.bathroomCount')}</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={METRIC_CARD_SX}>
                <Box sx={METRIC_ICON_BADGE_SX}><SquareFoot size={16} strokeWidth={1.75} /></Box>
                <Typography sx={METRIC_VALUE_SX}>{property.surfaceArea} m²</Typography>
                <Typography sx={METRIC_LABEL_SX}>{t('properties.surface')}</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={METRIC_CARD_SX}>
                <Box sx={METRIC_ICON_BADGE_SX}><Group size={16} strokeWidth={1.75} /></Box>
                <Typography sx={METRIC_VALUE_SX}>{property.maxGuests}</Typography>
                <Typography sx={METRIC_LABEL_SX}>{t('properties.maxCapacity')}</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={METRIC_CARD_SX}>
                <Box sx={METRIC_ICON_BADGE_SX}><CleaningServices size={16} strokeWidth={1.75} /></Box>
                <Typography sx={{ ...METRIC_VALUE_SX, fontSize: '12.5px' }}>
                  {getCleaningFrequencyLabel(property.cleaningFrequency, t)}
                </Typography>
                <Typography sx={METRIC_LABEL_SX}>{t('properties.cleaningFrequency')}</Typography>
              </Box>
            </Grid>
          </Grid>

          {/* ── Prestations à la carte chips ──────────────────────────── */}
          {featureChips.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
              <Typography sx={{ ...SECTION_TITLE_SX, mb: 0, mr: 0.5 }}>
                {t('properties.addOnServices.title')}
              </Typography>
              {featureChips.map((chip) => (
                <Chip
                  key={chip.label}
                  label={chip.label}
                  size="small"
                  sx={{ ...FIELD_CHIP_SX, '& .MuiChip-label': { px: 1 } }}
                />
              ))}
            </Box>
          )}

          {/* ── Équipements chips ──────────────────────────────────── */}
          {property.amenities && property.amenities.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
              <Typography sx={{ ...SECTION_TITLE_SX, mb: 0, mr: 0.5 }}>
                {t('properties.amenities.title')}
              </Typography>
              {property.amenities.map((amenity) => (
                <Chip
                  key={amenity}
                  label={t(`properties.amenities.items.${amenity}`)}
                  size="small"
                  sx={{ ...FIELD_CHIP_SX, '& .MuiChip-label': { px: 1 } }}
                />
              ))}
            </Box>
          )}

          {/* ── Row 1: Photos | Informations + Tarification | Configuration ── */}
          <Paper sx={{ ...CARD_SX, mb: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'stretch' }}>
              {/* ── Col 1: Photos (carrousel + plein ecran au clic) ──── */}
              <Box sx={{ flex: 1, minWidth: 0, display: 'flex' }}>
                <PropertyImageCarousel
                  photoUrls={photoUrls}
                  alt={property.name}
                  width="100%"
                  height={{ xs: 240, sm: 280, md: 340 }}
                  alwaysShowNav
                  enableFullscreen
                  showCounter
                  sx={{ width: '100%' }}
                />
              </Box>

              <Divider orientation="vertical" flexItem />

              {/* ── Col 2: Informations generales + Tarification menage ── */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={SECTION_TITLE_SX}>
                  {t('properties.informationsGeneral')}
                </Typography>
                <Box sx={INFO_ROW_SX}>
                  <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><LocationOn size={16} strokeWidth={1.75} /></Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={INFO_LABEL_SX}>{t('properties.address')}</Typography>
                    <Typography sx={INFO_VALUE_SX}>
                      {property.address}, {property.city} {property.postalCode}
                    </Typography>
                  </Box>
                </Box>
                {property.country && (
                  <>
                    <Divider sx={{ my: 0.5 }} />
                    <Box sx={INFO_ROW_SX}>
                      <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Flag size={16} strokeWidth={1.75} /></Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={INFO_LABEL_SX}>{t('properties.country')}</Typography>
                        <Typography sx={INFO_VALUE_SX}>{property.country}</Typography>
                      </Box>
                    </Box>
                  </>
                )}
                <Divider sx={{ my: 0.5 }} />
                <Box sx={INFO_ROW_SX}>
                  <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Home size={16} strokeWidth={1.75} /></Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={INFO_LABEL_SX}>{t('properties.type')}</Typography>
                    <Typography sx={INFO_VALUE_SX}>{getPropertyTypeLabel(property.propertyType, t)}</Typography>
                  </Box>
                </Box>
                {property.createdAt && (
                  <>
                    <Divider sx={{ my: 0.5 }} />
                    <Box sx={INFO_ROW_SX}>
                      <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><CalendarMonth size={16} strokeWidth={1.75} /></Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={INFO_LABEL_SX}>{t('properties.createdAt')}</Typography>
                        <Typography sx={INFO_VALUE_SX}>{formatDate(property.createdAt)}</Typography>
                      </Box>
                    </Box>
                  </>
                )}

                <Typography sx={{ ...SECTION_TITLE_SX, mt: 1.5 }}>
                  {t('properties.cleaningPricing')}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                  {property.cleaningBasePrice != null && property.cleaningBasePrice > 0 && (
                    <Box sx={INFO_ROW_SX}>
                      <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Payments size={16} strokeWidth={1.75} /></Box>
                      <Box>
                        <Typography sx={INFO_LABEL_SX}>{t('properties.cleaningBasePrice')}</Typography>
                        <Typography sx={{ ...INFO_VALUE_SX, fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}><Money value={property.cleaningBasePrice} from="EUR" decimals={0} /></Typography>
                      </Box>
                    </Box>
                  )}
                  {property.cleaningDurationMinutes != null && property.cleaningDurationMinutes > 0 && (
                    <Box sx={INFO_ROW_SX}>
                      <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Timer size={16} strokeWidth={1.75} /></Box>
                      <Box>
                        <Typography sx={INFO_LABEL_SX}>{t('properties.cleaningDuration')}</Typography>
                        <Typography sx={INFO_VALUE_SX}>
                          {property.cleaningDurationMinutes >= 60
                            ? `${Math.floor(property.cleaningDurationMinutes / 60)}h${property.cleaningDurationMinutes % 60 > 0 ? String(property.cleaningDurationMinutes % 60).padStart(2, '0') : ''}`
                            : `${property.cleaningDurationMinutes} min`}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                  {property.numberOfFloors != null && property.numberOfFloors > 0 && (
                    <Box sx={INFO_ROW_SX}>
                      <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Stairs size={16} strokeWidth={1.75} /></Box>
                      <Box>
                        <Typography sx={INFO_LABEL_SX}>{t('properties.numberOfFloors')}</Typography>
                        <Typography sx={INFO_VALUE_SX}>{property.numberOfFloors}</Typography>
                      </Box>
                    </Box>
                  )}
                  {property.hasExterior && (
                    <Box sx={INFO_ROW_SX}>
                      <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Deck size={16} strokeWidth={1.75} /></Box>
                      <Typography sx={INFO_VALUE_SX}>{t('properties.hasExterior')}</Typography>
                    </Box>
                  )}
                  {property.hasLaundry && (
                    <Box sx={INFO_ROW_SX}>
                      <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><LocalLaundryService size={16} strokeWidth={1.75} /></Box>
                      <Typography sx={INFO_VALUE_SX}>{t('properties.hasLaundry')}</Typography>
                    </Box>
                  )}
                </Box>
              </Box>

              <Divider orientation="vertical" flexItem />

              {/* ── Col 3: Configuration ───────────────────────────── */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={SECTION_TITLE_SX}>
                  {t('properties.configuration')}
                </Typography>
                <Box sx={INFO_ROW_SX}>
                  <Box>
                    <Typography sx={INFO_LABEL_SX}>{t('properties.status')}</Typography>
                    <Chip label={getPropertyStatusLabel(property.status, t)} size="small"
                      sx={{ mt: 0.5, ...propertyStatusChipSx(property.status), '& .MuiChip-label': { px: 1 } }} />
                  </Box>
                </Box>
                {property.ownerName && (
                  <>
                    <Divider sx={{ my: 0.5 }} />
                    <Box sx={INFO_ROW_SX}>
                      <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Person size={16} strokeWidth={1.75} /></Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={INFO_LABEL_SX}>{t('properties.owner')}</Typography>
                        <Typography sx={INFO_VALUE_SX}>{property.ownerName}</Typography>
                      </Box>
                    </Box>
                  </>
                )}
                {(property.defaultCheckInTime || property.defaultCheckOutTime) && (
                  <>
                    <Divider sx={{ my: 0.5 }} />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {property.defaultCheckInTime && (
                        <Box sx={INFO_ROW_SX}>
                          <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Login size={16} strokeWidth={1.75} /></Box>
                          <Box>
                            <Typography sx={INFO_LABEL_SX}>{t('properties.checkInTime')}</Typography>
                            <Typography sx={INFO_VALUE_SX}>{formatTime(property.defaultCheckInTime)}</Typography>
                          </Box>
                        </Box>
                      )}
                      {property.defaultCheckOutTime && (
                        <Box sx={INFO_ROW_SX}>
                          <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Logout size={16} strokeWidth={1.75} /></Box>
                          <Box>
                            <Typography sx={INFO_LABEL_SX}>{t('properties.checkOutTime')}</Typography>
                            <Typography sx={INFO_VALUE_SX}>{formatTime(property.defaultCheckOutTime)}</Typography>
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </>
                )}
                <Divider sx={{ my: 0.5 }} />
                <Box sx={INFO_ROW_SX}>
                  <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><CleaningServices size={16} strokeWidth={1.75} /></Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={INFO_LABEL_SX}>{t('properties.cleaningFrequency')}</Typography>
                    <Typography sx={INFO_VALUE_SX}>{getCleaningFrequencyLabel(property.cleaningFrequency, t)}</Typography>
                  </Box>
                </Box>
                {property.lastCleaning && (
                  <>
                    <Divider sx={{ my: 0.5 }} />
                    <Box sx={INFO_ROW_SX}>
                      <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Schedule size={16} strokeWidth={1.75} /></Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={INFO_LABEL_SX}>{t('properties.lastCleaning')}</Typography>
                        <Typography sx={INFO_VALUE_SX}>{formatDate(property.lastCleaning)}</Typography>
                      </Box>
                    </Box>
                  </>
                )}
              </Box>

            </Box>
          </Paper>

          {/* ── Row 2: Map + Description | Instructions voyageur ────── */}
          <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
            {/* ── Left column: Map + Description ──────────────────── */}
            <Box sx={{ flex: 6, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {/* Mini-carte Mapbox */}
              {property.latitude != null && property.longitude != null && (
                <Paper sx={{ ...CARD_SX, p: 0, overflow: 'hidden' }}>
                  <MapboxPropertyMap
                    properties={[{
                      lat: property.latitude,
                      lng: property.longitude,
                      name: property.name,
                      id: Number(property.id),
                      type: 'property',
                    }]}
                    center={[property.longitude, property.latitude]}
                    zoom={15}
                    height={220}
                  />
                </Paper>
              )}

              {/* Description du logement & Consignes de ménage */}
              {(property.description || property.cleaningNotes) && (
                <DescriptionNotesDisplay
                  description={property.description}
                  notes={property.cleaningNotes}
                  variant="cleaning"
                />
              )}
            </Box>

            {/* ── Right column: Instructions voyageur ─────────────── */}
            {property.checkInInstructions && (() => {
              const ci = property.checkInInstructions;
              const hasAnyField = ci.accessCode || ci.wifiName || ci.wifiPassword || ci.parkingInfo
                || ci.arrivalInstructions || ci.departureInstructions || ci.houseRules || ci.emergencyContact;
              if (!hasAnyField) return null;

              const fields: { icon: React.ReactNode; label: string; value: string | null }[] = [
                { icon: <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><VpnKey size={16} strokeWidth={1.75} /></Box>, label: t('channels.checkIn.accessCode'), value: ci.accessCode },
                { icon: <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Wifi size={16} strokeWidth={1.75} /></Box>, label: t('channels.checkIn.wifiName'), value: ci.wifiName },
                { icon: <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Wifi size={16} strokeWidth={1.75} /></Box>, label: t('channels.checkIn.wifiPassword'), value: ci.wifiPassword },
                { icon: <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><LocalParking size={16} strokeWidth={1.75} /></Box>, label: t('channels.checkIn.parkingInfo'), value: ci.parkingInfo },
                { icon: <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Login size={16} strokeWidth={1.75} /></Box>, label: t('channels.checkIn.arrivalInstructions'), value: ci.arrivalInstructions },
                { icon: <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Logout size={16} strokeWidth={1.75} /></Box>, label: t('channels.checkIn.departureInstructions'), value: ci.departureInstructions },
                { icon: <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Gavel size={16} strokeWidth={1.75} /></Box>, label: t('channels.checkIn.houseRules'), value: ci.houseRules },
                { icon: <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Phone size={16} strokeWidth={1.75} /></Box>, label: t('channels.checkIn.emergencyContact'), value: ci.emergencyContact },
              ];

              // Split: first 4 fields in 2-col grid, rest full-width
              const compactFields = fields.slice(0, 4).filter(f => f.value);
              const fullWidthFields = fields.slice(4).filter(f => f.value);

              if (compactFields.length === 0 && fullWidthFields.length === 0) return null;

              return (
                <Box sx={{ flex: 6, minWidth: 0 }}>
                  <Paper sx={CARD_SX}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography sx={SECTION_TITLE_SX}>
                        {t('channels.checkIn.title')}
                      </Typography>
                      <Button
                        size="small"
                        endIcon={<OpenInNew size={12} strokeWidth={1.75} />}
                        onClick={() => setTabValue(3)}
                        variant="text"
                        sx={{ minWidth: 0, px: 1, py: 0.25, height: 26, fontSize: '11.5px' }}
                      >
                        {t('properties.modify')}
                      </Button>
                    </Box>

                    {/* Compact fields: 2 columns */}
                    {compactFields.length > 0 && (
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: fullWidthFields.length > 0 ? 1 : 0 }}>
                        {compactFields.map((field) => (
                          <Box key={field.label} sx={INFO_ROW_SX}>
                            {field.icon}
                            <Box sx={{ flex: 1 }}>
                              <Typography sx={INFO_LABEL_SX}>{field.label}</Typography>
                              <Typography sx={INFO_VALUE_SX}>{field.value}</Typography>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    )}

                    {/* Full-width fields */}
                    {fullWidthFields.map((field) => (
                      <React.Fragment key={field.label}>
                        <Divider sx={{ my: 0.5 }} />
                        <Box sx={INFO_ROW_SX}>
                          {field.icon}
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={INFO_LABEL_SX}>{field.label}</Typography>
                            <Typography sx={{ ...INFO_VALUE_SX, whiteSpace: 'pre-line' }}>{field.value}</Typography>
                          </Box>
                        </Box>
                      </React.Fragment>
                    ))}
                  </Paper>
                </Box>
              );
            })()}
          </Box>
        </Box>
      )}

      {/* ─── Tab 1: Interventions ────────────────────────────────────────── */}
      {tabValue === 1 && (
        <Box
          role="tabpanel"
          id="property-tabpanel-1"
          aria-labelledby="property-tab-1"
          sx={{ pt: 1.5, flex: 1, minHeight: 0, overflow: 'auto' }}
        >
          <PropertyInterventionsTab interventions={interventions} propertyId={String(id)} />
        </Box>
      )}

      {/* ─── Tab 2: Channels ──────────────────────────────────────────── */}
      {tabValue === 2 && (
        <Box
          role="tabpanel"
          id="property-tabpanel-2"
          aria-labelledby="property-tab-2"
          sx={{ pt: 1.5, flex: 1, minHeight: 0, overflow: 'auto' }}
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1.5 }}>
            {/* Airbnb — with real status */}
            <Paper sx={CARD_SX}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box component="img" src={airbnbLogoSmall} alt="Airbnb" sx={{ width: 21, height: 21, borderRadius: '7px', objectFit: 'contain' }} />
                <Typography sx={{ ...SECTION_TITLE_SX, mb: 0 }}>Airbnb</Typography>
                <Chip
                  label={channelStatus?.airbnb?.linked ? t('channels.connected') : t('channels.notConnected')}
                  size="small"
                  sx={{ ml: 'auto', height: 20, bgcolor: channelStatus?.airbnb?.linked ? 'var(--ok-soft)' : 'var(--hover)', color: channelStatus?.airbnb?.linked ? 'var(--ok)' : 'var(--muted)', border: 'none', '& .MuiChip-label': { px: 1 } }}
                />
              </Box>
              {channelStatus?.airbnb?.linked ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Box sx={INFO_ROW_SX}>
                    <Box component="span" sx={{ display: 'inline-flex', color: channelStatus.airbnb.syncEnabled ? 'var(--ok)' : 'var(--muted)' }}><Sync size={16} strokeWidth={1.75} /></Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={INFO_LABEL_SX}>{t('channels.syncStatus.title')}</Typography>
                      <Typography sx={INFO_VALUE_SX}>
                        {channelStatus.airbnb.syncEnabled ? t('channels.syncStatus.syncOn') : t('channels.syncStatus.syncOff')}
                      </Typography>
                    </Box>
                  </Box>
                  {channelStatus.airbnb.lastSyncAt && (
                    <Box sx={INFO_ROW_SX}>
                      <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Schedule size={16} strokeWidth={1.75} /></Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={INFO_LABEL_SX}>{t('channels.syncStatus.lastSync')}</Typography>
                        <Typography sx={INFO_VALUE_SX}>{new Date(channelStatus.airbnb.lastSyncAt).toLocaleString('fr-FR')}</Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              ) : (
                <Button size="small" variant="outlined" startIcon={<Hub size={14} strokeWidth={1.75} />} onClick={() => navigate('/channels')}>
                  {t('channels.listings.linkProperty')}
                </Button>
              )}
            </Paper>

            {/* Other channels — static cards */}
            {[
              { name: 'Booking.com', logo: bookingLogoSmall },
              { name: 'Expedia', logo: expediaLogo },
              { name: 'Hotels.com', logo: hotelsComLogo },
              { name: 'Agoda', logo: agodaLogo },
              { name: 'Vrbo', logo: vrboLogo },
              { name: 'Abritel', logo: abritelLogo },
            ].map((ch) => (
              <Paper key={ch.name} sx={CARD_SX}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Box component="img" src={ch.logo} alt={ch.name} sx={{ width: 21, height: 21, borderRadius: '7px', objectFit: 'contain' }} />
                  <Typography sx={{ ...SECTION_TITLE_SX, mb: 0 }}>{ch.name}</Typography>
                  <Chip
                    label={t('channels.notConnected')}
                    size="small"
                    sx={{ ml: 'auto', height: 20, bgcolor: 'var(--hover)', color: 'var(--muted)', border: 'none', '& .MuiChip-label': { px: 1 } }}
                  />
                </Box>
                <Button size="small" variant="outlined" startIcon={<Hub size={14} strokeWidth={1.75} />} onClick={() => navigate('/channels')}>
                  {t('channels.listings.linkProperty')}
                </Button>
              </Paper>
            ))}
          </Box>
        </Box>
      )}

      {/* ─── Tab 3: Instructions voyageur ─────────────────────────────── */}
      {tabValue === 3 && (
        <Box
          role="tabpanel"
          id="property-tabpanel-3"
          aria-labelledby="property-tab-3"
          sx={{ pt: 1.5, flex: 1, minHeight: 0, overflow: 'auto' }}
        >
          <CheckInInstructionsForm propertyId={Number(id)} />
        </Box>
      )}

      {/* ─── Tab 4: Photos ─────────────────────────────────────────────── */}
      {tabValue === 4 && (
        <Box
          role="tabpanel"
          id="property-tabpanel-4"
          aria-labelledby="property-tab-4"
          sx={{ pt: 1.5, flex: 1, minHeight: 0, overflow: 'auto' }}
        >
          <PropertyPhotosTab propertyId={Number(id)} />
        </Box>
      )}

      {/* ─── Tab 5: Inventaire ───────────────────────────────────────────── */}
      {tabValue === 5 && (
        <Box
          role="tabpanel"
          id="property-tabpanel-5"
          aria-labelledby="property-tab-5"
          sx={{ pt: 1.5, flex: 1, minHeight: 0, overflow: 'auto' }}
        >
          <PropertyInventoryTab propertyId={Number(id)} canEdit={canEdit} />
        </Box>
      )}


      {/* Devis ménage : confirmation avant envoi au propriétaire */}
      <Dialog open={cleaningQuoteDialogOpen} onClose={() => setCleaningQuoteDialogOpen(false)}>
        <DialogTitle>{t('properties.cleaningQuote.confirmTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{t('properties.cleaningQuote.confirmBody')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setCleaningQuoteDialogOpen(false)} disabled={cleaningQuoteSending}>
            {t('common.cancel')}
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleSendCleaningQuote}
            disabled={cleaningQuoteSending}
            startIcon={cleaningQuoteSending ? <CircularProgress size={14} color="inherit" /> : <Send size={14} strokeWidth={1.75} />}
          >
            {t('properties.cleaningQuote.confirmSend')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={cleaningQuoteSnackbar.open}
        autoHideDuration={4000}
        onClose={() => setCleaningQuoteSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={cleaningQuoteSnackbar.severity} variant="filled" onClose={() => setCleaningQuoteSnackbar((prev) => ({ ...prev, open: false }))}>
          {cleaningQuoteSnackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PropertyDetails;
