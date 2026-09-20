import { useLayoutEffect, useRef, useState } from 'react';
import { BIotSectionDemo } from '../../src/modules/admin/design-system/iot-demo';
import { Cursor, useReducedMotion, useScriptedCursor, useTimeline } from './mockupKit';
import { useSiteLanguage } from '../lib/siteLanguage';
import { MOCKUP_MESSAGES } from '../lib/messages/mockups';

/**
 * Mockup animé — Objets connectés. AUCUN écran réinventé : la PROJECTION
 * réelle de la galerie (BIotSectionDemo) est embarquée à l'échelle dans une
 * fenêtre, et le curseur scripté clique ses VRAIS onglets et boutons
 * (Capteur de bruit → Serrure connectée → verrouillage → Vidéosurveillance).
 * Le conteneur est à hauteur fixe : rien ne décale la page.
 * prefers-reduced-motion → projection statique, sans curseur.
 */

const DESIGN_WIDTH = 1240;
const WINDOW_HEIGHT = 540;
/* Zoom arrière volontaire (< 1) : la grille de KPIs de la projection se replie
   en 2 colonnes sur viewport étroit et mange toute la hauteur ; on dézoome pour
   révéler onglets + contenu sous les KPIs. */
const ZOOM = 0.82;

export default function AnimatedIotMockup() {
  const [cycle, setCycle] = useState(0);
  return <IotScene key={cycle} onCycleEnd={() => setCycle((current) => current + 1)} />;
}

function IotScene({ onCycleEnd }: { onCycleEnd: () => void }) {
  const reduced = useReducedMotion();
  const { language } = useSiteLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.9);
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

  /** Repere un element de la projection par son attribut de demonstration. */
  const find = (selector: string) =>
    stageRef.current?.querySelector<HTMLElement>(selector) ?? null;

  useTimeline(!reduced, (at) => {
    /* Radix s'active au mousedown : on rejoue la sequence pointeur complete,
       pas un simple click(). */
    const clickReal = (el: HTMLElement | null) => {
      if (!el) return;
      for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'] as const) {
        const Ctor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
        el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, view: window, button: 0 }));
      }
    };

    at(1500, park);
    // Filtrer le parc sur les serrures — le geste qui a remplace les onglets.
    at(4000, () => moveTo(find('[data-demo-filters] button:nth-of-type(2)'), 0, 1));
    at(5000, () => clickReal(find('[data-demo-filters] button:nth-of-type(2)')));
    // Ouvrir une serrure : dans l'application, la carte mene a son ecran.
    at(8000, () => moveTo(find('[data-demo-device="lock"]'), 0, 1));
    at(9000, () => clickReal(find('[data-demo-device="lock"]')));
    // Deverrouiller, puis re-verrouiller — vrais boutons, vrai etat.
    at(12000, () => moveTo(find('[data-demo-action="unlock"]'), -6, 1));
    at(13000, () => clickReal(find('[data-demo-action="unlock"]')));
    at(16000, () => moveTo(find('[data-demo-action="lock"]'), -6, 1));
    at(17000, () => clickReal(find('[data-demo-action="lock"]')));
    // Revenir au parc entier, puis ouvrir un capteur de bruit.
    at(20000, () => moveTo(find('[data-demo-filters] button:nth-of-type(1)'), 0, 1));
    at(21000, () => clickReal(find('[data-demo-filters] button:nth-of-type(1)')));
    at(24000, () => moveTo(find('[data-demo-device="noise"]'), 0, 1));
    at(25000, () => clickReal(find('[data-demo-device="noise"]')));
    at(30000, hide);
    at(32000, onCycleEnd);
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
          <span className="ms-3 text-xs text-muted-foreground">{MOCKUP_MESSAGES[language].windowTitles.iot}</span>
        </div>
        {/* La PROJECTION réelle, à l'échelle — hauteur de fenêtre fixe,
            stage dézoomé et centré horizontalement. */}
        <div
          className="flex justify-center overflow-hidden bg-background"
          style={{ height: frameHeight }}
        >
          <div
            ref={stageRef}
            className="iot-stage shrink-0 p-4"
            style={{
              width: DESIGN_WIDTH,
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
            }}
          >
            <BIotSectionDemo />
          </div>
        </div>
      </div>
      {!reduced && <Cursor cursor={cursor} />}
    </div>
  );
}
