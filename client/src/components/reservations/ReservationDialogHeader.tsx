import React from 'react';
import { cn } from '../../utils/cn';
import { Close, Public as GlobeIcon, Schedule, CheckCircle } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import StatusChip from '../StatusChip';
import PropertyThumb from '../PropertyThumb';
import type { ReservationStatus } from '../../services/api';
import type { UseReservationFormResult } from './useReservationForm';
import type { ReservationDialogEntryMode } from './ReservationDialog';
import { RESERVATION_ART } from './reservationArtwork';

// Contrôle segmenté de la modale (mode, statut) : piste `bg-muted`, segment
// actif en carte, comme les sous-vues des espaces Finances et Documents.
const SEG_WRAP_CLASS = 'inline-flex shrink-0 gap-[2px] rounded-[10px] bg-muted p-[3px]';

const segBtnClass = (on: boolean) =>
  cn(
    'inline-flex items-center justify-center gap-[6px] rounded-[8px] border border-solid px-3 py-1.5',
    '[font-family:inherit] text-xs whitespace-nowrap cursor-pointer',
    'transition-[background-color,color,border-color] duration-[160ms] ease-out',
    'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1',
    on
      ? 'border-border bg-card font-semibold text-foreground'
      : 'border-transparent bg-transparent font-medium text-muted-foreground hover:text-foreground',
  );

interface Props {
  form: UseReservationFormResult;
  onClose: () => void;
  /** Mode d'entrée (création) : réservation OU blocage. */
  entryMode: ReservationDialogEntryMode;
  onEntryModeChange: (m: ReservationDialogEntryMode) => void;
  /** Affiche le toggle réservation/blocage (création uniquement). */
  showModeToggle: boolean;
}

/**
 * En-tête de la modale : le logement (photo) et la personne concernés d'abord,
 * puis les réglages qui qualifient la réservation (mode, canal, statut).
 */
const ReservationDialogHeader: React.FC<Props> = ({ form, onClose, entryMode, onEntryModeChange, showModeToggle }) => {
  const { t } = useTranslation();
  const isBlock = entryMode === 'block';
  const guestName = form.selectedGuest?.fullName
    || [form.newGuestFirstName, form.newGuestLastName].map((part) => part.trim()).filter(Boolean).join(' ');
  const subtitle = [
    isBlock ? '' : guestName,
    form.propertyName || t('reservations.dialog.propertyPlaceholder'),
  ].filter(Boolean).join(' · ');

  const renderStatusIcon = (s: ReservationStatus) => {
    if (form.isEdit) return null; // segmented compact (labels seuls) en édition
    if (s === 'pending') return <Schedule size={13} strokeWidth={1.75} />;
    if (s === 'confirmed') return <CheckCircle size={13} strokeWidth={1.75} />;
    return null;
  };

  return (
    <div className="shrink-0 border-b border-solid border-border px-[22px] pt-[18px] pb-[14px]">
      <div className="flex items-center gap-3">
        {form.effectivePropertyId ? (
          <PropertyThumb
            seed={String(form.effectivePropertyId)}
            photo={form.propertyPhoto}
            className="h-11 w-[66px] rounded-[10px]"
          />
        ) : (
          <img
            src={isBlock ? RESERVATION_ART.stay : RESERVATION_ART.reservation}
            alt=""
            width={44}
            height={44}
            className="size-11 shrink-0 rounded-[10px] object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold leading-tight tracking-[-0.01em] text-foreground text-balance">
            {isBlock ? t('reservations.dialog.blockTitle') : form.headerTitle}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground" dir="auto">{subtitle}</p>
        </div>
        <button
          type="button"
          aria-label={t('common.close', 'Fermer')}
          onClick={onClose}
          className={cn(
            'flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-solid border-border bg-card p-0 text-muted-foreground',
            'transition-[color,border-color] duration-[160ms] ease-out hover:border-foreground/30 hover:text-foreground',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          )}
        >
          <Close size={16} strokeWidth={1.75} />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        {/* Toggle réservation / blocage (création uniquement) */}
        {showModeToggle && (
          <div className={SEG_WRAP_CLASS} role="group" aria-label={t('reservations.dialog.modeLabel', 'Type de saisie')}>
            {(['reservation', 'block'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={entryMode === m}
                onClick={() => onEntryModeChange(m)}
                className={segBtnClass(entryMode === m)}
              >
                {m === 'reservation' ? t('reservations.dialog.modeReservation') : t('reservations.dialog.modeBlock')}
              </button>
            ))}
          </div>
        )}

        {/* Édition : statut (cycle de vie). Création : le statut dérive de
            l'intention de paiement, choisie à l'étape « Finalisation ». */}
        {form.isEdit && (
          <div className={SEG_WRAP_CLASS} role="group" aria-label={t('reservations.fields.status')}>
            {form.statuses.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={form.status === s}
                onClick={() => form.setStatus(s)}
                className={segBtnClass(form.status === s)}
              >
                {renderStatusIcon(s)}
                {t(`reservations.status.${s}`)}
              </button>
            ))}
          </div>
        )}

        {/* Canal : une provenance, pas un état — masqué en blocage (pas de canal). */}
        {!isBlock && (
          <StatusChip
            pill
            icon={<GlobeIcon size={13} strokeWidth={2} />}
            label={t(`reservations.source.${form.sourceKey}`)}
            tokens={{ color: 'var(--bui-primary-deep)', bg: 'var(--bui-primary-soft)' }}
            className="ms-auto px-[11px]"
          />
        )}
      </div>
    </div>
  );
};

export default ReservationDialogHeader;
