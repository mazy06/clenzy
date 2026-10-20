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
import {
  Timer,
  CalendarMonth,
  EventAvailable,
  Edit as EditIcon,
  ArrowDownward,
  FiberManualRecord,
  ArrowUpward,
  Bolt,
} from '../../icons';
import { Controller, Control, FieldErrors, UseFormSetValue } from 'react-hook-form';
import { useTranslation } from '../../hooks/useTranslation';
import type { ServiceRequestFormValues } from '../../schemas';
import { activeIntlLocale } from '../../utils/activeLocale';

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
  initialDateMode?: 'checkout' | 'custom';
}

// ─── Priority config (tokens sémantiques — encre `-ink` sur fond `-soft`) ────

interface PriorityDef {
  value: string;
  labelKey: string;
  fg: string;
  bg: string;
  icon: React.ReactElement;
}

const PRIORITIES: PriorityDef[] = [
  { value: 'LOW', labelKey: 'serviceRequests.priorities.low', fg: 'var(--bui-muted-foreground)', bg: 'var(--bui-muted)', icon: <ArrowDownward size={14} strokeWidth={1.75} /> },
  { value: 'NORMAL', labelKey: 'serviceRequests.priorities.normal', fg: 'var(--bui-info-ink)', bg: 'var(--bui-info-soft)', icon: <FiberManualRecord size={10} strokeWidth={1.75} /> },
  { value: 'HIGH', labelKey: 'serviceRequests.priorities.high', fg: 'var(--bui-warning-ink)', bg: 'var(--bui-warning-soft)', icon: <ArrowUpward size={14} strokeWidth={1.75} /> },
  { value: 'CRITICAL', labelKey: 'serviceRequests.priorities.critical', fg: 'var(--bui-destructive-ink)', bg: 'var(--bui-destructive-soft)', icon: <Bolt size={14} strokeWidth={1.75} /> },
];

/** Ton de marque des puces et encarts de ce panneau (encre + fond pastel). */
const BRAND_TOKENS = { color: 'var(--bui-primary)', bg: 'var(--bui-primary-soft)' } as const;

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
  ({ control, errors, setValue, disabled = false, isAdminOrManager = false, reservations = [], estimatedDurationMinutes, initialDateMode = 'checkout' }) => {
    const { t } = useTranslation();

    // Date mode : 'checkout' (sélection depuis réservation) ou 'custom' (saisie libre)
    const [dateMode, setDateMode] = useState<'checkout' | 'custom'>(initialDateMode);

    // Popover pour édition de durée (admin). Le popover du kit s'ancre sur un
    // element enfant (PopoverAnchor) et non sur un anchorEl : l'etat n'a plus
    // besoin de porter le noeud DOM, un booleen suffit.

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
        <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          {t('serviceRequests.sections.priorityPlanning')}
        </p>

        <div className="flex flex-col gap-3">

          {/* ─── Priorité (Chips sélectionnables, encre `-ink` sur fond `-soft`) ─── */}
          <div>
            <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
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
                    <FieldError className="mt-[3px]">
                      {fieldState.error.message}
                    </FieldError>
                  )}
                </div>
              )}
            />
          </div>

          <Controller name="estimatedDurationHours" control={control}
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel htmlFor="service-request-duration-minutes">{t('serviceRequests.fields.estimatedDuration')} *</FieldLabel>
                <div className="baitly-request-editor__duration">
                  <Timer size={20} strokeWidth={1.75} aria-hidden="true" />
                  <InputGroup>
                    <InputGroupInput id="service-request-duration-minutes" type="number" min={1} step={5}
                      className="tabular-nums" value={hoursToMins(field.value) || ''}
                      readOnly={!isAdminOrManager} disabled={disabled} onBlur={field.onBlur}
                      onChange={event => field.onChange(minsToHours(Number(event.target.value)))}
                      aria-invalid={!!fieldState.error} />
                    <InputGroupAddon align="inline-end"><InputGroupText>min</InputGroupText></InputGroupAddon>
                  </InputGroup>
                  <span className="baitly-request-editor__duration-equivalent" aria-live="polite">{formatDurationMins(hoursToMins(field.value))}</span>
                </div>
                {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
              </Field>
            )} />

          {/* ─── Date d'échéance ─── */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('serviceRequests.fields.dueDate')} *
              </p>

              {/* Toggle checkout / custom — chips sélecteurs au ton de marque */}
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
                      tokens={BRAND_TOKENS}
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
                              <button
                                type="button"
                                aria-pressed={field.value === co.isoValue}
                                disabled={disabled}
                                key={co.id}
                                onClick={disabled ? undefined : () => handleSelectCheckout(co.isoValue, field.value)}
                                className={cn(
                                  'flex items-center gap-1.5 py-[4.5px] px-[7.5px] rounded-[11px] border border-solid',
                                  'transition-[background-color,border-color] duration-150',
                                  isSelected
                                    ? 'border-primary bg-primary-soft'
                                    : 'border-field-line bg-field',
                                  disabled ? 'cursor-default opacity-45' : 'cursor-pointer hover:border-primary',
                                )}
                              >
                                <span className={cn('inline-flex', isSelected ? 'text-primary' : 'text-faint')}><CalendarMonth size={16} strokeWidth={1.75} /></span>
                                <div className="flex-1">
                                  <p className={cn('text-[12px] leading-[1.3] tabular-nums', isSelected ? 'font-semibold' : 'font-medium', isSelected ? 'text-primary' : 'text-foreground')}>
                                    {formatCheckoutDateDisplay(co.checkOut, co.checkOutTime)}
                                  </p>
                                  <p className="text-[10.5px] text-faint leading-[1.2]">
                                    Départ {co.guestName}
                                  </p>
                                </div>
                                {isSelected && (
                                  <StatusChip size="sm" tokens={{ color: 'var(--bui-primary)', bg: 'var(--bui-card)' }} label={t('serviceRequests.planning.selected')} className="text-[10px]" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-[9px] px-[9px] rounded-[11px] bg-field border border-dashed border-border text-center">
                          <p className="text-[11.5px] text-faint">
                            {t('serviceRequests.planning.noUpcomingCheckout')}
                          </p>
                          <StatusChip
                            tokens={BRAND_TOKENS}
                            label={t('serviceRequests.planning.manualDate')}
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
                        <FieldDescription>{t('serviceRequests.planning.duringStayHint')}</FieldDescription>
                      )}
                    </Field>
                  )}
                  {fieldState.error && dateMode === 'checkout' && (
                    <FieldError className="mt-[3px]">
                      {fieldState.error.message}
                    </FieldError>
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
  const formatted = date.toLocaleDateString(activeIntlLocale(), { weekday: 'short', day: 'numeric', month: 'short' });
  const time = checkOutTime || '11:00';
  return `${formatted} à ${time} — ${guestName}`;
}

function formatCheckoutDateDisplay(checkOut: string, checkOutTime: string | undefined): string {
  const date = new Date(checkOut);
  const formatted = date.toLocaleDateString(activeIntlLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
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
