import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Divider,
  Avatar,
  Badge,
  Tooltip,
} from '@mui/material';
import {
  Home,
  LocationOn,
  Euro,
  Bed,
  Bathroom,
  SquareFoot,
  Star,
  Visibility,
  Edit,
  Delete,
  Close,
  Phone,
  Email,
  CleaningServices,
  Group,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

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
  const { hasPermission } = useAuth();
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Vérifier les permissions
  const canEdit = hasPermission('properties:edit');
  const canDelete = hasPermission('properties:delete');

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
  const getStatusColor = (status: string) => {
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
        <CardContent sx={{ flexGrow: 1, p: 3 }}>
          {/* En-tête avec nom et statut */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
              {getPropertyTypeIcon(property.propertyType)}
              <Typography variant="h6" fontWeight={600} noWrap>
                {property.name}
              </Typography>
            </Box>
            <Chip
              label={property.status}
              color={getStatusColor(property.status) as any}
              size="small"
              sx={{ textTransform: 'capitalize' }}
            />
          </Box>

          {/* Adresse */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <LocationOn sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              {property.address}, {property.postalCode} {property.city}, {property.country}
            </Typography>
          </Box>

          {/* Caractéristiques principales */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Bed sx={{ fontSize: 20, color: 'text.secondary', mb: 0.5 }} />
                <Typography variant="body2" fontWeight={500}>
                  {property.bedrooms}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Chambres
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Bathroom sx={{ fontSize: 20, color: 'text.secondary', mb: 0.5 }} />
                <Typography variant="body2" fontWeight={500}>
                  {property.bathrooms}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  SDB
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <SquareFoot sx={{ fontSize: 20, color: 'text.secondary', mb: 0.5 }} />
                <Typography variant="body2" fontWeight={500}>
                  {property.surfaceArea}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  m²
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Group sx={{ fontSize: 20, color: 'text.secondary', mb: 0.5 }} />
                <Typography variant="body2" fontWeight={500}>
                  {property.maxGuests}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Voyageurs
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {/* Prix */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Euro sx={{ fontSize: 20, color: 'success.main' }} />
            <Typography variant="h5" fontWeight={700} color="success.main">
              {property.nightlyPrice}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              /nuit
            </Typography>
          </Box>

          {/* Commodités principales */}
          {property.amenities.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Commodités :
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {property.amenities.slice(0, 3).map((amenity, index) => (
                  <Chip
                    key={index}
                    label={amenity}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.75rem' }}
                  />
                ))}
                {property.amenities.length > 3 && (
                  <Chip
                    label={`+${property.amenities.length - 3}`}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.75rem' }}
                  />
                )}
              </Box>
            </Box>
          )}

          {/* Fréquence de nettoyage */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CleaningServices sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              Nettoyage : {formatCleaningFrequency(property.cleaningFrequency)}
            </Typography>
          </Box>
        </CardContent>

        {/* Actions */}
        <Box sx={{ p: 2, pt: 0 }}>
          <Grid container spacing={1}>
            <Grid item xs={12} sm={6}>
              <Button
                fullWidth
                size="small"
                startIcon={<Visibility />}
                onClick={() => setDetailsOpen(true)}
                variant="outlined"
              >
                Voir détails
              </Button>
            </Grid>
            {canEdit && (
              <Grid item xs={12} sm={6}>
                <Button
                  fullWidth
                  size="small"
                  startIcon={<Edit />}
                  onClick={onEdit}
                  variant="outlined"
                  color="primary"
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
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" component="h2">
              Détails de la propriété
            </Typography>
            <IconButton onClick={() => setDetailsOpen(false)} size="small">
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={3}>
            {/* Informations de base */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                Informations de base
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Nom
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {property.name}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Type
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {property.propertyType}
              </Typography>
            </Grid>

            {/* Adresse complète */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                Adresse
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">
                Adresse complète
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {property.address}
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">
                Ville
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {property.city}
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">
                Code postal
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {property.postalCode}
              </Typography>
            </Grid>

            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary">
                Pays
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {property.country}
              </Typography>
            </Grid>

            {/* Caractéristiques détaillées */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                Caractéristiques
              </Typography>
            </Grid>

            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" color="text.secondary">
                Commodités
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {property.amenities.length} disponible(s)
              </Typography>
            </Grid>

            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" color="text.secondary">
                Salles de bain
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {property.bathrooms}
              </Typography>
            </Grid>

            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" color="text.secondary">
                Surface
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {property.surfaceArea} m²
              </Typography>
            </Grid>

            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" color="text.secondary">
                Prix/nuit
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {property.nightlyPrice} €
              </Typography>
            </Grid>

            {/* Commodités complètes */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                Commodités
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {property.amenities.map((amenity, index) => (
                  <Chip
                    key={index}
                    label={amenity}
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Grid>

            {/* Configuration */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                Configuration
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Statut
              </Typography>
              <Chip
                label={property.status}
                color={getStatusColor(property.status) as any}
                sx={{ mb: 2 }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Fréquence de nettoyage
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {formatCleaningFrequency(property.cleaningFrequency)}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Nombre max de voyageurs
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {property.maxGuests}
              </Typography>
            </Grid>

            {/* Contact */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                Contact
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Téléphone
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {property.contactPhone || 'Non renseigné'}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Email
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {property.contactEmail}
              </Typography>
            </Grid>

            {/* Description */}
            {property.description && (
              <>
                <Grid item xs={12}>
                  <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                    Description
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body1">
                    {property.description}
                  </Typography>
                </Grid>
              </>
            )}
          </Grid>
        </DialogContent>

        <DialogActions>
          {canDelete && (
            <Button
              onClick={onDelete}
              color="error"
              variant="outlined"
              startIcon={<Delete />}
            >
              Supprimer
            </Button>
          )}
          <Button onClick={() => setDetailsOpen(false)}>
            Fermer
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PropertyCard;
