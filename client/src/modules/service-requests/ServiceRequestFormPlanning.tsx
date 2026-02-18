import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  FormHelperText,
  Chip,
  alpha,
  Tooltip,
  Popover,
} from '@mui/material';
import {
  Timer,
  CalendarMonth,
  EventAvailable,
  Edit as EditIcon,
  Lock,
  ArrowDownward,
  FiberManualRecord,
  ArrowUpward,
  Bolt,
} from '@mui/icons-material';
import { Controller, Control, FieldErrors, UseFormSetValue } from 'react-hook-form';
import { useTranslation } from '../../hooks/useTranslation';
import type { ServiceRequestFormValues } from '../../schemas';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Reservation {
  id: number;
  propertyId: number;
  guestName: string;
  checkIn: string;
  checkOut: string;
  checkInTime?: string;
  checkOutTime?: string;
  status: string;
}

export interface ServiceRequestFormPlanningProps {
  control: Control<ServiceRequestFormValues>;
  errors: FieldErrors<ServiceRequestFormValues>;
  setValue: UseFormSetValue<ServiceRequestFormValues>;
  disabled?: boolean;
  isAdminOrManager?: boolean;
  /** Réservations de la propriété sélectionnée */
  reservations?: Reservation[];
  /** Durée estimée auto-calculée (en minutes) depuis PriceEstimate */
  estimatedDurationMinutes?: number;
}

// ─── Priority config ────────────────────────────────────────────────────────

interface PriorityDef {
  value: string;
  labelKey: string;
  color: string;
  icon: React.ReactElement;
}

const PRIORITIES: PriorityDef[] = [
  { value: 'LOW', labelKey: 'serviceRequests.priorities.low', color: '#78909c', icon: <ArrowDownward sx={{ fontSize: 14 }} /> },
  { value: 'NORMAL', labelKey: 'serviceRequests.priorities.normal', color: '#42a5f5', icon: <FiberManualRecord sx={{ fontSize: 10 }} /> },
  { value: 'HIGH', labelKey: 'serviceRequests.priorities.high', color: '#ff9800', icon: <ArrowUpward sx={{ fontSize: 14 }} /> },
  { value: 'CRITICAL', labelKey: 'serviceRequests.priorities.critical', color: '#ef5350', icon: <Bolt sx={{ fontSize: 14 }} /> },
];

// ─── Component ──────────────────────────────────────────────────────────────

/** Convertir minutes → fractional hours pour le backend */
function minsToHours(mins: number): number {
  return Math.round((mins / 60) * 1000) / 1000;
}

/** Convertir fractional hours → minutes */
function hoursToMins(hours: number): number {
  return Math.round(hours * 60);
}

