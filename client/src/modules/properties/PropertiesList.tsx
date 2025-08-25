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

const propertyTypes = [
  { value: 'all', label: 'Tous les types' },
  { value: 'apartment', label: 'Appartement' },
  { value: 'house', label: 'Maison' },
  { value: 'villa', label: 'Villa' },
  { value: 'studio', label: 'Studio' },
];

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
  const { user, isAdmin, isManager, isHost, hasPermission } = useAuth();

  // Charger les propriétés depuis l'API
  const loadProperties = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_CONFIG.BASE_URL}/api/properties`;
      
      // Si c'est un HOST, filtrer par ses propriétés
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
      if (!hasPermission('users:view') && !hasPermission('users:manage')) {
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
  }, [hasPermission]);

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

  return (
    <Box>
      <PageHeader
        title="Propriétés"
        subtitle="Gestion du parc immobilier"
        backPath="/dashboard"
        showBackButton={false}
        actions={
          <Button
            variant="contained"
            color="primary"
            startIcon={<Add />}
            onClick={() => navigate('/properties/new')}
          >
            Nouvelle propriété
          </Button>
        }
      />

      {/* Filtres et recherche */}
      <FilterSearchBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={isHost() ? "Rechercher ma propriété..." : "Rechercher une propriété..."}
        filters={{
          type: {
            value: selectedType,
            options: propertyTypes,
            onChange: setSelectedType,
            label: "Type de propriété"
          },
          status: {
            value: selectedStatus,
            options: [
              { value: 'all', label: 'Tous les statuts' },
              { value: 'active', label: 'Actif' },
              { value: 'inactive', label: 'Inactif' },
              { value: 'maintenance', label: 'Maintenance' }
            ],
            onChange: setSelectedStatus,
            label: "Statut"
          },
          ...(hasPermission('users:view') || hasPermission('users:manage') ? {
            host: {
              value: selectedHost,
              options: [{ value: 'all', label: 'Tous les hôtes' }, ...hosts.map(host => ({ value: host.id.toString(), label: `${host.firstName} ${host.lastName}` }))],
              onChange: setSelectedHost,
              label: "Hôte"
            }
          } : {})
        }}
        counter={{
          label: "propriété",
          count: filteredProperties.length,
          singular: "",
          plural: "s"
        }}
      />

      {/* Liste des propriétés */}
      {filteredProperties.length === 0 ? (
          <Grid item xs={12}>
            <Card sx={{ textAlign: 'center', py: 4, px: 3, ...createSpacing.card() }}>
              <CardContent>
                <Box sx={{ mb: 2 }}>
                  <Home sx={{ fontSize: 60, color: 'text.secondary', opacity: 0.6 }} />
                </Box>
                <Typography variant="h5" color="text.secondary" gutterBottom>
                  Aucune propriété trouvée
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                  {isAdmin() || isManager() 
                    ? "Aucune propriété n'a encore été créée dans le système."
                    : "Aucune propriété ne vous est actuellement assignée."}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Les propriétés permettent de gérer votre parc immobilier et de suivre les interventions de maintenance et nettoyage.
                </Typography>
                {(hasPermission('properties:create') || isAdmin() || isManager() || isHost()) && (
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => navigate('/properties/new')}
                    size="large"
                    sx={{ borderRadius: 2 }}
                  >
                    Créer votre première propriété
                  </Button>
                )}
              </CardContent>
            </Card>
          </Grid>
        ) : (
          <Grid container spacing={3}>
            {filteredProperties.map((property) => (
              <Grid item xs={12} md={6} lg={4} key={property.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1, ...createSpacing.card() }}>
                    {/* En-tête avec titre et menu */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                        {getPropertyTypeIcon(property.type)}
                        <Typography variant="h6" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
                          {property.name}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, property)}
                        sx={{ ml: 1 }}
                      >
                        <MoreVert />
                      </IconButton>
                    </Box>

                    {/* Description */}
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: '3em' }}>
                      {property.description || 'Aucune description disponible'}
                    </Typography>

                    {/* Localisation */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <LocationOn sx={{ fontSize: 18, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary">
                        {property.address}, {property.postalCode} {property.city}, {property.country}
                      </Typography>
                    </Box>

                    {/* Chips pour type et statut */}
                    <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                      <Chip
                        label={property.type === 'apartment' ? 'Appartement' : 
                               property.type === 'house' ? 'Maison' : 
                               property.type === 'villa' ? 'Villa' : 
                               property.type === 'studio' ? 'Studio' : property.type}
                        color="primary"
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        label={property.status}
                        color={property.status === 'active' ? 'success' : 'warning'}
                        size="small"
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </Box>

                    {/* Caractéristiques principales */}
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <BedIcon sx={{ fontSize: 20, color: 'text.secondary', mb: 0.5 }} />
                          <Typography variant="caption" color="text.secondary" display="block">
                            Chambres
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {property.bedrooms}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <PersonIcon sx={{ fontSize: 20, color: 'text.secondary', mb: 0.5 }} />
                          <Typography variant="caption" color="text.secondary" display="block">
                            Voyageurs
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {property.guests}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <BathroomIcon sx={{ fontSize: 20, color: 'text.secondary', mb: 0.5 }} />
                          <Typography variant="caption" color="text.secondary" display="block">
                            SDB
                          </Typography>
                          <Typography variant="body2" fontWeight={600}>
                            {property.bathrooms}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>

                    {/* Divider pour séparer les informations */}
                    <Divider sx={{ my: 2 }} />

                    {/* Prix et actions */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Euro sx={{ fontSize: 16, color: 'success.main' }} />
                          <Typography variant="h6" fontWeight={700} color="success.main">
                            {property.nightlyPrice}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            /nuit
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          Surface: {property.squareMeters || 'N/A'} m²
                        </Typography>
                      </Box>
                      <Box textAlign="right">
                        <Typography variant="h6" color="primary">
                          {property.bedrooms}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Chambres
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
          Voir détails
        </MenuItem>
        {/* Actions d'édition/suppression - visibles selon les permissions */}
        {selectedProperty && canModifyProperty(selectedProperty) && (
          <>
            <MenuItem onClick={handleEdit}>
              <ListItemIcon>
                <Edit fontSize="small" />
              </ListItemIcon>
              Modifier
            </MenuItem>
            <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
              <ListItemIcon>
                <Delete fontSize="small" sx={{ color: 'error.main' }} />
              </ListItemIcon>
              Supprimer
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Dialog de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir supprimer la propriété "{selectedProperty?.name}" ? 
            Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Annuler</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      {/* FAB pour ajouter rapidement - visible selon les permissions */}
      {(hasPermission('properties:create') || isAdmin() || isManager() || isHost()) && (
        <Fab
          color="secondary"
          aria-label="add"
          sx={{ position: 'fixed', bottom: 16, right: 16, display: { md: 'none' } }}
          onClick={() => navigate('/properties/new')}
        >
          <Add />
        </Fab>
      )}
    </Box>
  );
}
