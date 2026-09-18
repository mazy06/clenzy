/**
 * Fenêtre pendant laquelle la mise en page se déplace **volontairement**.
 *
 * <p>Le repli de la navigation anime la largeur de la gouttière, qui pousse la
 * zone de contenu : pendant ~220 ms, la largeur du contenu change à chaque
 * frame. Les écrans qui se mesurent (hauteur de page utile, nombre de rangs
 * tenant dans un cadre, viewport d'une grille) sont branchés sur des
 * {@code ResizeObserver} : sans garde, chacun recalcule une douzaine de fois
 * pendant le repli. Le coût n'est pas la mesure elle-même mais ce qu'elle
 * entraîne — une lecture de layout forcée puis un rendu React d'un arbre
 * lourd, à chaque frame. C'est ce qui rendait le repli saccadé.</p>
 *
 * <p>Ces mesures n'ont d'intérêt qu'à l'arrivée : les valeurs intermédiaires
 * sont jetées aussitôt. On les diffère donc jusqu'à la fin du déplacement,
 * pour n'en faire qu'une.</p>
 *
 * <p>Volontairement un module et non un contexte React : les consommateurs
 * sont des callbacks d'observateurs, hors du cycle de rendu.</p>
 */

let shiftingUntil = 0;

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Ouvre la fenêtre pour {@code durationMs}. Sans effet en mouvement réduit :
 * la transition CSS y est neutralisée, la mise en page arrive d'un coup et
 * différer la mesure ne ferait que retarder l'affichage.
 */
export function beginLayoutShift(durationMs: number): void {
  if (prefersReducedMotion()) return;
  shiftingUntil = performance.now() + durationMs;
}

export function isLayoutShifting(): boolean {
  return performance.now() < shiftingUntil;
}

/**
 * Planificateur de mesure qui attend la fin du déplacement.
 *
 * <p>Une mesure au plus est en attente ; tant que la fenêtre est ouverte, elle
 * est repoussée d'une frame. Aucune inscription à un évènement de fin n'est
 * nécessaire : la première frame après la fermeture mesure, et le report se
 * termine donc tout seul même si la transition est interrompue.</p>
 */
export function createSettledScheduler(measure: () => void) {
  let frame = 0;

  const step = () => {
    frame = requestAnimationFrame(() => {
      if (isLayoutShifting()) {
        step();
        return;
      }
      frame = 0;
      measure();
    });
  };

  return {
    schedule: () => {
      if (!frame) step();
    },
    cancel: () => {
      cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}
