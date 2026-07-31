import React from 'react';
import StatusChip from '../../components/StatusChip';
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
} from '../../icons';
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

/** Info utilisateur connecté pour affichage demandeur en lecture seule */
interface CurrentUserInfo {
  name: string;
  role: string;
  roleLabel: string;
}

export interface ServiceRequestFormPropertyProps {
  control: Control<ServiceRequestFormValues>;
  errors: FieldErrors<ServiceRequestFormValues>;
  properties: Property[];
  users: User[];
  isAdminOrManager: boolean;
  selectedProperty?: Property | null;
  disabled?: boolean;
  /** Info de l'utilisateur connecté — si fourni, le demandeur est affiché en lecture seule */
  currentUser?: CurrentUserInfo | null;
}

// ─── Stable sx ──────────────────────────────────────────────────────────────

const TAGS_CONTAINER_SX = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 0.75,
  mt: 1.5,
  mb: 0.5,
} as const;

// Chip neutre « champ » (.fr-chip) : fond --field, icône accent (géométrie pilule du thème).
const TAG_SX = {
  height: 30,
  fontSize: '11.5px',
  fontWeight: 500,
  color: 'var(--body)',
  bgcolor: 'var(--field)',
  border: '1px solid var(--field-line)',
  '& .MuiChip-icon': { fontSize: 14, ml: 0.5, color: 'var(--accent)' },
  '& .MuiChip-label': { px: 0.75 },
} as const;

