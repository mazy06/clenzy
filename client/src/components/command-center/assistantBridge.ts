/**
 * Ouverture de l'assistant depuis l'extérieur de son sous-arbre.
 *
 * <p>L'assistant est monté en lazy tout en bas de `MainLayoutFull` et porte son
 * état ouvert/fermé en interne. Un événement de fenêtre est la façon la moins
 * intrusive de le solliciter : pas de contexte à hisser, pas de dépendance du
 * centre de commande vers le chunk (lourd) de l'assistant.</p>
 *
 * <p>Deux verbes, parce que les deux appelants ne demandent pas la même chose :
 * le centre de commande et les amorces du survol veulent <b>ouvrir</b> (« montre
 * l'assistant »), le logo de la barre latérale veut <b>basculer</b> — c'est le
 * point d'entrée unique de l'assistant, il doit aussi savoir le refermer.</p>
 */

export const ASSISTANT_OPEN_EVENT = 'baitly:assistant-open';
export const ASSISTANT_TOGGLE_EVENT = 'baitly:assistant-toggle';

/** Charge utile de l'ouverture : une amorce à envoyer dès l'affichage. */
export interface AssistantOpenDetail {
  /** Question à poser aussitôt le panneau ouvert. Absente = panneau vide. */
  prompt?: string;
  /**
   * Poser la question dans une conversation NEUVE plutôt qu'à la suite de
   * celle en cours. C'est ce que veut une amorce validée depuis la bulle du
   * logo : elle ouvre un sujet, elle ne répond pas au précédent.
   */
  newConversation?: boolean;
}

/**
 * Demande l'ouverture du panneau d'assistant. Sans effet s'il n'est pas monté.
 *
 * @param prompt amorce envoyée dans la foulée (ex. une question validée dans
 *   la bulle du logo) — omise, le panneau s'ouvre sans rien dire.
 * @param options {@code newConversation} pour repartir d'un fil vide.
 */
export function openAssistant(
  prompt?: string,
  options?: { newConversation?: boolean },
): void {
  window.dispatchEvent(
    new CustomEvent<AssistantOpenDetail>(ASSISTANT_OPEN_EVENT, {
      detail: { prompt, newConversation: options?.newConversation },
    }),
  );
}

/** Bascule le panneau d'assistant (ouvre s'il est fermé, ferme s'il est ouvert). */
export function toggleAssistant(): void {
  window.dispatchEvent(new CustomEvent(ASSISTANT_TOGGLE_EVENT));
}
