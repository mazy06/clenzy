import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { AGENT_SPEECH_MORPH_MS, agentSpeechOutline, type SpeechTailSide } from './agentSpeechGeometry';

type Shape = { width: number; height: number; x: number; y: number; radius: number; badgeWidth: number; fill: string; stroke: string; tailSide: SpeechTailSide };

/** The same SVG contour grows from the badge and returns to it on dismissal. */
export function AgentSpeechSurface({ anchorRef, open, badge, children }: {
  anchorRef: RefObject<HTMLSpanElement>;
  open: boolean;
  badge: ReactNode;
  children: ReactNode;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const shapeRef = useRef<Shape | null>(null);
  const drawRef = useRef<() => void>(() => {});
  const measureRef = useRef<() => void>(() => {});

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    const anchor = anchorRef.current;
    const popup = surface?.closest<HTMLElement>('[data-slot="popover-content"]');
    if (!surface || !anchor || !popup) return;
    let frame = 0;
    const draw = () => {
      const shape = shapeRef.current;
      if (!shape || !pathRef.current) return;
      pathRef.current.setAttribute('d', agentSpeechOutline(shape.width, shape.height, shape, progress.current, shape.radius, shape.badgeWidth, shape.tailSide));
      const sourceShare = (1 - progress.current) * 100;
      pathRef.current.style.fill = `color-mix(in srgb, ${shape.fill} ${sourceShare}%, var(--bui-card))`;
      // The contour keeps the notification's own border throughout the morph.
      pathRef.current.style.stroke = shape.stroke;
      if (counterRef.current) counterRef.current.style.opacity = String(Math.max(0, 1 - progress.current * 4));
      if (contentRef.current) contentRef.current.style.opacity = String(Math.max(0, (progress.current - .45) / .55));
    };
    drawRef.current = draw;
    const measure = () => {
      // Measure the untransformed popup, not its animated contents.
      const box = popup.getBoundingClientRect();
      const badgeBox = anchor.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const badgeStyle = anchor.firstElementChild ? getComputedStyle(anchor.firstElementChild) : null;
      const opposite: Record<string, SpeechTailSide> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
      const shape = { width: box.width, height: box.height, x: badgeBox.left + badgeBox.width / 2 - box.left, y: badgeBox.top + badgeBox.height / 2 - box.top, radius: badgeBox.height / 2, badgeWidth: badgeBox.width, fill: badgeStyle?.backgroundColor || 'var(--bui-card)', stroke: badgeStyle?.borderColor || 'var(--bui-supervision-line)', tailSide: opposite[popup.dataset.side ?? 'right'] };
      shapeRef.current = shape;
      if (counterRef.current && badgeStyle) counterRef.current.style.color = badgeStyle.color;
      surface.style.setProperty('--speech-anchor-x', `${shape.x}px`);
      surface.style.setProperty('--speech-anchor-y', `${shape.y}px`);
      surface.dataset.ready = 'true';
      draw();
    };
    measureRef.current = measure;
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const resize = new ResizeObserver(schedule);
    resize.observe(popup);
    resize.observe(anchor);
    const placement = new MutationObserver(schedule);
    if (popup.parentElement) placement.observe(popup.parentElement, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      placement.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [anchorRef]);

  useLayoutEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const from = progress.current;
    const to = open ? 1 : 0;
    if (surfaceRef.current) surfaceRef.current.dataset.morphState = open ? 'expanding' : 'contracting';
    let frame = 0;
    let start: number | null = null;
    const animate = (now: number) => {
      // The orbit can rotate while a balloon is closing. Follow its badge
      // every morph frame instead of shrinking toward its former position.
      measureRef.current();
      // Do not start until Popper has placed the bubble and its badge is measured.
      if (!shapeRef.current) { frame = requestAnimationFrame(animate); return; }
      start ??= now;
      const t = reduced.matches ? 1 : Math.min(1, (now - start) / AGENT_SPEECH_MORPH_MS);
      const eased = 1 - (1 - t) ** 4;
      progress.current = from + (to - from) * eased;
      drawRef.current();
      if (t < 1) frame = requestAnimationFrame(animate);
      else if (surfaceRef.current) surfaceRef.current.dataset.morphState = open ? 'expanded' : 'collapsed';
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [open]);

  return (
    <div ref={surfaceRef} className="baitly-agent-speech-surface">
      <svg className="baitly-agent-speech-outline" aria-hidden="true"><path ref={pathRef} /></svg>
      <span ref={counterRef} className="baitly-agent-speech-counter" aria-hidden="true">{badge}</span>
      <div ref={contentRef} className="baitly-agent-speech-copy">{children}</div>
    </div>
  );
}
