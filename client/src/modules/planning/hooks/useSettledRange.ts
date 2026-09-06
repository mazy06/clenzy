import { useEffect, useRef, useState } from 'react';
import { toDateStr } from '../utils/dateUtils';

/** Delai d'immobilite avant de considerer la fenetre comme posee. */
const SETTLE_DELAY_MS = 250;

/**
 * Fenetre de dates « posee » : suit `start`/`end` mais n'adopte une nouvelle
 * valeur qu'apres {@link SETTLE_DELAY_MS} sans changement.
 *
 * <p>La fenetre de rendu glisse d'une fenetre visible a chaque approche d'un
 * bord. Un defilement rapide de trois mois en traverse donc trois — et si les
 * requetes suivaient le rendu, chaque etape intermediaire declenchait un lot
 * complet de chargements (reservations, interventions, prix, min-nights) qu'on
 * jetait aussitot. C'est ce qui epuisait le quota de l'API (300 req/min par
 * utilisateur) et rendait la main avec des 429.</p>
 *
 * <p>La toute premiere valeur est adoptee immediatement : l'affichage initial
 * ne doit pas attendre.</p>
 */
export function useSettledRange(start: Date, end: Date): { start: Date; end: Date } {
  const [settled, setSettled] = useState({ start, end });

  // Cles textuelles : deux `Date` distinctes valant le meme jour ne doivent pas
  // relancer le minuteur (le buffer se recalcule a chaque rendu du parent).
  const startKey = toDateStr(start);
  const endKey = toDateStr(end);
  const latest = useRef({ start, end });
  latest.current = { start, end };

  useEffect(() => {
    if (toDateStr(settled.start) === startKey && toDateStr(settled.end) === endKey) return;
    const timer = setTimeout(() => setSettled(latest.current), SETTLE_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startKey, endKey]);

  return settled;
}
