import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  Add,
  Home,
  Visibility,
  Edit,
  LocationOn,
  Star,
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
import { estimateCleaningPrice, estimateCleaningDuration, formatDuration } from './PropertyCard';
import ThemedTooltip from '../../components/ThemedTooltip';
import { MapboxPropertyMap } from '../../components/MapboxPropertyMap';
import type { PropertyMarker, MapBounds } from '../../components/MapboxPropertyMap';
import { usePropertiesList } from '../../hooks/usePropertiesList';
import type { PropertyListItem } from '../../hooks/usePropertiesList';
import {
  getPropertyStatusLabel,
  getPropertyStatusHex,
  getPropertyTypeLabel,
  getPropertyTypeHex,
  getCleaningFrequencyLabel,
  getCleaningFrequencyHex,
  getAmenityHex,
} from '../../utils/statusUtils';

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
const LIST_ROWS_PER_PAGE_OPTIONS = [10, 25, 50];
const LIST_DEFAULT_ROWS = 10;

const LIST_PAPER_SX = {
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
  borderRadius: 1.5,
} as const;

interface PropertiesListProps {
  embedded?: boolean;
  actionsContainer?: HTMLElement | null;
  filtersContainer?: HTMLElement | null;
}

export default function PropertiesList({ embedded = false, actionsContainer, filtersContainer }: PropertiesListProps) {
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
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'map'>('list');
  const [rowsPerPage, setRowsPerPage] = useState(LIST_DEFAULT_ROWS);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);

  const navigate = useNavigate();
  const { isAdmin, isManager, isHost } = useAuth();
  const { t } = useTranslation();
  const theme = useTheme();

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

  const effectivePageSize = viewMode === 'grid' ? ITEMS_PER_PAGE : rowsPerPage;

  const paginatedProperties = useMemo(
    () => filteredProperties.slice(page * effectivePageSize, (page + 1) * effectivePageSize),
    [filteredProperties, page, effectivePageSize]
  );

  // ─── Map markers (from filtered properties with coordinates) ─────
  const mapMarkers: PropertyMarker[] = useMemo(
    () =>
      filteredProperties
        .filter((p) => p.latitude != null && p.longitude != null)
        .map((p) => ({
          lat: p.latitude!,
          lng: p.longitude!,
          name: p.name,
          id: Number(p.id),
          type: 'property' as const,
        })),
    [filteredProperties],
  );

  useEffect(() => {
    setPage(0);
    if (viewMode !== 'map') setMapBounds(null);
  }, [searchTerm, selectedType, selectedStatus, selectedHost, viewMode]);

  // ─── Map bounds tracking (debounced) ───────────────────────────────
  const boundsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBoundsChange = useCallback((bounds: MapBounds) => {
    if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
    boundsTimerRef.current = setTimeout(() => setMapBounds(bounds), 300);
  }, []);

  useEffect(() => {
    return () => { if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current); };
  }, []);

  const viewportProperties = useMemo(() => {
    if (!mapBounds) return filteredProperties.filter((p) => p.latitude != null && p.longitude != null);
    // Small padding (~500m) so markers at the viewport edge are included
    const pad = 0.005;
    return filteredProperties.filter((p) => {
      if (p.latitude == null || p.longitude == null) return false;
      return (
        p.latitude >= mapBounds.south - pad &&
        p.latitude <= mapBounds.north + pad &&
        p.longitude >= mapBounds.west - pad &&
        p.longitude <= mapBounds.east + pad
      );
    });
  }, [filteredProperties, mapBounds]);

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
    { key: 'nightlyPrice', label: 'Prix/nuit (€)' },
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

  const actionButtons = (
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
        title={t('properties.create')}
      >
        {t('properties.create')}
      </Button>
    </Box>
  );

  const filterBar = (
    <FilterSearchBar
      bare
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
      viewToggle={{
        mode: viewMode,
        onChange: setViewMode,
      }}
    />
  );

  return (
    <Box>
      {/* Portal actions into parent's PageHeader when embedded */}
      {embedded && actionsContainer && createPortal(actionButtons, actionsContainer)}

      {/* Portal filters into parent's PageHeader when embedded */}
      {embedded && filtersContainer && createPortal(filterBar, filtersContainer)}

      {!embedded && (
        <PageHeader
          title={t('properties.title')}
          subtitle={t('properties.subtitle')}
          backPath="/dashboard"
          showBackButton={false}
          actions={actionButtons}
          filters={filterBar}
        />
      )}

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
      ) : viewMode === 'map' ? (
        /* ─── Vue carte (sticky) + liste viewport (scrollable) ─── */
        <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)', minHeight: 500 }}>
          {/* Carte fixe en haut */}
          <Paper sx={{ ...LIST_PAPER_SX, p: 0, overflow: 'hidden', flexShrink: 0 }}>
            {mapMarkers.length > 0 ? (
              <MapboxPropertyMap
                properties={mapMarkers}
                height={400}
                onMarkerClick={(marker) => {
                  if (marker.id) navigate(`/properties/${marker.id}`);
                }}
                onBoundsChange={handleBoundsChange}
              />
            ) : (
              <Box sx={{ height: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <Home sx={EMPTY_STATE_ICON_SX} />
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                  Aucune propriété avec coordonnées GPS
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                  Les coordonnées sont ajoutées automatiquement lors de la saisie de l'adresse
                </Typography>
              </Box>
            )}
          </Paper>

          {/* Liste scrollable en dessous */}
          {mapMarkers.length > 0 && (
            <Box sx={{ mt: 1.5, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <Typography
                variant="subtitle2"
                sx={{ mb: 1, fontSize: '0.8125rem', fontWeight: 600, color: 'text.secondary', flexShrink: 0 }}
              >
                {viewportProperties.length} {viewportProperties.length > 1 ? 'propriétés' : 'propriété'} dans la zone visible
              </Typography>

              {viewportProperties.length === 0 ? (
                <Paper sx={{ ...LIST_PAPER_SX, p: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                    Aucune propriété dans cette zone. Déplacez ou dézoomez la carte.
                  </Typography>
                </Paper>
              ) : (
                <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, pr: 0.5 }}>
                  {viewportProperties.map((property) => {
                    const statusColor = getPropertyStatusHex(property.status);
                    const typeColor = getPropertyTypeHex(property.type);
                    return (
                      <Paper
                        key={property.id}
                        sx={{
                          ...LIST_PAPER_SX,
                          p: 1.5,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          flexShrink: 0,
                          '&:hover': {
                            borderColor: 'primary.main',
                            bgcolor: 'action.hover',
                          },
                        }}
                        onClick={() => navigate(`/properties/${property.id}`)}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          {/* Nom + adresse */}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              sx={{ fontSize: '0.84rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                              {property.name}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                              <LocationOn sx={{ fontSize: 13, color: 'text.secondary', flexShrink: 0 }} />
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                              >
                                {property.address}, {property.city}
                              </Typography>
                            </Box>
                          </Box>

                          {/* Type + Statut chips */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                            <Chip
                              label={getPropertyTypeLabel(property.type, t)}
                              size="small"
                              sx={{
                                backgroundColor: `${typeColor}18`,
                                color: typeColor,
                                border: `1px solid ${typeColor}40`,
                                borderRadius: '6px',
                                fontWeight: 600,
                                fontSize: '0.68rem',
                                height: 22,
                                '& .MuiChip-label': { px: 0.75 },
                              }}
                            />
                            <Chip
                              label={getPropertyStatusLabel(property.status, t)}
                              size="small"
                              sx={{
                                backgroundColor: `${statusColor}18`,
                                color: statusColor,
                                border: `1px solid ${statusColor}40`,
                                borderRadius: '6px',
                                fontWeight: 600,
                                fontSize: '0.68rem',
                                height: 22,
                                '& .MuiChip-label': { px: 0.75 },
                              }}
                            />
                          </Box>

                          {/* Prix + Note + Action */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
                            {property.nightlyPrice > 0 && (
                              <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.84rem', whiteSpace: 'nowrap' }}>
                                {property.nightlyPrice}€
                                <Typography component="span" variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                                  /nuit
                                </Typography>
                              </Typography>
                            )}
                            {property.rating > 0 && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                <Star sx={{ fontSize: 14, color: '#f59e0b' }} />
                                <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.72rem' }}>
                                  {property.rating}
                                </Typography>
                              </Box>
                            )}
                            <Tooltip title="Détails">
                              <IconButton
                                size="small"
                                onClick={(e) => { e.stopPropagation(); navigate(`/properties/${property.id}`); }}
                                sx={{ p: 0.5 }}
                              >
                                <Visibility sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>
                      </Paper>
                    );
                  })}
                </Box>
              )}
            </Box>
          )}
        </Box>
      ) : viewMode === 'grid' ? (
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
      ) : (
        /* ─── Vue liste (table) ─── */
        <Paper sx={LIST_PAPER_SX}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow
                  sx={{
                    '& th': {
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      color: theme.palette.text.secondary,
                      borderBottom: `2px solid ${theme.palette.divider}`,
                      whiteSpace: 'nowrap',
                    },
                  }}
                >
                  <TableCell>Nom</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Caractéristiques</TableCell>
                  <TableCell>Commodités</TableCell>
                  <TableCell align="right">Prix/nuit</TableCell>
                  <TableCell align="right">Ménage estimé</TableCell>
                  <TableCell align="center">Ménage auto</TableCell>
                  <TableCell align="center">Statut</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedProperties.map((property) => {
                  const details = toPropertyDetails(property);
                  const price = estimateCleaningPrice(details);
                  const duration = estimateCleaningDuration(details);
                  return (
                    <TableRow
                      key={property.id}
                      hover
                      sx={{
                        cursor: 'pointer',
                        '&:last-child td': { borderBottom: 0 },
                      }}
                      onClick={() => navigate(`/properties/${property.id}`)}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.82rem' }}>
                          {property.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                          {property.address}, {property.postalCode} {property.city}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {(() => { const c = getPropertyTypeHex(property.type); return (
                        <Chip
                          label={getPropertyTypeLabel(property.type, t)}
                          size="small"
                          sx={{
                            backgroundColor: `${c}18`,
                            color: c,
                            border: `1px solid ${c}40`,
                            borderRadius: '6px',
                            fontWeight: 600,
                            fontSize: '0.68rem',
                            height: 22,
                            '& .MuiChip-label': { px: 0.75 },
                          }}
                        />
                        ); })()}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                          {property.bedrooms} ch. · {property.bathrooms} sdb · {property.squareMeters ?? 0} m² · {property.guests} voy.
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {property.amenities && property.amenities.length > 0 ? (
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'nowrap', alignItems: 'center' }}>
                            {property.amenities.slice(0, 3).map((amenity, i) => {
                              const c = getAmenityHex(amenity);
                              return (
                              <Chip
                                key={i}
                                label={t(`properties.amenities.items.${amenity}`)}
                                size="small"
                                sx={{
                                  backgroundColor: `${c}18`,
                                  color: c,
                                  border: `1px solid ${c}40`,
                                  borderRadius: '6px',
                                  fontWeight: 600,
                                  fontSize: '0.62rem',
                                  height: 22,
                                  '& .MuiChip-label': { px: 0.75 },
                                }}
                              />
                              );
                            })}
                            {property.amenities.length > 3 && (
                              <ThemedTooltip
                                title={
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {property.amenities.map((a, i) => {
                                      const c = getAmenityHex(a);
                                      return (
                                      <Chip
                                        key={i}
                                        label={t(`properties.amenities.items.${a}`)}
                                        size="small"
                                        sx={{
                                          backgroundColor: `${c}18`,
                                          color: c,
                                          border: `1px solid ${c}40`,
                                          borderRadius: '6px',
                                          fontWeight: 600,
                                          fontSize: '0.6rem',
                                          height: 20,
                                          '& .MuiChip-label': { px: 0.75 },
                                        }}
                                      />
                                      );
                                    })}
                                  </Box>
                                }
                                arrow
                                placement="top"
                              >
                                <Chip
                                  label={`+${property.amenities.length - 3}`}
                                  size="small"
                                  sx={{ height: 22, fontSize: '0.62rem', fontWeight: 600, backgroundColor: '#75757518', color: '#757575', border: '1px solid #75757540', borderRadius: '6px', '& .MuiChip-label': { px: 0.75 }, cursor: 'default' }}
                                />
                              </ThemedTooltip>
                            )}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.82rem' }}>
                          {property.nightlyPrice > 0 ? `${property.nightlyPrice}€` : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {price != null ? (
                          <Box>
                            <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.82rem' }}>
                              {price}€
                            </Typography>
                            {duration != null && (
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                                ~{formatDuration(duration)}
                              </Typography>
                            )}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {(() => { const c = getCleaningFrequencyHex(property.cleaningFrequency || 'ON_DEMAND'); return (
                          <Chip
                            label={getCleaningFrequencyLabel(property.cleaningFrequency || 'ON_DEMAND', t)}
                            size="small"
                            sx={{
                              backgroundColor: `${c}18`,
                              color: c,
                              border: `1px solid ${c}40`,
                              borderRadius: '6px',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                              height: 24,
                              '& .MuiChip-label': { px: 1 },
                            }}
                          />
                        ); })()}
                      </TableCell>
                      <TableCell align="center">
                        {(() => { const c = getPropertyStatusHex(property.status); return (
                          <Chip
                            label={getPropertyStatusLabel(property.status, t)}
                            size="small"
                            sx={{
                              backgroundColor: `${c}18`,
                              color: c,
                              border: `1px solid ${c}40`,
                              borderRadius: '6px',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                              height: 24,
                              '& .MuiChip-label': { px: 1 },
                            }}
                          />
                        ); })()}
                      </TableCell>
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                        <Tooltip title="Détails">
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); navigate(`/properties/${property.id}`); }}
                          >
                            <Visibility sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Modifier">
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); navigate(`/properties/${property.id}/edit`); }}
                          >
                            <Edit sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filteredProperties.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            rowsPerPageOptions={LIST_ROWS_PER_PAGE_OPTIONS}
            labelRowsPerPage="Lignes par page"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
            sx={PAGINATION_SX}
          />
        </Paper>
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
