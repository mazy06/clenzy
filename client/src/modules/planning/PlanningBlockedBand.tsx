import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import { Lock as LockIcon } from '../../icons';

interface PlanningBlockedBandProps {
  /** Position et taille (px) calculées par le layout du planning. */
  left: number;
  width: number;
  height: number;
  /** Notes éventuelles du blocage (saisie manuelle). */
  notes?: string;
  /** Source du blocage (ex: "ICAL:42", "MANUAL", "AIRBNB"). */
  source?: string;
}

/**
 * Plage bloquée du calendrier rendue comme une bande de cellules **grisées**
 * (hachurées) — et non comme une brique d'événement : un blocage n'est pas un
 * séjour. Au clic, un tooltip explique que la période est indisponible.
 *
 * Le blocage reste présent dans les données (`allEvents`) : le drag-to-select
 * de création de réservation continue de l'éviter.
 */
const PlanningBlockedBand: React.FC<PlanningBlockedBandProps> = ({ left, width, height, notes, source }) => {
  const [open, setOpen] = useState(false);
  const bandRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
    setOpen((o) => !o);
  }, []);

  // Remplacement du ClickAwayListener MUI. On ne passe pas par
  // `onPointerDownOutside` du contenu Radix : la bande elle-meme est « outside »
  // du panneau, un clic dessus fermerait puis rouvrirait aussitot — le toggle
  // ne refermerait donc jamais.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!bandRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const isExternal = !!source && source.toUpperCase().startsWith('ICAL');

  // Largeur minimale pour afficher l'icône / le label sans tronquer.
  const showIcon = width >= 22;
  const showLabel = width >= 68;

  return (
    // `open` est pilote par le clic seul : `onOpenChange` n'est pas branche, donc
    // le survol et le focus de Radix ne peuvent pas ouvrir l'infobulle — c'est
    // ce que faisaient les `disableHoverListener` / `disableFocusListener` MUI.
    <Tooltip open={open}>
      <TooltipTrigger asChild>
        <div
          ref={bandRef}
          data-blocked-range
          role="button"
          tabIndex={0}
          aria-label="Période bloquée — voir le détail"
          onClick={toggle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggle(e);
            }
          }}
          className={
            'absolute top-0 z-[2] cursor-pointer flex items-center justify-center gap-[3px] text-[var(--muted)] ' +
            // Cellules grisées + hachures diagonales = convention « indisponible ».
            'bg-[color-mix(in_srgb,var(--muted)_8%,var(--card))] ' +
            'hover:bg-[color-mix(in_srgb,var(--muted)_14%,var(--card))] ' +
            'shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--muted)_14%,transparent)] ' +
            'transition-[background-color] duration-150 ease-out'
          }
          style={{
            left,
            width,
            height,
            // Gradient statique laisse en style inline (les dimensions y passent
            // deja) : plus lisible qu'une classe arbitraire de 100 caracteres.
            backgroundImage:
              'repeating-linear-gradient(45deg, color-mix(in srgb, var(--muted) 16%, transparent) 0 1px, transparent 1px 7px)',
          }}
        >
          {showIcon && <LockIcon size={12} strokeWidth={1.75} />}
          {showLabel && (
            <p className="cn-text-body1 text-[0.6875rem] font-semibold text-[var(--muted)] whitespace-nowrap overflow-hidden text-ellipsis">
              Bloqué
            </p>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px]" onEscapeKeyDown={close}>
        <div className="py-0.5">
          <p className="cn-text-body1 text-[0.75rem] font-bold mb-0.5">
            Période bloquée
          </p>
          <p className="cn-text-body1 text-[0.6875rem] leading-[1.35]">
            Ces dates sont indisponibles à la réservation.
            {isExternal && ' Synchronisée depuis un calendrier externe (OTA).'}
          </p>
          {notes && (
            <p className="cn-text-body1 text-[0.6875rem] mt-0.5 opacity-85 italic">
              {notes}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

PlanningBlockedBand.displayName = 'PlanningBlockedBand';
export default PlanningBlockedBand;
