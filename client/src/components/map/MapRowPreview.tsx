import { useLayoutEffect, useState, type ReactNode } from 'react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { Button, PopoverContent } from '../ui';
import { X } from '../../icons/glyphs';
import { useTranslation } from '../../hooks/useTranslation';
import { useMediaQuery } from '../../hooks/use-media-query';
import './mapRowPreview.css';

/** Aperçu ancré à sa ligne, avec encoche et fermeture sans quitter la carte. */
export default function MapRowPreview({ children, label, side }: {
  children: ReactNode; label: string; side: 'start' | 'end';
}) {
  const { t, isArabic } = useTranslation();
  const small = useMediaQuery('(max-width: 767.98px)');
  const [inner, setInner] = useState<HTMLDivElement | null>(null);
  const [lastRow, setLastRow] = useState(false);
  const [lastAlignOffset, setLastAlignOffset] = useState(-1);
  useLayoutEffect(() => {
    const panel = inner?.closest<HTMLElement>('[data-slot="popover-content"]');
    if (!panel) return;
    const trigger = Array.from(document.querySelectorAll<HTMLElement>('[aria-controls]'))
      .find(element => element.getAttribute('aria-controls') === panel.id);
    const anchor = trigger?.closest<HTMLElement>('[data-map-preview-anchor]') ?? trigger;
    if (!anchor) return;
    const carrier = anchor.closest<HTMLElement>('[data-provider-sector-panel]');
    const measure = () => {
      const box = panel.getBoundingClientRect();
      // Le séparateur appartient à la ligne (li), pas au bouton qu'elle contient.
      const rowElement = anchor.closest<HTMLElement>('[data-map-preview-row]') ?? anchor;
      const last = rowElement.dataset.mapPreviewLast === 'true';
      setLastRow(last);
      const row = rowElement.getBoundingClientRect();
      const lastBottom = Math.min(carrier?.getBoundingClientRect().bottom ?? row.bottom, window.innerHeight - 8);
      if (last) {
        const offset = anchor.getBoundingClientRect().bottom - lastBottom;
        setLastAlignOffset(previous => Math.abs(previous - offset) < 0.1 ? previous : offset);
      }
      const side = panel.dataset.side;
      const gap = side === 'right' ? box.left - row.right
        : side === 'left' ? row.left - box.right : Number.POSITIVE_INFINITY;
      const adjacent = gap >= -2 && gap <= 16;
      let top = row.top;
      let bottom = row.bottom;
      // Une ligne sortie de sa liste défilante ne doit plus dessiner de raccord.
      for (let parent = anchor.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (/auto|scroll|hidden|clip/.test(style.overflowY)) {
          const clip = parent.getBoundingClientRect();
          const topRadius = Math.max(parseFloat(style.borderTopLeftRadius) || 0, parseFloat(style.borderTopRightRadius) || 0);
          const bottomRadius = Math.max(parseFloat(style.borderBottomLeftRadius) || 0, parseFloat(style.borderBottomRightRadius) || 0);
          // Le congé ne doit pas recouvrir le coin arrondi du panneau porteur.
          top = Math.max(top, clip.top + (topRadius ? topRadius + 16 : 0));
          bottom = Math.min(bottom, clip.bottom - (!last && bottomRadius ? bottomRadius + 16 : 0));
        }
      }
      // Les deux congés restent à l'intérieur du flanc, loin des coins de la fiche.
      // Les coordonnées absolues partent de la boîte de padding de l'aperçu.
      const start = Math.max(32, top - box.top - panel.clientTop);
      const end = Math.min(box.height - (last ? 0 : 32) - panel.clientTop, (last ? lastBottom : bottom) - box.top - panel.clientTop);
      const joined = adjacent && bottom > top && end - start > 24;
      panel.dataset.joined = joined ? 'true' : 'false';
      panel.dataset.joinLast = last ? 'true' : 'false';
      if (carrier) {
        if (last && joined) carrier.dataset.previewLastSide = side;
        else delete carrier.dataset.previewLastSide;
      }
      panel.style.setProperty('--preview-join-top', `${start}px`);
      panel.style.setProperty('--preview-join-bottom', `${end}px`);
      panel.style.setProperty('--preview-join-gap', `${Math.max(0, Number.isFinite(gap) ? gap : 0)}px`);
    };
    let frame = 0;
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    measure(); schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(panel); observer.observe(anchor);
    const positionObserver = new MutationObserver(schedule);
    if (panel.parentElement) positionObserver.observe(panel.parentElement, { attributes: true, attributeFilter: ['style'] });
    if (anchor.parentElement) positionObserver.observe(anchor.parentElement, { attributes: true, attributeFilter: ['style'], childList: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    return () => { observer.disconnect(); positionObserver.disconnect(); cancelAnimationFrame(frame);
      if (carrier) delete carrier.dataset.previewLastSide;
      window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true); };
  }, [inner, small]);
  const physicalSide = (side === 'end') !== !!isArabic ? 'right' : 'left';
  return <PopoverContent side={small ? 'bottom' : physicalSide} align={small ? 'start' : lastRow ? 'end' : 'center'}
    alignOffset={!small && lastRow ? lastAlignOffset : 0} sideOffset={12}
    collisionPadding={{ top: 24, bottom: lastRow && !small ? 8 : 24, left: 24, right: 24 }}
    aria-label={label} className="bui-map-preview w-[min(400px,calc(100vw-48px))] gap-0 p-0">
    <span aria-hidden className="bui-map-preview__join" />
    <div ref={setInner} className="max-h-[min(75dvh,var(--radix-popover-content-available-height))] overflow-y-auto overscroll-contain">
      {children}
    </div>
    <PopoverPrimitive.Close asChild>
      <Button size="icon-xs" variant="secondary" aria-label={t('common.close', 'Fermer')}
        className="absolute end-2 top-2 cursor-pointer"><X className="size-3.5" /></Button>
    </PopoverPrimitive.Close>
  </PopoverContent>;
}
