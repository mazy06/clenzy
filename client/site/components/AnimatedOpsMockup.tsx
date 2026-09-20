import { useLayoutEffect, useRef, useState } from 'react';
import { BInterventionsSectionDemo } from '../../src/modules/admin/design-system/sections-demos';
import ProjectionRuntime from './ProjectionRuntime';
import { Cursor, useReducedMotion, useScriptedCursor, useTimeline } from './mockupKit';
import { useSiteLanguage } from '../lib/siteLanguage';
import { MOCKUP_MESSAGES } from '../lib/messages/mockups';

/**
 * Mockup animé — Opérations & ménage. AUCUN écran réinventé : la PROJECTION
 * réelle (BInterventionsSectionDemo) est embarquée à l'échelle, et le curseur
 * scripté filtre les interventions en cliquant les VRAIS chips (Ménage →
 * Maintenance → Check-in/out → tout), la liste se recompose sous les yeux.
 * Conteneur à hauteur fixe → rien ne décale la page.
 * prefers-reduced-motion → projection statique, sans curseur.
 */

/* La vue carte se compose en DEUX colonnes, pas en pleine largeur d'ecran :
   la dessiner sur 1240 px puis la reduire a 55 % rendait tout illisible. Une
   largeur de conception proche de celle du cadre la laisse a son echelle. */
const DESIGN_WIDTH = 880;
const WINDOW_HEIGHT = 420;
const ZOOM = 1;

/** La vue carte : cinq marqueurs, trois missions dans le panneau. */
const PIN_COUNT = 5;
const MISSION_COUNT = 3;

export default function AnimatedOpsMockup() {
  const [cycle, setCycle] = useState(0);
  return <OpsScene key={cycle} onCycleEnd={() => setCycle((current) => current + 1)} />;
}

function OpsScene({ onCycleEnd }: { onCycleEnd: () => void }) {
  const reduced = useReducedMotion();
  const { language } = useSiteLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(ZOOM);
  const [frameHeight, setFrameHeight] = useState(WINDOW_HEIGHT);
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

  /* Repere par attribut : la vue carte n'a plus de puces de filtre, et ses
     libelles changent avec la langue. */
  const find = (selector: string) =>
    stageRef.current?.querySelector<HTMLElement>(selector) ?? null;

  useTimeline(!reduced, (at) => {
    const clickReal = (el: HTMLElement | null) => {
      if (!el) return;
      for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'] as const) {
        const Ctor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
        el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, view: window, button: 0 }));
      }
    };

    at(1500, park);
    /* Le geste de cet ecran : parcourir les marqueurs de la carte, puis les
       missions que le panneau liste pour la zone visible. */
    for (let index = 0; index < PIN_COUNT; index += 1) {
      const base = 3000 + index * 1600;
      at(base, () => moveTo(find(`[data-demo-pin="${index}"]`), 0, 1));
      at(base + 700, () => clickReal(find(`[data-demo-pin="${index}"]`)));
    }
    const panelBase = 3000 + PIN_COUNT * 1600;
    for (let index = 0; index < MISSION_COUNT; index += 1) {
      const base = panelBase + index * 2000;
      at(base, () => moveTo(find(`[data-demo-mission="${index}"]`), 0, 1));
      at(base + 800, () => clickReal(find(`[data-demo-mission="${index}"]`)));
    }
    const end = panelBase + MISSION_COUNT * 2000;
    at(end + 600, hide);
    at(end + 1600, onCycleEnd);
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
          <span className="ms-3 text-xs text-muted-foreground">{MOCKUP_MESSAGES[language].windowTitles.ops}</span>
        </div>
        {/* La PROJECTION réelle, à l'échelle et centrée — hauteur de fenêtre fixe */}
        <div
          className="flex justify-center overflow-hidden bg-background"
          style={{ height: frameHeight }}
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
