import { useState, useCallback } from 'react';

const SIDEBAR_KEY = 'clenzy_sidebar_collapsed';

function getSavedCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Préférence de repli de la navigation, persistée par appareil.
 *
 * Ne concerne **que** le desktop : sous 1024 px la sidebar est une feuille
 * latérale gérée par le kit (`SIDEBAR_SHEET_BREAKPOINT` dans `ui/sidebar`), où
 * la notion de repli n'a pas de sens. Aucun palier n'est donc géré ici — c'est
 * précisément le mélange de deux échelles de points de rupture qui avait
 * introduit un trou entre 768 et 900 px (cf. `components/SIDEBAR-PARITY.md` §E).
 *
 * Lecture synchrone au montage : la valeur est lue avant le premier rendu pour
 * éviter que la sidebar s'affiche déployée puis se replie.
 */
export function useSidebarState() {
  const [isCollapsed, setIsCollapsed] = useState(getSavedCollapsed);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(SIDEBAR_KEY, String(next));
      } catch {
        // Mode privé ou quota plein : la préférence ne survit pas au rechargement.
      }
      return next;
    });
  }, []);

  return { isCollapsed, toggleCollapsed };
}