const ServiceRequestFormProperty: React.FC<ServiceRequestFormPropertyProps> = React.memo(
  ({ control, errors, properties, users, isAdminOrManager, selectedProperty, disabled = false, currentUser }) => {
    const { t } = useTranslation();

    // Construire les tags caractéristiques du logement sélectionné
    const propertyTags = React.useMemo(() => {
      if (!selectedProperty) return [];
      const tags: { icon: React.ReactElement; label: string }[] = [];

      // Type de logement
      if (selectedProperty.type) {
        tags.push({
          icon: <Category size={14} strokeWidth={1.75} />,
          label: getPropertyTypeLabel(selectedProperty.type, t),
        });
      }

      // Surface
      if (selectedProperty.squareMeters && selectedProperty.squareMeters > 0) {
        tags.push({
          icon: <SquareFoot size={14} strokeWidth={1.75} />,
          label: `${selectedProperty.squareMeters} m²`,
        });
      }

      // Chambres
      if (selectedProperty.bedroomCount && selectedProperty.bedroomCount > 0) {
        tags.push({
          icon: <Bed size={14} strokeWidth={1.75} />,
          label: `${selectedProperty.bedroomCount} ${selectedProperty.bedroomCount > 1 ? 'chambres' : 'chambre'}`,
        });
      }

      // Salles de bain
      if (selectedProperty.bathroomCount && selectedProperty.bathroomCount > 0) {
        tags.push({
          icon: <Bathtub size={14} strokeWidth={1.75} />,
          label: `${selectedProperty.bathroomCount} SDB`,
        });
      }

      // Capacité
      if (selectedProperty.maxGuests && selectedProperty.maxGuests > 0) {
        tags.push({
          icon: <People size={14} strokeWidth={1.75} />,
          label: `${selectedProperty.maxGuests} voyageurs`,
        });
      }

      // Étages
      if (selectedProperty.numberOfFloors && selectedProperty.numberOfFloors > 1) {
        tags.push({
          icon: <Layers size={14} strokeWidth={1.75} />,
          label: `${selectedProperty.numberOfFloors} étages`,
        });
      }

      // Extérieur
      if (selectedProperty.hasExterior) {
        tags.push({
          icon: <Deck size={14} strokeWidth={1.75} />,
          label: 'Extérieur',
        });
      }

      // Linge
      if (selectedProperty.hasLaundry) {
        tags.push({
          icon: <LocalLaundryService size={14} strokeWidth={1.75} />,
          label: 'Linge',
        });
      }

      // Fenêtres
      if (selectedProperty.windowCount && selectedProperty.windowCount > 0) {
        tags.push({
          icon: <Window size={14} strokeWidth={1.75} />,
          label: `${selectedProperty.windowCount} fenêtres`,
        });
      }

      // Porte-fenêtres
      if (selectedProperty.frenchDoorCount && selectedProperty.frenchDoorCount > 0) {
        tags.push({
          icon: <DoorSliding size={14} strokeWidth={1.75} />,
          label: `${selectedProperty.frenchDoorCount} portes-fenêtres`,
        });
      }

      // Baies vitrées
      if (selectedProperty.slidingDoorCount && selectedProperty.slidingDoorCount > 0) {
        tags.push({
          icon: <DoorSliding size={14} strokeWidth={1.75} />,
          label: `${selectedProperty.slidingDoorCount} baies vitrées`,
        });
      }

      // Repassage
      if (selectedProperty.hasIroning) {
        tags.push({
          icon: <Iron size={14} strokeWidth={1.75} />,
          label: 'Repassage',
        });
      }

      // Cuisine approfondie
      if (selectedProperty.hasDeepKitchen) {
        tags.push({
          icon: <Kitchen size={14} strokeWidth={1.75} />,
          label: 'Cuisine approfondie',
        });
      }

      // Désinfection
      if (selectedProperty.hasDisinfection) {
        tags.push({
          icon: <AutoAwesome size={14} strokeWidth={1.75} />,
          label: 'Désinfection',
        });
      }

      return tags;
    }, [selectedProperty, t]);

    return (
      <>
        {/* Titre de la demande */}
        <div className="mb-3">
          <Controller
            name="title"
            control={control}
            render={({ field, fieldState }) => (
              <FormControl fullWidth error={!!fieldState.error}>
                <InputLabel shrink>
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
                />
                {fieldState.error && (
                  <FormHelperText>{fieldState.error.message}</FormHelperText>
                )}
              </FormControl>
            )}
          />
        </div>

        {/* Propriete */}
        <p className="cn-text-body1 text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)] mb-2">
          {t('serviceRequests.sections.property')}
        </p>

        {/* Propriété et Demandeur sur la même ligne */}
        <div className="flex gap-3 mb-2">
          {/* Propriété */}
          <Box sx={{ flex: 7 }}>
            <Controller
              name="propertyId"
              control={control}
              render={({ field, fieldState }) => {
                const selectedProp = properties.find(p => p.id === field.value);
                return (
                  <FormControl fullWidth error={!!fieldState.error}>
                    <InputLabel shrink>
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
                      renderValue={() => (
                        <div className="flex items-center gap-1">
                          <Box component="span" sx={{ display: 'inline-flex', color: selectedProp ? 'var(--accent)' : 'var(--faint)' }}><Home size={16} strokeWidth={1.75} /></Box>
                          <Typography sx={{ fontSize: '12.5px', color: selectedProp ? 'var(--body)' : 'var(--faint)' }}>
                            {selectedProp
                              ? `${selectedProp.name} - ${selectedProp.address}, ${selectedProp.city}`
                              : t('serviceRequests.fields.selectProperty')}
                          </Typography>
                        </div>
                      )}
                    >
                      {properties.map((property) => (
                        <MenuItem key={property.id} value={property.id}>
                          <div className="flex items-center gap-1">
                            <span className="inline-flex text-[var(--accent)]"><Home size={16} strokeWidth={1.75} /></span>
                            <p className="cn-text-body1 text-[12.5px] text-[var(--body)]">
                              {property.name} - {property.address}, {property.city}
                            </p>
                          </div>
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

          {/* Demandeur — lecture seule, trace l'utilisateur connecté */}
          <Box sx={{ flex: 5 }}>
            {currentUser ? (
              <div>
                <p className="cn-text-body1 text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)] mb-0.5 ms-0.5">
                  {t('serviceRequests.fields.requestor')}
                </p>
                <div className="flex items-center gap-1 px-2 py-1 rounded-[11px] bg-[var(--field)] border border-[var(--field-line)] min-h-[40px]">
                  <span className="inline-flex text-[var(--accent)]"><Person size={16} strokeWidth={1.75} /></span>
                  <p className="cn-text-body1 text-[12.5px] font-medium text-[var(--ink)] flex-1">
                    {currentUser.name}
                  </p>
                  {currentUser.roleLabel && (
                    <StatusChip tokens={{ color: currentUser.role === 'ADMIN' ? 'var(--err)' : currentUser.role === 'MANAGER' ? 'var(--warn)' : 'var(--accent)', bg: currentUser.role === 'ADMIN' ? 'var(--err-soft)' : currentUser.role === 'MANAGER' ? 'var(--warn-soft)' : 'var(--accent-soft)' }} label={currentUser.roleLabel} className="h-[20px] text-[10px]" />
                  )}
                </div>
              </div>
            ) : (
              /* Fallback: ancien Select si currentUser pas fourni (compatibilité) */
              <Controller
                name="userId"
                control={control}
                render={({ field, fieldState }) => {
                  const selectedUser = users.find(u => u.id === field.value);
                  const hasValue = !!selectedUser;
                  return (
                    <FormControl fullWidth error={!!fieldState.error}>
                      <InputLabel shrink>
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
                        renderValue={() => (
                          <div className="flex items-center gap-1">
                            <Box component="span" sx={{ display: 'inline-flex', color: hasValue ? 'var(--accent)' : 'var(--faint)' }}><Person size={16} strokeWidth={1.75} /></Box>
                            <Typography sx={{ fontSize: '12.5px', color: hasValue ? 'var(--body)' : 'var(--faint)' }}>
                              {hasValue
                                ? `${selectedUser.firstName} ${selectedUser.lastName}`
                                : t('serviceRequests.fields.selectRequestor')}
                            </Typography>
                          </div>
                        )}
                      >
                        {users.map((u) => (
                          <MenuItem key={u.id} value={u.id}>
                            <div className="flex items-center gap-1">
                              <span className="inline-flex text-[var(--accent)]"><Person size={16} strokeWidth={1.75} /></span>
                              <p className="cn-text-body1 text-[12.5px] text-[var(--body)]">
                                {u.firstName} {u.lastName}
                              </p>
                            </div>
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
            )}
          </Box>
        </div>

        {/* Chips caractéristiques du logement */}
        {propertyTags.length > 0 && (
          <Box sx={TAGS_CONTAINER_SX}>
            {propertyTags.map((tag) => (
              <Chip
                key={tag.label}
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
