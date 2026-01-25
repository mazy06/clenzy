import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Badge,
  Tooltip,
  Fab,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  Add,
  MoreVert,
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
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import FilterSearchBar from '../../components/FilterSearchBar';
import PageHeader from '../../components/PageHeader';
import { API_CONFIG } from '../../config/api';
import { PropertyStatus, PROPERTY_STATUS_OPTIONS } from '../../types/statusEnums';
import { createSpacing } from '../../theme/spacing';
import { useTranslation } from '../../hooks/useTranslation';

// Types pour les propriétés
interface Property {
  id: string;
  name: string;
  type: 'apartment' | 'house' | 'villa' | 'studio';
  address: string;
  city: string;
  postalCode?: string;
  country?: string;
  status: 'active' | 'inactive' | 'maintenance';
  rating: number;
  nightlyPrice: number;
  guests: number;
  bedrooms: number;
  bathrooms: number;
  squareMeters?: number;
  description?: string;
  imageUrl?: string;
  lastCleaning?: string;
  nextCleaning?: string;
  ownerId?: string; // ID du propriétaire pour les hôtes
}

// Type pour les utilisateurs (hosts)
interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

// Données mockées supprimées - utilisation de l'API uniquement

// propertyTypes sera généré dynamiquement avec les traductions

// Utilisation des enums partagés pour les statuts des propriétés
const statusColors = Object.fromEntries(
  PROPERTY_STATUS_OPTIONS.map(option => [option.value.toLowerCase(), option.color])
) as Record<string, string>;

const statusLabels = Object.fromEntries(
  PROPERTY_STATUS_OPTIONS.map(option => [option.value.toLowerCase(), option.label])
) as Record<string, string>;

