import { useLayoutEffect, useRef, useState } from 'react';
import { CheckIcon, DownloadIcon, PauseIcon, PlayIcon } from '../../src/icons/glyphs';
import { OwnersDemo } from './BaitlyProductDemos';
import { BOwnerPortalSectionDemo } from '../../src/modules/admin/design-system/screens-demos-2';
import ProjectionRuntime from './ProjectionRuntime';
import { Cursor, useReducedMotion, useScriptedCursor, useTimeline } from './mockupKit';
import { useBaitlyDemoVisibility } from './useBaitlyDemoVisibility';
import { useSiteLanguage } from '../lib/siteLanguage';
import { BAITLY_PRODUCT_DEMO_MESSAGES } from '../lib/messages/baitlyProductDemos';
import { AGENTS_DEMO_MESSAGES } from '../lib/messages/baitlyAgentsDemo';

/** Static and animated previews share the same statement. Manual input pauses the tour. */
export default function AnimatedOwnerMockup() {
  const { language, direction } = useSiteLanguage();
  const { visibilityRef, active, reduced } = useBaitlyDemoVisibility();
  const [playing, setPlaying] = useState(true);
  const [cycle, setCycle] = useState(0);
  const { cursor, moveTo, hide } = useScriptedCursor(visibilityRef, direction);
  const running = playing && active;
  return <div ref={visibilityRef} className="relative" dir={direction}>
    <OwnerTour key={cycle} active={running} find={(index) => visibilityRef.current?.querySelectorAll<HTMLButtonElement>('.bps-choices button')[index] ?? null}
      moveTo={moveTo} hide={hide} onComplete={() => setCycle(value => value + 1)} />
    <div onPointerDown={() => setPlaying(false)} onKeyDown={() => setPlaying(false)}>
      <OwnersDemo language={language} />
    </div>
    <div className="flex items-center justify-between gap-3 px-3 py-3 text-xs text-muted-foreground">
      <span>{BAITLY_PRODUCT_DEMO_MESSAGES[language].owners.note}</span>
      {!reduced && <button className="bap-icon-button" type="button" aria-label={playing ? AGENTS_DEMO_MESSAGES[language].pause : AGENTS_DEMO_MESSAGES[language].play}
        onClick={() => setPlaying(value => !value)}>{playing ? <PauseIcon size={15} /> : <PlayIcon size={15} />}</button>}
    </div>
    {running && <Cursor cursor={cursor} />}
  </div>;
}

function OwnerTour({ active, find, moveTo, hide, onComplete }: {
  active: boolean; find: (index: number) => HTMLButtonElement | null;
  moveTo: (element: HTMLElement | null) => void; hide: () => void; onComplete: () => void;
}) {
  useTimeline(active, at => {
    [0, 1, 2].forEach(index => {
      at(2200 + index * 3600, () => moveTo(find(index)));
      at(3000 + index * 3600, () => find(index)?.click());
    });
    at(13000, hide);
    at(16500, onComplete);
  });
  return null;
}
