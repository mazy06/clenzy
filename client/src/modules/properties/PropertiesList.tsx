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
import PropertyForm from './PropertyForm';
import { API_CONFIG } from '../../config/api';

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

const mockProperties: Property[] = [
  {
    id: '1',
    name: 'Appartement Montmartre',
    type: 'apartment',
    address: '15 rue de la Paix',
    city: 'Paris',
    status: 'active',
    rating: 4.8,
    nightlyPrice: 120,
    guests: 4,
    bedrooms: 2,
    bathrooms: 1,
    lastCleaning: '2024-01-15',
    nextCleaning: '2024-01-18',
    ownerId: 'host-1',
  },
  {
    id: '2',
    name: 'Villa Sunshine',
    type: 'villa',
    address: '25 Promenade des Anglais',
    city: 'Nice',
    status: 'active',
    rating: 4.9,
    nightlyPrice: 250,
    guests: 6,
    bedrooms: 3,
    bathrooms: 2,
    lastCleaning: '2024-01-14',
    nextCleaning: '2024-01-17',
    ownerId: 'host-2',
  },
  {
    id: '3',
    name: 'Studio Le Marais',
    type: 'studio',
    address: '8 rue des Rosiers',
    city: 'Paris',
    status: 'maintenance',
    rating: 4.6,
    nightlyPrice: 90,
    guests: 2,
    bedrooms: 1,
    bathrooms: 1,
    lastCleaning: '2024-01-10',
    nextCleaning: '2024-01-20',
    ownerId: 'host-1',
  },
];

const propertyTypes = [
  { value: 'all', label: 'Tous les types' },
  { value: 'apartment', label: 'Appartement' },
  { value: 'house', label: 'Maison' },
  { value: 'villa', label: 'Villa' },
  { value: 'studio', label: 'Studio' },
];

const statusColors = {
  active: 'success',
  inactive: 'default',
  maintenance: 'warning',
} as const;

const statusLabels = {
  active: 'Actif',
  inactive: 'Inactif',
  maintenance: 'Maintenance',
};

