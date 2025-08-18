import React, { useState } from 'react';
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
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import FilterSearchBar from '../../components/FilterSearchBar';

interface Property {
  id: string;
  name: string;
  type: 'apartment' | 'house' | 'villa' | 'studio';
  address: string;
  city: string;
  status: 'active' | 'inactive' | 'maintenance';
  rating: number;
  price: number;
  guests: number;
  bedrooms: number;
  bathrooms: number;
  imageUrl?: string;
  lastCleaning?: string;
  nextCleaning?: string;
  ownerId?: string; // ID du propriétaire pour les hôtes
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
    price: 120,
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
    price: 250,
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
    price: 85,
    guests: 2,
    bedrooms: 1,
    bathrooms: 1,
    lastCleaning: '2024-01-10',
    nextCleaning: '2024-01-20',
    ownerId: 'host-1',
  },
];

const propertyTypes = [
  { value: 'all', label: 'Tous les types', icon: <Home /> },
  { value: 'apartment', label: 'Appartements', icon: <Apartment /> },
  { value: 'house', label: 'Maisons', icon: <Home /> },
  { value: 'villa', label: 'Villas', icon: <Villa /> },
  { value: 'studio', label: 'Studios', icon: <Hotel /> },
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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { user, isAdmin, isManager, isHost, hasPermission } = useAuth();

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
    let properties = mockProperties;

    // Si c'est un hôte, ne montrer que ses propriétés
    if (isHost() && !isAdmin() && !isManager()) {
      properties = properties.filter(property => property.ownerId === 'host-1'); // Simuler l'ID de l'hôte connecté
    }

    // Appliquer les filtres de recherche
    return properties.filter((property) => {
      const matchesSearch = property.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           property.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           property.city.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedType === 'all' || property.type === selectedType;
      const matchesStatus = selectedStatus === 'all' || property.status === selectedStatus;
      
      return matchesSearch && matchesType && matchesStatus;
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
    if (isHost() && property.ownerId === 'host-1') return true; // Simuler l'ID de l'hôte connecté
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
            startIcon={<Add />}
            onClick={() => navigate('/properties/new')}
            sx={{ borderRadius: 2 }}
          >
            {isHost() ? 'Ajouter ma propriété' : 'Ajouter une propriété'}
          </Button>
        )}
      </Box>

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
          }
        }}
        counter={{
          label: "propriété",
          count: filteredProperties.length,
          singular: "",
          plural: "s"
        }}
      />

      {/* Liste des propriétés */}
      <Grid container spacing={3}>
        {filteredProperties.map((property) => (
          <Grid item xs={12} md={6} lg={4} key={property.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getPropertyTypeIcon(property.type)}
                    <Typography variant="h6" fontWeight={600}>
                      {property.name}
                    </Typography>
                  </Box>
                  {/* Menu contextuel - visible selon les permissions */}
                  {canModifyProperty(property) && (
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, property)}
                    >
                      <MoreVert />
                    </IconButton>
                  )}
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <LocationOn sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    {property.address}, {property.city}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Chip
                    label={statusLabels[property.status]}
                    color={statusColors[property.status]}
                    size="small"
                    variant="outlined"
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Star sx={{ fontSize: 16, color: 'warning.main' }} />
                    <Typography variant="body2" fontWeight={500}>
                      {property.rating}
                    </Typography>
                  </Box>
                </Box>

                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary">
                      Capacité
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {property.guests} pers.
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary">
                      Chambres
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {property.bedrooms}
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="caption" color="text.secondary">
                      SDB
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {property.bathrooms}
                    </Typography>
                  </Grid>
                </Grid>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Euro sx={{ fontSize: 16, color: 'success.main' }} />
                    <Typography variant="h6" fontWeight={700} color="success.main">
                      {property.price}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      /nuit
                    </Typography>
                  </Box>
                </Box>
              </CardContent>

              <CardActions sx={{ p: 2, pt: 0 }}>
                <Button
                  size="small"
                  startIcon={<Visibility />}
                  onClick={() => navigate(`/properties/${property.id}`)}
                  sx={{ flexGrow: 1 }}
                >
                  Voir détails
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

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
