import structuralCSS from './styles/structural.css?raw';

/**
 * Mode « headless » des widgets de réservation.
 *
 * `true`  → widgets rendus en LIGHT DOM (pas de Shadow DOM), SANS thème ni CSS cosmétique : c'est le
 *           CSS du TEMPLATE hôte qui les habille (police, couleurs, boutons, inputs). Seule une feuille
 *           STRUCTURELLE (mise en page invisible) est injectée pour garder les contrôles fonctionnels.
 * `false` → ancien rendu : Shadow DOM isolé + thème `--cb-*` + reset/base/components.
 *
 * Réversible : repasser à `false` rétablit intégralement l'ancien comportement (sécurité prod).
 */
export const HEADLESS_WIDGETS: boolean = true;

export const STRUCTURAL_STYLE_ID = 'clenzy-widget-structural';

// Contenu courant de la feuille (mutable pour le HMR dev) + documents où elle est injectée (suivi DEV seul,
// pour la ré-injection HMR ci-dessous — non peuplé en prod, donc aucune rétention de documents).
let currentStructuralCss = structuralCSS;
const injectedDocs = new Set<Document>();

/**
 * Injecte (UNE seule fois par document) la feuille structurelle des widgets headless. Dans l'éditeur,
 * `doc` est le document de l'IFRAME du canvas ; sur le site publié, le document de la page hôte.
 */
export function ensureStructuralStyles(doc: Document | null | undefined): void {
  if (!doc) return;
  if (import.meta.hot) injectedDocs.add(doc);
  const existing = doc.getElementById(STRUCTURAL_STYLE_ID) as HTMLStyleElement | null;
  if (existing) {
    // Resynchronise le contenu si la feuille a évolué (HMR dev : le CSS change sans recharger la page, mais
    // le `<style>` déjà injecté garderait l'ancien contenu). Constant en prod → no-op.
    if (existing.textContent !== currentStructuralCss) existing.textContent = currentStructuralCss;
    return;
  }
  const style = doc.createElement('style');
  style.id = STRUCTURAL_STYLE_ID;
  style.textContent = currentStructuralCss;
  // Injecté EN DERNIER (append) : structural.css ne contient QUE de la mise en page fonctionnelle
  // (grilles, repli des déroulants, popovers) sur des sélecteurs `.cb-*` propres ; sur égalité de
  // spécificité il doit gagner pour garantir le fonctionnement des contrôles. Le template habille sur
  // d'AUTRES propriétés (couleurs, polices, bordures via `--cb-*`) → aucun conflit, et il garde la
  // maîtrise de ce que structural ne déclare pas (ex. flex-basis responsive des champs composés).
  (doc.head ?? doc.documentElement).appendChild(style);
}

// HMR dev : quand `structural.css` change, ré-injecte immédiatement le nouveau contenu dans TOUS les
// documents déjà servis (app + iframes éditeur) → les modifs CSS apparaissent sans reload ni re-mount.
// Bloc supprimé du bundle de prod (`import.meta.hot` y est statiquement faux).
if (import.meta.hot) {
  import.meta.hot.accept('./styles/structural.css?raw', (mod) => {
    if (!mod) return;
    currentStructuralCss = (mod as { default?: string }).default ?? currentStructuralCss;
    for (const d of injectedDocs) {
      const el = d.getElementById(STRUCTURAL_STYLE_ID);
      if (el && el.textContent !== currentStructuralCss) el.textContent = currentStructuralCss;
    }
  });
}
