import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipTrigger } from '../../components/ui';
import { Lock as LockIcon, LockOpen as LockOpenIcon } from '../../icons';
import { PlanningTooltipContent } from './PlanningTooltip';

interface PlanningBlockedBandProps {
  /** Position et taille (px) calculées par le layout du planning. */
  left: number;
  width: number;
  height: number;
  /** Notes éventuelles du blocage (saisie manuelle). */
  notes?: string;
  /** Source du blocage (ex: "ICAL:42", "MANUAL", "AIRBNB"). */
  source?: string;
  /** Bornes de la plage — `endDate` est EXCLUSIVE, comme l'attend l'API. */
  startDate?: string;
  endDate?: string;
  /**
   * Débloque la plage. Absent = action non proposée (le tooltip reste
   * informatif). Rejette pour afficher l'erreur dans le tooltip.
   */
  onUnblock?: (startDate: string, endDate: string) => Promise<void>;
}

/**
 * Plage bloquée du calendrier rendue comme une bande de cellules **grisées**
 * (hachurées) — et non comme une brique d'événement : un blocage n'est pas un
 * séjour. Au clic, un tooltip explique que la période est indisponible.
 *
 * Le blocage reste présent dans les données (`allEvents`) : le drag-to-select
 * de création de réservation continue de l'éviter.
 */
const PlanningBlockedBand: React.FC<PlanningBlockedBandProps> = ({
  left,
  width,
  height,
  notes,
  source,
  startDate,
  endDate,
  onUnblock,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
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

  const peutDebloquer = !!onUnblock && !!startDate && !!endDate;

  const debloquer = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUnblock || !startDate || !endDate) return;
    setPending(true);
    setErreur(null);
    try {
      await onUnblock(startDate, endDate);
      setOpen(false);
    } catch {
      setErreur(t('planning.blocked.unblockFailed', 'Le déblocage a échoué. Réessayez.'));
    } finally {
      setPending(false);
    }
  }, [onUnblock, startDate, endDate, t]);

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
          aria-label={t('planning.blocked.tooltip', 'Période bloquée — voir le détail')}
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
            'bg-[color-mix(in_srgb,var(--muted)_8%,var(--bui-card))] ' +
            'hover:bg-[color-mix(in_srgb,var(--muted)_14%,var(--bui-card))] ' +
            'shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--muted)_14%,transparent)] ' +
            'transition-[background-color] duration-150 ease-out'
          }
          style={{
            // Logique et non physique : la frise se lit a l'envers en arabe.
            insetInlineStart: left,
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
              {t('planning.blocked.label', 'Bloqué')}
            </p>
          )}
        </div>
      </TooltipTrigger>
      <PlanningTooltipContent side="top" className="max-w-[240px]" onEscapeKeyDown={close}>
        <div className="py-0.5">
          <p className="cn-text-body1 text-[0.75rem] font-bold mb-0.5">
            {t('planning.blocked.title', 'Période bloquée')}
          </p>
          <p className="cn-text-body1 text-[0.6875rem] leading-[1.35]">
            {t('planning.blocked.desc', 'Ces dates sont indisponibles à la réservation.')}
            {isExternal && t('planning.blocked.descExternal', ' Synchronisée depuis un calendrier externe (OTA).')}
          </p>
          {notes && (
            <p className="cn-text-body1 text-[0.6875rem] mt-0.5 opacity-85 italic">
              {notes}
            </p>
          )}
          {peutDebloquer && (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={debloquer}
                className={
                  'mt-1.5 w-full inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 ' +
                  'cn-text-body1 text-[0.6875rem] font-semibold cursor-pointer ' +
                  'bg-[color-mix(in_srgb,currentColor_12%,transparent)] ' +
                  'hover:bg-[color-mix(in_srgb,currentColor_20%,transparent)] ' +
                  'disabled:opacity-60 disabled:cursor-default ' +
                  'transition-[background-color] duration-150 ease-out'
                }
              >
                <LockOpenIcon size={12} strokeWidth={1.75} />
                {pending
                  ? t('planning.blocked.unblocking', 'Déblocage…')
                  : t('planning.blocked.unblock', 'Débloquer la période')}
              </button>
              {isExternal && (
                <p className="cn-text-body1 text-[0.6875rem] mt-1 leading-[1.35] opacity-85">
                  {t('planning.blocked.externalWarning', "Le blocage revient à la prochaine synchronisation s'il n'est pas aussi levé chez le canal.")}
                </p>
              )}
              {erreur && (
                <p role="alert" className="cn-text-body1 text-[0.6875rem] mt-1 font-semibold">
                  {erreur}
                </p>
              )}
            </>
          )}
        </div>
      </PlanningTooltipContent>
    </Tooltip>
  );
};

PlanningBlockedBand.displayName = 'PlanningBlockedBand';
export default PlanningBlockedBand;
