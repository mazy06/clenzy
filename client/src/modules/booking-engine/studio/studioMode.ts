/**
 * Mode d'édition du Studio booking engine : deux niveaux.
 *  - `advanced` (DÉFAUT) : éditeur GrapesJS libre + import + tous les onglets/blocs. = comportement historique.
 *  - `guided`   : expérience bridée (façon Lodgify) — set de blocs curé, onglets Blocs + Style seulement,
 *                 pas d'import. Le drag-drop reste, mais les leviers bas-niveau sont masqués.
 *
 * Persisté SANS migration DB : sérialisé dans le champ JSON existant `componentConfig`
 * (colonne `component_config`), sous la clé `studioMode`. Cette même chaîne JSON est aussi lue par le SDK
 * (`widgetLayout` / `styleMode`) ; les helpers ci-dessous PRÉSERVENT donc les autres clés et n'écrivent
 * que `studioMode`.
 */

export type StudioMode = 'guided' | 'advanced';

/** Mode par défaut : `advanced` → zéro changement de comportement pour les configs existantes. */
export const DEFAULT_STUDIO_MODE: StudioMode = 'advanced';

/** Lit le mode depuis la chaîne JSON `componentConfig`. Repli `advanced` si absent/illisible/invalide. */
export function readStudioMode(componentConfig: string | null | undefined): StudioMode {
  if (!componentConfig) return DEFAULT_STUDIO_MODE;
  try {
    const m = (JSON.parse(componentConfig) as { studioMode?: unknown }).studioMode;
    return m === 'guided' ? 'guided' : DEFAULT_STUDIO_MODE;
  } catch {
    return DEFAULT_STUDIO_MODE;
  }
}

/**
 * Réécrit la chaîne JSON `componentConfig` en y posant `studioMode`, SANS perdre les autres clés
 * (`widgetLayout`, `styleMode`…) consommées par le SDK. Si la chaîne courante est illisible, on repart
 * d'un objet vide (greenfield) plutôt que de la propager.
 */
export function writeStudioMode(componentConfig: string | null | undefined, mode: StudioMode): string {
  let base: Record<string, unknown> = {};
  if (componentConfig) {
    try {
      const parsed = JSON.parse(componentConfig);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) base = parsed as Record<string, unknown>;
    } catch {
      /* JSON illisible → repart d'un objet vide */
    }
  }
  return JSON.stringify({ ...base, studioMode: mode });
}

/**
 * Onglets du panneau droit GrapesJS autorisés en mode GUIDÉ : on garde « Blocs » (composer la page) et
 * « Style » (personnaliser couleurs/typo/marque). On masque « Composites » (avancé), « Calques »
 * (arborescence DOM) et « Réglages » (traits bas-niveau par composant).
 *
 * Le BRIDAGE DES BLOCS (set curé : blocs de base + widgets `booking-*` + composites `composite-*`) est
 * porté par le CSS (`grapesStudio.css`, sélecteurs `[data-guided] .gjs-block[data-cz-block=…]`) plutôt
 * que par du JS : c'est non destructif (≠ suppression de bloc) et ça survit aux `bm.render()`.
 */
export const GUIDED_VIEWS: ReadonlySet<EditorViewKey> = new Set<EditorViewKey>(['blocks', 'styles']);

/** Clés des onglets du panneau droit (miroir de `EditorView` dans GrapesStudio). */
export type EditorViewKey = 'blocks' | 'composites' | 'styles' | 'layers' | 'traits';
