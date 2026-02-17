import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Divider,
} from '@mui/material';
import {
  Edit,
  Delete,
  Visibility,
  LocationOn,
  Home,
  Apartment,
  Villa,
  Hotel,
  Person as PersonIcon,
  Bed as BedIcon,
  Bathroom as BathroomIcon,
  CleaningServices,
  Close,
  SquareFoot,
  MoreVert,
  Schedule,
  Payments,
  AutoAwesome,
  Timer,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { getPropertyTypeBannerUrl } from '../../utils/propertyTypeBanner';
import { formatDate } from '../../utils/formatUtils';
import {
  getPropertyStatusColor,
  getPropertyStatusLabel,
  getPropertyTypeLabel,
  getCleaningFrequencyLabel,
} from '../../utils/statusUtils';
import ThemedTooltip from '../../components/ThemedTooltip';

// Interface pour les propriétés détaillées
export interface PropertyDetails {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  propertyType: string;
  status: string;
  nightlyPrice: number;
  bedrooms: number;
  bathrooms: number;
  surfaceArea: number;
  description: string;
  amenities: string[];
  cleaningFrequency: string;
  maxGuests: number;
  contactPhone: string;
  contactEmail: string;
  rating?: number;
  lastCleaning?: string;
  nextCleaning?: string;
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
  cleaningBasePrice?: number;
  numberOfFloors?: number;
  hasExterior?: boolean;
  hasLaundry?: boolean;
}

interface PropertyCardProps {
  property: PropertyDetails;
  onEdit?: () => void;
  onDelete?: () => void;
  onView?: () => void;
}

// Gradient par type de propriété
const typeGradients: Record<string, string> = {
  apartment: 'linear-gradient(135deg, #6B8A9A 0%, #8BA3B3 100%)',
  appartement: 'linear-gradient(135deg, #6B8A9A 0%, #8BA3B3 100%)',
  house: 'linear-gradient(135deg, #4A9B8E 0%, #6BB5A8 100%)',
  maison: 'linear-gradient(135deg, #4A9B8E 0%, #6BB5A8 100%)',
  villa: 'linear-gradient(135deg, #D4A574 0%, #E8C19A 100%)',
  studio: 'linear-gradient(135deg, #7BA3C2 0%, #9BB8D1 100%)',
};

const styles = {
  // ── Card ──
  cardRoot: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: '0 12px 28px rgba(0,0,0,0.12), 0 4px 10px rgba(0,0,0,0.08)',
    },
  },
  bannerBox: {
    position: 'relative',
    height: 110,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badgeBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    px: 1.5,
    py: 0.75,
    bgcolor: 'grey.50',
    borderBottom: '1px solid',
    borderColor: 'grey.100',
    gap: 0.75,
    minHeight: 34,
  },
  statusChip: {
    height: 22,
    fontSize: '0.62rem',
    fontWeight: 600,
    borderWidth: 1.5,
    '& .MuiChip-label': { px: 0.75 },
  },
  priceChip: {
    height: 22,
    fontSize: '0.62rem',
    fontWeight: 600,
    borderWidth: 1.5,
    '& .MuiChip-label': { px: 0.75 },
  },
  dateBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 0.4,
    flexShrink: 0,
  },
  dateText: {
    color: 'text.secondary',
    fontWeight: 600,
    fontSize: '0.68rem',
    lineHeight: 1,
  },
  infoContent: {
    flexGrow: 1,
    p: 1.75,
    pb: '12px !important',
  },
  nameText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '0.95rem',
    mb: 0.5,
    color: 'text.primary',
  },
  addressText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    fontSize: '0.7rem',
  },
  metricsRow: {
    display: 'flex',
    gap: 0.75,
    mb: 1.25,
    flexWrap: 'wrap',
  },
  metricBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 0.4,
    bgcolor: 'grey.100',
    borderRadius: 1,
    px: 0.75,
    py: 0.35,
  },
  metricIconBox: {
    color: 'text.secondary',
    display: 'flex',
    alignItems: 'center',
  },
  amenityOverflow: {
    fontSize: '0.62rem',
    height: 20,
    bgcolor: 'grey.100',
    color: 'text.secondary',
  },
  actionBar: {
    px: 1.75,
    pb: 1.25,
    pt: 0,
    display: 'flex',
    gap: 0.75,
  },
  detailsButton: {
    fontSize: '0.72rem',
    py: 0.5,
    borderColor: 'grey.300',
    color: 'text.secondary',
    '&:hover': {
      borderColor: 'primary.main',
      color: 'primary.main',
      bgcolor: 'rgba(107, 138, 154, 0.04)',
    },
  },

  // ── Dialog ──
  dialogTitleBox: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dialogIconBox: {
    width: 40,
    height: 40,
    borderRadius: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogCharacteristicsRow: {
    display: 'flex',
    gap: 2,
    flexWrap: 'wrap',
  },
  dialogMetricBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    bgcolor: 'grey.50',
    border: '1px solid',
    borderColor: 'grey.200',
    borderRadius: 1.5,
    px: 1.5,
    py: 1,
    minWidth: 120,
  },
  dialogDescription: {
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 4,
    WebkitBoxOrient: 'vertical',
    lineHeight: 1.4,
  },
} as const;

