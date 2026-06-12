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
} from '../../icons';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { getPropertyTypeBannerUrl } from '../../utils/propertyTypeBanner';
import { formatDate } from '../../utils/formatUtils';
import {
  getPropertyStatusLabel,
  getPropertyTypeLabel,
  getCleaningFrequencyLabel,
  getCleaningFrequencyHex,
} from '../../utils/statusUtils';
import { propertyStatusChipSx, softDataChipSx, FIELD_CHIP_SX } from './propertiesListConstants';
import ChannexHealthBadge from '../settings/components/ChannexHealthBadge';
import MissingContractChip from './MissingContractChip';
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
  lastCleaning?: string;
  nextCleaning?: string;
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
  cleaningBasePrice?: number;
  numberOfFloors?: number;
  hasExterior?: boolean;
  hasLaundry?: boolean;
  defaultCheckInTime?: string;
  defaultCheckOutTime?: string;
}

interface PropertyCardProps {
  property: PropertyDetails;
  onEdit?: () => void;
  onDelete?: () => void;
  onView?: () => void;
  /**
   * Mapping Channex de cette propriete (si elle est connectee au Channel Manager).
   * Quand fourni, un petit badge de sante est affiche pres du nom (Quick Win #4).
   * Pour les roles non-SUPER_*, ce sera toujours undefined → aucun badge.
   */
  channexMapping?: import('../../services/api/channexApi').ChannexMappingDto | null;
  /** Callback declenche quand l'utilisateur clique sur le badge Channex. */
  onChannexBadgeClick?: () => void;
  /** Vrai si la propriété n'a pas de contrat de gestion vivant (gate de rattrapage). */
  missingContract?: boolean;
  /** Callback déclenché au clic sur le badge « Contrat manquant ». */
  onMissingContractClick?: () => void;
}

