import {
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  CalendarDaysIcon,
  CalendarPlusIcon,
  CheckIcon,
  MoveHorizontalIcon,
  ShieldCheckIcon,
  UserRoundCheckIcon,
} from '../../src/icons/glyphs';
import airbnbLogo from '../../src/assets/logo/airbnb-logo-small.svg';
import { useSiteLanguage } from '../lib/siteLanguage';
import { PLANNING_MOCKUP_MESSAGES } from '../lib/messages/planningMockup';
import {
  placePlanningCallout,
  type CalloutRect,
} from './baitlyPlanningCalloutLayout';
import { demoNumber } from '../lib/planningDemoLocale';
import { SITE_PHOTOS } from '../data/baitlyPhotography';

const { planningCity: propertyTerrace } = SITE_PHOTOS;

export interface PlanningAnnotation {
  step: number;
  target: string;
  /** false : la bulle pointe sa cible sans l'encadrer (vue d'ensemble). */
  frame?: boolean;
}

/** Another guided tour reusing the same callout (its own steps and visuals). */
export interface CalloutGuide {
  stepLabel: string;
  steps: readonly { title: string; body: string }[];
  icons: readonly ComponentType[];
  /** Optional picture replacing the icon of a step (photo, logo). */
  media?: (step: number) => ReactNode;
}

const ICONS = [
  CalendarDaysIcon,
  CalendarDaysIcon,
  ShieldCheckIcon,
  MoveHorizontalIcon,
  CalendarPlusIcon,
  UserRoundCheckIcon,
  CalendarDaysIcon,
  UserRoundCheckIcon,
  CheckIcon,
];

