/* ============================================================
   spawnComet — le « moment comète »

   Quand un agent agit sur une réservation précise, une comète part du
   nœud de l'agent et file vers la cellule du planning correspondante
   (retrouvée via data-reservation-id), qui pulse dans la couleur de
   l'agent. C'est le lien explicite canvas ludique ↔ travail réel.

   Port de `spawnComet` (demo) : overlay position:fixed animé entre les
   deux rects. Sûr en environnement sans rAF / Web Animations (jsdom) :
   l'overlay est tout de même créé puis nettoyé.
   ============================================================ */

export interface SpawnCometArgs {
  sourceEl: Element | null | undefined;
  targetEl: Element | null | undefined;
  color: string; // hex 6 chiffres (#RRGGBB)
  durationMs?: number;
}

const COMET_CLASS = 'supervision-comet';

function pulseTarget(el: Element, color: string): void {
  const node = el as HTMLElement & { animate?: HTMLElement['animate'] };
  if (typeof node.animate !== 'function') return; // jsdom : pas de Web Animations
  node.animate(
    [
      { boxShadow: `0 0 0 0 ${color}b3` },
      { boxShadow: `0 0 0 7px ${color}80`, offset: 0.3 },
      { boxShadow: `0 0 0 0 ${color}00` },
    ],
    { duration: 1000, easing: 'ease' },
  );
}

/** Lance une comète du nœud agent vers la cellule de planning. No-op si l'un manque. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function spawnComet({ sourceEl, targetEl, color, durationMs = 760 }: SpawnCometArgs): void {
  if (!sourceEl || !targetEl || typeof document === 'undefined') return;
  // prefers-reduced-motion : pas d'overlay animé (le travail reste signalé par
  // le satellite « agit » + le journal). Aucune animation déclenchée.
  if (prefersReducedMotion()) return;

  const s = sourceEl.getBoundingClientRect();
  const t = targetEl.getBoundingClientRect();
  const x0 = s.left + s.width / 2;
  const y0 = s.top + s.height / 2;
  const dx = t.left + t.width / 2 - x0;
  const dy = t.top + t.height / 2 - y0;

  const comet = document.createElement('div');
  comet.className = COMET_CLASS;
  Object.assign(comet.style, {
    position: 'fixed',
    left: `${x0}px`,
    top: `${y0}px`,
    width: '13px',
    height: '13px',
    borderRadius: '50%',
    background: color,
    boxShadow: `0 0 16px 5px ${color}d9, -10px 0 14px 2px ${color}66`,
    transform: 'translate(-50%, -50%)',
    transition: `transform ${durationMs}ms cubic-bezier(.45,0,.55,1), opacity ${durationMs}ms ease-in`,
    zIndex: '2000',
    pointerEvents: 'none',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(comet);

  const fly = () => {
    comet.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.5)`;
    comet.style.opacity = '0';
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fly);
  else fly();

  window.setTimeout(() => {
    pulseTarget(targetEl, color);
    comet.remove();
  }, durationMs);
}
