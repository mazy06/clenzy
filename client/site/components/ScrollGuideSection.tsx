import { SiteMoneyText } from './SiteMoney';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowDownIcon,
  ChevronRightIcon,
  ClockIcon,
  KeyRoundIcon,
  MapPinIcon,
  MousePointer2Icon,
  CheckIcon,
  ShieldCheckIcon,
  SparklesIcon,
  WifiIcon,
} from '../../src/icons/glyphs';
import { cn } from '../../src/utils/cn';
import { useSiteLanguage } from '../lib/siteLanguage';
import { GUIDE_MESSAGES } from '../lib/messages/guide';
import { SITE_PHOTOS } from '../data/baitlyPhotography';

const {
  guideLiving: salon,
  guideLivingDetail: riad,
  guideKitchen: pool,
  guideBalloon: balloon,
  guideDinner: desert,
  guideCooking: food,
} = SITE_PHOTOS;

/**
 * Livret d'accueil numérique — mockup mobile NEUTRE et photo-riche, dans le
 * design system Baitly (pas de thème éditorial). Le défilement interne du
 * téléphone est piloté par le SCROLL DE LA PAGE : le téléphone reste collé
 * (sticky) pendant que la section défile, et son contenu suit la progression.
 * Le mode sans animation conserve un téléphone défilable et les étapes au clavier.
 */

/** Icones des essentiels et des sections, dans l'ordre du dictionnaire. */
const ESSENTIAL_ICONS = [WifiIcon, KeyRoundIcon, ClockIcon, ClockIcon];
const SECTION_ICONS = [KeyRoundIcon, ShieldCheckIcon, MapPinIcon];

const GALLERY = [riad, pool];

/* Découpe de la course de scroll : saisie des champs, puis validation du
   formulaire, puis défilement du livret. La porte se franchit d'abord. */
const CHECKIN_PHASE = 0.24;
const PRESS_AT = 0.29;
const OPENED_AT = 0.34;

/** Visuels des activites, dans l'ordre du dictionnaire. */
const ACTIVITY_IMAGES = [balloon, desert, food];

