import { useLayoutEffect, useRef, useState } from 'react';
import { BInterventionsSectionDemo } from '../../src/modules/admin/design-system/sections-demos';
import ProjectionRuntime from './ProjectionRuntime';
import { Cursor, useReducedMotion, useScriptedCursor, useTimeline } from './mockupKit';

/**
 * Mockup animé — Opérations & ménage. AUCUN écran réinventé : la PROJECTION
 * réelle (BInterventionsSectionDemo) est embarquée à l'échelle, et le curseur
 * scripté filtre les interventions en cliquant les VRAIS chips (Ménage →
 * Maintenance → Check-in/out → tout), la liste se recompose sous les yeux.
 * Conteneur à hauteur fixe → rien ne décale la page.
 * prefers-reduced-motion → projection statique, sans curseur.
 */

const DESIGN_WIDTH = 1240;
const WINDOW_HEIGHT = 540;
const ZOOM = 0.72;

const STEPS = ['Ménage', 'Maintenance', 'Check-in/out'];

export default function AnimatedOpsMockup() {
  const [cycle, setCycle] = useState(0);
  return <OpsScene key={cycle} onCycleEnd={() => setCycle((current) => current + 1)} />;
}

function OpsScene({ onCycleEnd }: { onCycleEnd: () => void }) {
  const reduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(ZOOM);
  const { cursor, moveTo, park, hide } = useScriptedCursor(containerRef);

  useLayoutEffect(() => {
    const measure = () => {
      const width = containerRef.current?.clientWidth ?? DESIGN_WIDTH;
      setScale(Math.min(1, width / DESIGN_WIDTH) * ZOOM);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  /** Retrouve un vrai chip de filtre par son libellé (bouton aria-pressed). */
  const findChip = (label: string) =>
    [...(stageRef.current?.querySelectorAll<HTMLElement>('button[aria-pressed]') ?? [])].find(
      (button) => button.textContent?.includes(label),
    ) ?? null;

  useTimeline(!reduced, (at) => {
    const clickReal = (el: HTMLElement | null) => {
      if (!el) return;
      for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'] as const) {
        const Ctor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
        el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, view: window, button: 0 }));
      }
    };

    at(1500, park);
    STEPS.forEach((label, index) => {
      const base = 3500 + index * 3600;
      at(base, () => moveTo(findChip(label), 0, 1));
      at(base + 900, () => clickReal(findChip(label)));
    });
    // Dernier clic sur le chip actif → désélection (retour à « tout »)
    const resetBase = 3500 + STEPS.length * 3600;
    at(resetBase, () => moveTo(findChip(STEPS[STEPS.length - 1]), 0, 1));
    at(resetBase + 900, () => clickReal(findChip(STEPS[STEPS.length - 1])));
    at(resetBase + 2400, hide);
    at(resetBase + 3400, onCycleEnd);
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
          <span className="ms-3 text-xs text-muted-foreground">app.baitly — Interventions</span>
        </div>
        {/* La PROJECTION réelle, à l'échelle et centrée — hauteur de fenêtre fixe */}
        <div
          className="flex justify-center overflow-hidden bg-background"
          style={{ height: WINDOW_HEIGHT }}
        >
          <div
            ref={stageRef}
            className="projection-stage shrink-0 p-4"
            style={{ width: DESIGN_WIDTH, transform: `scale(${scale})`, transformOrigin: 'top center' }}
          >
            <ProjectionRuntime>
              <BInterventionsSectionDemo />
            </ProjectionRuntime>
          </div>
        </div>
      </div>
      {!reduced && <Cursor cursor={cursor} />}
    </div>
  );
}
