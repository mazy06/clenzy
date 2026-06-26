/* ============================================================
   useElementSize — mesure d'un élément via ResizeObserver

   Pas de hook générique équivalent dans le repo (useResponsiveSize =
   taille d'icône, useDynamicPageSize = viewport). Mesure synchrone au
   layout (anti-flash) + suivi des resize. Dégrade proprement si
   ResizeObserver est absent (ex. jsdom en test).
   ============================================================ */

import { useLayoutEffect, useRef, useState } from 'react';

export interface ElementSize {
  width: number;
  height: number;
}

export function useElementSize<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      setSize((prev) =>
        prev.width === el.clientWidth && prev.height === el.clientHeight
          ? prev
          : { width: el.clientWidth, height: el.clientHeight },
      );
    };
    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}
