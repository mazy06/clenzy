import React, { useEffect, useRef } from 'react';
import { Button } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';

/**
 * Amorces de la rangée du panneau — clés i18n sous {@code assistant.suggestions}.
 *
 * <p>Volontairement courte et FIXE : c'est une barre d'outils, pas une vitrine.
 * Elle doit rester reconnaissable d'une session à l'autre pour qu'on prenne le
 * réflexe d'y aller. Le réservoir large, lui, sert au tirage du survol —
 * cf. {@link ASSISTANT_SUGGESTION_POOL}.</p>
 */
export const ASSISTANT_SUGGESTION_KEYS = [
  'reservations',
  'occupancy',
  'arrivals',
  'guestMessage',
  'compare',
] as const;

/**
 * Réservoir des amorces, dans lequel la bulle de survol du logo tire au sort.
 *
 * <p>Large et varié À DESSEIN : la bulle ne montre que quelques questions à la
 * fois, et le tirage se rejoue à chaque survol. Un réservoir de cinq aurait
 * ressassé les mêmes phrases ; ici on balaie tout le produit — calendrier,
 * tarifs, ménage, finances, voyageurs, canaux — pour montrer l'étendue de ce
 * qu'on peut demander. Les amorces de la rangée du panneau en font partie : ce
 * qu'on lit au survol doit rester lançable d'un clic une fois dedans.</p>
 */
export const ASSISTANT_SUGGESTION_POOL = [
  ...ASSISTANT_SUGGESTION_KEYS,
  'revenue',
  'pricing',
  'gaps',
  'cleaning',
  'unpaid',
  'maintenance',
  'checkouts',
  'topProperty',
  'channels',
  'lastMinute',
] as const;

interface AssistantSuggestionsProps {
  onPick: (prompt: string) => void;
  disabled?: boolean;
}

/**
 * Rangée d'amorces cliquables, entre le fil et le composeur.
 *
 * <p>Permanente, comme dans la projection : ce ne sont pas des suggestions
 * d'état vide mais des raccourcis toujours disponibles — l'assistant reste
 * relançable d'un clic après vingt échanges.</p>
 *
 * <p><b>Une seule ligne, qui défile.</b> Sur plusieurs lignes, la rangée
 * mangeait deux à trois étages de hauteur au fil selon la largeur du panneau,
 * et cette hauteur variait au fil du redimensionnement. Ici elle occupe une
 * ligne, toujours ; les amorces qui dépassent restent atteignables au
 * défilement. L'amorce coupée par le bord est l'indice qu'il y en a d'autres —
 * la barre de défilement est masquée pour ne pas alourdir la rangée.</p>
 */
export const AssistantSuggestions: React.FC<AssistantSuggestionsProps> = ({
  onPick,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Molette verticale → défilement horizontal au survol de la rangée.
  // Listener NATIF non passif : React enregistre ses gestionnaires `wheel` en
  // passif au niveau racine, un preventDefault() posé via onWheel serait ignoré
  // et la page défilerait en même temps que la rangée.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    const handleWheel = (event: WheelEvent) => {
      // Rien à faire défiler : on laisse le geste à la page.
      if (el.scrollWidth <= el.clientWidth) return;
      // Geste déjà horizontal (trackpad, molette inclinable) : le navigateur
      // le traite correctement tout seul.
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      el.scrollLeft += event.deltaY;
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <div
      ref={scrollerRef}
      className="flex shrink-0 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {ASSISTANT_SUGGESTION_KEYS.map((key) => {
        const phrase = t(`assistant.suggestions.${key}`);
        return (
          <Button
            key={key}
            size="xs"
            variant="outline"
            disabled={disabled}
            className="shrink-0 cursor-pointer rounded-full"
            onClick={() => onPick(phrase)}
          >
            {phrase}
          </Button>
        );
      })}
    </div>
  );
};
