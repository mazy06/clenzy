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
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePropertyDetails } from '../../hooks/usePropertyDetails';
import type { PropertyDetailsData } from '../../hooks/usePropertyDetails';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import { formatDate } from '../../utils/formatUtils';
import DescriptionNotesDisplay from '../../components/DescriptionNotesDisplay';
import {
  getPropertyStatusColor,
  getPropertyStatusLabel,
  getPropertyTypeLabel,
  getCleaningFrequencyLabel,
  getInterventionStatusColor,
  getInterventionStatusLabel,
  getInterventionTypeLabel,
} from '../../utils/statusUtils';

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

const FEATURE_CHIP_SX = {
  height: 24,
  fontSize: '0.6875rem',
  fontWeight: 500,
  '& .MuiChip-label': { px: 1 },
} as const;

// ─── Amenity → category color mapping ───────────────────────────────────────

type ChipColor = 'primary' | 'success' | 'info' | 'warning' | 'secondary' | 'default';

const AMENITY_CATEGORY_MAP: Record<string, ChipColor> = {
  // Confort → primary (bleu Clenzy)
  WIFI: 'primary', TV: 'primary', AIR_CONDITIONING: 'primary', HEATING: 'primary',
  // Cuisine → success (vert)
  EQUIPPED_KITCHEN: 'success', DISHWASHER: 'success', MICROWAVE: 'success', OVEN: 'success',
  // Électroménager → info (bleu clair)
  WASHING_MACHINE: 'info', DRYER: 'info', IRON: 'info', HAIR_DRYER: 'info',
  // Extérieur → warning (orange)
  PARKING: 'warning', POOL: 'warning', JACUZZI: 'warning', GARDEN_TERRACE: 'warning', BARBECUE: 'warning',
  // Sécurité & Famille → secondary (violet)
  SAFE: 'secondary', BABY_BED: 'secondary', HIGH_CHAIR: 'secondary',
};

