import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDaysIcon, PauseIcon, PlayIcon } from '../../src/icons/glyphs';
import { SITE_PHOTOS, sitePhotoAlt } from '../data/baitlyPhotography';
import heroPhotoSmall from '../assets/photos/editorial/homeReceptionBaitly-720.webp';
import { HOME_MESSAGES } from '../lib/messages/home';
import { AGENTS_DEMO_MESSAGES } from '../lib/messages/baitlyAgentsDemo';
import { useSiteLanguage } from '../lib/siteLanguage';
import { useBaitlyDemoVisibility } from './useBaitlyDemoVisibility';
import { FRAME_WIDTH, PLANNING_FRAME_HEIGHT, PlanningScene } from './AnimatedPlanningMockup';
import { AGENTS_FRAME_HEIGHT, AgentsScene } from './BaitlyAgentsPlanningDemo';

type ScreenMode = 'planning' | 'agents';
const ignore = () => {};
const FRAME_DOCUMENT = '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>';

/** Project the two native canvases onto the four inner corners of the monitor.
 * Coordinates belong to the 1254 × 1254 photograph, so they never mirror in RTL.
 * Corners: (447,410), (1127,389), (1117,829), (436,786).
 */
function screenProjection(height: number) {
  return `matrix3d(${[
    516.46913387 / FRAME_WIDTH, -77.44499284 / FRAME_WIDTH, 0, -0.1451028093 / FRAME_WIDTH,
    -12.56923385 / height, 373.17106009 / height, 0, -0.0035991602 / height,
    0, 0, 1, 0,
    447, 410, 0, 1,
  ].join(',')})`;
}

/** An isolated document keeps scripted cursor/overlay coordinates independent
 * of the photograph's perspective. React portals preserve language and currency.
 * No second application, script, narration or network API runs in this frame.
 */
export default function BaitlyHeroPlanningPhoto() {
  const { language, direction } = useSiteLanguage();
  const m = HOME_MESSAGES[language].hero;
  const { visibilityRef, active, reduced } = useBaitlyDemoVisibility();
  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState<ScreenMode>('planning');
  const [frameDocument, setFrameDocument] = useState<Document | null>(null);
  const preparing = useRef<Document | null>(null);
  const clockRef = useRef(() => 0);
  const playing = active;
  const height = mode === 'planning' ? PLANNING_FRAME_HEIGHT : AGENTS_FRAME_HEIGHT;

  useEffect(() => {
    if (active) setStarted(true);
    if (reduced) {
      setFrameDocument(null);
      preparing.current = null;
    }
  }, [active, reduced]);

  useEffect(() => {
    const photo = visibilityRef.current;
    if (!photo) return;
    const measure = () => photo.style.setProperty('--hero-photo-scale', String(photo.clientWidth / 1254));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(photo);
    return () => observer.disconnect();
  }, [visibilityRef]);

  useEffect(() => {
    if (frameDocument) {
      frameDocument.documentElement.lang = language;
      frameDocument.documentElement.dir = direction;
    }
  }, [frameDocument, language, direction]);

  async function prepareFrame(event: SyntheticEvent<HTMLIFrameElement>) {
    const frame = event.currentTarget;
    const doc = frame.contentDocument;
    if (!doc || preparing.current === doc) return;
    preparing.current = doc;
    doc.documentElement.lang = language;
    doc.documentElement.dir = direction;
    doc.body.className = 'baitly-marketing';
    doc.body.setAttribute('inert', '');
    const base = doc.createElement('base');
    base.href = document.baseURI;
    doc.head.append(base);
    // Reuse the already cached site styles, including Vite's development styles.
    const styles = Array.from(document.head.querySelectorAll<HTMLStyleElement | HTMLLinkElement>('style, link[rel="stylesheet"]'));
    const loaded = await Promise.all(styles.map((source) => new Promise<boolean>((resolve) => {
      const copy = source.cloneNode(true) as HTMLStyleElement | HTMLLinkElement;
      if (copy instanceof HTMLLinkElement) {
        copy.href = (source as HTMLLinkElement).href;
        copy.onload = () => resolve(true);
        copy.onerror = () => resolve(false);
      }
      doc.head.append(copy);
      if (source.tagName === 'STYLE') resolve(true);
    })));
    if (!frame.isConnected || frame.contentDocument !== doc || loaded.includes(false)) return;
    const reset = doc.createElement('style');
    reset.textContent = 'html, body { margin: 0 !important; padding: 0 !important; min-width: 0; overflow: hidden !important; }';
    doc.head.append(reset);
    setFrameDocument(doc);
  }

  const sceneProps = {
    active: playing,
    reduced,
    clockRef,
    onNarrate: ignore,
    onAnnotationChange: ignore,
    onCycleEnd: () => setMode((current) => current === 'planning' ? 'agents' : 'planning'),
  };

  return (
    <div ref={visibilityRef} className="baitly-hero-image">
      <img
        className="baitly-hero-photo"
        src={SITE_PHOTOS.homeHero}
        srcSet={`${heroPhotoSmall} 720w, ${SITE_PHOTOS.homeHero} 1254w`}
        sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1440px) 48vw, 680px"
        alt={sitePhotoAlt('homeHero', language)}
        width="1254"
        height="1254"
        {...{ fetchpriority: 'high' }}
      />
      {started && !reduced && (
        <div className="baitly-hero-screen-layer" aria-hidden="true">
          <div className="baitly-hero-screen-canvas">
            <iframe
              className="baitly-hero-screen"
              data-ready={Boolean(frameDocument)}
              data-mode={mode}
              data-playing={playing}
              title={m.screenLabel}
              tabIndex={-1}
              sandbox="allow-same-origin"
              srcDoc={FRAME_DOCUMENT}
              width={FRAME_WIDTH}
              height={height}
              style={{ transform: screenProjection(height) }}
              onLoad={(event) => { void prepareFrame(event); }}
            />
          </div>
        </div>
      )}
      {frameDocument && !reduced && createPortal(
        <div className="bad-demo baitly-hero-screen-demo" data-playing={playing}>
          {mode === 'planning' ? (
            <PlanningScene key={`planning-${language}`} {...sceneProps} onSceneChange={ignore} />
          ) : (
            <AgentsScene key={`agents-${language}`} {...sceneProps} m={AGENTS_DEMO_MESSAGES[language]} />
          )}
        </div>,
        frameDocument.body,
      )}
      <div className="baitly-photo-location">
        <CalendarDaysIcon aria-hidden="true" />
        {m.photoCaption}
      </div>
    </div>
  );
}
