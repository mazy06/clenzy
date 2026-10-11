import type * as maplibregl from 'maplibre-gl';
import { prefersReducedMotion } from './motion';

/** Marge gardée entre la fiche et le bord de la carte. */
const EDGE_MARGIN = 12;

/**
 * Garde une bulle « fiche » entièrement visible :
 *
 * <ul>
 *   <li>sa taille est plafonnée à celle de la carte (défilement interne au-delà),
 *       ce qui évite toute fiche plus grande que l'espace disponible ;</li>
 *   <li>à chaque changement de taille (ouverture, chargement des photos, fiche
 *       compacte), le débordement est mesuré et la carte se décale d'autant.</li>
 * </ul>
 *
 * <p>Le choix du côté (dessus / dessous / gauche / droite) reste celui de
 * MapLibre, recalculé à chaque déplacement de la carte.</p>
 *
 * @returns fonction de nettoyage à appeler à la fermeture de la bulle.
 */
export function keepPopupInView(map: maplibregl.Map, popup: maplibregl.Popup): () => void {
  const element = popup.getElement();
  const content = element?.querySelector<HTMLElement>('.maplibregl-popup-content');
  if (!element || !content) return () => undefined;

  const container = map.getContainer();
  const usableFrame = () => {
    const frame = container.getBoundingClientRect();
    // Les contrôles gardent un couloir à droite ; la fiche ne les recouvre pas.
    const controls = container.querySelector('.maplibregl-ctrl-top-right')?.getBoundingClientRect();
    const reserved = controls?.width ? Math.min(controls.width + EDGE_MARGIN, frame.width / 3) : 0;
    return { left: frame.left + EDGE_MARGIN, right: frame.right - EDGE_MARGIN - reserved,
      top: frame.top + EDGE_MARGIN, bottom: frame.bottom - EDGE_MARGIN };
  };
  const applyLimits = () => {
    const frame = usableFrame();
    const limitWidth = Math.max(1, frame.right - frame.left);
    const limitHeight = Math.max(1, frame.bottom - frame.top);
    content.style.maxInlineSize = `${limitWidth}px`;
    content.style.maxBlockSize = `${limitHeight}px`;
    // Large : photos à gauche, infos à droite — dès que la carte a la place
    // d'une fiche de 400 px à côté du marqueur. Sinon, fiche empilée.
    element.dataset.layout = container.clientWidth >= 560 ? 'wide' : 'stacked';
    // Fiche « compacte » : la carte est trop basse pour photos + infos en entier.
    element.dataset.compact = String(container.clientHeight < 420);
  };

  const reveal = () => {
    // Un vol de caméra est en cours (centrage au clic) : le recadrer l'interromprait.
    // On mesure une fois la caméra posée.
    if (map.isMoving()) {
      return;
    }
    const box = content.getBoundingClientRect();
    const frame = usableFrame();
    const shift = (start: number, end: number, min: number, max: number): number => {
      if (end - start > max - min) return min - start; // plus grande que la carte : aligner le début
      if (start < min) return min - start;
      if (end > max) return max - end;
      return 0;
    };
    const dx = shift(box.left, box.right, frame.left, frame.right);
    const dy = shift(box.top, box.bottom, frame.top, frame.bottom);
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    // panBy déplace la VUE : pour amener la fiche de +dy, la vue part de -dy.
    map.panBy([-dx, -dy], { duration: prefersReducedMotion() ? 0 : 200 });
  };

  let frameId = 0;
  const schedule = () => {
    cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(() => {
      applyLimits();
      reveal();
    });
  };

  applyLimits(); // disposition posée avant la première peinture : pas de saut empilé → large
  const observer = new ResizeObserver(schedule);
  observer.observe(content);
  observer.observe(container);
  map.on('moveend', schedule);
  map.on('resize', schedule);
  schedule();

  return () => {
    cancelAnimationFrame(frameId);
    observer.disconnect();
    map.off('moveend', schedule);
    map.off('resize', schedule);
  };
}