export default function BaitlyPlanningCallout({
  annotation,
  stageRef,
  active,
  guide,
}: {
  annotation: PlanningAnnotation;
  stageRef: RefObject<HTMLDivElement>;
  active: boolean;
  guide?: CalloutGuide;
}) {
  const { language } = useSiteLanguage();
  const planning = PLANNING_MOCKUP_MESSAGES[language].guide;
  const m = guide
    ? { step: guide.stepLabel, steps: guide.steps }
    : planning;
  const text = m.steps[annotation.step];
  const Icon = (guide ? guide.icons : ICONS)[annotation.step];
  const media = guide
    ? guide.media?.(annotation.step)
    : annotation.step === 0
      ? <img src={propertyTerrace} alt="" />
      : annotation.step === 1
        ? <img src={airbnbLogo} alt="" className="bpm-guide-channel" />
        : null;
  const cardRef = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<{
    target: CalloutRect & { round?: boolean };
    placement: ReturnType<typeof placePlanningCallout>;
  } | null>(null);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const scroll = stage?.querySelector<HTMLElement>('.bpm-planning-scroll');
    if (!stage || !scroll) return;
    let frame = 0;
    let previous = '';
    let previousWidth = 0;
    const measure = () => {
      const element = stage.querySelector<HTMLElement>(annotation.target);
      const card = cardRef.current;
      if (!card) return;
      if (!element) {
        // Cible disparue (fenêtre fermée, carte traitée) : le cadre et le
        // trait s'effacent aussitôt, la bulle reste en place.
        setGeometry((current) =>
          current && current.target.width > 0
            ? { ...current, target: { ...current.target, width: 0 } }
            : current,
        );
        previous = '';
        return;
      }
      const bounds = stage.getBoundingClientRect();
      const viewport = scroll.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      if (!bounds.width || !rect.width) return;
      const resized = previousWidth !== bounds.width;
      previousWidth = bounds.width;
      const driftedOut =
        rect.left > viewport.right - 60 || rect.right < viewport.left + 60;
      if (
        scroll.scrollWidth > scroll.clientWidth &&
        (resized || (active && driftedOut))
      ) {
        scroll.scrollTo({
          left:
            scroll.scrollLeft +
            rect.left -
            viewport.left +
            rect.width / 2 -
            viewport.width / 2,
          behavior: resized ? 'instant' : 'smooth',
        });
      }
      const local = (r: DOMRect): CalloutRect => ({
        x: r.left - bounds.left,
        y: r.top - bounds.top,
        width: r.width,
        height: r.height,
      });
      const target: CalloutRect & { round?: boolean } = local(rect);
      // Élément rond (nœud d'agent, pastille) : cercle ou pilule, pas un carré.
      const radius = getComputedStyle(element).borderTopLeftRadius;
      target.round =
        radius.endsWith('%')
          ? parseFloat(radius) >= 50
          : parseFloat(radius) * (rect.width / (element.offsetWidth || rect.width)) >=
            Math.min(rect.width, rect.height) / 2 - 1;
      // Focus follows only the part of a wide reservation visible in the calendar.
      const left = Math.max(4, target.x);
      const right = Math.min(bounds.width - 4, target.x + target.width);
      target.x = left;
      target.width = Math.max(0, right - left);
      const obstacles = [
        ...stage.querySelectorAll<HTMLElement>('[data-planning-panel]'),
      ].map((p) => local(p.getBoundingClientRect()));
      const placement = placePlanningCallout(
        bounds,
        target,
        { width: card.offsetWidth, height: card.offsetHeight },
        obstacles,
        bounds.width < 600 ? viewport.bottom - bounds.top + 14 : undefined,
      );
      const next = { target, placement };
      const signature = JSON.stringify(next);
      if (previous !== signature) {
        previous = signature;
        setGeometry(next);
      }
    };
    const follow = () => {
      measure();
      if (active) frame = requestAnimationFrame(follow);
    };
    follow();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    if (cardRef.current) observer.observe(cardRef.current);
    scroll.addEventListener('scroll', measure, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      scroll.removeEventListener('scroll', measure);
    };
  }, [annotation, active, stageRef]);

  return (
    <div
      className="bpm-guide-layer"
      data-guide-step={annotation.step}
      data-playing={active}
    >
      {geometry && geometry.target.width > 0 && (
        <svg className="bpm-guide-link" aria-hidden="true">
          {annotation.frame !== false && <rect
            x={geometry.target.x - 3}
            y={geometry.target.y - 3}
            width={geometry.target.width + 6}
            height={geometry.target.height + 6}
            rx={geometry.target.round ? (Math.min(geometry.target.width, geometry.target.height) + 6) / 2 : 10}
            className="bpm-guide-focus"
          />}
          <path d={geometry.placement.path} />
          <circle
            cx={geometry.placement.from.x}
            cy={geometry.placement.from.y}
            r="4"
          />
        </svg>
      )}
      <div
        className="bpm-guide-position"
        style={{
          visibility: geometry ? 'visible' : 'hidden',
          transform: `translate(${geometry?.placement.x ?? 0}px, ${
            geometry?.placement.y ?? 0
          }px)`,
        }}
      >
        <div
          ref={cardRef}
          className="bpm-guide-card"
          dir={language === 'ar' ? 'rtl' : 'ltr'}
        >
          <div className="bpm-guide-meta">
            {media ?? <Icon />}
            <span>
              {m.step}{' '}
              <bdi dir="ltr">
                <b>{demoNumber(annotation.step + 1, language, { minimumIntegerDigits: 2 })}</b> / {demoNumber(m.steps.length, language)}
              </bdi>
            </span>
          </div>
          <strong>{text.title}</strong>
          <p>{text.body}</p>
          <div className="bpm-guide-progress" aria-hidden="true">
            {m.steps.map((_, index) => (
              <i
                key={index}
                data-current={index === annotation.step}
                data-done={index < annotation.step}
              />
            ))}
          </div>
        </div>
      </div>
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {m.step} {demoNumber(annotation.step + 1, language)}. {text.title}. {text.body}
      </span>
    </div>
  );
}
