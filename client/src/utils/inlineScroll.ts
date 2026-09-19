/**
 * Defilement horizontal exprime en coordonnees LOGIQUES, pas en pixels de
 * gauche.
 *
 * <h3>Pourquoi</h3>
 * <p>{@code scrollLeft} ne veut pas dire la meme chose selon le sens
 * d'ecriture. En LTR il vaut 0 au DEBUT du contenu et croit vers la fin. En
 * RTL, les navigateurs modernes (Chrome 85+, Firefox, Safari 14.1+) gardent 0
 * au debut — c'est-a-dire au bord DROIT — et rendent des valeurs
 * <b>negatives</b> a mesure qu'on avance vers la gauche.</p>
 *
 * <p>Tout code qui compte les pixels depuis la gauche casse donc en arabe, et
 * pas doucement :</p>
 * <ul>
 *   <li>{@code Math.max(0, scrollLeft)} rend toujours 0 — la timeline du
 *       planning se croyait en permanence au bord du buffer et le faisait
 *       glisser vers le passe a chaque evenement de defilement, en boucle ;</li>
 *   <li>{@code el.scrollLeft = 640} est ecrete a 0 — « Aujourd'hui » et le
 *       recentrage renvoyaient au bord du contenu au lieu de la date visee ;</li>
 *   <li>{@code el.scrollLeft += deltaY} fait reculer la molette au lieu
 *       d'avancer.</li>
 * </ul>
 *
 * <p>Le decalage <i>inline</i> ci-dessous vaut 0 au debut du contenu et croit
 * vers la fin, <b>dans les deux sens d'ecriture</b>. Les calculs de grille
 * (index de jour × largeur de colonne) s'y expriment sans jamais avoir a
 * connaitre la direction : seules la lecture et l'ecriture la connaissent.</p>
 */

/**
 * Decalage depuis le DEBUT du contenu, toujours positif.
 *
 * <p>La valeur absolue absorbe les deux conventions RTL — la moderne
 * (negative) comme l'ancienne WebKit (positive decroissante) — sans avoir a
 * sonder le navigateur.</p>
 */
export function getInlineScroll(el: HTMLElement): number {
  return Math.abs(el.scrollLeft);
}

/** Pose le defileur a `offset` depuis le debut du contenu. */
export function setInlineScroll(el: HTMLElement, offset: number, isRtl: boolean): void {
  el.scrollLeft = isRtl ? -offset : offset;
}

/** Ajoute `delta` au decalage courant — positif = vers la fin du contenu. */
export function nudgeInlineScroll(el: HTMLElement, delta: number, isRtl: boolean): void {
  setInlineScroll(el, getInlineScroll(el) + delta, isRtl);
}

/** Variante animee de {@link setInlineScroll}. */
export function smoothInlineScroll(el: HTMLElement, offset: number, isRtl: boolean): void {
  el.scrollTo({ left: isRtl ? -offset : offset, behavior: 'smooth' });
}

/**
 * Abscisse d'un pointeur DANS un element, comptee depuis son bord de DEBUT.
 *
 * <p>Meme piege que {@link getInlineScroll}, cote souris : `clientX - left`
 * compte depuis le bord gauche physique. Sur une frise qui se lit de droite a
 * gauche, cliquer sur la premiere colonne y donnerait le dernier index — une
 * selection de dates poserait ses bornes a l'oppose du geste.</p>
 */
export function inlineOffsetInRect(clientX: number, rect: DOMRect, isRtl: boolean): number {
  return isRtl ? rect.right - clientX : clientX - rect.left;
}
