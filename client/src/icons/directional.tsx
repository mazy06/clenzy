/**
 * Chevrons de NAVIGATION — « précédent » / « suivant », pas « gauche » / « droite ».
 *
 * <p>Un chevron est un glyphe directionnel : contrairement à une icône neutre, il
 * ne se retourne pas tout seul en RTL. Un `ChevronLeft` posé pour « mois
 * précédent » continue de pointer à gauche en arabe, alors que « précédent » y est
 * à DROITE — la flèche désigne alors le sens opposé à son action, et les paires
 * de boutons semblent pointer vers l'intérieur.</p>
 *
 * <p>Ces deux composants prennent le sens LOGIQUE et choisissent le glyphe selon
 * la direction de lecture. À utiliser partout où le chevron veut dire « l'élément
 * d'avant / d'après » : calendriers, carrousels, galeries, pas à pas. Un chevron
 * qui désigne une vraie direction physique (ouvrir un sous-menu vers la droite de
 * l'écran) garde `ChevronLeft` / `ChevronRight`.</p>
 */
import { ChevronLeft, ChevronRight } from './glyphs';
import type { ComponentProps } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { isRtlLanguage } from '../utils/localeDate';

type ChevronProps = ComponentProps<typeof ChevronLeft>;

/** Chevron « élément précédent » : pointe à gauche en LTR, à droite en RTL. */
export function ChevronPrev(props: ChevronProps) {
  const { currentLanguage } = useTranslation();
  const Glyph = isRtlLanguage(currentLanguage) ? ChevronRight : ChevronLeft;
  return <Glyph {...props} />;
}

/** Chevron « élément suivant » : pointe à droite en LTR, à gauche en RTL. */
export function ChevronNext(props: ChevronProps) {
  const { currentLanguage } = useTranslation();
  const Glyph = isRtlLanguage(currentLanguage) ? ChevronLeft : ChevronRight;
  return <Glyph {...props} />;
}
