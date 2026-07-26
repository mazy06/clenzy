import { useLayoutEffect, useRef, useState } from 'react';
import { BIotSectionDemo } from '../../src/modules/admin/design-system/iot-demo';
import { Cursor, useReducedMotion, useScriptedCursor, useTimeline } from './mockupKit';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.9);
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

  /** Retrouve un vrai onglet de la projection par son libellé. */
  const findTab = (label: string) =>
    [...(stageRef.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])].find((tab) =>
      tab.textContent?.includes(label),
    ) ?? null;

  /** Retrouve un vrai bouton de la projection par son libellé. */
  const findButton = (label: string) =>
    [...(stageRef.current?.querySelectorAll<HTMLElement>('button') ?? [])].find((button) =>
      button.textContent?.trim().startsWith(label),
    ) ?? null;

  useTimeline(!reduced, (at) => {
    /* Radix (Tabs…) s'active au mousedown : on rejoue la séquence pointeur
       complète, pas un simple click(). */
    const clickReal = (el: HTMLElement | null) => {
      if (!el) return;
      for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'] as const) {
        const Ctor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
        el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, view: window, button: 0 }));
      }
    };

    at(1500, park);
    // → Capteur de bruit (chart 24 h + seuils, l'écran réel de la projection)
    at(4500, () => moveTo(findTab('Capteur de bruit'), 0, 1));
    at(5500, () => clickReal(findTab('Capteur de bruit')));
    // → Serrure connectée
    at(11500, () => moveTo(findTab('Serrure connectée'), 0, 1));
    at(12500, () => clickReal(findTab('Serrure connectée')));
    // Déverrouiller (vrai bouton, vrai état de la projection)…
    at(15000, () => moveTo(findButton('Déverrouiller'), -6, 1));
    at(16000, () => clickReal(findButton('Déverrouiller')));
    // …puis re-verrouiller
    at(19000, () => moveTo(findButton('Verrouiller'), -6, 1));
    at(20000, () => clickReal(findButton('Verrouiller')));
    // → Vidéosurveillance (mur de dalles)
    at(23500, () => moveTo(findTab('Vidéosurveillance'), 0, 1));
    at(24500, () => clickReal(findTab('Vidéosurveillance')));
    // → Retour au parc d'objets, fin de cycle
    at(30500, () => moveTo(findTab("Parc d'objets"), 0, 1));
    at(31500, () => clickReal(findTab("Parc d'objets")));
    at(33500, hide);
    at(35000, onCycleEnd);
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
          <span className="ms-3 text-xs text-muted-foreground">app.baitly — Objets connectés</span>
        </div>
        {/* La PROJECTION réelle, à l'échelle — hauteur de fenêtre fixe,
            stage dézoomé et centré horizontalement. */}
        <div
          className="flex justify-center overflow-hidden bg-background"
          style={{ height: WINDOW_HEIGHT }}
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
