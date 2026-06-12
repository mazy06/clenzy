import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  FormHelperText,
  Chip,
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
} from '../../icons';
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

// ─── Priority config (tokens sémantiques — texte couleur + fond -soft) ──────

interface PriorityDef {
  value: string;
  labelKey: string;
  fg: string;
  bg: string;
  icon: React.ReactElement;
}

const PRIORITIES: PriorityDef[] = [
  { value: 'LOW', labelKey: 'serviceRequests.priorities.low', fg: 'var(--muted)', bg: 'var(--hover)', icon: <ArrowDownward size={14} strokeWidth={1.75} /> },
  { value: 'NORMAL', labelKey: 'serviceRequests.priorities.normal', fg: 'var(--info)', bg: 'var(--info-soft)', icon: <FiberManualRecord size={10} strokeWidth={1.75} /> },
  { value: 'HIGH', labelKey: 'serviceRequests.priorities.high', fg: 'var(--warn)', bg: 'var(--warn-soft)', icon: <ArrowUpward size={14} strokeWidth={1.75} /> },
  { value: 'CRITICAL', labelKey: 'serviceRequests.priorities.critical', fg: 'var(--err)', bg: 'var(--err-soft)', icon: <Bolt size={14} strokeWidth={1.75} /> },
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
        <Typography sx={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--faint)', mb: 1.5 }}>
          {t('serviceRequests.sections.priorityPlanning')}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

          {/* ─── Priorité (Chips sélectionnables, sémantique -soft) ─── */}
          <Box>
            <Typography sx={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--faint)', mb: 0.75 }}>
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
                          size="small"
                          aria-pressed={isSelected}
                          sx={{
                            height: 30,
                            fontSize: '11.5px',
                            fontWeight: isSelected ? 600 : 500,
                            border: '1px solid',
                            borderColor: isSelected ? p.fg : 'var(--line-2)',
                            bgcolor: isSelected ? p.bg : 'var(--card)',
                            color: isSelected ? p.fg : 'var(--body)',
                            '& .MuiChip-icon': {
                              fontSize: 14,
                              ml: 0.5,
                              color: isSelected ? p.fg : 'var(--muted)',
                            },
                            '& .MuiChip-label': { px: 0.75 },
                            '&:hover': disabled ? {} : {
                              bgcolor: isSelected ? p.bg : 'var(--hover)',
                              borderColor: p.fg,
                            },
                            cursor: disabled ? 'default' : 'pointer',
                            opacity: disabled ? 0.45 : 1,
                            transition: 'background-color .15s, border-color .15s, color .15s',
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
            <Typography sx={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--faint)', mb: 0.75 }}>
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
                        borderRadius: '11px',
                        border: '1px solid',
                        borderColor: durationOpen ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 30%, transparent)',
                        bgcolor: 'var(--accent-soft)',
                        cursor: canEdit ? 'pointer' : 'default',
                        transition: 'border-color .15s, background-color .15s',
                        '&:hover': canEdit ? {
                          borderColor: 'var(--accent)',
                        } : {},
                      }}
                    >
                      <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}><Timer size={18} strokeWidth={1.75} /></Box>
                      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                        <Typography sx={{ fontSize: '16px', fontWeight: 600, color: 'var(--accent)', lineHeight: 1.2, fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>
                          {displayLabel}
                        </Typography>
                        <Typography sx={{ fontSize: '10.5px', fontWeight: 500, color: 'var(--muted)' }}>
                          durée estimée
                        </Typography>
                      </Box>
                      {canEdit ? (
                        <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)', ml: 'auto' }}><EditIcon size={13} strokeWidth={1.75} /></Box>
                      ) : (
                        <Tooltip title="Calculée automatiquement, modifiable par un manager" arrow>
                          <Box component="span" sx={{ display: 'inline-flex', color: 'var(--faint)', ml: 'auto' }}><Lock size={13} strokeWidth={1.75} /></Box>
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
                        // Skin popover global (hairline r12 + --shadow-pop) — seulement la géométrie locale.
                        paper: {
                          sx: { mt: 0.5, p: 2, minWidth: 220 },
                        },
                      }}
                    >
                      <Typography sx={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--faint)', mb: 1 }}>
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
                            <Typography sx={{ fontSize: '12px', color: 'var(--faint)', whiteSpace: 'nowrap', ml: 0.5 }}>
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
                          '& .MuiFormHelperText-root': { fontSize: '10.5px', mt: 0.5, color: 'var(--accent)', fontWeight: 500 },
                        }}
                      />
                    </Popover>

                    {fieldState.error && (
                      <FormHelperText error sx={{ mt: 0.5 }}>
                        {fieldState.error.message}
                      </FormHelperText>
                    )}
                    {!isAdminOrManager && (
                      <Typography sx={{ fontSize: '10px', color: 'var(--faint)', fontStyle: 'italic', mt: 0.5 }}>
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
              <Typography sx={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--faint)' }}>
                {t('serviceRequests.fields.dueDate')} *
              </Typography>

              {/* Toggle checkout / custom — chips sélecteurs accent-soft */}
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {([
                  { key: 'checkout' as const, label: 'Checkout', icon: <EventAvailable size={14} strokeWidth={1.75} />, onClick: handleSwitchToCheckout },
                  { key: 'custom' as const, label: 'Autre date', icon: <EditIcon size={14} strokeWidth={1.75} />, onClick: handleSwitchToCustom },
                ]).map((mode) => {
                  const isActive = dateMode === mode.key;
                  return (
                    <Chip
                      key={mode.key}
                      icon={mode.icon}
                      label={mode.label}
                      size="small"
                      onClick={mode.onClick}
                      aria-pressed={isActive}
                      sx={{
                        height: 30,
                        fontSize: '11.5px',
                        fontWeight: isActive ? 600 : 500,
                        border: '1px solid',
                        borderColor: isActive ? 'var(--accent)' : 'var(--line-2)',
                        bgcolor: isActive ? 'var(--accent-soft)' : 'var(--card)',
                        color: isActive ? 'var(--accent)' : 'var(--body)',
                        cursor: 'pointer',
                        transition: 'background-color .15s, border-color .15s, color .15s',
                        '&:hover': { bgcolor: isActive ? 'var(--accent-soft)' : 'var(--hover)', borderColor: 'var(--accent)' },
                        '& .MuiChip-icon': { fontSize: 14, ml: 0.5, color: isActive ? 'var(--accent)' : 'var(--muted)' },
                        '& .MuiChip-label': { px: 0.75 },
                      }}
                    />
                  );
                })}
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
                                  borderRadius: '11px',
                                  border: '1px solid',
                                  borderColor: isSelected ? 'var(--accent)' : 'var(--field-line)',
                                  bgcolor: isSelected ? 'var(--accent-soft)' : 'var(--field)',
                                  cursor: disabled ? 'default' : 'pointer',
                                  opacity: disabled ? 0.45 : 1,
                                  transition: 'background-color .15s, border-color .15s',
                                  '&:hover': disabled ? {} : {
                                    borderColor: 'var(--accent)',
                                  },
                                }}
                              >
                                <Box component="span" sx={{ display: 'inline-flex', color: isSelected ? 'var(--accent)' : 'var(--faint)' }}><CalendarMonth size={16} strokeWidth={1.75} /></Box>
                                <Box sx={{ flex: 1 }}>
                                  <Typography sx={{ fontSize: '12px', fontWeight: isSelected ? 600 : 500, color: isSelected ? 'var(--accent)' : 'var(--ink)', lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' }}>
                                    {formatCheckoutDateDisplay(co.checkOut, co.checkOutTime)}
                                  </Typography>
                                  <Typography sx={{ fontSize: '10.5px', color: 'var(--faint)', lineHeight: 1.2 }}>
                                    Départ {co.guestName}
                                  </Typography>
                                </Box>
                                {isSelected && (
                                  <Chip label="Sélectionné" size="small"
                                    sx={{ height: 18, fontSize: '10px', fontWeight: 700, color: 'var(--accent)', bgcolor: 'var(--card)', border: '1px solid var(--accent)', '& .MuiChip-label': { px: 0.75 } }}
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
                          borderRadius: '11px',
                          bgcolor: 'var(--field)',
                          border: '1px dashed var(--line-2)',
                          textAlign: 'center',
                        }}>
                          <Typography sx={{ fontSize: '11.5px', color: 'var(--faint)' }}>
                            Aucun checkout à venir pour cette propriété
                          </Typography>
                          <Chip
                            label="Saisir une date manuellement"
                            size="small"
                            onClick={handleSwitchToCustom}
                            sx={{ mt: 0.75, height: 22, fontSize: '10.5px', cursor: 'pointer', color: 'var(--accent)', bgcolor: 'var(--accent-soft)', border: 'none', '&:hover': { bgcolor: 'var(--accent-soft)' } }}
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
