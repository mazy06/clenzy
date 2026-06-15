import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Deep-link de notification : lit `?highlight=<id>` de l'URL pour qu'un écran
 * scrolle vers l'élément ciblé et le surligne brièvement. La valeur est
 * « consommée » (retirée de l'URL en replace) après lecture, pour ne pas
 * re-surligner aux navigations internes suivantes.
 *
 * Convention partagée backend↔frontend : le backend pose
 * `actionUrl = "/ecran?...&highlight={id}"` ; l'écran cible appelle
 * {@link useHighlightParam} puis {@link useHighlightTarget} (les lignes portent
 * `data-highlight-id={String(item.id)}`).
 */
export function useHighlightParam(): string | null {
  const [searchParams, setSearchParams] = useSearchParams();
  const [highlight, setHighlight] = useState<string | null>(() => searchParams.get('highlight'));

  useEffect(() => {
    const h = searchParams.get('highlight');
    if (!h) return;
    setHighlight(h);
    const next = new URLSearchParams(searchParams);
    next.delete('highlight');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  return highlight;
}

/**
 * Scrolle vers l'élément `[data-highlight-id="<id>"]` et le fait clignoter
 * (fond accent doux ~2s). À appeler quand les données sont chargées (`ready`)
 * pour que la ligne existe déjà dans le DOM.
 */
export function useHighlightTarget(highlightId: string | null | undefined, ready: boolean): void {
  useEffect(() => {
    if (!highlightId || !ready) return;
    // Laisse le DOM peindre la liste avant de chercher la ligne.
    const raf = requestAnimationFrame(() => {
      let el: HTMLElement | null = null;
      try {
        el = document.querySelector<HTMLElement>(`[data-highlight-id="${CSS.escape(highlightId)}"]`);
      } catch {
        el = null;
      }
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const prevTransition = el.style.transition;
      const prevBg = el.style.backgroundColor;
      el.style.transition = 'background-color .35s ease';
      el.style.backgroundColor = 'var(--accent-soft)';
      window.setTimeout(() => {
        el!.style.backgroundColor = prevBg;
        window.setTimeout(() => { el!.style.transition = prevTransition; }, 400);
      }, 2000);
    });
    return () => cancelAnimationFrame(raf);
  }, [highlightId, ready]);
}
