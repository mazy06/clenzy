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
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { getPropertyTypeBannerUrl } from '../../utils/propertyTypeBanner';

type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

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

const PropertyCard: React.FC<PropertyCardProps> = ({ property, onEdit, onDelete, onView }) => {
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();
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

  // Obtenir la couleur du statut
  const getStatusColor = (status: string): ChipColor => {
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return 'success';
      case 'INACTIVE':
        return 'default';
      case 'MAINTENANCE':
      case 'UNDER_MAINTENANCE':
        return 'warning';
      case 'RENTED':
        return 'info';
      case 'SOLD':
      case 'ARCHIVED':
        return 'error';
      default:
        return 'default';
    }
  };

  // Traduire le statut
  const getStatusLabel = (status: string): string => {
    switch (status.toUpperCase()) {
      case 'ACTIVE': return 'Actif';
      case 'INACTIVE': return 'Inactif';
      case 'MAINTENANCE':
      case 'UNDER_MAINTENANCE': return 'Maintenance';
      case 'RENTED': return 'Loué';
      case 'SOLD': return 'Vendu';
      case 'ARCHIVED': return 'Archivé';
      default: return status;
    }
  };

  // Traduire le type
  const getTypeLabel = (type: string): string => {
    switch (type.toLowerCase()) {
      case 'apartment':
      case 'appartement': return 'Appartement';
      case 'house':
      case 'maison': return 'Maison';
      case 'villa': return 'Villa';
      case 'studio': return 'Studio';
      default: return type;
    }
  };

  // Formater la fréquence de nettoyage
  const formatCleaningFrequency = (freq: string) => {
    switch (freq.toUpperCase()) {
      case 'DAILY': return 'Quotidien';
      case 'WEEKLY': return 'Hebdomadaire';
      case 'BIWEEKLY': return 'Bi-hebdomadaire';
      case 'MONTHLY': return 'Mensuel';
      case 'ON_DEMAND': return 'Sur demande';
      case 'AFTER_EACH_STAY': return 'Après chaque séjour';
      default: return freq;
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
        sx={{
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
        }}
        onClick={handleViewDetails}
      >
        {/* ─── Zone visuelle : Bandeau gradient ─── */}
        <Box
          sx={{
            position: 'relative',
            background: getGradient(property.propertyType),
            backgroundImage: `linear-gradient(rgba(0,0,0,0.10), rgba(0,0,0,0.35)), url(${getPropertyTypeBannerUrl(property.propertyType)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            height: 110,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Icône type en arrière-plan décoratif */}
          <Box
            sx={{
              position: 'absolute',
              right: -10,
              bottom: -10,
              opacity: 0.8,
            }}
          >
            {getPropertyTypeIcon(property.propertyType, 80)}
          </Box>

          {/* Type de propriété en haut à gauche */}
          <Box
            sx={{
              position: 'absolute',
              top: 10,
              left: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {getPropertyTypeIcon(property.propertyType, 18)}
            </Box>
            <Typography
              variant="caption"
              sx={{
                color: 'rgba(255,255,255,0.9)',
                fontWeight: 600,
                fontSize: '0.7rem',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
              }}
            >
              {getTypeLabel(property.propertyType)}
            </Typography>
          </Box>

          {/* Badge statut — coin supérieur droit */}
          <Chip
            label={getStatusLabel(property.status)}
            color={getStatusColor(property.status)}
            size="small"
            sx={{
              position: 'absolute',
              top: 10,
              right: 10,
              height: 22,
              fontSize: '0.65rem',
              fontWeight: 600,
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            }}
          />

          {/* Prix/nuit — coin inférieur gauche */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 10,
              left: 12,
              display: 'flex',
              alignItems: 'baseline',
              gap: 0.5,
              bgcolor: 'rgba(0,0,0,0.35)',
              backdropFilter: 'blur(4px)',
              borderRadius: 1.5,
              px: 1.25,
              py: 0.5,
            }}
          >
            <Typography
              variant="subtitle1"
              sx={{
                color: '#fff',
                fontWeight: 700,
                fontSize: '1.1rem',
                lineHeight: 1,
              }}
            >
              {property.nightlyPrice}€
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'rgba(255,255,255,0.75)',
                fontSize: '0.65rem',
              }}
            >
              /nuit
            </Typography>
          </Box>
        </Box>

        {/* ─── Zone info ─── */}
        <CardContent sx={{ flexGrow: 1, p: 1.75, pb: '12px !important' }}>
          {/* Nom */}
          <Typography
            variant="subtitle1"
            fontWeight={700}
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: '0.95rem',
              mb: 0.5,
              color: 'text.primary',
            }}
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
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                fontSize: '0.7rem',
              }}
              title={`${property.address}, ${property.postalCode} ${property.city}, ${property.country}`}
            >
              {property.address}, {property.postalCode} {property.city}
            </Typography>
          </Box>

          {/* Métriques — ligne horizontale compacte */}
          <Box
            sx={{
              display: 'flex',
              gap: 0.75,
              mb: 1.25,
              flexWrap: 'wrap',
            }}
          >
            {[
              { icon: <BedIcon sx={{ fontSize: 14 }} />, value: property.bedrooms, label: 'ch.' },
              { icon: <BathroomIcon sx={{ fontSize: 14 }} />, value: property.bathrooms, label: 'sdb' },
              { icon: <SquareFoot sx={{ fontSize: 14 }} />, value: property.surfaceArea, label: 'm²' },
              { icon: <PersonIcon sx={{ fontSize: 14 }} />, value: property.maxGuests, label: 'voy.' },
            ].map((metric, idx) => (
              <Box
                key={idx}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.4,
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                  px: 0.75,
                  py: 0.35,
                }}
              >
                <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
                  {metric.icon}
                </Box>
                <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.72rem', color: 'text.primary' }}>
                  {metric.value}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.secondary' }}>
                  {metric.label}
                </Typography>
              </Box>
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
                  sx={{ fontSize: '0.62rem', height: 20, borderColor: 'grey.300' }}
                />
              ))}
              {property.amenities.length > 3 && (
                <Chip
                  label={`+${property.amenities.length - 3}`}
                  size="small"
                  sx={{
                    fontSize: '0.62rem',
                    height: 20,
                    bgcolor: 'grey.100',
                    color: 'text.secondary',
                  }}
                />
              )}
            </Box>
          )}

          {/* Fréquence de nettoyage */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CleaningServices sx={{ fontSize: 13, color: 'text.disabled' }} />
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
              {formatCleaningFrequency(property.cleaningFrequency)}
            </Typography>
          </Box>
        </CardContent>

        {/* ─── Zone actions ─── */}
        <Box sx={{ px: 1.75, pb: 1.25, pt: 0, display: 'flex', gap: 0.75 }}>
          <Button
            fullWidth
            size="small"
            startIcon={<Visibility sx={{ fontSize: 15 }} />}
            onClick={(e) => { e.stopPropagation(); handleViewDetails(); }}
            variant="outlined"
            sx={{
              fontSize: '0.72rem',
              py: 0.5,
              borderColor: 'grey.300',
              color: 'text.secondary',
              '&:hover': {
                borderColor: 'primary.main',
                color: 'primary.main',
                bgcolor: 'rgba(107, 138, 154, 0.04)',
              },
            }}
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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1,
                  background: getGradient(property.propertyType),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {getPropertyTypeIcon(property.propertyType, 22)}
              </Box>
              <Box>
                <Typography variant="h6" component="h2" sx={{ lineHeight: 1.2 }}>
                  {property.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {getTypeLabel(property.propertyType)} • {getStatusLabel(property.status)}
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
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {[
                  { icon: <BedIcon sx={{ fontSize: 18 }} />, value: property.bedrooms, label: 'Chambres' },
                  { icon: <BathroomIcon sx={{ fontSize: 18 }} />, value: property.bathrooms, label: 'Salles de bain' },
                  { icon: <SquareFoot sx={{ fontSize: 18 }} />, value: `${property.surfaceArea} m²`, label: 'Surface' },
                  { icon: <PersonIcon sx={{ fontSize: 18 }} />, value: property.maxGuests, label: 'Voyageurs max' },
                ].map((item, idx) => (
                  <Box
                    key={idx}
                    sx={{
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
                    }}
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
                <Typography variant="body2">{formatCleaningFrequency(property.cleaningFrequency)}</Typography>
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
                        sx={{ fontSize: '0.72rem', height: 24 }}
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
                  sx={{
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 4,
                    WebkitBoxOrient: 'vertical',
                    lineHeight: 1.4,
                  }}
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
};

export default PropertyCard;
