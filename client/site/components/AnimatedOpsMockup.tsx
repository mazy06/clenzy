import { useState, type RefObject } from "react";
import { PauseIcon, PlayIcon } from "../../src/icons/glyphs";
import BInterventionsMapDemo from "../../src/modules/admin/design-system/BInterventionsMapDemo";
import SiteIllustrativeMissionMap from './SiteIllustrativeMissionMap';
import { interventionsMapCopy } from "../../src/modules/admin/design-system/interventionsMapCopy";
import { Cursor, useScriptedCursor, useTimeline } from "./mockupKit";
import { useBaitlyDemoVisibility } from "./useBaitlyDemoVisibility";
import { useSiteLanguage } from "../lib/siteLanguage";
import { MOCKUP_MESSAGES } from "../lib/messages/mockups";

/** Autoplay uses the real controls. Manual input pauses it; offscreen and
 * reduced-motion scenes stay still. Selection persists between animation loops. */
export default function AnimatedOpsMockup() {
  const { visibilityRef, active, reduced } = useBaitlyDemoVisibility();
  const { language, direction } = useSiteLanguage();
  const copy = interventionsMapCopy[language];
  const [playing, setPlaying] = useState(true);
  const [cycle, setCycle] = useState(0);
  const { cursor, moveTo, hide } = useScriptedCursor(visibilityRef, direction);
  const running = active && playing;

  return (
    <div ref={visibilityRef} className="relative" dir={direction}>
      <OpsAutoplay
        key={`${language}-${cycle}`}
        running={running}
        sceneRef={visibilityRef}
        moveTo={moveTo}
        hide={hide}
        onComplete={() => setCycle((value) => value + 1)}
      />
      <div className="shadow-brand overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
          <span className="size-2 rounded-full bg-border" aria-hidden />
          <span className="size-2 rounded-full bg-border" aria-hidden />
          <span className="size-2 rounded-full bg-border" aria-hidden />
          <span className="ms-3 text-xs text-muted-foreground">
            {MOCKUP_MESSAGES[language].windowTitles.ops.replace(" — ", " · ")}
          </span>
        </div>
        <div
          onPointerDown={() => setPlaying(false)}
          onKeyDown={() => setPlaying(false)}
        >
          <BInterventionsMapDemo MapComponent={SiteIllustrativeMissionMap} />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span>{copy.hint}</span>
          {!reduced && (
            <button
              type="button"
              className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
              aria-label={playing ? copy.pause : copy.play}
              onClick={() => setPlaying((value) => !value)}
            >
              {playing ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
            </button>
          )}
        </div>
      </div>
      {running && !reduced && <Cursor cursor={cursor} />}
    </div>
  );
}

function OpsAutoplay({
  running,
  sceneRef,
  moveTo,
  hide,
  onComplete,
}: {
  running: boolean;
  sceneRef: RefObject<HTMLDivElement | null>;
  moveTo: (element: HTMLElement | null) => void;
  hide: () => void;
  onComplete: () => void;
}) {
  useTimeline(running, (at) => {
    const find = (selector: string) =>
      sceneRef.current?.querySelector<HTMLElement>(selector) ?? null;
    // Three markers, three matching missions. Never move a visitor's focus.
    for (let index = 0; index < 3; index += 1) {
      const base = 1800 + index * 3400;
      const selector = `[data-map-property-id="${index + 1}"]`;
      at(base, () => moveTo(find(selector)));
      at(base + 800, () => find(selector)?.click());
    }
    for (let index = 0; index < 3; index += 1) {
      const base = 12500 + index * 3000;
      const selector = `[data-demo-mission="${index}"]`;
      at(base - 100, () => {
        const row = find(selector);
        const list = row?.closest<HTMLElement>("[data-map-list-scroll]");
        if (!row || !list) return;
        // Scroll only the embedded list, never the marketing page.
        const viewport = list.getBoundingClientRect();
        const item = row.getBoundingClientRect();
        if (item.top < viewport.top) list.scrollTop -= viewport.top - item.top;
        else if (item.bottom > viewport.bottom)
          list.scrollTop += item.bottom - viewport.bottom;
      });
      at(base, () => moveTo(find(selector)));
      at(base + 800, () => find(selector)?.click());
    }
    at(21500, hide);
    at(23000, onComplete);
  });
  return null;
}
