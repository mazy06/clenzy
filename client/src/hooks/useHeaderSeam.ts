import { useCallback, useRef, useState } from 'react';

/**
 * Classes du panneau accolé au bandeau du header.
 *
 * <p>Le fond, la bordure, le rayon et l'ombre sont portés par la feuille
 * (`.bui-header-flyout`, cf. `theme/baitly-nova.css`) — ne rien ajouter ici qui
 * y touche, une utility Tailwind vit dans la couche `utilities` et repasserait
 * devant une règle de `base`.</p>
 *
 * <p>Le DÉBORDEMENT, lui, ne peut se régler QUE d'ici, et pour cette même
 * raison : les kits posent `overflow-y-auto` en utility, ce qui fait du panneau
 * une boîte de découpe et rogne en entier les deux congés, qui vivent hors de
 * la boîte. Le défilement d'un contenu long revient donc à un conteneur
 * interne.</p>
 */
export const HEADER_FLYOUT_CLASS
  = 'bui-header-flyout overflow-visible data-[state=closed]:overflow-visible';

/**
 * Couture d'un panneau avec le bas du bandeau du header.
 *
 * <p>Radix positionne par rapport au DÉCLENCHEUR ; la ligne à rejoindre est
 * celle du bandeau, plus bas. On mesure donc l'écart et on le passe en
 * `sideOffset`, moins la morsure d'un pixel qui recouvre la ligne — c'est cette
 * interruption que les congés reprennent.</p>
 *
 * <p>`seam` vaut `null` hors d'un bandeau ancré : sans ligne à raccorder, le
 * panneau redevient flottant et garde le décalage par défaut du kit.</p>
 */
export function useHeaderSeam<T extends HTMLElement>() {
  const triggerRef = useRef<T>(null);
  const [seam, setSeam] = useState<number | null>(null);

  /**
   * À appeler AVANT l'ouverture, jamais après : le panneau doit se monter déjà
   * calé sur la couture, sans quoi il s'affiche au décalage par défaut puis
   * saute en place.
   */
  const measure = useCallback(() => {
    const trigger = triggerRef.current;
    const header = trigger?.closest<HTMLElement>('[data-slot="page-header"][data-anchored]');
    if (!trigger || !header) {
      setSeam(null);
      return;
    }
    setSeam(header.getBoundingClientRect().bottom - trigger.getBoundingClientRect().bottom - 1);
  }, []);

  return { triggerRef, seam, measure };
}
