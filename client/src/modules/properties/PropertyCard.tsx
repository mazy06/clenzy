import React, { useState, useEffect } from 'react';
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
  Tooltip,
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
          {/* Gauche : statut + prix */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            <Chip
              label={getPropertyStatusLabel(property.status, t)}
              color={getPropertyStatusColor(property.status)}
              size="small"
              variant="outlined"
              sx={styles.statusChip}
            />
            <Chip
              label={`${property.nightlyPrice}€/nuit`}
              size="small"
              variant="outlined"
              sx={styles.priceChip}
            />
          </Box>

          {/* Droite : date */}
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

          {/* Métriques — ligne horizontale compacte */}
          <Box sx={styles.metricsRow}>
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

          {/* Commodités */}
          {property.amenities && property.amenities.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
              {property.amenities.slice(0, 3).map((amenity, index) => (
                <Chip
                  key={index}
                  label={amenity}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.62rem', height: 22, borderColor: 'grey.300', borderWidth: 1.5, '& .MuiChip-label': { px: 0.75 } }}
                />
              ))}
              {property.amenities.length > 3 && (
                <Chip
                  label={`+${property.amenities.length - 3}`}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.62rem', height: 22, borderWidth: 1.5, borderColor: 'grey.300', color: 'text.secondary', '& .MuiChip-label': { px: 0.75 } }}
                />
              )}
            </Box>
          )}

          {/* Fréquence de nettoyage */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CleaningServices sx={{ fontSize: 13, color: 'text.disabled' }} />
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
              {getCleaningFrequencyLabel(property.cleaningFrequency, t)}
            </Typography>
          </Box>
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

            {/* Prix et nettoyage */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.75, color: 'primary.main' }}>
                Tarification
              </Typography>
              <Typography variant="h5" fontWeight={700} color="success.main">
                {property.nightlyPrice}€ <Typography component="span" variant="caption" color="text.secondary">/nuit</Typography>
              </Typography>
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
                        label={amenity}
                        color="primary"
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
