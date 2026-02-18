import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Chip,
  TextField,
} from '@mui/material';
import {
  Home,
  Person,
  Bed,
  Bathtub,
  SquareFoot,
  Layers,
  Deck,
  LocalLaundryService,
  People,
  Category,
  Window,
  DoorSliding,
  Iron,
  Kitchen,
  AutoAwesome,
} from '@mui/icons-material';
import { Controller, Control, FieldErrors } from 'react-hook-form';
import { useTranslation } from '../../hooks/useTranslation';
import { getPropertyTypeLabel } from '../../utils/statusUtils';
import type { ServiceRequestFormValues } from '../../schemas';

interface Property {
  id: number;
  name: string;
  address: string;
  city: string;
  type: string;
  ownerId?: number;
  // Caractéristiques logement
  bedroomCount?: number;
  bathroomCount?: number;
  squareMeters?: number;
  maxGuests?: number;
  // Tarification ménage
  cleaningDurationMinutes?: number;
  cleaningBasePrice?: number;
  cleaningNotes?: string;
  cleaningFrequency?: string;
  numberOfFloors?: number;
  hasExterior?: boolean;
  hasLaundry?: boolean;
  // Prestations à la carte
  windowCount?: number;
  frenchDoorCount?: number;
  slidingDoorCount?: number;
  hasIroning?: boolean;
  hasDeepKitchen?: boolean;
  hasDisinfection?: boolean;
  // Check-in/out
  defaultCheckInTime?: string;
  defaultCheckOutTime?: string;
}

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export interface ServiceRequestFormPropertyProps {
  control: Control<ServiceRequestFormValues>;
  errors: FieldErrors<ServiceRequestFormValues>;
  properties: Property[];
  users: User[];
  isAdminOrManager: boolean;
  selectedProperty?: Property | null;
  disabled?: boolean;
}

// ─── Stable sx ──────────────────────────────────────────────────────────────

const TAGS_CONTAINER_SX = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 0.75,
  mt: 1.5,
  mb: 0.5,
} as const;

const TAG_SX = {
  height: 30,
  fontSize: '0.75rem',
  fontWeight: 500,
  color: 'text.secondary',
  borderWidth: 1.5,
  borderColor: 'grey.200',
  '& .MuiChip-icon': { fontSize: 14, ml: 0.5, color: 'primary.main' },
  '& .MuiChip-label': { px: 0.75 },
} as const;

/** Shared Select sx for consistent styling */
const SELECT_SX = {
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: 'grey.200',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: 'primary.light',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: 'primary.main',
  },
} as const;

