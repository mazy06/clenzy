import React from 'react';
import { cn } from '../../utils/cn';
import { Close, Home, Public as GlobeIcon, Schedule, CheckCircle } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import type { ReservationStatus } from '../../services/api';
import type { UseReservationFormResult } from './useReservationForm';
import type { ReservationDialogEntryMode } from './ReservationDialog';

// Transcriptions en classes de `SEG_WRAP_SX` / `segBtnSx` (reservationDialogStyles),
// sur le meme modele que FinalizeStep et PricingSection. Le `background: none` du sx
// devient `bg-transparent` : sans lui le <button> reprendrait le fond gris de l'UA.
const SEG_WRAP_CLASS =
  'inline-flex shrink-0 bg-[var(--field)] border border-solid border-[var(--field-line)] rounded-[10px] p-[3px] gap-[2px]';

const segBtnClass = (on: boolean) =>
  cn(
    'inline-flex items-center justify-center gap-[6px] border-0 rounded-[7px] px-3 py-1.5',
    '[font-family:inherit] text-[12px] font-semibold whitespace-nowrap cursor-pointer',
    'transition-[background-color,color] duration-[140ms]',
    'focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-1',
    on
      ? 'bg-[var(--card)] text-[var(--accent)] shadow-[0_1px_3px_rgba(21,36,45,.12)]'
      : 'bg-transparent text-[var(--muted)] shadow-none',
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

const ReservationDialogHeader: React.FC<Props> = ({ form, onClose, entryMode, onEntryModeChange, showModeToggle }) => {
  const { t } = useTranslation();
  const isBlock = entryMode === 'block';

  const renderStatusIcon = (s: ReservationStatus) => {
    if (form.isEdit) return null; // segmented compact (labels seuls) en édition
    if (s === 'pending') return <Schedule size={13} strokeWidth={1.75} />;
    if (s === 'confirmed') return <CheckCircle size={13} strokeWidth={1.75} />;
    return null;
  };

  return (
    // `rowGap: '10px'` precedait `gap: '12px'` dans le sx : la shorthand `gap`,
    // serialisee apres, ecrasait deja le row-gap. On garde le rendu reel (12px).
    <div className="flex items-center flex-wrap gap-[12px] py-[18px] px-[22px] border-b border-solid border-[var(--line)] shrink-0">
      <span className="font-[var(--font-display)] text-[18px] font-semibold text-[var(--ink)] tracking-[-0.01em] whitespace-nowrap">
        {isBlock ? t('reservations.dialog.blockTitle') : form.headerTitle}
      </span>

      {/* Toggle réservation / blocage (création uniquement) */}
      {showModeToggle && (
        <div className={SEG_WRAP_CLASS}>
          {(['reservation', 'block'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onEntryModeChange(m)}
              className={segBtnClass(entryMode === m)}
            >
              {m === 'reservation' ? t('reservations.dialog.modeReservation') : t('reservations.dialog.modeBlock')}
            </button>
          ))}
        </div>
      )}

      {/* Pilule canal (.rm-chan) — masquée en mode blocage (pas de canal). */}
      {!isBlock && (
        <div className="inline-flex items-center gap-[6px] text-[11px] font-bold text-[var(--accent)] bg-[var(--accent-soft)] rounded-[20px] px-[11px] py-[4px] shrink-0">
          <GlobeIcon size={13} strokeWidth={2} />
          {t(`reservations.source.${form.sourceKey}`)}
        </div>
      )}

      {/* Édition : segmented STATUT (cycle de vie). Création : le statut dérive de
          l'intention de paiement, choisie à l'étape « Finalisation » du wizard. */}
      {form.isEdit && (
        <div className={SEG_WRAP_CLASS}>
          {form.statuses.map((s) => (
            <button key={s} type="button" onClick={() => form.setStatus(s)} className={segBtnClass(form.status === s)}>
              {renderStatusIcon(s)}
              {t(`reservations.status.${s}`)}
            </button>
          ))}
        </div>
      )}

      {/* Propriété (.rm-prop) — nom seul, uniquement quand le logement est verrouillé.
          En création libre, le sélecteur vit dans le corps (étape 1 / blocage) → pas de doublon. */}
      {!form.showPropertySelector && (
        <div
          className={cn(
            'ms-auto inline-flex items-center gap-[7px] text-[13px] font-semibold min-w-0',
            form.propertyName ? 'text-[var(--ink)]' : 'text-[var(--faint)]',
          )}
        >
          <span className="inline-flex text-[var(--accent)] shrink-0">
            <Home size={16} strokeWidth={1.75} />
          </span>
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
            {form.propertyName || t('reservations.dialog.propertyPlaceholder')}
          </span>
        </div>
      )}

      {/* ✕ (.rm-x) */}
      <button
        type="button"
        aria-label={t('common.cancel')}
        onClick={onClose}
        className={cn(
          'w-[34px] h-[34px] rounded-[10px] border border-solid border-[var(--line-2)] bg-[var(--card)] text-[var(--muted)]',
          'cursor-pointer flex items-center justify-center shrink-0 p-0',
          'transition-[color,border-color] duration-[140ms] hover:text-[var(--err)] hover:border-[var(--err)]',
          'focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2',
          // Quand le bloc logement est masqué (création libre), le X reprend le push à droite.
          form.showPropertySelector && 'ms-auto',
        )}
      >
        <Close size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
};

export default ReservationDialogHeader;
