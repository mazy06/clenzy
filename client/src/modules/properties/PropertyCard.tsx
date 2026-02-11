import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardActions,
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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  Rating,
  Tooltip,
} from '@mui/material';
import {
  Edit,
  Delete,
  Visibility,
  LocationOn,
  Euro,
  Star,
  Home,
  Apartment,
  Villa,
  Hotel,
  Person as PersonIcon,
  Bed as BedIcon,
  Bathroom as BathroomIcon,
  CleaningServices,
  Schedule,
  Info,
  Close,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';

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
}

const PropertyCard: React.FC<PropertyCardProps> = ({ property, onEdit, onDelete }) => {
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Vérifier les permissions
  const [canEdit, setCanEdit] = useState(false);
  
  useEffect(() => {
    const checkPermissions = async () => {
      const canEditPermission = await hasPermissionAsync('properties:edit');
      setCanEdit(canEditPermission);
    };
    
    checkPermissions();
  }, [hasPermissionAsync]);
  
  const [canDelete, setCanDelete] = useState(false);
  
  useEffect(() => {
    const checkPermissions = async () => {
      const canDeletePermission = await hasPermissionAsync('properties:delete');
      setCanDelete(canDeletePermission);
    };
    
    checkPermissions();
  }, [hasPermissionAsync]);

  // Obtenir l'icône du type de propriété
  const getPropertyTypeIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'APPARTEMENT':
        return <Home />;
      case 'MAISON':
        return <Home />;
      case 'VILLA':
        return <Home />;
      case 'STUDIO':
        return <Home />;
      default:
        return <Home />;
    }
  };

  // Obtenir la couleur du statut
  const getStatusColor = (status: string): ChipColor => {
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return 'success';
      case 'INACTIVE':
        return 'default';
      case 'MAINTENANCE':
        return 'warning';
      case 'RENTED':
        return 'info';
      case 'SOLD':
        return 'error';
      default:
        return 'default';
    }
  };

  // Formater la fréquence de nettoyage
  const formatCleaningFrequency = (freq: string) => {
    switch (freq.toUpperCase()) {
      case 'DAILY':
        return 'Quotidien';
      case 'WEEKLY':
        return 'Hebdomadaire';
      case 'BIWEEKLY':
        return 'Bi-hebdomadaire';
      case 'MONTHLY':
        return 'Mensuel';
      case 'ON_DEMAND':
        return 'Sur demande';
      default:
        return freq;
    }
  };

  return (
    <>
      {/* Carte principale */}
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flexGrow: 1, p: 1.5 }}>
          {/* En-tête avec nom et statut */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1, minWidth: 0 }}>
              <Box sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }}>
                {getPropertyTypeIcon(property.propertyType)}
              </Box>
              <Typography 
                variant="subtitle1" 
                fontWeight={600} 
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  fontSize: '0.95rem'
                }}
                title={property.name}
              >
                {property.name}
              </Typography>
            </Box>
            <Chip
              label={property.status}
              color={getStatusColor(property.status)}
              size="small"
              sx={{ textTransform: 'capitalize', flexShrink: 0, height: 20, fontSize: '0.7rem' }}
            />
          </Box>

          {/* Adresse */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <LocationOn sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
            <Typography 
              variant="caption" 
              color="text.secondary"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                fontSize: '0.7rem'
              }}
              title={`${property.address}, ${property.postalCode} ${property.city}, ${property.country}`}
            >
              {property.address}, {property.postalCode} {property.city}
            </Typography>
          </Box>

          {/* Caractéristiques principales */}
          <Grid container spacing={1} sx={{ mb: 1 }}>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <BedIcon sx={{ fontSize: 16, color: 'text.secondary', mb: 0.25 }} />
                <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
                  {property.bedrooms}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', lineHeight: 1 }}>
                  Chambres
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <BathroomIcon sx={{ fontSize: 16, color: 'text.secondary', mb: 0.25 }} />
                <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
                  {property.bathrooms}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', lineHeight: 1 }}>
                  SDB
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Info sx={{ fontSize: 16, color: 'text.secondary', mb: 0.25 }} />
                <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
                  {property.surfaceArea}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', lineHeight: 1 }}>
                  m²
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <PersonIcon sx={{ fontSize: 16, color: 'text.secondary', mb: 0.25 }} />
                <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
                  {property.maxGuests}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', lineHeight: 1 }}>
                  Voyageurs
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {/* Prix */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mb: 1 }}>
            <Euro sx={{ fontSize: 14, color: 'success.main' }} />
            <Typography variant="subtitle1" fontWeight={700} color="success.main" sx={{ fontSize: '0.95rem' }}>
              {property.nightlyPrice}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              /nuit
            </Typography>
          </Box>

          {/* Commodités principales */}
          {property.amenities.length > 0 && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.7rem' }}>
                Commodités :
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {property.amenities.slice(0, 3).map((amenity, index) => (
                  <Chip
                    key={index}
                    label={amenity}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.65rem', height: 20 }}
                  />
                ))}
                {property.amenities.length > 3 && (
                  <Chip
                    label={`+${property.amenities.length - 3}`}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.65rem', height: 20 }}
                  />
                )}
              </Box>
            </Box>
          )}

          {/* Fréquence de nettoyage */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <CleaningServices sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              Nettoyage : {formatCleaningFrequency(property.cleaningFrequency)}
            </Typography>
          </Box>
        </CardContent>

        {/* Actions */}
        <Box sx={{ p: 1, pt: 0 }}>
          <Grid container spacing={0.5}>
            <Grid item xs={12} sm={6}>
              <Button
                fullWidth
                size="small"
                startIcon={<Visibility sx={{ fontSize: 16 }} />}
                onClick={() => setDetailsOpen(true)}
                variant="outlined"
                sx={{ fontSize: '0.75rem', py: 0.5 }}
              >
                Voir détails
              </Button>
            </Grid>
            {canEdit && (
              <Grid item xs={12} sm={6}>
                <Button
                  fullWidth
                  size="small"
                  startIcon={<Edit sx={{ fontSize: 16 }} />}
                  onClick={onEdit}
                  variant="outlined"
                  color="primary"
                  sx={{ fontSize: '0.75rem', py: 0.5 }}
                >
                  Modifier
                </Button>
              </Grid>
            )}
          </Grid>
        </Box>
      </Card>

      {/* Dialog des détails complets */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" component="h2">
              Détails de la propriété
            </Typography>
            <IconButton onClick={() => setDetailsOpen(false)} size="small">
              <Close sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ pt: 1.5 }}>
          <Grid container spacing={2}>
            {/* Informations de base */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1, color: 'primary.main' }}>
                Informations de base
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Nom
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {property.name}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Type
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {property.propertyType}
              </Typography>
            </Grid>

            {/* Adresse complète */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1, color: 'primary.main' }}>
                Adresse
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Adresse complète
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {property.address}
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Ville
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {property.city}
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Code postal
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {property.postalCode}
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Pays
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {property.country}
              </Typography>
            </Grid>

            {/* Caractéristiques détaillées */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1, color: 'primary.main' }}>
                Caractéristiques
              </Typography>
            </Grid>

            <Grid item xs={12} md={3}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Commodités
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {property.amenities.length} disponible(s)
              </Typography>
            </Grid>

            <Grid item xs={12} md={3}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Salles de bain
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {property.bathrooms}
              </Typography>
            </Grid>

            <Grid item xs={12} md={3}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Surface
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {property.surfaceArea} m²
              </Typography>
            </Grid>

            <Grid item xs={12} md={3}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Prix/nuit
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {property.nightlyPrice} €
              </Typography>
            </Grid>

            {/* Commodités complètes */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1, color: 'primary.main' }}>
                Commodités
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {property.amenities.map((amenity, index) => (
                  <Chip
                    key={index}
                    label={amenity}
                    color="primary"
                    variant="outlined"
                    size="small"
                    sx={{ fontSize: '0.7rem', height: 22 }}
                  />
                ))}
              </Box>
            </Grid>

            {/* Configuration */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1, color: 'primary.main' }}>
                Configuration
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Statut
              </Typography>
              <Chip
                label={property.status}
                color={getStatusColor(property.status)}
                size="small"
                sx={{ mb: 1, height: 22 }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Fréquence de nettoyage
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {formatCleaningFrequency(property.cleaningFrequency)}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Nombre max de voyageurs
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {property.maxGuests}
              </Typography>
            </Grid>

            {/* Contact */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1, color: 'primary.main' }}>
                Contact
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Téléphone
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {property.contactPhone || 'Non renseigné'}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Email
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {property.contactEmail}
              </Typography>
            </Grid>

            {/* Description */}
            {property.description && (
              <>
                <Grid item xs={12}>
                  <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1, color: 'primary.main' }}>
                    Description
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography 
                    variant="body2"
                    sx={{
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      lineHeight: 1.3
                    }}
                    title={property.description}
                  >
                    {property.description}
                  </Typography>
                </Grid>
              </>
            )}
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          {canDelete && (
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
          <Button onClick={() => setDetailsOpen(false)} size="small">
            Fermer
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PropertyCard;
