import { useLayoutEffect, useRef, type RefObject } from 'react';

/** Attend le vrai défileur, qui peut apparaître après les tarifs et les briques. */
export function useBaitlyPlanningInitialScroll(
  scrollRef: RefObject<HTMLDivElement | null>,
  scrollToAnchor: () => void,
  enabled: boolean,
): void {
  const positioned = useRef(false);
  // Vérification à chaque commit : ref.current ne déclenche pas de rendu.
  useLayoutEffect(() => {
    if (!enabled || !scrollRef.current || positioned.current) return;
    scrollToAnchor();
    positioned.current = true;
  });
}