// Styles alignés sur DESIGN_BASELINE + référence maquette .pr-card (screen-properties).
const styles = {
  // ── Card ── (.pr-card : hairline r14 du thème, hover border --line-2 + shadow-card)
  cardRoot: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'border-color .14s, box-shadow .14s, transform .14s',
    '&:hover': {
      borderColor: 'var(--line-2)',
      boxShadow: 'var(--shadow-card)',
      transform: 'translateY(-2px)',
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
      '&:hover': { transform: 'none' },
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
    bgcolor: 'var(--surface-2)',
    borderBottom: '1px solid var(--line)',
    gap: 0.75,
    minHeight: 34,
  },
  // Géométrie pilule héritée du thème global MuiChip (r999, 10.5px, fw700, h22).
  statusChip: {
    '& .MuiChip-label': { px: 1 },
  },
  priceChip: {
    color: 'var(--body)',
    borderColor: 'var(--line-2)',
    bgcolor: 'var(--card)',
    '& .MuiChip-label': { px: 1 },
  },
  dateBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 0.4,
    flexShrink: 0,
  },
  dateText: {
    color: 'var(--muted)',
    fontWeight: 600,
    fontSize: '11px',
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
  },
  infoContent: {
    flexGrow: 1,
    p: 1.75,
    pb: '12px !important',
  },
  // .pr-nm — nom d'entité en display
  nameText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-display)',
    fontSize: '15px',
    fontWeight: 600,
    letterSpacing: '-.01em',
    mb: 0.5,
    color: 'var(--ink)',
  },
  addressText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    fontSize: '11.5px',
    color: 'var(--muted)',
  },
  // .pr-stats — bande de stats hairline (valeurs display tabular-nums)
  statsBand: {
    display: 'flex',
    borderTop: '1px solid var(--line)',
    borderBottom: '1px solid var(--line)',
    mb: 1.25,
  },
  statCell: {
    flex: 1,
    py: '9px',
    textAlign: 'center',
    borderRight: '1px solid var(--line)',
    minWidth: 0,
    '&:last-child': { borderRight: 0 },
  },
  statValue: {
    fontFamily: 'var(--font-display)',
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--ink)',
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.2,
  },
  statLabel: {
    fontSize: '9.5px',
    fontWeight: 700,
    letterSpacing: '.04em',
    textTransform: 'uppercase',
    color: 'var(--faint)',
    mt: '1px',
  },
  actionBar: {
    px: 1.75,
    pb: 1.25,
    pt: 0,
    display: 'flex',
    gap: 0.75,
  },

  // ── Dialog ── (skin global MuiDialog ; surfaces internes en tokens)
  dialogTitleBox: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dialogIconBox: {
    width: 40,
    height: 40,
    borderRadius: '11px',
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
    bgcolor: 'var(--field)',
    border: '1px solid var(--field-line)',
    borderRadius: '11px',
    px: 1.5,
    py: 1,
    minWidth: 120,
  },
  dialogSectionTitle: {
    fontSize: '10.5px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.06em',
    color: 'var(--faint)',
    mb: 0.75,
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

export function getAmenityColor(amenity: string): AmenityChipColor {
  return AMENITY_CATEGORY_MAP[amenity] || 'default';
}

// ─── Cleaning estimation (lightweight version for cards) ────────────────────

const SURFACE_TIERS: { maxSurface: number | null; base: number }[] = [
  { maxSurface: 30, base: 35 }, { maxSurface: 50, base: 45 },
  { maxSurface: 70, base: 55 }, { maxSurface: 100, base: 70 },
  { maxSurface: 150, base: 90 }, { maxSurface: null, base: 110 },
];

export function estimateCleaningPrice(p: PropertyDetails): number | null {
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

export function estimateCleaningDuration(p: PropertyDetails): number | null {
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

export function formatDuration(mins: number): string {
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  if (hours === 0) return `${mins}min`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h${String(remainder).padStart(2, '0')}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

const PropertyCard: React.FC<PropertyCardProps> = React.memo(({ property, onEdit, onDelete, onView, channexMapping, onChannexBadgeClick, missingContract, onMissingContractClick }) => {
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
    const iconProps = { size, color: 'var(--accent)', strokeWidth: 1.75 };
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
              size="small"
              sx={{ ...styles.statusChip, ...propertyStatusChipSx(property.status) }}
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
                  icon={<Payments size={12} strokeWidth={1.75} />}
                  label={`${cleaningPrice}€ estimé / ménage`}
                  size="small"
                  sx={{ color: 'var(--accent)', bgcolor: 'var(--accent-soft)', border: 'none', '& .MuiChip-icon': { fontSize: 12, ml: 0.5, color: 'var(--accent)' }, '& .MuiChip-label': { px: 1 }, cursor: 'default' }}
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
                  icon={<Timer size={12} strokeWidth={1.75} />}
                  label={`~${formatDuration(cleaningDuration)}`}
                  size="small"
                  sx={{ color: 'var(--info)', bgcolor: 'var(--info-soft)', border: 'none', '& .MuiChip-icon': { fontSize: 12, ml: 0.5, color: 'var(--info)' }, '& .MuiChip-label': { px: 1 }, cursor: 'default' }}
                />
              </ThemedTooltip>
            )}
            {(property.defaultCheckOutTime || property.defaultCheckInTime) && (
              <ThemedTooltip
                title={
                  <Typography sx={{ fontSize: '0.6875rem', lineHeight: 1.5 }}>
                    {t('properties.defaultTimesTooltip', {
                      checkOut: property.defaultCheckOutTime || '—',
                      checkIn: property.defaultCheckInTime || '—',
                    })}
                  </Typography>
                }
                arrow
                placement="top"
              >
                <Chip
                  icon={<Schedule size={12} strokeWidth={1.75} />}
                  label={`${property.defaultCheckOutTime || '—'} – ${property.defaultCheckInTime || '—'}`}
                  size="small"
                  variant="outlined"
                  sx={{ ...styles.priceChip, fontVariantNumeric: 'tabular-nums', '& .MuiChip-icon': { fontSize: 12, ml: 0.5, color: 'var(--muted)' }, cursor: 'default' }}
                />
              </ThemedTooltip>
            )}
            {(property.createdAt || property.nextCleaning || property.lastCleaning) && (
              <Box sx={styles.dateBox}>
                <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><Schedule size={13} strokeWidth={1.75} /></Box>
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
          {/* Nom + health badge Channex (Quick Win #4) */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              minWidth: 0,
            }}
          >
            <Typography
              variant="subtitle1"
              fontWeight={700}
              sx={{ ...styles.nameText, minWidth: 0, flex: 1 }}
              title={property.name}
            >
              {property.name}
            </Typography>
            {channexMapping && (
              <ChannexHealthBadge
                mapping={channexMapping}
                size={10}
                variant="dot"
                onClick={onChannexBadgeClick}
              />
            )}
            {missingContract && (
              <MissingContractChip
                onClick={(e) => { e.stopPropagation(); onMissingContractClick?.(); }}
              />
            )}
          </Box>

          {/* Adresse */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.25 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', flexShrink: 0 }}><LocationOn size={14} strokeWidth={1.75} /></Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={styles.addressText}
              title={`${property.address}, ${property.postalCode} ${property.city}, ${property.country}`}
            >
              {property.address}, {property.postalCode} {property.city}
            </Typography>
          </Box>

          {/* Bande de stats (.pr-stats) — chiffres display tabular-nums */}
          <Box sx={styles.statsBand}>
            {[
              { value: property.bedrooms, label: 'ch.' },
              { value: property.bathrooms, label: 'sdb' },
              { value: `${property.surfaceArea}`, label: 'm²' },
              { value: property.maxGuests, label: 'voy.' },
            ].map((metric, idx) => (
              <Box key={idx} sx={styles.statCell}>
                <Typography sx={styles.statValue}>{metric.value}</Typography>
                <Typography sx={styles.statLabel}>{metric.label}</Typography>
              </Box>
            ))}
          </Box>

          {/* Commodités — chips neutres « champ » (.fr-chip) */}
          {property.amenities && property.amenities.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.25, minWidth: 0 }}>
              {property.amenities.slice(0, 3).map((amenity, index) => (
                <Chip
                  key={index}
                  label={t(`properties.amenities.items.${amenity}`)}
                  size="small"
                  sx={{ ...FIELD_CHIP_SX, '& .MuiChip-label': { px: 1 } }}
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
                          size="small"
                          sx={{ ...FIELD_CHIP_SX, height: 20, '& .MuiChip-label': { px: 1 } }}
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
                    sx={{ color: 'var(--muted)', bgcolor: 'var(--hover)', border: 'none', '& .MuiChip-label': { px: 1 }, cursor: 'default' }}
                  />
                </ThemedTooltip>
              )}
            </Box>
          )}

          {/* Fréquence de nettoyage — chip -soft dérivé de la couleur de donnée */}
          {(() => { const c = getCleaningFrequencyHex(property.cleaningFrequency); return (
            <Chip
              icon={<AutoAwesome size={12} strokeWidth={1.75} color={c} />}
              label={getCleaningFrequencyLabel(property.cleaningFrequency, t)}
              size="small"
              sx={{
                alignSelf: 'flex-start',
                ...softDataChipSx(c),
                '& .MuiChip-icon': { fontSize: 12, ml: 0.5, color: c },
                '& .MuiChip-label': { px: 1 },
              }}
            />
          ); })()}
        </CardContent>

        {/* ─── Zone actions ─── */}
        <Box sx={styles.actionBar}>
          <Button
            fullWidth
            size="small"
            startIcon={<Visibility size={15} strokeWidth={1.75} />}
            onClick={(e) => { e.stopPropagation(); handleViewDetails(); }}
            variant="outlined"
          >
            Détails
          </Button>
          {canEdit && onEdit && (
            <Button
              fullWidth
              size="small"
              startIcon={<Edit size={15} strokeWidth={1.75} />}
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              variant="contained"
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
                  bgcolor: 'var(--accent-soft)',
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
              <Close size={18} strokeWidth={1.75} />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 1.5 }}>
          <Grid container spacing={2}>
            {/* Adresse */}
            <Grid item xs={12}>
              <Typography sx={styles.dialogSectionTitle}>
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
              <Typography sx={{ ...styles.dialogSectionTitle, mb: 1 }}>
                Caractéristiques
              </Typography>
              <Box sx={styles.dialogCharacteristicsRow}>
                {[
                  { icon: <BedIcon size={18} strokeWidth={1.75} />, value: property.bedrooms, label: 'Chambres' },
                  { icon: <BathroomIcon size={18} strokeWidth={1.75} />, value: property.bathrooms, label: 'Salles de bain' },
                  { icon: <SquareFoot size={18} strokeWidth={1.75} />, value: `${property.surfaceArea} m²`, label: 'Surface' },
                  { icon: <PersonIcon size={18} strokeWidth={1.75} />, value: property.maxGuests, label: 'Voyageurs max' },
                ].map((item, idx) => (
                  <Box
                    key={idx}
                    sx={styles.dialogMetricBox}
                  >
                    <Box sx={{ color: 'var(--accent)', display: 'flex' }}>{item.icon}</Box>
                    <Box>
                      <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{item.value}</Typography>
                      <Typography sx={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)' }}>{item.label}</Typography>
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
              <Typography sx={styles.dialogSectionTitle}>
                {t('properties.cleaningEstimate')}
              </Typography>
              {cleaningPrice != null ? (
                <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.01em' }}>
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
              <Typography sx={styles.dialogSectionTitle}>
                Nettoyage
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary' }}><CleaningServices size={18} strokeWidth={1.75} /></Box>
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
                  <Typography sx={{ ...styles.dialogSectionTitle, mb: 1 }}>
                    Commodités
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {property.amenities.map((amenity, index) => (
                      <Chip
                        key={index}
                        label={t(`properties.amenities.items.${amenity}`)}
                        size="small"
                        sx={{ ...FIELD_CHIP_SX, '& .MuiChip-label': { px: 1 } }}
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
              <Typography sx={styles.dialogSectionTitle}>
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
                <Typography sx={styles.dialogSectionTitle}>
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
              startIcon={<Delete size={16} strokeWidth={1.75} />}
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