// ─── Amenity → category color mapping ───────────────────────────────────────

type AmenityChipColor = 'primary' | 'success' | 'info' | 'warning' | 'secondary' | 'default';

const AMENITY_CATEGORY_MAP: Record<string, AmenityChipColor> = {
  WIFI: 'primary', TV: 'primary', AIR_CONDITIONING: 'primary', HEATING: 'primary',
  EQUIPPED_KITCHEN: 'success', DISHWASHER: 'success', MICROWAVE: 'success', OVEN: 'success',
  WASHING_MACHINE: 'info', DRYER: 'info', IRON: 'info', HAIR_DRYER: 'info',
  PARKING: 'warning', POOL: 'warning', JACUZZI: 'warning', GARDEN_TERRACE: 'warning', BARBECUE: 'warning',
  SAFE: 'secondary', BABY_BED: 'secondary', HIGH_CHAIR: 'secondary',
};

function getAmenityColor(amenity: string): AmenityChipColor {
  return AMENITY_CATEGORY_MAP[amenity] || 'default';
}

// ─── Cleaning estimation (lightweight version for cards) ────────────────────

const SURFACE_TIERS: { maxSurface: number | null; base: number }[] = [
  { maxSurface: 30, base: 35 }, { maxSurface: 50, base: 45 },
  { maxSurface: 70, base: 55 }, { maxSurface: 100, base: 70 },
  { maxSurface: 150, base: 90 }, { maxSurface: null, base: 110 },
];

function estimateCleaningPrice(p: PropertyDetails): number | null {
  const sqm = p.surfaceArea ?? 0;
  const hasBase = p.cleaningBasePrice != null && p.cleaningBasePrice > 0;
  if (sqm <= 0 && !hasBase) return null;

  const base = hasBase
    ? p.cleaningBasePrice!
    : (SURFACE_TIERS.find(t => t.maxSurface === null || sqm <= t.maxSurface)?.base ?? 110);

  let surcharge = 0;
  surcharge += Math.max(0, (p.bedrooms ?? 1) - 1) * 5;
  surcharge += Math.max(0, (p.bathrooms ?? 1) - 1) * 4;
  if ((p.numberOfFloors ?? 0) > 1) surcharge += ((p.numberOfFloors ?? 1) - 1) * 8;
  if (p.hasExterior) surcharge += 12;
  if (p.hasLaundry) surcharge += 8;
  if ((p.maxGuests ?? 2) > 4) surcharge += ((p.maxGuests ?? 2) - 4) * 3;

  return Math.max(30, Math.round((base + surcharge) / 5) * 5);
}

// ─── Duration estimation (lightweight version for cards) ─────────────────────

function estimateCleaningDuration(p: PropertyDetails): number | null {
  const bedrooms = p.bedrooms ?? 1;
  const bathrooms = p.bathrooms ?? 1;
  const sqm = p.surfaceArea ?? 0;

  if (sqm <= 0 && bedrooms <= 0) return null;

  // Base from bedroom count (type T)
  let mins: number;
  if (bedrooms <= 1)       mins = 90;
  else if (bedrooms === 2) mins = 120;
  else if (bedrooms === 3) mins = 150;
  else if (bedrooms === 4) mins = 180;
  else                      mins = 210;

  // Extra bathrooms (+15 min each above 1)
  if (bathrooms > 1) mins += (bathrooms - 1) * 15;

  // Surface surcharge (>80m² → +1 min per 5m²)
  if (sqm > 80) mins += Math.floor((sqm - 80) / 5);

  // Extra floors (+15 min each above 1)
  if ((p.numberOfFloors ?? 0) > 1) mins += ((p.numberOfFloors ?? 1) - 1) * 15;

  // Boolean add-ons
  if (p.hasLaundry) mins += 10;
  if (p.hasExterior) mins += 25;

  return mins;
}

