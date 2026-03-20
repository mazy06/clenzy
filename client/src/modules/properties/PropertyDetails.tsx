import React, { useState, useEffect, useMemo } from 'react';
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
  Tabs,
  Tab,
  Paper,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Edit,
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
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePropertyDetails } from '../../hooks/usePropertyDetails';
import type { PropertyDetailsData } from '../../hooks/usePropertyDetails';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import { formatDate } from '../../utils/formatUtils';
import DescriptionNotesDisplay from '../../components/DescriptionNotesDisplay';
import CheckInInstructionsForm from '../channels/CheckInInstructionsForm';
import PropertyPhotosTab from './PropertyPhotosTab';
import airbnbLogoSmall from '../../assets/logo/airbnb-logo-small.svg';
import bookingLogoSmall from '../../assets/logo/booking-logo-small.svg';
import hotelsComLogo from '../../assets/logo/hotels-com-logo-small.svg';
import agodaLogo from '../../assets/logo/agoda-logo-small.svg';
import vrboLogo from '../../assets/logo/vrbo-logo-small.svg';
import abritelLogo from '../../assets/logo/abritel-logo-small.svg';
import expediaLogo from '../../assets/logo/expedia-logo.png';
import {
  getPropertyStatusLabel,
  getPropertyStatusHex,
  getPropertyTypeLabel,
  getCleaningFrequencyLabel,
  getInterventionStatusLabel,
  getInterventionStatusHex,
  getInterventionTypeLabel,
  getAmenityHex,
} from '../../utils/statusUtils';
import { airbnbApi } from '../../services/api/airbnbApi';
import { MapboxPropertyMap } from '../../components/MapboxPropertyMap';

// ─── Stable sx constants ────────────────────────────────────────────────────

const TABS_SX = {
  minHeight: 36,
  '& .MuiTab-root': {
    minHeight: 36,
    py: 0.5,
    px: 2,
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'none',
    letterSpacing: '0.01em',
    color: 'text.secondary',
    '&.Mui-selected': {
      fontWeight: 700,
      color: 'primary.main',
    },
  },
  '& .MuiTabs-indicator': {
    height: 2,
    borderRadius: 1,
  },
} as const;

const METRIC_CARD_SX = {
  p: 1.5,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1.5,
  boxShadow: 'none',
  minHeight: 72,
  justifyContent: 'center',
} as const;

const METRIC_ICON_SX = {
  fontSize: 18,
  color: 'primary.main',
  mb: 0.25,
} as const;

const METRIC_VALUE_SX = {
  fontSize: '0.9375rem',
  fontWeight: 700,
  color: 'text.primary',
  lineHeight: 1.2,
} as const;

const METRIC_LABEL_SX = {
  fontSize: '0.625rem',
  fontWeight: 500,
  color: 'text.secondary',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  mt: 0.25,
} as const;

const SECTION_TITLE_SX = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'text.secondary',
  mb: 1,
} as const;

const INFO_ROW_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  py: 0.75,
} as const;

const INFO_LABEL_SX = {
  fontSize: '0.6875rem',
  fontWeight: 500,
  color: 'text.secondary',
} as const;

const INFO_VALUE_SX = {
  fontSize: '0.8125rem',
  fontWeight: 500,
  color: 'text.primary',
} as const;

const STATUS_CHIP_SX = {
  height: 22,
  fontSize: '0.625rem',
  fontWeight: 600,
  borderWidth: 1.5,
  '& .MuiChip-label': { px: 0.75 },
} as const;

const INTERVENTION_CARD_SX = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1.5,
  boxShadow: 'none',
  transition: 'border-color 0.15s ease',
  cursor: 'pointer',
  '&:hover': {
    borderColor: 'primary.main',
  },
} as const;

const EDIT_BUTTON_SX = {
  textTransform: 'none',
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0.01em',
  height: 28,
  px: 1.5,
  '& .MuiButton-startIcon': { mr: 0.5 },
  '& .MuiSvgIcon-root': { fontSize: 14 },
} as const;

