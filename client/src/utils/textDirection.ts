/**
 * Helpers pour adapter la typographie selon la langue du contenu.
 *
 * <p>L'arabe a besoin de ~15-20% plus de taille pour etre aussi lisible que
 * le latin : les caracteres sont plus denses, les diacritiques (tashkeel)
 * fines, et la majorite des polices systeme rendent l'arabe en taille
 * "metric-equivalente" qui apparait visuellement plus petit que prevu.</p>
 *
 * <p>Pattern d'utilisation : detecter sur le contenu (pas sur la prop
 * langue UI) pour gerer les conversations multilingues — l'user peut
 * poser une question en francais et recevoir une reponse arabe (memoire
 * user dit "je prefere l'arabe"), ou inversement.</p>
 */

/**
 * Plages Unicode des scripts arabes (couvre arabic de base, supplements,
 * extended, presentation forms A et B). Ne couvre PAS l'hebreu, persan
 * specifique, etc. — focus sur l'arabe Clenzy (utilisateurs FR/MA/SA).
 */
const ARABIC_UNICODE_RANGES =
  /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

/**
 * Retourne true si le texte contient AU MOINS un caractere arabe.
 * Use case : decider si on doit appliquer dir="rtl" + taille augmentee.
 *
 * <p>Volontairement permissif : meme une seule lettre arabe declenche le
 * traitement RTL, car un melange latin/arabe se rend mieux en RTL avec
 * isolation bidirectionnelle automatique.</p>
 */
export function containsArabic(text: string | null | undefined): boolean {
  if (!text) return false;
  return ARABIC_UNICODE_RANGES.test(text);
}

/**
 * Retourne true si > {@code threshold}% des caracteres non-whitespace sont
 * arabes. Use case : decider si la reponse est "majoritairement arabe"
 * pour appliquer la taille augmentee globale (au lieu d'augmenter aussi
 * la partie latine).
 *
 * @param threshold ratio entre 0 et 1, defaut 0.3 (30%)
 */
export function isArabicHeavy(text: string | null | undefined, threshold = 0.3): boolean {
  if (!text) return false;
  const stripped = text.replace(/\s/g, '');
  if (stripped.length === 0) return false;
  let arabicCount = 0;
  for (const char of stripped) {
    if (ARABIC_UNICODE_RANGES.test(char)) arabicCount++;
  }
  return arabicCount / stripped.length >= threshold;
}

/**
 * Styles sx MUI a appliquer sur un container de texte arabe pour
 * compenser la difference de densite visuelle vs latin.
 *
 * <p>Combine :</p>
 * <ul>
 *   <li>{@code fontSize: 1.18em} : +18% par rapport au parent (relatif pour
 *       composabilite avec headings, body2, etc.)</li>
 *   <li>{@code lineHeight: 1.85} : un peu plus aere que latin (1.55-1.65)
 *       pour eviter que les diacritiques (kasra/fatha/damma) ne touchent
 *       la ligne suivante</li>
 *   <li>{@code fontFamily} : priorise Tahoma/Geeza Pro (system fonts arabes
 *       bien renderees) avant fallback vers la stack system</li>
 *   <li>{@code dir: 'rtl'} : direction du texte (sera applique via prop HTML
 *       a part — voir {@link arabicDirProp})</li>
 * </ul>
 */
export const arabicTextSx = {
  fontSize: '1.18em',
  lineHeight: 1.85,
  fontFamily:
    '"Tahoma", "Geeza Pro", "Arabic Typesetting", "Traditional Arabic", inherit',
};

/**
 * Helper : prop HTML {@code dir} a passer a un element React s'il contient
 * de l'arabe. Retourne 'rtl' ou undefined (laisse heriter).
 */
export function arabicDirProp(text: string | null | undefined): 'rtl' | undefined {
  return containsArabic(text) ? 'rtl' : undefined;
}