export default function PropertiesList() {
  console.log('🔍 PropertiesList - Composant chargé');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedHost, setSelectedHost] = useState('all'); // Nouveau filtre par host
  const [hosts, setHosts] = useState<User[]>([]); // Liste des hosts
  const [loadingHosts, setLoadingHosts] = useState(false); // Chargement des hosts
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false); // New state for form visibility
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, isAdmin, isManager, isHost, hasPermission } = useAuth();

  // Charger les propriétés depuis l'API
  const loadProperties = useCallback(async () => {
    console.log('🔍 PropertiesList - loadProperties appelé');
    setLoading(true);
    try {
      console.log('🔍 PropertiesList - Appel API en cours...');
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/properties`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
      });
      
      console.log('🔍 PropertiesList - Réponse API reçue:', response.status, response.ok);
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 PropertiesList - Données reçues du backend:', data);
        console.log('🔍 PropertiesList - Contenu de la réponse:', data.content);
        
        // Convertir les données du backend vers le format frontend
        const convertedProperties = data.content?.map((prop: any) => {
          console.log('🔍 PropertiesList - Propriété individuelle du backend:', prop);
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
            nightlyPrice: (() => {
              console.log('🔍 PropertiesList - nightlyPrice brut du backend:', prop.nightlyPrice);
              console.log('🔍 PropertiesList - Type de nightlyPrice:', typeof prop.nightlyPrice);
              const price = prop.nightlyPrice || 0;
              console.log('🔍 PropertiesList - nightlyPrice final:', price);
              return price;
            })(),
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
          console.log('🔍 PropertiesList - Propriété convertie:', converted);
          return converted;
        }) || [];
        
        console.log('🔍 PropertiesList - Propriétés finales:', convertedProperties);
        setProperties(convertedProperties);
      } else {
        console.error('🔍 PropertiesList - Erreur API:', response.status);
      }
    } catch (err) {
      console.error('🔍 PropertiesList - Erreur chargement propriétés:', err);
    } finally {
      console.log('🔍 PropertiesList - Fin du chargement, loading = false');
      setLoading(false);
    }
  }, []);

  // Charger la liste des hosts depuis l'API
  const loadHosts = useCallback(async () => {
    // Seulement charger les hosts si l'utilisateur est admin ou manager
    if (!isAdmin() && !isManager()) return;
    
    setLoadingHosts(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/users`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('kc_access_token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Filtrer seulement les utilisateurs avec le rôle HOST
        const hostsList = (data.content || data).filter((user: User) => 
          user.role === 'HOST'
        );
        console.log('🔍 PropertiesList - Hosts chargés:', hostsList);
        setHosts(hostsList);
      }
    } catch (err) {
      console.error('🔍 PropertiesList - Erreur chargement hosts:', err);
    } finally {
      setLoadingHosts(false);
    }
  }, [isAdmin, isManager]);

  // Charger les données au montage du composant
  useEffect(() => {
    console.log('🔍 PropertiesList - useEffect pour loadProperties appelé');
    loadProperties();
    loadHosts();
  }, [loadProperties, loadHosts]);

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

  // Gestion du formulaire d'ajout
  const handleShowAddForm = () => {
    setShowAddForm(true);
  };

  const handleCloseAddForm = () => {
    setShowAddForm(false);
  };

  const handlePropertyCreated = () => {
    // Recharger la liste des propriétés depuis l'API
    loadProperties();
    setShowAddForm(false);
  };

  // Filtrer les propriétés selon le rôle
  const getFilteredProperties = () => {
    let filteredProperties = properties;

    // Si c'est un hôte, ne montrer que ses propriétés
    if (isHost() && !isAdmin() && !isManager()) {
      filteredProperties = properties.filter(property => property.ownerId === user?.id);
    }

    // Appliquer les filtres de recherche
    return filteredProperties.filter((property) => {
      const matchesSearch = property.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           property.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           property.city.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedType === 'all' || property.type === selectedType;
      const matchesStatus = selectedStatus === 'all' || property.status === selectedStatus;
      const matchesHost = selectedHost === 'all' || property.ownerId === selectedHost;
      
      return matchesSearch && matchesType && matchesStatus && matchesHost;
    });
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
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            {isHost() ? 'Mes propriétés' : 'Propriétés'}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {isHost() ? 'Gérez vos propriétés Airbnb' : 'Gérez les propriétés Airbnb'}
          </Typography>
        </Box>
        {/* Bouton d'ajout - visible selon les permissions */}
        {(hasPermission('properties:create') || isAdmin() || isManager() || isHost()) && (
          <Button
            variant="contained"
            startIcon={showAddForm ? <Home /> : <Add />}
            onClick={showAddForm ? handleCloseAddForm : handleShowAddForm}
            sx={{ borderRadius: 2 }}
          >
            {showAddForm ? 'Liste des propriétés' : (isHost() ? 'Ajouter ma propriété' : 'Ajouter une propriété')}
          </Button>
        )}
      </Box>

      {/* Filtres et recherche */}
      {!showAddForm && (
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
            host: {
              value: selectedHost,
              options: [{ value: 'all', label: 'Tous les hôtes' }, ...hosts.map(host => ({ value: host.id.toString(), label: `${host.firstName} ${host.lastName}` }))],
              onChange: setSelectedHost,
              label: "Hôte"
            }
          }}
          counter={{
            label: "propriété",
            count: filteredProperties.length,
            singular: "",
            plural: "s"
          }}
        />
      )}

      {/* Liste des propriétés */}
      {!showAddForm && (
        <Grid container spacing={3}>
          {loading ? (
            <Grid item xs={12}>
              <Typography variant="h6" align="center">Chargement des propriétés...</Typography>
            </Grid>
          ) : filteredProperties.length === 0 ? (
            <Grid item xs={12}>
              <Typography variant="h6" align="center">Aucune propriété trouvée.</Typography>
            </Grid>
          ) : (
            filteredProperties.map((property) => (
              <Grid item xs={12} md={6} lg={4} key={property.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1, p: 3 }}>
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
            ))

          )}
        </Grid>
      )}

      {/* Menu contextuel */}
      {!showAddForm && (
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
      )}

      {/* Dialog de confirmation de suppression */}
      {!showAddForm && (
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
      )}

      {/* Formulaire d'ajout de propriété */}
      {showAddForm && (
        <PropertyForm
          onClose={handleCloseAddForm}
          onSuccess={handlePropertyCreated}
        />
      )}

      {/* FAB pour ajouter rapidement - visible selon les permissions */}
      {(hasPermission('properties:create') || isAdmin() || isManager() || isHost()) && (
        <Fab
          color="secondary"
          aria-label="add"
          sx={{ position: 'fixed', bottom: 16, right: 16, display: { md: 'none' } }}
          onClick={handleShowAddForm}
        >
          <Add />
        </Fab>
      )}
    </Box>
  );
}
