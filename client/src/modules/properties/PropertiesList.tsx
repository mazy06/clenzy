import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Fab,
} from '@mui/material';
import {
  Add,
  Home,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import FilterSearchBar from '../../components/FilterSearchBar';
import PageHeader from '../../components/PageHeader';
import { propertiesApi, usersApi } from '../../services/api';
import { PropertyStatus, PROPERTY_STATUS_OPTIONS } from '../../types/statusEnums';
import { createSpacing } from '../../theme/spacing';
import { useTranslation } from '../../hooks/useTranslation';
import ExportButton from '../../components/ExportButton';
import type { ExportColumn } from '../../utils/exportUtils';
import PropertyCard from './PropertyCard';
import type { PropertyDetails } from './PropertyCard';

interface PropertyApiItem {
  id: number;
  name: string;
  type?: string;
  address: string;
  city: string;
  postalCode?: string;
  country?: string;
  status?: string;
  nightlyPrice?: number;
  maxGuests?: number;
  bedroomCount?: number;
  bathroomCount?: number;
  squareMeters?: number;
  description?: string;
  amenities?: string[];
  cleaningFrequency?: string;
  contactPhone?: string;
  contactEmail?: string;
  ownerId?: number;
}

// Types pour les propriétés (format interne)
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
  amenities?: string[];
  cleaningFrequency?: string;
  contactPhone?: string;
  contactEmail?: string;
  imageUrl?: string;
  lastCleaning?: string;
  nextCleaning?: string;
  ownerId?: string;
}

// Type pour les utilisateurs (hosts)
interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export default function PropertiesList() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedHost, setSelectedHost] = useState('all');
  const [hosts, setHosts] = useState<User[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { user, isAdmin, isManager, isHost, hasPermissionAsync } = useAuth();
  const { t } = useTranslation();

  // Charger les propriétés depuis l'API
  const loadProperties = useCallback(async () => {
    setLoading(true);
    try {
      const params = (isHost() && !isAdmin() && !isManager() && user?.id)
        ? { ownerId: user.id }
        : undefined;

      const data = await propertiesApi.getAll(params) as any;

      const convertedProperties = (data.content ?? data)?.map((prop: PropertyApiItem) => ({
        id: prop.id.toString(),
        name: prop.name,
        type: prop.type?.toLowerCase() || 'apartment',
        address: prop.address,
        city: prop.city,
        postalCode: prop.postalCode,
        country: prop.country,
        status: prop.status?.toLowerCase() || 'active',
        rating: 4.5,
        nightlyPrice: prop.nightlyPrice || 0,
        guests: prop.maxGuests || 2,
        bedrooms: prop.bedroomCount || 1,
        bathrooms: prop.bathroomCount || 1,
        squareMeters: prop.squareMeters,
        description: prop.description,
        amenities: prop.amenities || [],
        cleaningFrequency: prop.cleaningFrequency || 'ON_DEMAND',
        contactPhone: prop.contactPhone || '',
        contactEmail: prop.contactEmail || '',
        imageUrl: undefined,
        lastCleaning: undefined,
        nextCleaning: undefined,
        ownerId: prop.ownerId?.toString(),
      })) || [];

      setProperties(convertedProperties);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  }, [isHost, isAdmin, isManager, user?.id]);

  // Charger les hôtes (utilisateurs avec le rôle HOST)
  useEffect(() => {
    const loadHosts = async () => {
      if (!false && !false) {
        setHosts([]);
        return;
      }

      try {
        setLoading(true);
        const data = await usersApi.getAll({ role: 'HOST' }) as any;
        setHosts(data.content || data);
      } catch (err) {
        setHosts([]);
      } finally {
        setLoading(false);
      }
    };

    loadHosts();
  }, [hasPermissionAsync]);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  const confirmDelete = async () => {
    if (!selectedProperty) return;

    try {
      await propertiesApi.delete(Number(selectedProperty.id));
      setProperties(prev => prev.filter(p => p.id !== selectedProperty.id));
    } catch (err) {
      setError('Erreur de connexion lors de la suppression');
    } finally {
      setDeleteDialogOpen(false);
      setSelectedProperty(null);
    }
  };

  // Filtrer les propriétés
  const getFilteredProperties = () => {
    return properties.filter((property) => {
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

  // Convertir Property vers PropertyDetails pour le composant PropertyCard
  const toPropertyDetails = (property: Property): PropertyDetails => ({
    id: property.id,
    name: property.name,
    address: property.address,
    city: property.city,
    postalCode: property.postalCode || '',
    country: property.country || '',
    propertyType: property.type,
    status: property.status,
    nightlyPrice: property.nightlyPrice,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    surfaceArea: property.squareMeters || 0,
    description: property.description || '',
    amenities: property.amenities || [],
    cleaningFrequency: property.cleaningFrequency || 'ON_DEMAND',
    maxGuests: property.guests,
    contactPhone: property.contactPhone || '',
    contactEmail: property.contactEmail || '',
    rating: property.rating,
    lastCleaning: property.lastCleaning,
    nextCleaning: property.nextCleaning,
    ownerId: property.ownerId,
  });

  // Générer les types de propriétés avec traductions
  const propertyTypes = [
    { value: 'all', label: t('properties.allTypes') },
    { value: 'apartment', label: t('properties.types.apartment') },
    { value: 'house', label: t('properties.types.house') },
    { value: 'villa', label: t('properties.types.villa') },
    { value: 'studio', label: t('properties.types.studio') },
  ];

  const exportColumns: ExportColumn[] = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Nom' },
    { key: 'type', label: 'Type' },
    { key: 'address', label: 'Adresse' },
    { key: 'city', label: 'Ville' },
    { key: 'status', label: 'Statut' },
    { key: 'nightlyPrice', label: 'Prix/nuit (\u20AC)' },
    { key: 'bedrooms', label: 'Chambres' },
    { key: 'bathrooms', label: 'Salles de bain' },
    { key: 'squareMeters', label: 'Surface (m\u00b2)' },
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
          <Box sx={{ display: 'flex', gap: 1 }}>
            <ExportButton
              data={filteredProperties}
              columns={exportColumns}
              fileName="proprietes"
            />
            <Button
              variant="contained"
              color="primary"
              startIcon={<Add />}
              onClick={() => navigate('/properties/new')}
              size="small"
            >
              {t('properties.create')}
            </Button>
          </Box>
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

      {/* Liste des propri\u00e9t\u00e9s */}
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
                <Typography variant="caption" color="text.secondary" sx={{ mb: 3, display: 'block' }}>
                  {t('properties.propertiesDescription')}
                </Typography>
                {(false || isAdmin() || isManager() || isHost()) && (
                  <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={() => navigate('/properties/new')}
                      size="small"
                      sx={{ borderRadius: 1.5 }}
                    >
                      {t('properties.createFirst')}
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        ) : (
          <Grid container spacing={2}>
            {filteredProperties.map((property) => (
              <Grid item xs={12} md={6} lg={4} key={property.id}>
                <PropertyCard
                  property={toPropertyDetails(property)}
                  onEdit={() => navigate(`/properties/${property.id}/edit`)}
                  onDelete={() => {
                    setSelectedProperty(property);
                    setDeleteDialogOpen(true);
                  }}
                  onView={() => navigate(`/properties/${property.id}`)}
                />
              </Grid>
            ))}
          </Grid>
        )}

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

      {/* FAB pour ajouter rapidement */}
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
