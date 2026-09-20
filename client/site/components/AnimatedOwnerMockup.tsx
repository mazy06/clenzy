import { useLayoutEffect, useRef, useState } from 'react';
import { CheckIcon, DownloadIcon } from 'lucide-react';
import { BOwnerPortalSectionDemo } from '../../src/modules/admin/design-system/screens-demos-2';
import ProjectionRuntime from './ProjectionRuntime';
import { Cursor, useReducedMotion, useScriptedCursor, useTimeline } from './mockupKit';
import { useSiteLanguage } from '../lib/siteLanguage';
import { MOCKUP_MESSAGES } from '../lib/messages/mockups';

/**
 * Mockup animé — Portail propriétaire. AUCUN écran réinventé : la PROJECTION
 * réelle (BOwnerPortalSectionDemo) est embarquée à l'échelle, et le curseur
 * scripté télécharge les relevés mensuels un à un (clic sur les vrais boutons,
 * ripple + toast de confirmation dans la couche mockup).
 * Conteneur à hauteur fixe → rien ne décale la page.
 * prefers-reduced-motion → projection statique, sans curseur.
 */

const DESIGN_WIDTH = 1240;
const WINDOW_HEIGHT = 540;
const ZOOM = 0.74;

/** Trois releves dans la projection ; leurs libelles viennent du DOM. */
const STATEMENT_COUNT = 3;

export default function AnimatedOwnerMockup() {
  const [cycle, setCycle] = useState(0);
  return <OwnerScene key={cycle} onCycleEnd={() => setCycle((current) => current + 1)} />;
}

function OwnerScene({ onCycleEnd }: { onCycleEnd: () => void }) {
  const reduced = useReducedMotion();
  const { language } = useSiteLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(ZOOM);
  const [frameHeight, setFrameHeight] = useState(WINDOW_HEIGHT);
  const [ripple, setRipple] = useState<{ x: number; y: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { cursor, moveTo, park, hide } = useScriptedCursor(containerRef);

  /* La hauteur du cadre suit la projection : figee, elle laissait du vide sous
     un contenu plus court que la fenetre. Un `ResizeObserver` la reprend quand
     la projection grandit (panneau qui s'ouvre, liste qui s'allonge). */
  useLayoutEffect(() => {
    const measure = () => {
      const width = containerRef.current?.clientWidth ?? DESIGN_WIDTH;
      const next = Math.min(1, width / DESIGN_WIDTH) * ZOOM;
      setScale(next);
      const content = stageRef.current?.scrollHeight ?? 0;
      if (content > 0) setFrameHeight(Math.round(content * next));
    };
    measure();
    window.addEventListener('resize', measure);
    const observer = stageRef.current ? new ResizeObserver(measure) : null;
    if (observer && stageRef.current) observer.observe(stageRef.current);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, []);

  /* Le bouton est repere par son INDEX : son libelle change avec la langue,
     sa position dans la liste non. */
  const findDownload = (index: number) =>
    stageRef.current?.querySelector<HTMLElement>(`[data-demo-statement="${index}"]`) ?? null;

  /** Le nom du releve, lu sur la ligne que porte le bouton. */
  const statementLabel = (index: number) =>
    findDownload(index)?.closest('div')?.querySelector('span')?.textContent?.trim() ?? '';

  /** Ripple positionné sur la cible, dans le repère du conteneur. */
  const rippleAt = (el: HTMLElement | null) => {
    const container = containerRef.current;
    if (!container || !el) return;
    const c = container.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setRipple({ x: r.left - c.left + r.width / 2, y: r.top - c.top + r.height / 2 });
    window.setTimeout(() => setRipple(null), 500);
  };

  useTimeline(!reduced, (at) => {
    at(1500, park);
    Array.from({ length: STATEMENT_COUNT }, (_, index) => index).forEach((index) => {
      const base = 3000 + index * 3400;
      at(base, () => moveTo(findDownload(index), 0, 1));
      at(base + 900, () => {
        rippleAt(findDownload(index));
        setToast(statementLabel(index));
      });
      at(base + 2600, () => setToast(null));
    });
    const end = 3000 + STATEMENT_COUNT * 3400;
    at(end + 400, hide);
    at(end + 1400, onCycleEnd);
  });

  return (
    <div className="relative" ref={containerRef}>
      <div className="hero-grid absolute -inset-8 -z-10" aria-hidden />
      <div className="shadow-brand overflow-hidden rounded-xl border border-border bg-card">
        {/* Barre fenêtre */}
        <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="ms-3 text-xs text-muted-foreground">{MOCKUP_MESSAGES[language].windowTitles.owner}</span>
        </div>
        {/* La PROJECTION réelle, à l'échelle et centrée — hauteur de fenêtre fixe */}
        <div
          className="flex justify-center overflow-hidden bg-background"
          style={{ height: frameHeight }}
        >
          <div
            ref={stageRef}
            className="owner-stage shrink-0 p-4"
            style={{ width: DESIGN_WIDTH, transform: `scale(${scale})`, transformOrigin: 'top center' }}
          >
            <ProjectionRuntime>
              <BOwnerPortalSectionDemo />
            </ProjectionRuntime>
          </div>
        </div>
      </div>

      {/* Ripple de clic */}
      {ripple && (
        <span
          aria-hidden
          className="pointer-events-none absolute z-30 size-6 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-primary/30"
          style={{ left: ripple.x, top: ripple.y }}
        />
      )}

      {/* Toast de confirmation (couche mockup, pas la projection) */}
      <div
        aria-hidden
        className={`pointer-events-none absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background shadow-brand transition-all duration-300 ${
          toast ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        }`}
      >
        <CheckIcon className="size-3.5 text-success" />
        {toast} {MOCKUP_MESSAGES[language].windowTitles.downloaded}
        <DownloadIcon className="size-3 opacity-60" />
      </div>

      {!reduced && <Cursor cursor={cursor} />}
    </div>
  );
}
