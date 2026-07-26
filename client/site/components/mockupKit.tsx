import { useEffect, useState } from 'react';
import { MousePointer2Icon } from 'lucide-react';
import { cn } from '../../src/utils/cn';

/** Boîte à outils partagée des mockups animés (curseur scripté, timelines). */

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(media.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export interface CursorState {
  x: number;
  y: number;
  visible: boolean;
}

export function Cursor({ cursor }: { cursor: CursorState }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute z-40', cursor.visible ? 'opacity-100' : 'opacity-0')}
      style={{
        left: 0,
        top: 0,
        transform: `translate(${cursor.x}px, ${cursor.y}px)`,
        transition: 'transform 800ms cubic-bezier(0.22, 1, 0.36, 1), opacity 250ms ease-out',
      }}
    >
      <MousePointer2Icon className="size-3.5 text-foreground drop-shadow-sm" fill="currentColor" />
    </div>
  );
}

/** Chorégraphe : exécute des étapes datées tant que le mockup est actif. */
export function useTimeline(
  active: boolean,
  build: (at: (ms: number, fn: () => void) => void) => void,
) {
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(() => !cancelled && fn(), ms));
    };
    build(at);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

export function useScriptedCursor(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [cursor, setCursor] = useState<CursorState>({ x: 100, y: 100, visible: false });
  const moveTo = (el: HTMLElement | null, dx = 0, dy = 0) => {
    const container = containerRef.current;
    if (!container || !el) return;
    const c = container.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setCursor({ x: r.left - c.left + r.width / 2 + dx, y: r.top - c.top + r.height / 2 + dy, visible: true });
  };
  const park = () => {
    const container = containerRef.current;
    if (!container) return;
    const c = container.getBoundingClientRect();
    setCursor({ x: c.width * 0.68, y: c.height * 0.86, visible: true });
  };
  const hide = () => setCursor((current) => ({ ...current, visible: false }));
  return { cursor, moveTo, park, hide };
}
