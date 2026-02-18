import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  TablePagination,
} from '@mui/material';
import {
  Add,
  Home,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import FilterSearchBar from '../../components/FilterSearchBar';
import PageHeader from '../../components/PageHeader';
import { PROPERTY_STATUS_OPTIONS } from '../../types/statusEnums';
import { useTranslation } from '../../hooks/useTranslation';
import ExportButton from '../../components/ExportButton';
import type { ExportColumn } from '../../utils/exportUtils';
import PropertyCard from './PropertyCard';
import type { PropertyDetails } from './PropertyCard';
import { usePropertiesList } from '../../hooks/usePropertiesList';
import type { PropertyListItem } from '../../hooks/usePropertiesList';

// ─── Stable sx constants ────────────────────────────────────────────────────

const ACTION_BUTTON_SX = {
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0.01em',
  height: 28,
  px: 1.5,
  borderRadius: 1,
  textTransform: 'none',
  '& .MuiButton-startIcon': { mr: 0.5 },
  '& .MuiSvgIcon-root': { fontSize: 14 },
} as const;

const PAGINATION_SX = {
  position: 'sticky',
  bottom: 0,
  bgcolor: 'background.paper',
  borderTop: '1px solid',
  borderColor: 'divider',
  mt: 1.5,
  borderRadius: 1,
  '& .MuiTablePagination-toolbar': {
    minHeight: 36,
    px: 1,
  },
  '& .MuiTablePagination-displayedRows': {
    fontSize: '0.75rem',
    fontWeight: 500,
  },
  '& .MuiTablePagination-actions .MuiIconButton-root': {
    p: 0.5,
    '& .MuiSvgIcon-root': { fontSize: 18 },
  },
} as const;

const EMPTY_STATE_ICON_SX = {
  fontSize: 36,
  color: 'text.secondary',
  opacity: 0.5,
} as const;

const ITEMS_PER_PAGE = 6;

export default function PropertiesList() {
  // ─── React Query ──────────────────────────────────────────────────
  const { properties, isLoading, deleteProperty } = usePropertiesList();

  // ─── Local UI state ───────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedHost, setSelectedHost] = useState('all');
  const [selectedProperty, setSelectedProperty] = useState<PropertyListItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [page, setPage] = useState(0);

  const navigate = useNavigate();
  const { isAdmin, isManager, isHost } = useAuth();
  const { t } = useTranslation();

  // ─── Filtering ────────────────────────────────────────────────────

  const filteredProperties = useMemo(() => {
    return properties.filter((property) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = property.name.toLowerCase().includes(searchLower) ||
                           property.address.toLowerCase().includes(searchLower) ||
                           property.city.toLowerCase().includes(searchLower);
      const matchesType = selectedType === 'all' || property.type === selectedType;
      const matchesStatus = selectedStatus === 'all' || property.status === selectedStatus;
      const matchesHost = selectedHost === 'all' || property.ownerId === selectedHost;

      return matchesSearch && matchesType && matchesStatus && matchesHost;
    });
  }, [properties, searchTerm, selectedType, selectedStatus, selectedHost]);

  const paginatedProperties = useMemo(
    () => filteredProperties.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE),
    [filteredProperties, page]
  );

  useEffect(() => {
    setPage(0);
  }, [searchTerm, selectedType, selectedStatus, selectedHost]);

  // ─── Delete handler ───────────────────────────────────────────────

  const confirmDelete = () => {
    if (!selectedProperty) return;
    deleteProperty(selectedProperty.id);
    setDeleteDialogOpen(false);
    setSelectedProperty(null);
  };

  // ─── Converter to PropertyCard format ─────────────────────────────

  const toPropertyDetails = useCallback((property: PropertyListItem): PropertyDetails => ({
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
    createdAt: property.createdAt,
    cleaningBasePrice: property.cleaningBasePrice,
    numberOfFloors: property.numberOfFloors,
    hasExterior: property.hasExterior,
    hasLaundry: property.hasLaundry,
    defaultCheckInTime: property.defaultCheckInTime,
    defaultCheckOutTime: property.defaultCheckOutTime,
  }), []);

  // ─── Filter options ───────────────────────────────────────────────

  const propertyTypes = useMemo(() => [
    { value: 'all', label: t('properties.allTypes') },
    { value: 'apartment', label: t('properties.types.apartment') },
    { value: 'house', label: t('properties.types.house') },
    { value: 'villa', label: t('properties.types.villa') },
    { value: 'studio', label: t('properties.types.studio') },
  ], [t]);

  const exportColumns: ExportColumn[] = useMemo(() => [
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
  ], []);

  const statusOptions = [
    { value: 'all', label: t('properties.allStatuses') },
    ...PROPERTY_STATUS_OPTIONS.map(option => ({
      value: option.value.toLowerCase(),
      label: option.label
    }))
  ];

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <Box>
      <PageHeader
        title={t('properties.title')}
        subtitle={t('properties.subtitle')}
        backPath="/dashboard"
        showBackButton={false}
        actions={
          <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
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
              sx={ACTION_BUTTON_SX}
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
        <Card sx={{ textAlign: 'center', py: 2, px: 2, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ py: 1.5 }}>
            <Box sx={{ mb: 1 }}>
              <Home sx={EMPTY_STATE_ICON_SX} />
            </Box>
            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 0.5 }}
            >
              {t('properties.noPropertyFound')}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: '0.75rem', mb: 0.5 }}
            >
              {isAdmin() || isManager()
                ? t('properties.noPropertyCreated')
                : t('properties.noPropertyAssigned')}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: '0.6875rem', mb: 1.5, display: 'block' }}
            >
              {t('properties.propertiesDescription')}
            </Typography>
            {(isAdmin() || isManager() || isHost()) && (
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => navigate('/properties/new')}
                  size="small"
                  sx={ACTION_BUTTON_SX}
                >
                  {t('properties.createFirst')}
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Grid container spacing={1.5}>
            {paginatedProperties.map((property) => (
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
          {filteredProperties.length > ITEMS_PER_PAGE && (
            <TablePagination
              component="div"
              count={filteredProperties.length}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={ITEMS_PER_PAGE}
              rowsPerPageOptions={[ITEMS_PER_PAGE]}
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
              sx={PAGINATION_SX}
            />
          )}
        </>
      )}

      {/* Dialog de confirmation de suppression */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontSize: '0.875rem', fontWeight: 600, pb: 0.5 }}>
          {t('properties.confirmDelete')}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.8125rem' }}>
            {t('properties.confirmDeleteMessage', { name: selectedProperty?.name })}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 1.5 }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            size="small"
            sx={{ fontSize: '0.75rem', textTransform: 'none' }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={confirmDelete}
            color="error"
            variant="contained"
            size="small"
            sx={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'none', height: 28 }}
          >
            {t('properties.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* FAB pour ajouter rapidement */}
      {(isAdmin() || isManager() || isHost()) && (
        <Fab
          color="primary"
          aria-label="add"
          size="small"
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            display: { md: 'none' },
            width: 40,
            height: 40,
            '& .MuiSvgIcon-root': { fontSize: 20 },
          }}
          onClick={() => navigate('/properties/new')}
        >
          <Add />
        </Fab>
      )}
    </Box>
  );
}
