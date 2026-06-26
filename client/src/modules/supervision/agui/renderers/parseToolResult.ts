/* ============================================================
   parseToolResult — décapsule le résultat d'un tool AG-UI.

   Le backend Java (AgentSseEventToAgUi.wrapResult) emballe chaque
   résultat d'outil en { displayHint, isError, data } puis le sérialise
   en JSON. CopilotKit le restitue dans `props.result` (string) une fois
   `props.status === 'complete'`.

   Ce helper est volontairement tolérant :
     - result null/undefined/vide  → { displayHint: null, isError: false, data: null }
     - JSON wrappé { displayHint, isError, data } → renvoyé tel quel
     - JSON non wrappé (objet brut)  → traité comme `data`, displayHint déduit null
     - chaîne non-JSON  → conservée comme `data` brut (la carte fallback l'affichera)
   ============================================================ */

export interface ParsedToolResult {
  /** Hint de rendu fourni par le backend ("list", "chart_bar", …) ou null. */
  displayHint: string | null;
  /** true si le tool a échoué (le LLM expliquera, on affiche une carte d'erreur discrète). */
  isError: boolean;
  /** Payload métier parsé (objet/array) ou chaîne brute si non-JSON. */
  data: unknown;
}

/** Forme du wrapper backend. */
interface WrapperShape {
  displayHint?: unknown;
  isError?: unknown;
  data?: unknown;
}

function isWrapper(value: unknown): value is WrapperShape {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    ('displayHint' in value || 'data' in value)
  );
}

/**
 * Décapsule `props.result` (string JSON ou autre) en { displayHint, isError, data }.
 * Ne lève jamais — toujours un objet exploitable.
 */
export function parseToolResult(result: unknown): ParsedToolResult {
  if (result === null || result === undefined) {
    return { displayHint: null, isError: false, data: null };
  }

  // Le cas nominal : une chaîne JSON.
  let parsed: unknown = result;
  if (typeof result === 'string') {
    const trimmed = result.trim();
    if (trimmed === '') {
      return { displayHint: null, isError: false, data: null };
    }
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // Pas du JSON : on garde la chaîne brute comme data.
      return { displayHint: null, isError: false, data: result };
    }
  }

  // Wrapper backend { displayHint, isError, data } ?
  if (isWrapper(parsed)) {
    const w = parsed as WrapperShape;
    return {
      displayHint: typeof w.displayHint === 'string' ? w.displayHint : null,
      isError: w.isError === true,
      data: 'data' in w ? w.data : parsed,
    };
  }

  // Objet/array brut sans wrapper : on le traite comme data.
  return { displayHint: null, isError: false, data: parsed };
}
