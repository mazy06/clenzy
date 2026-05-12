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
} from '../../icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePersistedViewMode } from '../../hooks/usePersistedViewMode';
import FilterSearchBar from '../../components/FilterSearchBar';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
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
import { PropertyImageCarousel } from '../../components/PropertyImageCarousel';
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

const ICON_BUTTON_SX = {
  p: 0.5,
  borderRadius: 1,
  border: '1px solid',
  borderColor: 'divider',
  color: 'text.secondary',
  '&:hover': { bgcolor: 'rgba(107,138,154,0.08)', borderColor: 'primary.main', color: 'primary.main' },
  '& .MuiSvgIcon-root': { fontSize: 18 },
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
  // Auto default : map si au moins 1 propriete a des coords GPS, sinon list.
  // undefined tant qu'on charge -> le hook conserve son fallback initial.
  const autoDefaultMode = useMemo<'map' | 'list' | undefined>(() => {
    if (isLoading) return undefined;
    return properties.some((p) => p.latitude != null && p.longitude != null)
      ? 'map'
      : 'list';
  }, [isLoading, properties]);
  const [viewMode, setViewMode] = usePersistedViewMode<'grid' | 'list' | 'map'>(
    'properties',
    'map',
    ['grid', 'list', 'map'] as const,
    autoDefaultMode,
  );
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
        variant="icon"
      />
      <Tooltip title={t('properties.create')}>
        <IconButton
          size="small"
          onClick={() => navigate('/properties/new')}
          sx={{ ...ICON_BUTTON_SX, color: 'primary.main', borderColor: 'primary.main', bgcolor: 'rgba(107,138,154,0.06)' }}
        >
          <Add size={20} strokeWidth={1.75} />
        </IconButton>
      </Tooltip>
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
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Portal actions into parent's PageHeader when embedded */}
      {embedded && actionsContainer && createPortal(actionButtons, actionsContainer)}

      {/* Portal filters into parent's PageHeader when embedded */}
      {embedded && filtersContainer && createPortal(filterBar, filtersContainer)}

      {!embedded && (
        <Box sx={{ flexShrink: 0 }}>
          <PageHeader
            title={t('properties.title')}
            subtitle={t('properties.subtitle')}
            iconBadge={<Home />}
            backPath="/dashboard"
            showBackButton={false}
            actions={actionButtons}
            filters={filterBar}
          />
        </Box>
      )}

      {/* Liste des propriétés */}
      {filteredProperties.length === 0 ? (
        <EmptyState
          icon={<Home />}
          title={t('properties.noPropertyFound')}
          description={`${
            isAdmin() || isManager()
              ? t('properties.noPropertyCreated')
              : t('properties.noPropertyAssigned')
          } — ${t('properties.propertiesDescription')}`}
          action={(isAdmin() || isManager() || isHost()) && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<Add size={16} strokeWidth={1.75} />}
              onClick={() => navigate('/properties/new')}
            >
              {t('properties.createFirst')}
            </Button>
          )}
        />
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
                <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', opacity: 0.5 }}><Home size={36} strokeWidth={1.5} /></Box>
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
                              <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', flexShrink: 0 }}><LocationOn size={13} strokeWidth={1.75} /></Box>
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
                            <Tooltip title="Détails">
                              <IconButton
                                size="small"
                                onClick={(e) => { e.stopPropagation(); navigate(`/properties/${property.id}`); }}
                                sx={{ p: 0.5 }}
                              >
                                <Visibility size={16} strokeWidth={1.75} />
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
        <Paper
          sx={{
            ...LIST_PAPER_SX,
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <TableContainer sx={{ flex: 1, overflow: 'hidden' }}>
            <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
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
                  <TableCell sx={{ width: '20%' }}>Nom</TableCell>
                  <TableCell sx={{ width: '9%' }}>Type</TableCell>
                  <TableCell sx={{ width: '17%' }}>Caractéristiques</TableCell>
                  <TableCell sx={{ width: '14%' }}>Commodités</TableCell>
                  <TableCell align="right" sx={{ width: '8%' }}>Prix/nuit</TableCell>
                  <TableCell align="right" sx={{ width: '9%' }}>Ménage estimé</TableCell>
                  <TableCell align="center" sx={{ width: '10%' }}>Ménage auto</TableCell>
                  <TableCell align="center" sx={{ width: '7%' }}>Statut</TableCell>
                  <TableCell align="center" sx={{ width: '6%' }}>Actions</TableCell>
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
                      <TableCell sx={{ p: 0, pr: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                          <PropertyImageCarousel photoUrls={property.photoUrls} alt={property.name} />
                          <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, pl: 1.25 }}>
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              sx={{
                                fontSize: '0.82rem',
                                minWidth: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {property.name}
                            </Typography>
                          </Box>
                        </Box>
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
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            fontSize: '0.78rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {property.bedrooms} ch. · {property.bathrooms} sdb · {property.squareMeters ?? 0} m² · {property.guests} voy.
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {property.amenities && property.amenities.length > 0 ? (
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'nowrap', alignItems: 'center', overflow: 'hidden' }}>
                            {property.amenities.slice(0, 2).map((amenity, i) => {
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
                            {property.amenities.length > 2 && (
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
                                  label={`+${property.amenities.length - 2}`}
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
                            <Visibility size={18} strokeWidth={1.75} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Modifier">
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); navigate(`/properties/${property.id}/edit`); }}
                          >
                            <Edit size={18} strokeWidth={1.75} />
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
            sx={{ flexShrink: 0, borderTop: '1px solid', borderColor: 'divider' }}
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
          <Add size={20} strokeWidth={1.75} />
        </Fab>
      )}
    </Box>
  );
}
