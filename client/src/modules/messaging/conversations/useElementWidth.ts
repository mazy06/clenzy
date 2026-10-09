import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Largeur courante d'un élément (en px), mise à jour par un `ResizeObserver`.
 *
 * Sert à choisir entre un panneau affiché en permanence et un tiroir selon la
 * place RÉELLEMENT disponible dans l'écran : une media query mesurerait la
 * fenêtre, sans tenir compte de la barre latérale ni de la liste voisine.
 * Renvoie 0 tant que l'élément n'est pas monté (et en environnement sans
 * `ResizeObserver`, comme jsdom).
 */
export function useElementWidth<T extends HTMLElement>(): [RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    setWidth(Math.round(el.getBoundingClientRect().width));
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
