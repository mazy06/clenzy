/**
 * Ouverture de l'assistant depuis l'extérieur de son sous-arbre.
 *
 * <p>L'assistant est monté en lazy tout en bas de `MainLayoutFull` et porte son
 * état ouvert/fermé en interne. Un événement de fenêtre est la façon la moins
 * intrusive de le solliciter : pas de contexte à hisser, pas de dépendance du
 * centre de commande vers le chunk (lourd) de l'assistant.</p>
 */

export const ASSISTANT_OPEN_EVENT = 'baitly:assistant-open';

/** Demande l'ouverture du panneau d'assistant. Sans effet s'il n'est pas monté. */
export function openAssistant(): void {
  window.dispatchEvent(new CustomEvent(ASSISTANT_OPEN_EVENT));
}