const CARD_SX = {
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
  borderRadius: 1.5,
  p: 1.5,
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

function a11yProps(index: number) {
  return {
    id: `property-tab-${index}`,
    'aria-controls': `property-tabpanel-${index}`,
  };
}

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

  const [tabValue, setTabValue] = useState(0);
  const [canEdit, setCanEdit] = useState(false);
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
    const chips: { label: string; hex: string }[] = [];

    if (property.hasExterior) chips.push({ label: t('properties.hasExterior'), hex: '#4A9B8E' });
    if (property.hasLaundry) chips.push({ label: t('properties.hasLaundry'), hex: '#0288d1' });
    if ((property.windowCount ?? 0) > 0 || (property.frenchDoorCount ?? 0) > 0 || (property.slidingDoorCount ?? 0) > 0) {
      const parts = [
        (property.windowCount ?? 0) > 0 && `${property.windowCount} ${t('properties.addOnServices.windowCountShort')}`,
        (property.frenchDoorCount ?? 0) > 0 && `${property.frenchDoorCount} ${t('properties.addOnServices.frenchDoorCountShort')}`,
        (property.slidingDoorCount ?? 0) > 0 && `${property.slidingDoorCount} ${t('properties.addOnServices.slidingDoorCountShort')}`,
      ].filter(Boolean).join(', ');
      chips.push({ label: `${t('properties.addOnServices.windows')}: ${parts}`, hex: '#757575' });
    }
    if (property.hasIroning) chips.push({ label: t('properties.addOnServices.hasIroning'), hex: '#ED6C02' });
    if (property.hasDeepKitchen) chips.push({ label: t('properties.addOnServices.hasDeepKitchen'), hex: '#ED6C02' });
    if (property.hasDisinfection) chips.push({ label: t('properties.addOnServices.hasDisinfection'), hex: '#7B61FF' });
    if (property.numberOfFloors != null && property.numberOfFloors > 1) {
      chips.push({ label: `${property.numberOfFloors} ${t('properties.numberOfFloors').toLowerCase()}`, hex: '#757575' });
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
          backPath="/properties"
          actions={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              {canEdit && (
                <Button
                  variant="outlined"
                  startIcon={<Edit />}
                  onClick={() => navigate(`/properties/${id}/edit`)}
                  size="small"
                  sx={EDIT_BUTTON_SX}
                  title={t('properties.modify')}
                >
                  {t('properties.modify')}
                </Button>
              )}
            </Box>
          }
        />
      </Box>

      {/* ─── Tabs ────────────────────────────────────────────────────────── */}
      <Paper sx={{ borderBottom: 1, borderColor: 'divider', mb: 0, flexShrink: 0, boxShadow: 'none' }}>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          aria-label={t('properties.details')}
          sx={TABS_SX}
        >
          <Tab
            icon={<Info sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={t('properties.tabs.overview')}
            {...a11yProps(0)}
          />
          <Tab
            icon={<Build sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={`${t('properties.tabs.interventions')} (${interventions.length})`}
            {...a11yProps(1)}
          />
          <Tab
            icon={<Hub sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={t('channels.title')}
            {...a11yProps(2)}
          />
          <Tab
            icon={<FlightLand sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={t('channels.checkIn.title')}
            {...a11yProps(3)}
          />
          <Tab
            icon={<PhotoLibrary sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label={t('properties.tabs.photos')}
            {...a11yProps(4)}
          />
        </Tabs>
      </Paper>

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
                <Box sx={{ ...METRIC_CARD_SX, borderColor: 'primary.main', bgcolor: 'primary.50', cursor: 'help' }}>
                  <Payments sx={{ ...METRIC_ICON_SX, color: 'primary.main' }} />
                  <Typography sx={{ ...METRIC_VALUE_SX, color: 'primary.main' }}>
                    {cleaningEstimate ? `${cleaningEstimate.min}€` : '—'}
                  </Typography>
                  <Typography sx={METRIC_LABEL_SX}>{t('properties.cleaningEstimate')}</Typography>
                </Box>
              </Tooltip>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={METRIC_CARD_SX}>
                <Bed sx={METRIC_ICON_SX} />
                <Typography sx={METRIC_VALUE_SX}>{property.bedrooms}</Typography>
                <Typography sx={METRIC_LABEL_SX}>{t('properties.bedrooms')}</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={METRIC_CARD_SX}>
                <Bathroom sx={METRIC_ICON_SX} />
                <Typography sx={METRIC_VALUE_SX}>{property.bathrooms}</Typography>
                <Typography sx={METRIC_LABEL_SX}>{t('properties.bathroomCount')}</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={METRIC_CARD_SX}>
                <SquareFoot sx={METRIC_ICON_SX} />
                <Typography sx={METRIC_VALUE_SX}>{property.surfaceArea} m²</Typography>
                <Typography sx={METRIC_LABEL_SX}>{t('properties.surface')}</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={METRIC_CARD_SX}>
                <Group sx={METRIC_ICON_SX} />
                <Typography sx={METRIC_VALUE_SX}>{property.maxGuests}</Typography>
                <Typography sx={METRIC_LABEL_SX}>{t('properties.maxCapacity')}</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={METRIC_CARD_SX}>
                <CleaningServices sx={METRIC_ICON_SX} />
                <Typography sx={{ ...METRIC_VALUE_SX, fontSize: '0.75rem' }}>
                  {getCleaningFrequencyLabel(property.cleaningFrequency, t)}
                </Typography>
                <Typography sx={METRIC_LABEL_SX}>{t('properties.cleaningFrequency')}</Typography>
              </Box>
            </Grid>
          </Grid>

          {/* ── Prestations à la carte chips ──────────────────────────── */}
          {featureChips.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mr: 0.5 }}>
                {t('properties.addOnServices.title')}
              </Typography>
              {featureChips.map((chip, i) => (
                <Chip
                  key={i}
                  label={chip.label}
                  size="small"
                  sx={{
                    backgroundColor: `${chip.hex}18`,
                    color: chip.hex,
                    border: `1px solid ${chip.hex}40`,
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '0.6875rem',
                    height: 24,
                    '& .MuiChip-label': { px: 1 },
                  }}
                />
              ))}
            </Box>
          )}

          {/* ── Équipements chips ──────────────────────────────────── */}
          {property.amenities && property.amenities.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mr: 0.5 }}>
                {t('properties.amenities.title')}
              </Typography>
              {property.amenities.map((amenity, index) => {
                const c = getAmenityHex(amenity);
                return (
                  <Chip
                    key={index}
                    label={t(`properties.amenities.items.${amenity}`)}
                    size="small"
                    sx={{
                      backgroundColor: `${c}18`,
                      color: c,
                      border: `1px solid ${c}40`,
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '0.6875rem',
                      height: 24,
                      '& .MuiChip-label': { px: 1 },
                    }}
                  />
                );
              })}
            </Box>
          )}

          {/* ── Row 1: Merged info card (3 columns) ──────────────── */}
          <Paper sx={{ ...CARD_SX, mb: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              {/* ── Col 1: Informations générales ──────────────────── */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={SECTION_TITLE_SX}>
                  {t('properties.informationsGeneral')}
                </Typography>
                <Box sx={INFO_ROW_SX}>
                  <LocationOn sx={{ fontSize: 16, color: 'text.secondary' }} />
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
                      <Flag sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={INFO_LABEL_SX}>{t('properties.country')}</Typography>
                        <Typography sx={INFO_VALUE_SX}>{property.country}</Typography>
                      </Box>
                    </Box>
                  </>
                )}
                <Divider sx={{ my: 0.5 }} />
                <Box sx={INFO_ROW_SX}>
                  <Home sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={INFO_LABEL_SX}>{t('properties.type')}</Typography>
                    <Typography sx={INFO_VALUE_SX}>{getPropertyTypeLabel(property.propertyType, t)}</Typography>
                  </Box>
                </Box>
                {property.createdAt && (
                  <>
                    <Divider sx={{ my: 0.5 }} />
                    <Box sx={INFO_ROW_SX}>
                      <CalendarMonth sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={INFO_LABEL_SX}>{t('properties.createdAt')}</Typography>
                        <Typography sx={INFO_VALUE_SX}>{formatDate(property.createdAt)}</Typography>
                      </Box>
                    </Box>
                  </>
                )}
              </Box>

              <Divider orientation="vertical" flexItem />

              {/* ── Col 2: Configuration ───────────────────────────── */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={SECTION_TITLE_SX}>
                  {t('properties.configuration')}
                </Typography>
                <Box sx={INFO_ROW_SX}>
                  <Box>
                    <Typography sx={INFO_LABEL_SX}>{t('properties.status')}</Typography>
                    {(() => { const c = getPropertyStatusHex(property.status); return (
                      <Chip label={getPropertyStatusLabel(property.status, t)} size="small"
                        sx={{ ...STATUS_CHIP_SX, mt: 0.5, backgroundColor: `${c}18`, color: c, border: `1px solid ${c}40`, borderRadius: '6px' }} />
                    ); })()}
                  </Box>
                </Box>
                {property.ownerName && (
                  <>
                    <Divider sx={{ my: 0.5 }} />
                    <Box sx={INFO_ROW_SX}>
                      <Person sx={{ fontSize: 16, color: 'text.secondary' }} />
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
                          <Login sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Box>
                            <Typography sx={INFO_LABEL_SX}>{t('properties.checkInTime')}</Typography>
                            <Typography sx={INFO_VALUE_SX}>{formatTime(property.defaultCheckInTime)}</Typography>
                          </Box>
                        </Box>
                      )}
                      {property.defaultCheckOutTime && (
                        <Box sx={INFO_ROW_SX}>
                          <Logout sx={{ fontSize: 16, color: 'text.secondary' }} />
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
                  <CleaningServices sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={INFO_LABEL_SX}>{t('properties.cleaningFrequency')}</Typography>
                    <Typography sx={INFO_VALUE_SX}>{getCleaningFrequencyLabel(property.cleaningFrequency, t)}</Typography>
                  </Box>
                </Box>
                {property.lastCleaning && (
                  <>
                    <Divider sx={{ my: 0.5 }} />
                    <Box sx={INFO_ROW_SX}>
                      <Schedule sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={INFO_LABEL_SX}>{t('properties.lastCleaning')}</Typography>
                        <Typography sx={INFO_VALUE_SX}>{formatDate(property.lastCleaning)}</Typography>
                      </Box>
                    </Box>
                  </>
                )}
              </Box>

              <Divider orientation="vertical" flexItem />

              {/* ── Col 3: Tarification ménage ─────────────────────── */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={SECTION_TITLE_SX}>
                  {t('properties.cleaningPricing')}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                  {property.cleaningBasePrice != null && property.cleaningBasePrice > 0 && (
                    <Box sx={INFO_ROW_SX}>
                      <Payments sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Box>
                        <Typography sx={INFO_LABEL_SX}>{t('properties.cleaningBasePrice')}</Typography>
                        <Typography sx={{ ...INFO_VALUE_SX, fontWeight: 700, color: 'primary.main' }}>{property.cleaningBasePrice}€</Typography>
                      </Box>
                    </Box>
                  )}
                  {property.cleaningDurationMinutes != null && property.cleaningDurationMinutes > 0 && (
                    <Box sx={INFO_ROW_SX}>
                      <Timer sx={{ fontSize: 16, color: 'text.secondary' }} />
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
                      <Stairs sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Box>
                        <Typography sx={INFO_LABEL_SX}>{t('properties.numberOfFloors')}</Typography>
                        <Typography sx={INFO_VALUE_SX}>{property.numberOfFloors}</Typography>
                      </Box>
                    </Box>
                  )}
                  {property.hasExterior && (
                    <Box sx={INFO_ROW_SX}>
                      <Deck sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography sx={INFO_VALUE_SX}>{t('properties.hasExterior')}</Typography>
                    </Box>
                  )}
                  {property.hasLaundry && (
                    <Box sx={INFO_ROW_SX}>
                      <LocalLaundryService sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography sx={INFO_VALUE_SX}>{t('properties.hasLaundry')}</Typography>
                    </Box>
                  )}
                </Box>
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
                { icon: <VpnKey sx={{ fontSize: 16, color: 'text.secondary' }} />, label: t('channels.checkIn.accessCode'), value: ci.accessCode },
                { icon: <Wifi sx={{ fontSize: 16, color: 'text.secondary' }} />, label: t('channels.checkIn.wifiName'), value: ci.wifiName },
                { icon: <Wifi sx={{ fontSize: 16, color: 'text.secondary' }} />, label: t('channels.checkIn.wifiPassword'), value: ci.wifiPassword },
                { icon: <LocalParking sx={{ fontSize: 16, color: 'text.secondary' }} />, label: t('channels.checkIn.parkingInfo'), value: ci.parkingInfo },
                { icon: <Login sx={{ fontSize: 16, color: 'text.secondary' }} />, label: t('channels.checkIn.arrivalInstructions'), value: ci.arrivalInstructions },
                { icon: <Logout sx={{ fontSize: 16, color: 'text.secondary' }} />, label: t('channels.checkIn.departureInstructions'), value: ci.departureInstructions },
                { icon: <Gavel sx={{ fontSize: 16, color: 'text.secondary' }} />, label: t('channels.checkIn.houseRules'), value: ci.houseRules },
                { icon: <Phone sx={{ fontSize: 16, color: 'text.secondary' }} />, label: t('channels.checkIn.emergencyContact'), value: ci.emergencyContact },
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
                        endIcon={<OpenInNew sx={{ fontSize: 12 }} />}
                        onClick={() => setTabValue(3)}
                        sx={{ fontSize: '0.625rem', textTransform: 'none', fontWeight: 600, minWidth: 0, px: 1, py: 0.25 }}
                      >
                        {t('properties.modify')}
                      </Button>
                    </Box>

                    {/* Compact fields: 2 columns */}
                    {compactFields.length > 0 && (
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: fullWidthFields.length > 0 ? 1 : 0 }}>
                        {compactFields.map((field, idx) => (
                          <Box key={idx} sx={INFO_ROW_SX}>
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
                    {fullWidthFields.map((field, idx) => (
                      <React.Fragment key={idx}>
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
          {interventions.length > 0 ? (
            <Grid container spacing={1}>
              {interventions.map((intervention) => (
                <Grid item xs={12} sm={6} md={4} key={intervention.id}>
                  <Card
                    sx={INTERVENTION_CARD_SX}
                    onClick={() => navigate(`/interventions/${intervention.id}`)}
                  >
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      {/* Type + Status row */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: 'text.primary' }}>
                          {getInterventionTypeLabel(intervention.type, t)}
                        </Typography>
                        {(() => { const c = getInterventionStatusHex(intervention.status); return (
                          <Chip
                            label={getInterventionStatusLabel(intervention.status, t)}
                            size="small"
                            sx={{ ...STATUS_CHIP_SX, backgroundColor: `${c}18`, color: c, border: `1px solid ${c}40`, borderRadius: '6px' }}
                          />
                        ); })()}
                      </Box>

                      {/* Description */}
                      {intervention.description && (
                        <Typography
                          sx={{
                            fontSize: '0.75rem',
                            color: 'text.secondary',
                            mb: 0.75,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: 1.4,
                          }}
                        >
                          {intervention.description}
                        </Typography>
                      )}

                      {/* Footer: date + cost */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CalendarMonth sx={{ fontSize: 12, color: 'text.disabled' }} />
                          <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                            {formatDate(intervention.scheduledDate)}
                          </Typography>
                        </Box>
                        {intervention.cost != null && intervention.cost > 0 && (
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'primary.main' }}>
                            {intervention.cost}€
                          </Typography>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Paper sx={{ border: '1px solid', borderColor: 'divider', boxShadow: 'none', borderRadius: 1.5, p: 3, textAlign: 'center' }}>
              <Build sx={{ fontSize: 32, color: 'text.disabled', mb: 0.5 }} />
              <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', fontWeight: 500 }}>
                {t('properties.noInterventions')}
              </Typography>
            </Paper>
          )}
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
                <Box component="img" src={airbnbLogoSmall} alt="Airbnb" sx={{ width: 28, height: 28, borderRadius: '6px', objectFit: 'contain' }} />
                <Typography sx={{ ...SECTION_TITLE_SX, mb: 0 }}>Airbnb</Typography>
                <Chip
                  label={channelStatus?.airbnb?.linked ? t('channels.connected') : t('channels.notConnected')}
                  size="small"
                  sx={{ ml: 'auto', fontSize: '0.625rem', height: 20, backgroundColor: channelStatus?.airbnb?.linked ? '#4A9B8E18' : '#9e9e9e18', color: channelStatus?.airbnb?.linked ? '#4A9B8E' : '#9e9e9e', border: `1px solid ${channelStatus?.airbnb?.linked ? '#4A9B8E40' : '#9e9e9e40'}`, borderRadius: '6px' }}
                />
              </Box>
              {channelStatus?.airbnb?.linked ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Box sx={INFO_ROW_SX}>
                    <Sync sx={{ fontSize: 16, color: channelStatus.airbnb.syncEnabled ? '#4A9B8E' : '#9e9e9e' }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={INFO_LABEL_SX}>{t('channels.syncStatus.title')}</Typography>
                      <Typography sx={INFO_VALUE_SX}>
                        {channelStatus.airbnb.syncEnabled ? t('channels.syncStatus.syncOn') : t('channels.syncStatus.syncOff')}
                      </Typography>
                    </Box>
                  </Box>
                  {channelStatus.airbnb.lastSyncAt && (
                    <Box sx={INFO_ROW_SX}>
                      <Schedule sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={INFO_LABEL_SX}>{t('channels.syncStatus.lastSync')}</Typography>
                        <Typography sx={INFO_VALUE_SX}>{new Date(channelStatus.airbnb.lastSyncAt).toLocaleString('fr-FR')}</Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              ) : (
                <Button size="small" variant="outlined" startIcon={<Hub sx={{ fontSize: 14 }} />} onClick={() => navigate('/channels')} sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
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
                  <Box component="img" src={ch.logo} alt={ch.name} sx={{ width: 28, height: 28, borderRadius: '6px', objectFit: 'contain' }} />
                  <Typography sx={{ ...SECTION_TITLE_SX, mb: 0 }}>{ch.name}</Typography>
                  <Chip
                    label={t('channels.notConnected')}
                    size="small"
                    sx={{ ml: 'auto', fontSize: '0.625rem', height: 20, backgroundColor: '#9e9e9e18', color: '#9e9e9e', border: '1px solid #9e9e9e40', borderRadius: '6px' }}
                  />
                </Box>
                <Button size="small" variant="outlined" startIcon={<Hub sx={{ fontSize: 14 }} />} onClick={() => navigate('/channels')} sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
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
    </Box>
  );
};

export default PropertyDetails;