/** Contenu du livret (neutre, design system) — rendu dans le cadre téléphone. */
function GuideContent({
  filled,
  pressing,
  opened,
}: {
  filled: number;
  pressing: boolean;
  opened: boolean;
}) {
  const { language } = useSiteLanguage();
  const m = GUIDE_MESSAGES[language];
  const fields = m.checkinFields;
  return (
    <div className="bg-background pb-6 text-foreground">
      {/* Hero photo */}
      <div className="relative">
        <img
          src={salon}
          alt=""
          className="h-56 w-full object-cover"
          loading="lazy"
        />
        <div className="bsg-photo-shade absolute inset-0" />
        <div className="bsg-photo-caption absolute inset-x-0 bottom-0 p-4">
          <p className="text-[10px] font-medium tracking-wide uppercase opacity-80">
            {m.greeting}
          </p>
          <h3 className="mt-0.5 text-lg leading-tight font-semibold">
            {m.property}
          </h3>
          <p className="mt-1 flex items-center gap-1 text-[11px] opacity-90">
            <MapPinIcon className="size-3" /> {m.stay}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {/* Première visite : le livret est verrouillé tant que l'arrivée n'est
            pas complétée. Une fois validé, le bloc se replie et libère la place. */}
        {!opened && (
          <div data-guide-checkin>
            <div className="relative rounded-xl border border-primary/30 bg-primary-soft/40 p-3">
              <div className="flex items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <ShieldCheckIcon className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold">{m.checkinTitle}</p>
                  <p className="text-[10px] leading-snug text-muted-foreground">
                    {m.checkinSub}
                  </p>
                </div>
              </div>
              <div className="mt-2.5 flex flex-col gap-1.5">
                {fields.map((field, index) => {
                  const done = index < filled;
                  const typing = index === filled;
                  return (
                    <div
                      key={field.label}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 transition-colors duration-200',
                        done
                          ? 'border-border'
                          : typing
                            ? 'border-primary/50'
                            : 'border-dashed border-border',
                      )}
                    >
                      <span className="flex-1 text-[10px] text-muted-foreground">
                        {field.label}
                      </span>
                      {done ? (
                        <>
                          <span className="text-[11px] font-semibold">
                            {field.value}
                          </span>
                          <CheckIcon className="size-3 shrink-0 text-[var(--bl-success)]" />
                        </>
                      ) : (
                        <span
                          className={cn(
                            'h-2.5 rounded-full',
                            typing
                              ? 'w-10 animate-pulse bg-primary/30'
                              : 'w-8 bg-muted',
                          )}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              {filled >= fields.length && (
                <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-success/12 px-2 py-1.5">
                  <ShieldCheckIcon className="size-3 shrink-0 text-[var(--bl-success)]" />
                  <p className="text-[10px] leading-snug text-[var(--bl-success)]">
                    {m.checkinDone}
                  </p>
                </div>
              )}
              <span
                className={cn(
                  'mt-2.5 flex w-full items-center justify-center rounded-lg py-2 text-[11px] font-semibold transition-colors duration-300',
                  filled >= fields.length
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                  pressing && 'scale-[.97]',
                )}
              >
                {filled >= fields.length
                  ? m.openGuide
                  : `${filled} / ${fields.length} ${m.fieldsFilled}`}
              </span>

              {/* Curseur qui vient appuyer sur le bouton, piloté par le scroll */}
              {pressing && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-8 bottom-1.5 flex items-center justify-center"
                >
                  <span className="absolute size-8 rounded-full bg-primary/25" />
                  <MousePointer2Icon
                    className="relative size-4 text-foreground"
                    fill="currentColor"
                  />
                </span>
              )}
            </div>
          </div>
        )}

        {/* Mot de l'hôte */}
        <div
          data-guide-step="1"
          className="flex gap-3 rounded-xl border border-border bg-card p-3"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            A
          </span>
          <div>
            <p className="text-xs font-semibold">{m.hostName}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              {m.hostWord}
            </p>
          </div>
        </div>

        {/* Essentiels */}
        <div data-guide-step="2">
          <p className="mb-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            {m.essentialsTitle}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {m.essentials.map((item, index) => {
              const Icon = ESSENTIAL_ICONS[index];
              return (
                <div
                  key={item.label}
                  className="rounded-xl border border-border bg-card p-2.5"
                >
                  <Icon className="size-3.5 text-primary" />
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="text-xs font-semibold tabular-nums">
                    {item.value}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Explorer le livret */}
        <div data-guide-step="3">
          <p className="mb-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            {m.exploreTitle}
          </p>
          <div className="flex flex-col gap-1.5">
            {m.sections.map((section, index) => {
              const Icon = SECTION_ICONS[index];
              return (
                <div
                  key={section.title}
                  className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5"
                >
                  <span className="flex size-7 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">{section.title}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {section.sub}
                    </p>
                  </div>
                  <ChevronRightIcon className="size-3.5 text-muted-foreground" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Galerie photos */}
        <div className="grid grid-cols-2 gap-1.5">
          {GALLERY.map((img, index) => (
            <img
              key={index}
              src={img}
              alt=""
              className="aspect-square w-full rounded-lg object-cover"
              loading="lazy"
            />
          ))}
        </div>

        {/* Expériences (marketplace) */}
        <div data-guide-step="4">
          <p className="mb-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            {m.activitiesTitle}
          </p>
          <div className="flex flex-col gap-2.5">
            {m.activities.map((activity, index) => (
              <div
                key={activity.title}
                className="overflow-hidden rounded-xl border border-border bg-card"
              >
                <div className="relative">
                  <img
                    src={ACTIVITY_IMAGES[index]}
                    alt=""
                    className="h-24 w-full object-cover"
                    loading="lazy"
                  />
                  {activity.tag && (
                    <span className="bsg-activity-tag absolute top-1.5 start-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-medium">
                      {activity.tag}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">
                      {activity.title}
                    </p>
                    <p className="text-[11px] font-semibold text-primary-deep tabular-nums">
                      <SiteMoneyText>{activity.price}</SiteMoneyText>
                    </p>
                  </div>
                  <span className="rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground">
                    {m.book}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="pt-1 text-center text-[9px] text-muted-foreground">
          {m.poweredBy}{' '}
          <span className="font-semibold text-foreground">Baitly</span>
        </p>
      </div>
    </div>
  );
}

export default function ScrollGuideSection() {
  const { language } = useSiteLanguage();
  const m = GUIDE_MESSAGES[language];
  const wrapperRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [manual, setManual] = useState(false);
  const [manualOffset, setManualOffset] = useState(0);
  const [geometry, setGeometry] = useState({
    maxScroll: 0,
    stops: [0, 0, 0, 0, 0],
    rawStops: [0, 0, 0, 0, 0],
    windowHeight: 580,
    checkinBottom: 0,
  });
  const opened = !manual && progress >= OPENED_AT;

  useEffect(() => {
    const media = window.matchMedia(
      '(prefers-reduced-motion: reduce), (max-height: 620px)',
    );
    const update = () => setManual(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  // Re-measure after the check-in closes, fonts load, or the phone resizes.
  // Subtract its height before closing too, so chapter links target the same
  // point in the page whether the guest form is currently visible or not.
  useLayoutEffect(() => {
    const measure = () => {
      const content = contentRef.current;
      const viewport = viewportRef.current;
      if (!content || !viewport) return;
      const origin = content.getBoundingClientRect().top;
      const checkin = content.querySelector<HTMLElement>(
        '[data-guide-checkin]',
      );
      const removed = checkin ? checkin.offsetHeight + 16 : 0;
      const rawStops = [
        0,
        ...[1, 2, 3, 4].map((step) => {
          const element = content.querySelector<HTMLElement>(
            '[data-guide-step="' + step + '"]',
          );
          return element ? element.getBoundingClientRect().top - origin : 0;
        }),
      ];
      setGeometry({
        windowHeight: viewport.clientHeight,
        checkinBottom: checkin
          ? checkin.getBoundingClientRect().bottom - origin
          : 0,
        maxScroll: Math.max(
          0,
          content.scrollHeight - removed - viewport.clientHeight,
        ),
        rawStops,
        stops: rawStops.map((position, i) =>
          i === 0 ? 0 : Math.max(0, position - removed),
        ),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (contentRef.current) observer.observe(contentRef.current);
    if (viewportRef.current) observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, [language, opened, manual]);

  useEffect(() => {
    if (manual) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const wrapper = wrapperRef.current;
      const stage = stageRef.current;
      if (!wrapper || !stage) return;
      const top = parseFloat(getComputedStyle(stage).top) || 0;
      const distance = wrapper.offsetHeight - stage.offsetHeight;
      setProgress(
        distance > 0
          ? Math.max(
              0,
              Math.min(
                1,
                (top - wrapper.getBoundingClientRect().top) / distance,
              ),
            )
          : 0,
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [manual]);

  const fieldCount = m.checkinFields.length;
  const filled = manual
    ? fieldCount
    : Math.min(
        fieldCount,
        Math.floor(
          (Math.min(progress, CHECKIN_PHASE) / CHECKIN_PHASE) *
            (fieldCount + 0.5),
        ),
      );
  const pressing = !manual && progress >= PRESS_AT && progress < OPENED_AT;
  const offset = manual
    ? 0
    : opened
      ? Math.max(0, (progress - OPENED_AT) / (1 - OPENED_AT)) *
        geometry.maxScroll
      : Math.min(1, progress / PRESS_AT) *
        Math.max(0, geometry.checkinBottom - geometry.windowHeight + 16);
  const readingOffset = manual ? manualOffset : offset;
  const stops = manual ? geometry.rawStops : geometry.stops;
  const active =
    !manual && !opened
      ? 0
      : stops.reduce(
          (chapter, position, index) =>
            (manual || index > 0) &&
            position <= readingOffset + geometry.windowHeight * 0.4
              ? index
              : chapter,
          manual ? 0 : 1,
        );

  const selectStep = (index: number) => {
    const viewport = viewportRef.current;
    const wrapper = wrapperRef.current;
    const stage = stageRef.current;
    if (!viewport || !wrapper || !stage) return;
    if (manual) {
      viewport.scrollTo({
        top: Math.max(0, geometry.rawStops[index] - 20),
        behavior: 'auto',
      });
      return;
    }
    const destination = Math.max(
      0,
      geometry.stops[index] - geometry.windowHeight * 0.2,
    );
    const next =
      index === 0
        ? 0
        : OPENED_AT +
          Math.min(1, destination / Math.max(geometry.maxScroll, 1)) *
            (1 - OPENED_AT);
    const top =
      wrapper.getBoundingClientRect().top +
      window.scrollY -
      (parseFloat(getComputedStyle(stage).top) || 0) +
      next * (wrapper.offsetHeight - stage.offsetHeight);
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <section
      id="livret-demo"
      className="bsg-track"
      ref={wrapperRef}
      data-manual={manual || undefined}
      aria-labelledby="guide-demo-title"
    >
      <div className="bsg-stage" ref={stageRef}>
        <div className="site-shell bsg-layout">
          <div className="bsg-story">
            <p className="bsg-eyebrow">{m.eyebrow}</p>
            <h2 id="guide-demo-title">{m.title}</h2>
            <p className="bsg-intro">{m.intro}</p>
            <ol className="bsg-steps" aria-label={m.chapters}>
              {m.steps.map((step, index) => (
                <li key={step.title}>
                  <button
                    type="button"
                    aria-pressed={index === active}
                    onClick={() => selectStep(index)}
                  >
                    <span className="bsg-step-number">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="bsg-step-label">
                      <strong>{step.title}</strong>
                      <span>{step.copy}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            <p className="bsg-mobile-caption">
              <strong>{m.steps[active].title}</strong>
              {m.steps[active].copy}
            </p>
            <p className="bsg-scroll-hint">
              <ArrowDownIcon size={16} aria-hidden="true" />
              {manual ? m.manualHint : m.scrollHint}
            </p>
            <a className="bsg-skip" href="#livret-services">
              {m.skip}
              <ArrowDownIcon size={15} aria-hidden="true" />
            </a>
          </div>

          <div className="bsg-scene">
            <div className="bsg-orbit" aria-hidden="true" />
            <div
              className="bsg-float bsg-float-access"
              aria-hidden="true"
              style={{
                transform:
                  'translateY(' + (manual ? 0 : progress * -70) + 'px)',
              }}
            >
              <KeyRoundIcon size={18} />
              <p>{m.accessCode}</p>
              <strong>{m.essentials[1].value}</strong>
              <span>{m.accessCodeValidity}</span>
            </div>
            <div
              className="bsg-float bsg-float-experience"
              aria-hidden="true"
              style={{
                transform: 'translateY(' + (manual ? 0 : progress * 50) + 'px)',
              }}
            >
              <img
                src={SITE_PHOTOS.guideBalloonCard}
                alt=""
                width={180}
                height={96}
                loading="lazy"
              />
              <div>
                <strong>{m.activities[0].title}</strong>
                <p>
                  <SiteMoneyText>{m.activities[0].price}</SiteMoneyText>
                </p>
                <span>
                  <SparklesIcon size={12} />
                  {m.commission}
                </span>
              </div>
            </div>

            <div className="bsg-phone">
              <span className="bsg-camera" aria-hidden="true" />
              <div
                className="bsg-viewport"
                ref={viewportRef}
                tabIndex={manual ? 0 : undefined}
                role="region"
                aria-label={m.title}
                onScroll={
                  manual
                    ? (event) => setManualOffset(event.currentTarget.scrollTop)
                    : undefined
                }
              >
                <div
                  ref={contentRef}
                  className="bsg-phone-content"
                  style={{
                    transform: manual
                      ? undefined
                      : 'translateY(' + -offset + 'px)',
                  }}
                >
                  <GuideContent
                    filled={filled}
                    pressing={pressing}
                    opened={opened}
                  />
                </div>
              </div>
            </div>
            <p className="bsg-demo-note">{m.demoNote}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