function formatDuration(mins: number): string {
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  if (hours === 0) return `${mins}min`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h${String(remainder).padStart(2, '0')}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

const PropertyCard: React.FC<PropertyCardProps> = React.memo(({ property, onEdit, onDelete, onView }) => {
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();
  const { t } = useTranslation();
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Vérifier les permissions
  const [canEdit, setCanEdit] = useState(false);
  const [canDelete, setCanDelete] = useState(false);

  useEffect(() => {
    const checkPermissions = async () => {
      const [editPerm, deletePerm] = await Promise.all([
        hasPermissionAsync('properties:edit'),
        hasPermissionAsync('properties:delete'),
      ]);
      setCanEdit(editPerm);
      setCanDelete(deletePerm);
    };
    checkPermissions();
  }, [hasPermissionAsync]);

  // Estimation du prix et de la durée de ménage
  const cleaningPrice = useMemo(() => estimateCleaningPrice(property), [property]);
  const cleaningDuration = useMemo(() => estimateCleaningDuration(property), [property]);

  // Obtenir l'icône du type de propriété
  const getPropertyTypeIcon = (type: string, size: number = 48) => {
    const iconProps = { sx: { fontSize: size, color: 'rgba(255,255,255,0.35)' } };
    switch (type.toLowerCase()) {
      case 'appartement':
      case 'apartment':
        return <Apartment {...iconProps} />;
      case 'maison':
      case 'house':
        return <Home {...iconProps} />;
      case 'villa':
        return <Villa {...iconProps} />;
      case 'studio':
        return <Hotel {...iconProps} />;
      default:
        return <Home {...iconProps} />;
    }
  };

  // Obtenir le gradient basé sur le type
  const getGradient = (type: string): string => {
    return typeGradients[type.toLowerCase()] || typeGradients.apartment;
  };

  const handleViewDetails = () => {
    if (onView) {
      onView();
    } else {
      setDetailsOpen(true);
    }
  };

  return (
    <>
      {/* Carte principale — Design moderne */}
      <Card
        sx={styles.cardRoot}
        onClick={handleViewDetails}
      >
        {/* ─── Zone visuelle : Bandeau gradient ─── */}
        <Box
          sx={{
            ...styles.bannerBox,
            background: getGradient(property.propertyType),
            backgroundImage: `linear-gradient(rgba(0,0,0,0.10), rgba(0,0,0,0.35)), url(${getPropertyTypeBannerUrl(property.propertyType)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
        </Box>

        {/* ─── Barre de badges (entre bandeau et contenu) ─── */}
        <Box sx={styles.badgeBar}>
          {/* Gauche : statut + prix nuit (si renseigné) */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            <Chip
              label={getPropertyStatusLabel(property.status, t)}
              color={getPropertyStatusColor(property.status)}
              size="small"
              variant="outlined"
              sx={styles.statusChip}
            />
            {property.nightlyPrice > 0 && (
              <Chip
                label={`${property.nightlyPrice}€/nuit`}
                size="small"
                variant="outlined"
                sx={styles.priceChip}
              />
            )}
          </Box>

          {/* Droite : estimation ménage + date */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            {cleaningPrice != null && (
              <ThemedTooltip
                title={
                  <Typography sx={{ fontSize: '0.6875rem', lineHeight: 1.5 }}>
                    {t('properties.cleaningEstimateTooltip')}
                  </Typography>
                }
                arrow
                placement="top"
              >
                <Chip
                  icon={<Payments sx={{ fontSize: 12 }} />}
                  label={`${cleaningPrice}€ estimé / ménage`}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ ...styles.priceChip, '& .MuiChip-icon': { fontSize: 12, ml: 0.5 }, cursor: 'default' }}
                />
              </ThemedTooltip>
            )}
            {cleaningDuration != null && (
              <ThemedTooltip
                title={
                  <Typography sx={{ fontSize: '0.6875rem', lineHeight: 1.5 }}>
                    {t('properties.cleaningDurationTooltip')}
                  </Typography>
                }
                arrow
                placement="top"
              >
                <Chip
                  icon={<Timer sx={{ fontSize: 12 }} />}
                  label={`~${formatDuration(cleaningDuration)}`}
                  size="small"
                  color="info"
                  variant="outlined"
                  sx={{ ...styles.priceChip, '& .MuiChip-icon': { fontSize: 12, ml: 0.5 }, cursor: 'default' }}
                />
              </ThemedTooltip>
            )}
            {(property.createdAt || property.nextCleaning || property.lastCleaning) && (
              <Box sx={styles.dateBox}>
                <Schedule sx={{ fontSize: 13, color: 'text.secondary' }} />
                <Typography
                  variant="caption"
                  sx={styles.dateText}
                >
                  {new Date(property.nextCleaning || property.lastCleaning || property.createdAt || '').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* ─── Zone info ─── */}
        <CardContent sx={styles.infoContent}>
          {/* Nom */}
          <Typography
            variant="subtitle1"
            fontWeight={700}
            sx={styles.nameText}
            title={property.name}
          >
            {property.name}
          </Typography>

          {/* Adresse */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.25 }}>
            <LocationOn sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={styles.addressText}
              title={`${property.address}, ${property.postalCode} ${property.city}, ${property.country}`}
            >
              {property.address}, {property.postalCode} {property.city}
            </Typography>
          </Box>

          {/* Métriques + Commodités — deux colonnes */}
          <Box sx={{ display: 'flex', gap: 1, mb: 1.25 }}>
            {/* Colonne gauche : métriques */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, flex: 1, minWidth: 0 }}>
              {[
                { icon: <BedIcon sx={{ fontSize: 13 }} />, value: property.bedrooms, label: 'ch.' },
                { icon: <BathroomIcon sx={{ fontSize: 13 }} />, value: property.bathrooms, label: 'sdb' },
                { icon: <SquareFoot sx={{ fontSize: 13 }} />, value: property.surfaceArea, label: 'm²' },
                { icon: <PersonIcon sx={{ fontSize: 13 }} />, value: property.maxGuests, label: 'voy.' },
              ].map((metric, idx) => (
                <Chip
                  key={idx}
                  icon={metric.icon}
                  label={`${metric.value} ${metric.label}`}
                  size="small"
                  variant="outlined"
                  sx={{
                    height: 22,
                    fontSize: '0.62rem',
                    fontWeight: 600,
                    borderWidth: 1.5,
                    borderColor: 'grey.300',
                    '& .MuiChip-icon': { fontSize: 13, ml: 0.5 },
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              ))}
            </Box>

            {/* Colonne droite : commodités */}
            {property.amenities && property.amenities.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
                {property.amenities.slice(0, 3).map((amenity, index) => (
                  <Chip
                    key={index}
                    label={t(`properties.amenities.items.${amenity}`)}
                    size="small"
                    color={getAmenityColor(amenity)}
                    variant="outlined"
                    sx={{ fontSize: '0.62rem', height: 22, borderWidth: 1.5, '& .MuiChip-label': { px: 0.75 } }}
                  />
                ))}
                {property.amenities.length > 3 && (
                  <ThemedTooltip
                    title={
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {property.amenities.map((a, i) => (
                          <Chip
                            key={i}
                            label={t(`properties.amenities.items.${a}`)}
                            color={getAmenityColor(a)}
                            variant="outlined"
                            size="small"
                            sx={{ fontSize: '0.6rem', height: 20, borderWidth: 1.5, '& .MuiChip-label': { px: 0.75 } }}
                          />
                        ))}
                      </Box>
                    }
                    arrow
                    placement="top"
                  >
                    <Chip
                      label={`+${property.amenities.length - 3}`}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.62rem', height: 22, borderWidth: 1.5, borderColor: 'grey.300', color: 'text.secondary', '& .MuiChip-label': { px: 0.75 }, cursor: 'default' }}
                    />
                  </ThemedTooltip>
                )}
              </Box>
            )}
          </Box>

          {/* Fréquence de nettoyage */}
          <Chip
            icon={<AutoAwesome sx={{ fontSize: 12 }} />}
            label={getCleaningFrequencyLabel(property.cleaningFrequency, t)}
            size="small"
            variant="outlined"
            color="primary"
            sx={{
              alignSelf: 'flex-start',
              height: 22,
              fontSize: '0.62rem',
              fontWeight: 600,
              borderWidth: 1.5,
              '& .MuiChip-icon': { fontSize: 12, ml: 0.5 },
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        </CardContent>

        {/* ─── Zone actions ─── */}
        <Box sx={styles.actionBar}>
          <Button
            fullWidth
            size="small"
            startIcon={<Visibility sx={{ fontSize: 15 }} />}
            onClick={(e) => { e.stopPropagation(); handleViewDetails(); }}
            variant="outlined"
            sx={styles.detailsButton}
          >
            Détails
          </Button>
          {canEdit && onEdit && (
            <Button
              fullWidth
              size="small"
              startIcon={<Edit sx={{ fontSize: 15 }} />}
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              variant="outlined"
              color="primary"
              sx={{ fontSize: '0.72rem', py: 0.5 }}
            >
              Modifier
            </Button>
          )}
        </Box>
      </Card>

      {/* ─── Dialog des détails complets ─── */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
        onClick={(e) => e.stopPropagation()}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={styles.dialogTitleBox}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  ...styles.dialogIconBox,
                  background: getGradient(property.propertyType),
                }}
              >
                {getPropertyTypeIcon(property.propertyType, 22)}
              </Box>
              <Box>
                <Typography variant="h6" component="h2" sx={{ lineHeight: 1.2 }}>
                  {property.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {getPropertyTypeLabel(property.propertyType, t)} • {getPropertyStatusLabel(property.status, t)}
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={() => setDetailsOpen(false)} size="small">
              <Close sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 1.5 }}>
          <Grid container spacing={2}>
            {/* Adresse */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.75, color: 'primary.main' }}>
                Adresse
              </Typography>
              <Typography variant="body2">
                {property.address}, {property.postalCode} {property.city}, {property.country}
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Divider />
            </Grid>

            {/* Caractéristiques */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, color: 'primary.main' }}>
                Caractéristiques
              </Typography>
              <Box sx={styles.dialogCharacteristicsRow}>
                {[
                  { icon: <BedIcon sx={{ fontSize: 18 }} />, value: property.bedrooms, label: 'Chambres' },
                  { icon: <BathroomIcon sx={{ fontSize: 18 }} />, value: property.bathrooms, label: 'Salles de bain' },
                  { icon: <SquareFoot sx={{ fontSize: 18 }} />, value: `${property.surfaceArea} m²`, label: 'Surface' },
                  { icon: <PersonIcon sx={{ fontSize: 18 }} />, value: property.maxGuests, label: 'Voyageurs max' },
                ].map((item, idx) => (
                  <Box
                    key={idx}
                    sx={styles.dialogMetricBox}
                  >
                    <Box sx={{ color: 'primary.main', display: 'flex' }}>{item.icon}</Box>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{item.value}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>{item.label}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Divider />
            </Grid>

            {/* Estimation ménage + prix nuit */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.75, color: 'primary.main' }}>
                {t('properties.cleaningEstimate')}
              </Typography>
              {cleaningPrice != null ? (
                <Typography variant="h5" fontWeight={700} color="primary.main">
                  {cleaningPrice}€ <Typography component="span" variant="caption" color="text.secondary">{t('properties.priceEstimation.perIntervention')}</Typography>
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">—</Typography>
              )}
              {property.nightlyPrice > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {property.nightlyPrice}€ / {t('properties.perNight')}
                </Typography>
              )}
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.75, color: 'primary.main' }}>
                Nettoyage
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <CleaningServices sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="body2">{getCleaningFrequencyLabel(property.cleaningFrequency, t)}</Typography>
              </Box>
            </Grid>

            {/* Commodités */}
            {property.amenities && property.amenities.length > 0 && (
              <>
                <Grid item xs={12}>
                  <Divider />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, color: 'primary.main' }}>
                    Commodités
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {property.amenities.map((amenity, index) => (
                      <Chip
                        key={index}
                        label={t(`properties.amenities.items.${amenity}`)}
                        color={getAmenityColor(amenity)}
                        variant="outlined"
                        size="small"
                        sx={{ fontSize: '0.72rem', height: 24, borderWidth: 1.5, '& .MuiChip-label': { px: 0.75 } }}
                      />
                    ))}
                  </Box>
                </Grid>
              </>
            )}

            {/* Contact */}
            <Grid item xs={12}>
              <Divider />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.75, color: 'primary.main' }}>
                Contact
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.25 }}>
                {property.contactPhone || 'Téléphone non renseigné'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {property.contactEmail || 'Email non renseigné'}
              </Typography>
            </Grid>

            {/* Description */}
            {property.description && (
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.75, color: 'primary.main' }}>
                  Description
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={styles.dialogDescription}
                >
                  {property.description}
                </Typography>
              </Grid>
            )}
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          {canDelete && onDelete && (
            <Button
              onClick={onDelete}
              color="error"
              variant="outlined"
              size="small"
              startIcon={<Delete sx={{ fontSize: 16 }} />}
            >
              Supprimer
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => setDetailsOpen(false)} size="small" variant="outlined">
            Fermer
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
});

PropertyCard.displayName = 'PropertyCard';

export default PropertyCard;
