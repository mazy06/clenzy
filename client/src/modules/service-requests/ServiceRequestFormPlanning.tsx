import React, { useState, useMemo, useCallback } from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '../../components/ui';
import { FormHelperText, Chip, Tooltip, Popover } from '@mui/material';
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
        <p className="cn-text-body1 text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)] mb-2">
          {t('serviceRequests.sections.priorityPlanning')}
        </p>

        <div className="flex flex-col gap-3">

          {/* ─── Priorité (Chips sélectionnables, sémantique -soft) ─── */}
          <div>
            <p className="cn-text-body1 text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)] mb-1">
              {t('serviceRequests.fields.priority')} *
            </p>
            <Controller
              name="priority"
              control={control}
              render={({ field, fieldState }) => (
                <div>
                  <div className="flex gap-1 flex-wrap">
                    {PRIORITIES.map((p) => {
                      const isSelected = field.value === p.value;
                      return (
                        <StatusChip
                          key={p.value}
                          outlined
                          selected={isSelected}
                          pressed={isSelected}
                          tokens={{ color: p.fg, bg: p.bg }}
                          icon={p.icon}
                          label={t(p.labelKey)}
                          onClick={disabled ? undefined : () => field.onChange(p.value)}
                          disabled={disabled}
                          className={cn('h-[30px] text-[11.5px]', disabled && 'opacity-45')}
                        />
                      );
                    })}
                  </div>
                  {fieldState.error && (
                    <FormHelperText error sx={{ mt: 0.5 }}>
                      {fieldState.error.message}
                    </FormHelperText>
                  )}
                </div>
              )}
            />
          </div>

          {/* ─── Durée estimée (chip + popover pour admin) ─── */}
          <div>
            <p className="cn-text-body1 text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)] mb-1">
              {t('serviceRequests.fields.estimatedDuration')} *
            </p>
            <Controller
              name="estimatedDurationHours"
              control={control}
              render={({ field, fieldState }) => {
                const currentMins = hoursToMins(field.value);
                const displayLabel = formatDurationMins(currentMins);
                const canEdit = isAdminOrManager && !disabled;

                return (
                  <div>
                    {/* Chip durée */}
                    {/* Ancre du Popover : `e.currentTarget` (element DOM), le <div> convient. */}
                    <div
                      onClick={canEdit ? (e: React.MouseEvent<HTMLElement>) => {
                        setDurationInputValue(String(currentMins));
                        setDurationAnchor(e.currentTarget);
                      } : undefined}
                      className={cn(
                        'inline-flex items-center gap-[4.5px] py-[4.5px] px-[9px] rounded-[11px]',
                        'border border-solid bg-[var(--accent-soft)] transition-[border-color,background-color] duration-150',
                        durationOpen
                          ? 'border-[var(--accent)]'
                          : 'border-[color-mix(in_srgb,var(--accent)_30%,transparent)]',
                        canEdit ? 'cursor-pointer hover:border-[var(--accent)]' : 'cursor-default',
                      )}
                    >
                      <span className="inline-flex text-[var(--accent)]"><Timer size={18} strokeWidth={1.75} /></span>
                      <div className="flex items-baseline gap-0.5">
                        <p className="cn-text-body1 text-[16px] font-semibold text-[var(--accent)] leading-[1.2] font-[family-name:var(--font-display)] tabular-nums">
                          {displayLabel}
                        </p>
                        <p className="cn-text-body1 text-[10.5px] font-medium text-[var(--muted)]">
                          durée estimée
                        </p>
                      </div>
                      {canEdit ? (
                        <span className="inline-flex text-[var(--accent)] ms-auto"><EditIcon size={13} strokeWidth={1.75} /></span>
                      ) : (
                        <Tooltip title="Calculée automatiquement, modifiable par un manager" arrow>
                          <span className="inline-flex text-[var(--faint)] ms-auto"><Lock size={13} strokeWidth={1.75} /></span>
                        </Tooltip>
                      )}
                    </div>

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
                      <p className="cn-text-body1 text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)] mb-1.5">
                        Modifier la durée
                      </p>
                      <Field>
                        <FieldLabel htmlFor="service-request-duration-minutes">Durée (en minutes)</FieldLabel>
                        <InputGroup>
                          <InputGroupInput
                            id="service-request-duration-minutes"
                            type="number"
                            className="tabular-nums"
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
                            placeholder="Ex : 240"
                            autoFocus
                            min={1}
                            step={5}
                          />
                          <InputGroupAddon align="inline-end">
                            <InputGroupText className="text-[12px] text-[var(--faint)] whitespace-nowrap">
                              min
                            </InputGroupText>
                          </InputGroupAddon>
                        </InputGroup>
                        <FieldDescription className="text-[10.5px] font-medium text-[var(--accent)]">
                          {durationInputValue && !isNaN(parseInt(durationInputValue, 10)) && parseInt(durationInputValue, 10) > 0
                            ? `= ${formatDurationMins(parseInt(durationInputValue, 10))}`
                            : 'Saisissez la durée en minutes'}
                        </FieldDescription>
                      </Field>
                    </Popover>

                    {fieldState.error && (
                      <FormHelperText error sx={{ mt: 0.5 }}>
                        {fieldState.error.message}
                      </FormHelperText>
                    )}
                    {!isAdminOrManager && (
                      <p className="cn-text-body1 text-[10px] text-[var(--faint)] italic mt-0.5">
                        Calculée automatiquement depuis les caractéristiques du logement
                      </p>
                    )}
                  </div>
                );
              }}
            />
          </div>

          {/* ─── Date d'échéance ─── */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="cn-text-body1 text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)]">
                {t('serviceRequests.fields.dueDate')} *
              </p>

              {/* Toggle checkout / custom — chips sélecteurs accent-soft */}
              <div className="flex gap-0.5">
                {([
                  { key: 'checkout' as const, label: 'Checkout', icon: <EventAvailable size={14} strokeWidth={1.75} />, onClick: handleSwitchToCheckout },
                  { key: 'custom' as const, label: 'Autre date', icon: <EditIcon size={14} strokeWidth={1.75} />, onClick: handleSwitchToCustom },
                ]).map((mode) => {
                  const isActive = dateMode === mode.key;
                  return (
                    <StatusChip
                      key={mode.key}
                      outlined
                      selected={isActive}
                      pressed={isActive}
                      tokens={{ color: 'var(--accent)', bg: 'var(--accent-soft)' }}
                      icon={mode.icon}
                      label={mode.label}
                      onClick={mode.onClick}
                      className="h-[30px] text-[11.5px]"
                    />
                  );
                })}
              </div>
            </div>

            <Controller
              name="desiredDate"
              control={control}
              // Le ref de react-hook-form est ecarte : les primitives du kit sont des
              // composants fonction sans forwardRef (React 18 refuserait le ref).
              render={({ field: { ref: _ref, ...field }, fieldState }) => (
                <div>
                  {dateMode === 'checkout' ? (
                    <>
                      {/* Checkout date chips */}
                      {checkoutDates.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {checkoutDates.map((co) => {
                            const isSelected = field.value === co.isoValue;
                            return (
                              <div
                                key={co.id}
                                onClick={disabled ? undefined : () => handleSelectCheckout(co.isoValue, field.value)}
                                className={cn(
                                  'flex items-center gap-1.5 py-[4.5px] px-[7.5px] rounded-[11px] border border-solid',
                                  'transition-[background-color,border-color] duration-150',
                                  isSelected
                                    ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                                    : 'border-[var(--field-line)] bg-[var(--field)]',
                                  disabled ? 'cursor-default opacity-45' : 'cursor-pointer hover:border-[var(--accent)]',
                                )}
                              >
                                <span className={cn('inline-flex', isSelected ? 'text-[var(--accent)]' : 'text-[var(--faint)]')}><CalendarMonth size={16} strokeWidth={1.75} /></span>
                                <div className="flex-1">
                                  <p className={cn('cn-text-body1 text-[12px] leading-[1.3] tabular-nums', isSelected ? 'font-semibold' : 'font-medium', isSelected ? 'text-[var(--accent)]' : 'text-[var(--ink)]')}>
                                    {formatCheckoutDateDisplay(co.checkOut, co.checkOutTime)}
                                  </p>
                                  <p className="cn-text-body1 text-[10.5px] text-[var(--faint)] leading-[1.2]">
                                    Départ {co.guestName}
                                  </p>
                                </div>
                                {isSelected && (
                                  <StatusChip size="sm" tokens={{ color: 'var(--accent)', bg: 'var(--card)' }} label="Sélectionné" className="text-[10px]" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-[9px] px-[9px] rounded-[11px] bg-[var(--field)] border border-dashed border-[var(--line-2)] text-center">
                          <p className="cn-text-body1 text-[11.5px] text-[var(--faint)]">
                            Aucun checkout à venir pour cette propriété
                          </p>
                          <StatusChip
                            tokens={{ color: 'var(--accent)', bg: 'var(--accent-soft)' }}
                            label="Saisir une date manuellement"
                            onClick={handleSwitchToCustom}
                            className="mt-1 text-[10.5px]"
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    /* Custom date input */
                    <Field>
                      <Input
                        {...field}
                        // Le titre de section au-dessus fait office de libelle visible :
                        // aria-label evite de le dupliquer tout en nommant le champ.
                        aria-label={t('serviceRequests.fields.dueDate')}
                        className="w-full"
                        type="datetime-local"
                        required
                        disabled={disabled}
                        aria-invalid={!!fieldState.error}
                      />
                      {fieldState.error ? (
                        <FieldError>{fieldState.error.message}</FieldError>
                      ) : (
                        <FieldDescription>Idéal pour les demandes de maintenance pendant un séjour</FieldDescription>
                      )}
                    </Field>
                  )}
                  {fieldState.error && dateMode === 'checkout' && (
                    <FormHelperText error sx={{ mt: 0.5 }}>
                      {fieldState.error.message}
                    </FormHelperText>
                  )}
                </div>
              )}
            />
          </div>
        </div>
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