const ServiceRequestFormProperty: React.FC<ServiceRequestFormPropertyProps> = React.memo(
  ({ control, errors, properties, users, isAdminOrManager, selectedProperty, disabled = false }) => {
    const { t } = useTranslation();

    // Construire les tags caractéristiques du logement sélectionné
    const propertyTags = React.useMemo(() => {
      if (!selectedProperty) return [];
      const tags: { icon: React.ReactElement; label: string }[] = [];

      // Type de logement
      if (selectedProperty.type) {
        tags.push({
          icon: <Category sx={{ fontSize: 14 }} />,
          label: getPropertyTypeLabel(selectedProperty.type, t),
        });
      }

      // Surface
      if (selectedProperty.squareMeters && selectedProperty.squareMeters > 0) {
        tags.push({
          icon: <SquareFoot sx={{ fontSize: 14 }} />,
          label: `${selectedProperty.squareMeters} m²`,
        });
      }

      // Chambres
      if (selectedProperty.bedroomCount && selectedProperty.bedroomCount > 0) {
        tags.push({
          icon: <Bed sx={{ fontSize: 14 }} />,
          label: `${selectedProperty.bedroomCount} ${selectedProperty.bedroomCount > 1 ? 'chambres' : 'chambre'}`,
        });
      }

      // Salles de bain
      if (selectedProperty.bathroomCount && selectedProperty.bathroomCount > 0) {
        tags.push({
          icon: <Bathtub sx={{ fontSize: 14 }} />,
          label: `${selectedProperty.bathroomCount} SDB`,
        });
      }

      // Capacité
      if (selectedProperty.maxGuests && selectedProperty.maxGuests > 0) {
        tags.push({
          icon: <People sx={{ fontSize: 14 }} />,
          label: `${selectedProperty.maxGuests} voyageurs`,
        });
      }

      // Étages
      if (selectedProperty.numberOfFloors && selectedProperty.numberOfFloors > 1) {
        tags.push({
          icon: <Layers sx={{ fontSize: 14 }} />,
          label: `${selectedProperty.numberOfFloors} étages`,
        });
      }

      // Extérieur
      if (selectedProperty.hasExterior) {
        tags.push({
          icon: <Deck sx={{ fontSize: 14 }} />,
          label: 'Extérieur',
        });
      }

      // Linge
      if (selectedProperty.hasLaundry) {
        tags.push({
          icon: <LocalLaundryService sx={{ fontSize: 14 }} />,
          label: 'Linge',
        });
      }

      // Fenêtres
      if (selectedProperty.windowCount && selectedProperty.windowCount > 0) {
        tags.push({
          icon: <Window sx={{ fontSize: 14 }} />,
          label: `${selectedProperty.windowCount} fenêtres`,
        });
      }

      // Porte-fenêtres
      if (selectedProperty.frenchDoorCount && selectedProperty.frenchDoorCount > 0) {
        tags.push({
          icon: <DoorSliding sx={{ fontSize: 14 }} />,
          label: `${selectedProperty.frenchDoorCount} portes-fenêtres`,
        });
      }

      // Baies vitrées
      if (selectedProperty.slidingDoorCount && selectedProperty.slidingDoorCount > 0) {
        tags.push({
          icon: <DoorSliding sx={{ fontSize: 14 }} />,
          label: `${selectedProperty.slidingDoorCount} baies vitrées`,
        });
      }

      // Repassage
      if (selectedProperty.hasIroning) {
        tags.push({
          icon: <Iron sx={{ fontSize: 14 }} />,
          label: 'Repassage',
        });
      }

      // Cuisine approfondie
      if (selectedProperty.hasDeepKitchen) {
        tags.push({
          icon: <Kitchen sx={{ fontSize: 14 }} />,
          label: 'Cuisine approfondie',
        });
      }

      // Désinfection
      if (selectedProperty.hasDisinfection) {
        tags.push({
          icon: <AutoAwesome sx={{ fontSize: 14 }} />,
          label: 'Désinfection',
        });
      }

      return tags;
    }, [selectedProperty, t]);

    return (
      <>
        {/* Titre de la demande */}
        <Box sx={{ mb: 2 }}>
          <Controller
            name="title"
            control={control}
            render={({ field, fieldState }) => (
              <FormControl fullWidth error={!!fieldState.error}>
                <InputLabel shrink sx={{ color: 'text.secondary' }}>
                  {t('serviceRequests.fields.title')} *
                </InputLabel>
                <TextField
                  {...field}
                  fullWidth
                  disabled={disabled}
                  placeholder={t('serviceRequests.fields.titlePlaceholder')}
                  size="small"
                  error={!!fieldState.error}
                  InputLabelProps={{ shrink: true }}
                  label={`${t('serviceRequests.fields.title')} *`}
                  sx={{
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'grey.200',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'primary.light',
                    },
                    '& .Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'primary.main',
                    },
                  }}
                />
                {fieldState.error && (
                  <FormHelperText>{fieldState.error.message}</FormHelperText>
                )}
              </FormControl>
            )}
          />
        </Box>

        {/* Propriete */}
        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary', mb: 1.5 }}>
          {t('serviceRequests.sections.property')}
        </Typography>

        {/* Propriété et Demandeur sur la même ligne */}
        <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
          {/* Propriété */}
          <Box sx={{ flex: 7 }}>
            <Controller
              name="propertyId"
              control={control}
              render={({ field, fieldState }) => {
                const selectedProp = properties.find(p => p.id === field.value);
                return (
                  <FormControl fullWidth error={!!fieldState.error}>
                    <InputLabel shrink sx={{ color: 'text.secondary' }}>
                      {t('serviceRequests.fields.property')}
                    </InputLabel>
                    <Select
                      value={field.value}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      onBlur={field.onBlur}
                      label={t('serviceRequests.fields.property')}
                      size="small"
                      displayEmpty
                      notched
                      sx={SELECT_SX}
                      renderValue={() => (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Home sx={{ fontSize: 16, color: selectedProp ? 'primary.main' : 'grey.400' }} />
                          <Typography sx={{ fontSize: '0.8125rem', color: selectedProp ? 'text.secondary' : 'grey.400' }}>
                            {selectedProp
                              ? `${selectedProp.name} - ${selectedProp.address}, ${selectedProp.city}`
                              : t('serviceRequests.fields.selectProperty')}
                          </Typography>
                        </Box>
                      )}
                    >
                      {properties.map((property) => (
                        <MenuItem key={property.id} value={property.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Home sx={{ fontSize: 16, color: 'primary.main' }} />
                            <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
                              {property.name} - {property.address}, {property.city}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                    {fieldState.error && (
                      <FormHelperText>{fieldState.error.message}</FormHelperText>
                    )}
                  </FormControl>
                );
              }}
            />
          </Box>

          {/* Demandeur */}
          <Box sx={{ flex: 5 }}>
            <Controller
              name="userId"
              control={control}
              render={({ field, fieldState }) => {
                const selectedUser = users.find(u => u.id === field.value);
                const hasValue = !!selectedUser;
                return (
                  <FormControl fullWidth error={!!fieldState.error}>
                    <InputLabel shrink sx={{ color: 'text.secondary' }}>
                      {t('serviceRequests.fields.requestor')}
                    </InputLabel>
                    <Select
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      onBlur={field.onBlur}
                      label={t('serviceRequests.fields.requestor')}
                      disabled={!isAdminOrManager}
                      size="small"
                      displayEmpty
                      notched
                      sx={SELECT_SX}
                      renderValue={() => (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Person sx={{ fontSize: 16, color: hasValue ? 'primary.main' : 'grey.400' }} />
                          <Typography sx={{ fontSize: '0.8125rem', color: hasValue ? 'text.secondary' : 'grey.400' }}>
                            {hasValue
                              ? `${selectedUser.firstName} ${selectedUser.lastName}`
                              : t('serviceRequests.fields.selectRequestor')}
                          </Typography>
                        </Box>
                      )}
                    >
                      {users.map((u) => (
                        <MenuItem key={u.id} value={u.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Person sx={{ fontSize: 16, color: 'primary.main' }} />
                            <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
                              {u.firstName} {u.lastName}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                    {!isAdminOrManager && (
                      <FormHelperText sx={{ fontSize: '0.625rem', color: 'text.disabled', m: 0, mt: 0.5 }}>
                        {t('serviceRequests.fields.requestorHelper')}
                      </FormHelperText>
                    )}
                    {fieldState.error && (
                      <FormHelperText>{fieldState.error.message}</FormHelperText>
                    )}
                  </FormControl>
                );
              }}
            />
          </Box>
        </Box>

        {/* Chips caractéristiques du logement */}
        {propertyTags.length > 0 && (
          <Box sx={TAGS_CONTAINER_SX}>
            {propertyTags.map((tag, idx) => (
              <Chip
                key={idx}
                icon={tag.icon}
                label={tag.label}
                size="small"
                variant="outlined"
                sx={TAG_SX}
              />
            ))}
          </Box>
        )}
      </>
    );
  }
);

ServiceRequestFormProperty.displayName = 'ServiceRequestFormProperty';

export default ServiceRequestFormProperty;