export default function PropertiesList() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedHost, setSelectedHost] = useState('all');
  const [hosts, setHosts] = useState<User[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { user, isAdmin, isManager, isHost, hasPermissionAsync } = useAuth();
  const { t } = useTranslation();

  // Charger les propriétés depuis l'API
  const loadProperties = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_CONFIG.BASE_URL}/api/properties`;
      
      // Si c'est un HOST, filtrer par ses propriétés
      console.log('🔍 PropertiesList - Debug utilisateur:', {
        isHost: isHost(),
        isAdmin: isAdmin(),
        isManager: isManager(),
        userId: user?.id,
        userRoles: user?.roles,
        userEmail: user?.email
      });
      
      if (isHost() && !isAdmin() && !isManager() && user?.id) {
        url += `?ownerId=${user.id}`;
        console.log('🔍 PropertiesList - Chargement des propriétés du HOST:', user.id);
      } else {
        console.log('🔍 PropertiesList - Chargement de toutes les propriétés (ADMIN/MANAGER)');
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Convertir les données du backend vers le format frontend
        const convertedProperties = data.content?.map((prop: any) => {
          const converted = {
            id: prop.id.toString(),
            name: prop.name,
            type: prop.type?.toLowerCase() || 'apartment',
            address: prop.address,
            city: prop.city,
            postalCode: prop.postalCode,
            country: prop.country,
            status: prop.status?.toLowerCase() || 'active',
            rating: 4.5, // Valeur par défaut
            nightlyPrice: prop.nightlyPrice || 0,
            guests: prop.maxGuests || 2,
            bedrooms: prop.bedroomCount || 1,
            bathrooms: prop.bathroomCount || 1,
            squareMeters: prop.squareMeters,
            description: prop.description,
            imageUrl: undefined,
            lastCleaning: undefined,
            nextCleaning: undefined,
            ownerId: prop.ownerId?.toString(),
          };
          return converted;
        }) || [];
        
        console.log('🔍 PropertiesList - Propriétés chargées:', convertedProperties.length);
        setProperties(convertedProperties);
      } else {
        console.error('🔍 PropertiesList - Erreur API:', response.status);
      }
    } catch (err) {
      console.error('🔍 PropertiesList - Erreur chargement propriétés:', err);
    } finally {
      setLoading(false);
    }
  }, [isHost, isAdmin, isManager, user?.id]);

  // Charger les hôtes (utilisateurs avec le rôle HOST)
  useEffect(() => {
    const loadHosts = async () => {
      // Vérifier si l'utilisateur peut voir les utilisateurs
      if (!false && !false) {
        setHosts([]);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`${API_CONFIG.BASE_URL}/api/users?role=HOST`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setHosts(data.content || data);
        } else if (response.status === 403) {
          setHosts([]);
        } else {
          console.error('🔍 PropertiesList - Erreur lors du chargement des hôtes:', response.status);
          setHosts([]);
        }
      } catch (err) {
        console.error('🔍 PropertiesList - Erreur de connexion lors du chargement des hôtes:', err);
        setHosts([]);
      } finally {
        setLoading(false);
      }
    };

    loadHosts();
  }, [hasPermissionAsync]);

  // Charger les données au montage du composant
  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, property: Property) => {
    setAnchorEl(event.currentTarget);
    setSelectedProperty(property);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedProperty(null);
  };

  const handleEdit = () => {
    if (selectedProperty) {
      navigate(`/properties/${selectedProperty.id}/edit`);
    }
    handleMenuClose();
  };

  const handleView = () => {
    if (selectedProperty) {
      navigate(`/properties/${selectedProperty.id}`);
    }
    handleMenuClose();
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const confirmDelete = () => {
    // TODO: Implement delete logic
    console.log('Deleting property:', selectedProperty?.id);
    setDeleteDialogOpen(false);
  };

  // Filtrer les propriétés selon le rôle
  const getFilteredProperties = () => {
    let filteredProperties = properties;

    // Le filtrage par propriétaire est déjà fait côté serveur
    // Ici on applique seulement les filtres de recherche et de type/statut
    console.log('🔍 PropertiesList - Filtrage des propriétés, total:', properties.length);

    // Appliquer les filtres de recherche
    const finalFiltered = filteredProperties.filter((property) => {
      const matchesSearch = property.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           property.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           property.city.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedType === 'all' || property.type === selectedType;
      const matchesStatus = selectedStatus === 'all' || property.status === selectedStatus;
      const matchesHost = selectedHost === 'all' || property.ownerId === selectedHost;
      
      return matchesSearch && matchesType && matchesStatus && matchesHost;
    });

    console.log('🔍 PropertiesList - Propriétés après filtrage:', finalFiltered.length);
    return finalFiltered;
  };

  const filteredProperties = getFilteredProperties();

  const getPropertyTypeIcon = (type: string) => {
    switch (type) {
      case 'apartment':
        return <Apartment />;
      case 'house':
        return <Home />;
      case 'villa':
        return <Villa />;
      case 'studio':
        return <Hotel />;
      default:
        return <Home />;
    }
  };

  // Vérifier si l'utilisateur peut modifier/supprimer cette propriété
  const canModifyProperty = (property: Property): boolean => {
    if (isAdmin() || isManager()) return true;
    if (isHost() && property.ownerId === user?.id) return true; // Utiliser user?.id pour l'hôte connecté
    return false;
  };

  // Générer les types de propriétés avec traductions
  const propertyTypes = [
    { value: 'all', label: t('properties.allTypes') },
    { value: 'apartment', label: t('properties.types.apartment') },
    { value: 'house', label: t('properties.types.house') },
    { value: 'villa', label: t('properties.types.villa') },
    { value: 'studio', label: t('properties.types.studio') },
  ];

  // Générer les statuts avec traductions
  const statusOptions = [
    { value: 'all', label: t('properties.allStatuses') },
    ...PROPERTY_STATUS_OPTIONS.map(option => ({
      value: option.value.toLowerCase(),
      label: option.label
    }))
  ];

  return (
    <Box>
      <PageHeader
        title={t('properties.title')}
        subtitle={t('properties.subtitle')}
        backPath="/dashboard"
        showBackButton={false}
        actions={
          <Button
            variant="contained"
            color="primary"
            startIcon={<Add />}
            onClick={() => navigate('/properties/new')}
            size="small"
          >
            {t('properties.create')}
          </Button>
        }
      />

      {/* Filtres et recherche */}
      <FilterSearchBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={isHost() ? t('properties.searchMy') : t('properties.search')}
        filters={{
          type: {
            value: selectedType,
            options: propertyTypes,
            onChange: setSelectedType,
            label: t('properties.type')
          },
          status: {
            value: selectedStatus,
            options: statusOptions,
            onChange: setSelectedStatus,
            label: t('properties.status')
          },
          ...(false || false ? {
            host: {
              value: selectedHost,
              options: [{ value: 'all', label: t('properties.allHosts') }, ...hosts.map(host => ({ value: host.id.toString(), label: `${host.firstName} ${host.lastName}` }))],
              onChange: setSelectedHost,
              label: t('properties.owner')
            }
          } : {})
        }}
        counter={{
          label: t('properties.property'),
          count: filteredProperties.length,
          singular: "",
          plural: "s"
        }}
      />

      {/* Liste des propriétés */}
      {filteredProperties.length === 0 ? (
          <Grid item xs={12}>
            <Card sx={{ textAlign: 'center', py: 2.5, px: 2, ...createSpacing.card() }}>
              <CardContent>
                <Box sx={{ mb: 1.5 }}>
                  <Home sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.6 }} />
                </Box>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {t('properties.noPropertyFound')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  {isAdmin() || isManager() 
                    ? t('properties.noPropertyCreated')
                    : t('properties.noPropertyAssigned')}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 2 }}>
                  {t('properties.propertiesDescription')}
                </Typography>
                {(false || isAdmin() || isManager() || isHost()) && (
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => navigate('/properties/new')}
                    size="small"
                    sx={{ borderRadius: 1.5 }}
                  >
                    {t('properties.createFirst')}
                  </Button>
                )}
              </CardContent>
            </Card>
          </Grid>
        ) : (
          <Grid container spacing={2}>
            {filteredProperties.map((property) => (
              <Grid item xs={12} md={6} lg={4} key={property.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1, p: 1.5 }}>
                    {/* En-tête avec titre et menu */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1, minWidth: 0 }}>
                        <Box sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }}>
                          {getPropertyTypeIcon(property.type)}
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
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, property)}
                        sx={{ ml: 0.5, flexShrink: 0, p: 0.5 }}
                      >
                        <MoreVert sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>

                    {/* Description */}
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ 
                        mb: 1, 
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: '0.75rem'
                      }}
                      title={property.description || t('properties.noDescription')}
                    >
                      {property.description || t('properties.noDescription')}
                    </Typography>

                    {/* Localisation */}
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

                    {/* Chips pour type et statut */}
                    <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
                      <Chip
                        label={property.type === 'apartment' ? t('properties.types.apartment') : 
                               property.type === 'house' ? t('properties.types.house') : 
                               property.type === 'villa' ? t('properties.types.villa') : 
                               property.type === 'studio' ? t('properties.types.studio') : property.type}
                        color="primary"
                        size="small"
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                      <Chip
                        label={property.status}
                        color={property.status === 'active' ? 'success' : 'warning'}
                        size="small"
                        sx={{ textTransform: 'capitalize', height: 20, fontSize: '0.7rem' }}
                      />
                    </Box>

                    {/* Caractéristiques principales */}
                    <Grid container spacing={1} sx={{ mb: 1 }}>
                      <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <BedIcon sx={{ fontSize: 16, color: 'text.secondary', mb: 0.25 }} />
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.65rem', lineHeight: 1 }}>
                            {t('properties.bedrooms')}
                          </Typography>
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
                            {property.bedrooms}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <PersonIcon sx={{ fontSize: 16, color: 'text.secondary', mb: 0.25 }} />
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.65rem', lineHeight: 1 }}>
                            {t('properties.guests')}
                          </Typography>
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
                            {property.guests}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <BathroomIcon sx={{ fontSize: 16, color: 'text.secondary', mb: 0.25 }} />
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.65rem', lineHeight: 1 }}>
                            {t('properties.bathrooms')}
                          </Typography>
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>
                            {property.bathrooms}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>

                    {/* Divider pour séparer les informations */}
                    <Divider sx={{ my: 1 }} />

                    {/* Prix et actions */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                          <Euro sx={{ fontSize: 14, color: 'success.main' }} />
                          <Typography variant="subtitle1" fontWeight={700} color="success.main" sx={{ fontSize: '0.95rem' }}>
                            {property.nightlyPrice}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                            {t('properties.perNight')}
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, fontSize: '0.7rem' }}>
                          {property.squareMeters || 'N/A'} {t('properties.squareMeters')}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

      {/* Menu contextuel */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleView}>
          <ListItemIcon>
            <Visibility fontSize="small" />
          </ListItemIcon>
          {t('properties.viewDetails')}
        </MenuItem>
        {/* Actions d'édition/suppression - visibles selon les permissions */}
        {selectedProperty && canModifyProperty(selectedProperty) && (
          <>
            <MenuItem onClick={handleEdit}>
              <ListItemIcon>
                <Edit fontSize="small" />
              </ListItemIcon>
              {t('properties.modify')}
            </MenuItem>
            <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
              <ListItemIcon>
                <Delete fontSize="small" sx={{ color: 'error.main' }} />
              </ListItemIcon>
              {t('properties.delete')}
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('properties.confirmDelete')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('properties.confirmDeleteMessage', { name: selectedProperty?.name })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            {t('properties.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* FAB pour ajouter rapidement - visible selon les permissions */}
      {(false || isAdmin() || isManager() || isHost()) && (
        <Fab
          color="secondary"
          aria-label="add"
          size="small"
          sx={{ position: 'fixed', bottom: 12, right: 12, display: { md: 'none' } }}
          onClick={() => navigate('/properties/new')}
        >
          <Add />
        </Fab>
      )}
    </Box>
  );
}