/** Formater des minutes en affichage lisible (aligné avec PriceEstimate) */
function formatDurationMins(mins: number): string {
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  if (hours === 0) return `${mins} min`;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h${String(remainder).padStart(2, '0')}`;
}

const ServiceRequestFormPlanning: React.FC<ServiceRequestFormPlanningProps> = React.memo(
  ({ control, errors, setValue, disabled = false, isAdminOrManager = false, reservations = [], estimatedDurationMinutes }) => {
    const { t } = useTranslation();

    // Date mode : 'checkout' (sélection depuis réservation) ou 'custom' (saisie libre)
    const [dateMode, setDateMode] = useState<'checkout' | 'custom'>('checkout');

    // Popover pour édition de durée (admin)
    const [durationAnchor, setDurationAnchor] = useState<HTMLElement | null>(null);
    const durationOpen = Boolean(durationAnchor);
    const [durationInputValue, setDurationInputValue] = useState('');

    // Dates de checkout triées (futures uniquement)
    const checkoutDates = useMemo(() => {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      return reservations
        .filter(r => {
          const co = new Date(r.checkOut);
          co.setHours(0, 0, 0, 0);
          return co >= now && r.status !== 'cancelled';
        })
        .sort((a, b) => new Date(a.checkOut).getTime() - new Date(b.checkOut).getTime())
        .map(r => ({
          id: r.id,
          checkOut: r.checkOut,
          checkOutTime: r.checkOutTime || '11:00',
          guestName: r.guestName,
          label: formatCheckoutLabel(r.checkOut, r.checkOutTime, r.guestName),
          isoValue: toDateTimeLocal(r.checkOut, r.checkOutTime || '11:00'),
        }));
    }, [reservations]);

    // Sélectionner / désélectionner une date de checkout (toggle)
    const handleSelectCheckout = useCallback((isoValue: string, currentValue: string) => {
      if (currentValue === isoValue) {
        // Déjà sélectionnée → désélectionner
        setValue('desiredDate', '', { shouldValidate: true });
      } else {
        setValue('desiredDate', isoValue, { shouldValidate: true });
      }
    }, [setValue]);

    // Switcher en mode custom
    const handleSwitchToCustom = useCallback(() => {
      setDateMode('custom');
    }, []);

    // Switcher en mode checkout
    const handleSwitchToCheckout = useCallback(() => {
      setDateMode('checkout');
    }, []);

    return (
      <>
        {/* Header */}
        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary', mb: 1.5 }}>
          {t('serviceRequests.sections.priorityPlanning')}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

          {/* ─── Priorité (Chips sélectionnables) ─── */}
          <Box>
            <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: 'text.secondary', mb: 0.75 }}>
              {t('serviceRequests.fields.priority')} *
            </Typography>
            <Controller
              name="priority"
              control={control}
              render={({ field, fieldState }) => (
                <Box>
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    {PRIORITIES.map((p) => {
                      const isSelected = field.value === p.value;
                      return (
                        <Chip
                          key={p.value}
                          icon={p.icon}
                          label={t(p.labelKey)}
                          onClick={disabled ? undefined : () => field.onChange(p.value)}
                          disabled={disabled}
                          variant={isSelected ? 'filled' : 'outlined'}
                          size="small"
                          sx={{
                            height: 30,
                            fontSize: '0.75rem',
                            fontWeight: isSelected ? 600 : 500,
                            borderWidth: 1.5,
                            borderColor: isSelected ? p.color : 'grey.200',
                            bgcolor: isSelected ? alpha(p.color, 0.12) : 'transparent',
                            color: isSelected ? p.color : 'text.secondary',
                            '& .MuiChip-icon': {
                              fontSize: 14,
                              ml: 0.5,
                              color: isSelected ? p.color : 'primary.main',
                            },
                            '& .MuiChip-label': { px: 0.75 },
                            '&:hover': disabled ? {} : {
                              bgcolor: alpha(p.color, 0.08),
                              borderColor: p.color,
                            },
                            cursor: disabled ? 'default' : 'pointer',
                            opacity: disabled ? 0.5 : 1,
                            transition: 'all 0.15s ease',
                          }}
                        />
                      );
                    })}
                  </Box>
                  {fieldState.error && (
                    <FormHelperText error sx={{ mt: 0.5 }}>
                      {fieldState.error.message}
                    </FormHelperText>
                  )}
                </Box>
              )}
            />
          </Box>

          {/* ─── Durée estimée (chip + popover pour admin) ─── */}
          <Box>
            <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: 'text.secondary', mb: 0.75 }}>
              {t('serviceRequests.fields.estimatedDuration')} *
            </Typography>
            <Controller
              name="estimatedDurationHours"
              control={control}
              render={({ field, fieldState }) => {
                const currentMins = hoursToMins(field.value);
                const displayLabel = formatDurationMins(currentMins);
                const canEdit = isAdminOrManager && !disabled;

                return (
                  <Box>
                    {/* Chip durée */}
                    <Box
                      onClick={canEdit ? (e: React.MouseEvent<HTMLElement>) => {
                        setDurationInputValue(String(currentMins));
                        setDurationAnchor(e.currentTarget);
                      } : undefined}
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.75,
                        py: 0.75,
                        px: 1.5,
                        borderRadius: 1.5,
                        border: '1.5px solid',
                        borderColor: durationOpen ? 'primary.main' : 'primary.200',
                        bgcolor: 'primary.50',
                        cursor: canEdit ? 'pointer' : 'default',
                        transition: 'all 0.15s ease',
                        '&:hover': canEdit ? {
                          borderColor: 'primary.main',
                          bgcolor: alpha('#6B8A9A', 0.08),
                        } : {},
                      }}
                    >
                      <Timer sx={{ fontSize: 18, color: 'primary.main' }} />
                      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                        <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'primary.main', lineHeight: 1.2 }}>
                          {displayLabel}
                        </Typography>
                        <Typography sx={{ fontSize: '0.625rem', fontWeight: 500, color: 'text.secondary' }}>
                          durée estimée
                        </Typography>
                      </Box>
                      {canEdit ? (
                        <EditIcon sx={{ fontSize: 13, color: 'primary.300', ml: 'auto' }} />
                      ) : (
                        <Tooltip title="Calculée automatiquement, modifiable par un manager" arrow>
                          <Lock sx={{ fontSize: 13, color: 'text.disabled', ml: 'auto' }} />
                        </Tooltip>
                      )}
                    </Box>

                    {/* Popover champ édition durée (admin/manager uniquement) */}
                    <Popover
                      open={durationOpen}
                      anchorEl={durationAnchor}
                      onClose={() => {
                        // Valider la saisie à la fermeture
                        const parsed = parseInt(durationInputValue, 10);
                        if (!isNaN(parsed) && parsed > 0) {
                          field.onChange(minsToHours(parsed));
                        }
                        setDurationAnchor(null);
                      }}
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                      slotProps={{
                        paper: {
                          sx: {
                            mt: 0.5,
                            borderRadius: 1.5,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                            border: '1px solid',
                            borderColor: 'divider',
                            p: 2,
                            minWidth: 220,
                          },
                        },
                      }}
                    >
                      <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.disabled', mb: 1 }}>
                        Modifier la durée
                      </Typography>
                      <TextField
                        value={durationInputValue}
                        onChange={(e) => setDurationInputValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const parsed = parseInt(durationInputValue, 10);
                            if (!isNaN(parsed) && parsed > 0) {
                              field.onChange(minsToHours(parsed));
                            }
                            setDurationAnchor(null);
                          }
                        }}
                        fullWidth
                        size="small"
                        type="number"
                        label="Durée (en minutes)"
                        placeholder="Ex : 240"
                        autoFocus
                        inputProps={{ min: 1, step: 5 }}
                        InputProps={{
                          endAdornment: (
                            <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', whiteSpace: 'nowrap', ml: 0.5 }}>
                              min
                            </Typography>
                          ),
                        }}
                        helperText={
                          durationInputValue && !isNaN(parseInt(durationInputValue, 10)) && parseInt(durationInputValue, 10) > 0
                            ? `= ${formatDurationMins(parseInt(durationInputValue, 10))}`
                            : 'Saisissez la durée en minutes'
                        }
                        sx={{
                          '& .MuiInputBase-root': { fontSize: '0.875rem' },
                          '& .MuiFormHelperText-root': { fontSize: '0.625rem', mt: 0.5, color: 'primary.main', fontWeight: 500 },
                        }}
                      />
                    </Popover>

                    {fieldState.error && (
                      <FormHelperText error sx={{ mt: 0.5 }}>
                        {fieldState.error.message}
                      </FormHelperText>
                    )}
                    {!isAdminOrManager && (
                      <Typography sx={{ fontSize: '0.5625rem', color: 'text.disabled', fontStyle: 'italic', mt: 0.5 }}>
                        Calculée automatiquement depuis les caractéristiques du logement
                      </Typography>
                    )}
                  </Box>
                );
              }}
            />
          </Box>

          {/* ─── Date d'échéance ─── */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
              <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: 'text.secondary' }}>
                {t('serviceRequests.fields.dueDate')} *
              </Typography>

              {/* Toggle checkout / custom */}
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Chip
                  icon={<EventAvailable sx={{ fontSize: 14 }} />}
                  label="Checkout"
                  size="small"
                  onClick={handleSwitchToCheckout}
                  variant={dateMode === 'checkout' ? 'filled' : 'outlined'}
                  color={dateMode === 'checkout' ? 'primary' : 'default'}
                  sx={{ height: 30, fontSize: '0.75rem', '& .MuiChip-icon': { fontSize: 14, ml: 0.5 }, '& .MuiChip-label': { px: 0.75 } }}
                />
                <Chip
                  icon={<EditIcon sx={{ fontSize: 14 }} />}
                  label="Autre date"
                  size="small"
                  onClick={handleSwitchToCustom}
                  variant={dateMode === 'custom' ? 'filled' : 'outlined'}
                  color={dateMode === 'custom' ? 'primary' : 'default'}
                  sx={{ height: 30, fontSize: '0.75rem', '& .MuiChip-icon': { fontSize: 14, ml: 0.5 }, '& .MuiChip-label': { px: 0.75 } }}
                />
              </Box>
            </Box>

            <Controller
              name="desiredDate"
              control={control}
              render={({ field, fieldState }) => (
                <Box>
                  {dateMode === 'checkout' ? (
                    <>
                      {/* Checkout date chips */}
                      {checkoutDates.length > 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {checkoutDates.map((co) => {
                            const isSelected = field.value === co.isoValue;
                            return (
                              <Box
                                key={co.id}
                                onClick={disabled ? undefined : () => handleSelectCheckout(co.isoValue, field.value)}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                  py: 0.75,
                                  px: 1.25,
                                  borderRadius: 1.5,
                                  border: '1.5px solid',
                                  borderColor: isSelected ? 'primary.main' : 'grey.200',
                                  bgcolor: isSelected ? 'primary.50' : 'grey.50',
                                  cursor: disabled ? 'default' : 'pointer',
                                  opacity: disabled ? 0.5 : 1,
                                  transition: 'all 0.15s ease',
                                  '&:hover': disabled ? {} : {
                                    borderColor: 'primary.main',
                                    bgcolor: alpha('#1976d2', 0.04),
                                  },
                                }}
                              >
                                <CalendarMonth sx={{ fontSize: 16, color: isSelected ? 'primary.main' : 'text.disabled' }} />
                                <Box sx={{ flex: 1 }}>
                                  <Typography sx={{ fontSize: '0.75rem', fontWeight: isSelected ? 600 : 500, color: isSelected ? 'primary.main' : 'text.primary', lineHeight: 1.3 }}>
                                    {formatCheckoutDateDisplay(co.checkOut, co.checkOutTime)}
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.625rem', color: 'text.disabled', lineHeight: 1.2 }}>
                                    Départ {co.guestName}
                                  </Typography>
                                </Box>
                                {isSelected && (
                                  <Chip label="Sélectionné" size="small" color="primary" variant="filled"
                                    sx={{ height: 18, fontSize: '0.5625rem', fontWeight: 600, '& .MuiChip-label': { px: 0.75 } }}
                                  />
                                )}
                              </Box>
                            );
                          })}
                        </Box>
                      ) : (
                        <Box sx={{
                          py: 1.5,
                          px: 1.5,
                          borderRadius: 1.5,
                          bgcolor: 'grey.50',
                          border: '1px dashed',
                          borderColor: 'grey.300',
                          textAlign: 'center',
                        }}>
                          <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
                            Aucun checkout à venir pour cette propriété
                          </Typography>
                          <Chip
                            label="Saisir une date manuellement"
                            size="small"
                            onClick={handleSwitchToCustom}
                            sx={{ mt: 0.75, height: 22, fontSize: '0.625rem', cursor: 'pointer' }}
                          />
                        </Box>
                      )}
                    </>
                  ) : (
                    /* Custom date input */
                    <TextField
                      {...field}
                      fullWidth
                      type="datetime-local"
                      required
                      disabled={disabled}
                      size="small"
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message || 'Idéal pour les demandes de maintenance pendant un séjour'}
                      InputLabelProps={{ shrink: true }}
                    />
                  )}
                  {fieldState.error && dateMode === 'checkout' && (
                    <FormHelperText error sx={{ mt: 0.5 }}>
                      {fieldState.error.message}
                    </FormHelperText>
                  )}
                </Box>
              )}
            />
          </Box>
        </Box>
      </>
    );
  }
);

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCheckoutLabel(checkOut: string, checkOutTime: string | undefined, guestName: string): string {
  const date = new Date(checkOut);
  const formatted = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = checkOutTime || '11:00';
  return `${formatted} à ${time} — ${guestName}`;
}

function formatCheckoutDateDisplay(checkOut: string, checkOutTime: string | undefined): string {
  const date = new Date(checkOut);
  const formatted = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const time = checkOutTime || '11:00';
  return `${formatted} à ${time}`;
}

function toDateTimeLocal(dateStr: string, time: string): string {
  // Convert "2025-06-15" + "11:00" to "2025-06-15T11:00" for datetime-local input
  const date = new Date(dateStr);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}T${time}`;
}

ServiceRequestFormPlanning.displayName = 'ServiceRequestFormPlanning';

export default ServiceRequestFormPlanning;
