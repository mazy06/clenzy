import apiClient from '../apiClient';

/**
 * Clôture d'une action de la file « à traiter ».
 *
 * <p>La liste arrive avec le tableau de bord : seule la clôture a besoin d'un
 * appel dédié. Elle sert aux actions nées d'un événement (litige, virement
 * refusé), que rien ne peut refermer automatiquement — une action déduite des
 * données, elle, disparaît d'elle-même quand sa cause disparaît.</p>
 */
export const actionItemsApi = {
  /** Retire l'action de la file, le nécessaire ayant été fait ailleurs. */
  resolve: (id: number): Promise<void> =>
    apiClient.post<void>(`/action-items/${id}/resolve`),

  /**
   * Demande un recalcul immédiat de la file.
   *
   * <p>La file est reconstruite périodiquement côté serveur. Cela convient à
   * une anomalie qui apparaît, mais pas à une ligne qu'on vient de traiter :
   * la voir persister donnerait l'impression que le geste n'a pas pris.</p>
   */
  refresh: (): Promise<void> => apiClient.post<void>('/action-items/refresh'),

  /**
   * Réessaie l'envoi que l'action signale — document non délivré, message
   * voyageur en échec. Le canal d'origine est conservé.
   */
  retry: (id: number): Promise<void> => apiClient.post<void>(`/action-items/${id}/retry`),
};

/**
 * Rafraîchit la file puis les vues qui en dépendent.
 *
 * <p>À appeler après un geste qui rend une ligne caduque sans la clôturer
 * explicitement — encaisser un solde, relancer un flux, répondre à un avis.
 * Le recalcul est best-effort : s'il échoue, on invalide quand même, et la
 * ligne disparaîtra au balayage suivant plutôt que de bloquer l'écran sur une
 * erreur qui ne concerne pas l'utilisateur.</p>
 */
export async function refreshActionQueue(
  invalidate: (key: readonly unknown[]) => Promise<unknown>,
  keys: readonly (readonly unknown[])[],
): Promise<void> {
  try {
    await actionItemsApi.refresh();
  } catch {
    // Sans conséquence visible : la file se remettra à jour d'elle-même.
  }
  await Promise.all(keys.map((key) => invalidate([...key])));
}