function getAmenityColor(amenity: string): ChipColor {
  return AMENITY_CATEGORY_MAP[amenity] || 'default';
}

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

  // ─── Permissions (lightweight, kept as useEffect) ───────────────────────
  useEffect(() => {
    const checkPermissions = async () => {
      const canEditPermission = await hasPermissionAsync('properties:edit');
      setCanEdit(canEditPermission);
    };
    checkPermissions();
  }, [hasPermissionAsync]);

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
    const chips: { label: string; color: 'primary' | 'secondary' | 'default' | 'info' | 'success' | 'warning' }[] = [];

    if (property.hasExterior) chips.push({ label: t('properties.hasExterior'), color: 'success' });
    if (property.hasLaundry) chips.push({ label: t('properties.hasLaundry'), color: 'info' });
    if ((property.windowCount ?? 0) > 0 || (property.frenchDoorCount ?? 0) > 0 || (property.slidingDoorCount ?? 0) > 0) {
      const parts = [
        (property.windowCount ?? 0) > 0 && `${property.windowCount} ${t('properties.addOnServices.windowCountShort')}`,
        (property.frenchDoorCount ?? 0) > 0 && `${property.frenchDoorCount} ${t('properties.addOnServices.frenchDoorCountShort')}`,
        (property.slidingDoorCount ?? 0) > 0 && `${property.slidingDoorCount} ${t('properties.addOnServices.slidingDoorCountShort')}`,
      ].filter(Boolean).join(', ');
      chips.push({ label: `${t('properties.addOnServices.windows')}: ${parts}`, color: 'default' });
    }
    if (property.hasIroning) chips.push({ label: t('properties.addOnServices.hasIroning'), color: 'warning' });
    if (property.hasDeepKitchen) chips.push({ label: t('properties.addOnServices.hasDeepKitchen'), color: 'warning' });
    if (property.hasDisinfection) chips.push({ label: t('properties.addOnServices.hasDisinfection'), color: 'secondary' });
    if (property.numberOfFloors != null && property.numberOfFloors > 1) {
      chips.push({ label: `${property.numberOfFloors} ${t('properties.numberOfFloors').toLowerCase()}`, color: 'default' });
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
              <Chip
                label={getPropertyStatusLabel(property.status, t)}
                color={getPropertyStatusColor(property.status)}
                size="small"
                variant="outlined"
                sx={STATUS_CHIP_SX}
              />
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
              <Box sx={{ ...METRIC_CARD_SX, borderColor: 'primary.main', bgcolor: 'primary.50' }}>
                <Payments sx={{ ...METRIC_ICON_SX, color: 'primary.main' }} />
                <Typography sx={{ ...METRIC_VALUE_SX, color: 'primary.main' }}>
                  {cleaningEstimate ? `${cleaningEstimate.min}€` : '—'}
                </Typography>
                <Typography sx={METRIC_LABEL_SX}>{t('properties.cleaningEstimate')}</Typography>
              </Box>
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

          {/* ── Feature chips (active options) ────────────────────────── */}
          {featureChips.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
              {featureChips.map((chip, i) => (
                <Chip
                  key={i}
                  label={chip.label}
                  color={chip.color}
                  size="small"
                  variant="outlined"
                  sx={FEATURE_CHIP_SX}
                />
              ))}
            </Box>
          )}

          {/* ── Two-column detail layout ───────────────────────────────── */}
          <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
            {/* ── Left column: Infos générales ──────────────────────── */}
            <Box sx={{ flex: 7, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {/* Address & Location */}
              <Paper sx={CARD_SX}>
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
                    <Typography sx={INFO_VALUE_SX}>
                      {getPropertyTypeLabel(property.propertyType, t)}
                    </Typography>
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
              </Paper>

              {/* Description du logement & Consignes de ménage */}
              {(property.description || property.cleaningNotes) && (
                <DescriptionNotesDisplay
                  description={property.description}
                  notes={property.cleaningNotes}
                  variant="cleaning"
                />
              )}

              {/* Amenities */}
              {property.amenities && property.amenities.length > 0 && (
                <Paper sx={CARD_SX}>
                  <Typography sx={SECTION_TITLE_SX}>
                    {t('properties.amenities.title')}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {property.amenities.map((amenity, index) => (
                      <Chip
                        key={index}
                        label={t(`properties.amenities.items.${amenity}`)}
                        size="small"
                        color={getAmenityColor(amenity)}
                        variant="outlined"
                        sx={{
                          height: 26,
                          fontSize: '0.6875rem',
                          fontWeight: 500,
                          borderWidth: 1.5,
                          '& .MuiChip-label': { px: 1 },
                        }}
                      />
                    ))}
                  </Box>
                </Paper>
              )}
            </Box>

            {/* ── Right column: Configuration & Ménage ──────────────── */}
            <Box sx={{ flex: 5, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {/* Configuration */}
              <Paper sx={CARD_SX}>
                <Typography sx={SECTION_TITLE_SX}>
                  {t('properties.configuration')}
                </Typography>

                <Box sx={{ ...INFO_ROW_SX, justifyContent: 'space-between' }}>
                  <Box>
                    <Typography sx={INFO_LABEL_SX}>{t('properties.status')}</Typography>
                    <Chip
                      label={getPropertyStatusLabel(property.status, t)}
                      color={getPropertyStatusColor(property.status)}
                      size="small"
                      variant="outlined"
                      sx={{ ...STATUS_CHIP_SX, mt: 0.5 }}
                    />
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
                    <Box sx={{ display: 'flex', gap: 2 }}>
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
                    <Typography sx={INFO_VALUE_SX}>
                      {getCleaningFrequencyLabel(property.cleaningFrequency, t)}
                    </Typography>
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
              </Paper>

              {/* Tarification ménage */}
              {(property.cleaningBasePrice != null || property.cleaningDurationMinutes != null || property.numberOfFloors != null || property.hasExterior || property.hasLaundry) && (
                <Paper sx={CARD_SX}>
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

                </Paper>
              )}

              {/* Prestations à la carte */}
              {((property.windowCount ?? 0) > 0 || (property.frenchDoorCount ?? 0) > 0 || (property.slidingDoorCount ?? 0) > 0 || property.hasIroning || property.hasDeepKitchen || property.hasDisinfection) && (
                <Paper sx={CARD_SX}>
                  <Typography sx={SECTION_TITLE_SX}>
                    {t('properties.addOnServices.title')}
                  </Typography>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    {/* Windows summary */}
                    {((property.windowCount ?? 0) > 0 || (property.frenchDoorCount ?? 0) > 0 || (property.slidingDoorCount ?? 0) > 0) && (
                      <Box sx={INFO_ROW_SX}>
                        <Window sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Box>
                          <Typography sx={INFO_LABEL_SX}>{t('properties.addOnServices.windows')}</Typography>
                          <Typography sx={INFO_VALUE_SX}>
                            {[
                              (property.windowCount ?? 0) > 0 && `${property.windowCount} ${t('properties.addOnServices.windowCountShort')}`,
                              (property.frenchDoorCount ?? 0) > 0 && `${property.frenchDoorCount} ${t('properties.addOnServices.frenchDoorCountShort')}`,
                              (property.slidingDoorCount ?? 0) > 0 && `${property.slidingDoorCount} ${t('properties.addOnServices.slidingDoorCountShort')}`,
                            ].filter(Boolean).join(', ')}
                          </Typography>
                        </Box>
                      </Box>
                    )}

                    {property.hasIroning && (
                      <Box sx={INFO_ROW_SX}>
                        <Iron sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography sx={INFO_VALUE_SX}>{t('properties.addOnServices.hasIroning')}</Typography>
                      </Box>
                    )}

                    {property.hasDeepKitchen && (
                      <Box sx={INFO_ROW_SX}>
                        <Kitchen sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography sx={INFO_VALUE_SX}>{t('properties.addOnServices.hasDeepKitchen')}</Typography>
                      </Box>
                    )}

                    {property.hasDisinfection && (
                      <Box sx={INFO_ROW_SX}>
                        <Sanitizer sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography sx={INFO_VALUE_SX}>{t('properties.addOnServices.hasDisinfection')}</Typography>
                      </Box>
                    )}
                  </Box>
                </Paper>
              )}
            </Box>
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
                        <Chip
                          label={getInterventionStatusLabel(intervention.status, t)}
                          color={getInterventionStatusColor(intervention.status)}
                          size="small"
                          variant="outlined"
                          sx={STATUS_CHIP_SX}
                        />
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
    </Box>
  );
};

export default PropertyDetails;
