import { useEffect, useRef, useState } from 'react';
import {
  ArrowRightIcon,
  ChevronRightIcon,
  ClockIcon,
  KeyRoundIcon,
  MapPinIcon,
  MousePointer2Icon,
  CheckIcon,
  ShieldCheckIcon,
  SparklesIcon,
  WifiIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge, Button } from '../../src/components/ui';
import { cn } from '../../src/utils/cn';
import Reveal from './Reveal';
import salon from '../assets/photos/guesthouse.jpg';
import riad from '../assets/photos/bedroom.jpg';
import pool from '../assets/photos/pool.jpg';
import balloon from '../assets/photos/balloon.jpg';
import desert from '../assets/photos/excursion.jpg';
import food from '../assets/photos/food.jpg';
import { useSiteLanguage } from '../lib/siteLanguage';
import { GUIDE_MESSAGES } from '../lib/messages/guide';

/**
 * Livret d'accueil numérique — mockup mobile NEUTRE et photo-riche, dans le
 * design system Baitly (pas de thème éditorial). Le défilement interne du
 * téléphone est piloté par le SCROLL DE LA PAGE : le téléphone reste collé
 * (sticky) pendant que la section défile, et son contenu suit la progression.
 * prefers-reduced-motion : le contenu reste en haut.
 */

const PHONE_W = 300;
const WINDOW_H = 580;

/** Icones des essentiels et des sections, dans l'ordre du dictionnaire. */
const ESSENTIAL_ICONS = [WifiIcon, KeyRoundIcon, ClockIcon, ClockIcon];
const SECTION_ICONS = [KeyRoundIcon, ShieldCheckIcon, MapPinIcon];

const GALLERY = [riad, pool, salon];



/* Découpe de la course de scroll : saisie des champs, puis validation du
   formulaire, puis défilement du livret. La porte se franchit d'abord. */
/** Hauteur de la course de scroll : plus elle est grande, plus tout défile
    lentement (4,5 écrans de haut pour l'ensemble du déroulé). */
const SCROLL_RUN = '600vh';

const CHECKIN_PHASE = 0.42; // fin du remplissage des champs
const PRESS_AT = 0.5; // le curseur appuie sur le bouton
const OPENED_AT = 0.56; // formulaire replié, livret accessible

/** Visuels des activites, dans l'ordre du dictionnaire. */
const ACTIVITY_IMAGES = [balloon, desert, food];

/** Contenu du livret (neutre, design system) — rendu dans le cadre téléphone. */
function GuideContent({ filled, pressing, opened }: { filled: number; pressing: boolean; opened: boolean }) {
  const { language } = useSiteLanguage();
  const m = GUIDE_MESSAGES[language];
  const fields = m.checkinFields;
  return (
    <div className="bg-background pb-6 text-foreground">
      {/* Hero photo */}
      <div className="relative">
        <img src={salon} alt="" className="h-56 w-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <p className="text-[10px] font-medium tracking-wide uppercase opacity-80">Bienvenue, Marie</p>
          <h3 className="mt-0.5 text-lg leading-tight font-semibold">Duplex Al Badii</h3>
          <p className="mt-1 flex items-center gap-1 text-[11px] opacity-90">
            <MapPinIcon className="size-3" /> {m.stay}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {/* Première visite : le livret est verrouillé tant que l'arrivée n'est
            pas complétée. Une fois validé, le bloc se replie et libère la place. */}
        <div
          className="overflow-hidden transition-all duration-500 ease-out"
          style={{
            maxHeight: opened ? 0 : 460,
            opacity: opened ? 0 : 1,
            marginBottom: opened ? -16 : 0,
          }}
        >
        <div className="relative rounded-xl border border-primary/30 bg-primary-soft/40 p-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheckIcon className="size-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold">{m.checkinTitle}</p>
              <p className="text-[10px] leading-snug text-muted-foreground">{m.checkinSub}</p>
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
                    done ? 'border-border' : typing ? 'border-primary/50' : 'border-dashed border-border',
                  )}
                >
                  <span className="flex-1 text-[10px] text-muted-foreground">{field.label}</span>
                  {done ? (
                    <>
                      <span className="text-[11px] font-semibold">{field.value}</span>
                      <CheckIcon className="size-3 shrink-0 text-success" />
                    </>
                  ) : (
                    <span
                      className={cn(
                        'h-2.5 rounded-full',
                        typing ? 'w-10 animate-pulse bg-primary/30' : 'w-8 bg-muted',
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
          {filled >= fields.length && (
            <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-success/12 px-2 py-1.5">
              <ShieldCheckIcon className="size-3 shrink-0 text-success" />
              <p className="text-[10px] leading-snug text-success">
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
              <span className="absolute size-8 animate-ping rounded-full bg-primary/25" />
              <MousePointer2Icon className="relative size-4 text-foreground" fill="currentColor" />
            </span>
          )}
        </div>
        </div>

        {/* Mot de l'hôte */}
        <div className="flex gap-3 rounded-xl border border-border bg-card p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            A
          </span>
          <div>
            <p className="text-xs font-semibold">{m.hostName}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{m.hostWord}</p>
          </div>
        </div>

        {/* Essentiels */}
        <div>
          <p className="mb-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            {m.essentialsTitle}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {m.essentials.map((item, index) => {
              const Icon = ESSENTIAL_ICONS[index];
              return (
              <div key={item.label} className="rounded-xl border border-border bg-card p-2.5">
                <Icon className="size-3.5 text-primary" />
                <p className="mt-1.5 text-[10px] text-muted-foreground">{item.label}</p>
                <p className="text-xs font-semibold tabular-nums">{item.value}</p>
              </div>
              );
            })}
          </div>
        </div>

        {/* Explorer le livret */}
        <div>
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
                  <p className="truncate text-[10px] text-muted-foreground">{section.sub}</p>
                </div>
                <ChevronRightIcon className="size-3.5 text-muted-foreground" />
              </div>
              );
            })}
          </div>
        </div>

        {/* Galerie photos */}
        <div className="grid grid-cols-3 gap-1.5">
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
        <div>
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
                    <span className="absolute top-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white">
                      {activity.tag}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{activity.title}</p>
                    <p className="text-[11px] font-semibold text-primary-deep tabular-nums">
                      {activity.price}
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
          {m.poweredBy} <span className="font-semibold text-foreground">Baitly</span>
        </p>
      </div>
    </div>
  );
}



export default function ScrollGuideSection() {
  const { language } = useSiteLanguage();
  const m = GUIDE_MESSAGES[language];
  const STEPS = m.steps;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [maxScroll, setMaxScroll] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => {
    const measure = () => setMaxScroll(Math.max(0, (contentRef.current?.scrollHeight ?? 0) - WINDOW_H));
    const timer = window.setTimeout(measure, 500);
    window.addEventListener('resize', measure);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => {
    if (reduced) return;
    const onScroll = () => {
      const el = wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const scrolled = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
      setProgress(total > 0 ? scrolled / total : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [reduced]);

  const p = reduced ? 1 : progress;
  /* Phase 1 — les champs se remplissent ; phase 2 — le livret défile. */
  const fieldCount = m.checkinFields.length;
  const filled = Math.min(
    fieldCount,
    Math.floor((Math.min(p, CHECKIN_PHASE) / CHECKIN_PHASE) * (fieldCount + 0.5)),
  );
  const pressing = p >= PRESS_AT && p < OPENED_AT;
  const opened = p >= OPENED_AT;
  /* Le livret ne défile qu'une fois le formulaire validé et replié. */
  const after = Math.max(0, (p - OPENED_AT) / (1 - OPENED_AT));
  const offset = after * maxScroll;
  /* L'étape courante suit la position réelle, pas un minuteur. */
  const active =
    p < OPENED_AT ? 0 : Math.min(STEPS.length - 1, 1 + Math.floor(after * (STEPS.length - 1)));

  return (
    /* Wrapper haut : crée la course de scroll. Le contenu sticky reste à
       l'écran pendant qu'on la parcourt, et le livret défile en synchro. */
    /* Course longue : l'animation est pilotée par la distance parcourue, pas
       par le temps — l'étirer ralentit tout le déroulé d'autant. */
    <section ref={wrapperRef} className="relative" style={{ height: reduced ? 'auto' : SCROLL_RUN }}>
      <div className="sticky top-16 flex h-[calc(100vh-4rem)] items-center">
        <div className="site-shell grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
          {/* Colonne récit : le fil d'étapes se synchronise avec le téléphone */}
          <Reveal>
            <Badge variant="outline">{m.eyebrow}</Badge>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
              {m.title}
            </h2>
            <p className="mt-3 max-w-md text-muted-foreground">
              {m.intro}
            </p>
            <ol className="mt-7 flex flex-col">
              {STEPS.map((step, index) => {
                const on = index === active;
                return (
                  <li key={step.title} className="flex gap-3.5">
                    <span className="flex flex-col items-center">
                      <span
                        className={cn(
                          'size-2.5 shrink-0 rounded-full transition-all duration-300',
                          on ? 'scale-125 bg-primary' : 'bg-border',
                        )}
                      />
                      {index < STEPS.length - 1 && (
                        <span className="w-px flex-1 bg-border" style={{ minHeight: 42 }} />
                      )}
                    </span>
                    <span className="pb-5">
                      <span
                        className={cn(
                          'block text-sm font-semibold transition-colors duration-300',
                          on ? 'text-foreground' : 'text-muted-foreground/60',
                        )}
                      >
                        {step.title}
                      </span>
                      <span
                        className={cn(
                          'mt-0.5 block text-sm text-muted-foreground transition-opacity duration-300',
                          on ? 'opacity-100' : 'opacity-0',
                        )}
                      >
                        {step.copy}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
            <Button variant="outline" asChild>
              <Link to="/demo">
                {m.cta} <ArrowRightIcon />
              </Link>
            </Button>
          </Reveal>

          {/* Téléphone + cartes détachées qui dérivent en sens opposés */}
          <div className="relative flex justify-center lg:justify-center">
            <div
              className="shadow-brand absolute top-14 -left-2 z-10 hidden w-40 rounded-2xl border border-border bg-card p-3 sm:block"
              style={{ transform: `translateY(${p * -120}px)` }}
            >
              <KeyRoundIcon className="size-4 text-primary" />
              <p className="mt-2 text-[11px] text-muted-foreground">{m.accessCode}</p>
              <p className="text-lg font-semibold tabular-nums">{m.essentials[1].value}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{m.accessCodeValidity}</p>
            </div>

            <div
              className="shadow-brand absolute -right-8 bottom-10 z-10 hidden w-48 overflow-hidden rounded-2xl border border-border bg-card sm:block"
              style={{ transform: `translateY(${p * 90}px)` }}
            >
              <img src={balloon} alt="" className="h-20 w-full object-cover" loading="lazy" />
              <div className="p-3">
                <p className="text-xs font-semibold">{m.activities[0].title}</p>
                <p className="mt-0.5 text-[11px] font-semibold text-primary-deep tabular-nums">
                  {m.activities[0].price}
                </p>
                <p className="mt-1 flex items-center gap-1 text-[10px] text-success">
                  <SparklesIcon className="size-3" /> {m.commission}
                </p>
              </div>
            </div>

            <div
              className="shadow-brand relative shrink-0 rounded-[2.4rem] border-[6px] border-foreground bg-foreground"
              style={{ width: PHONE_W + 12 }}
            >
              <div className="absolute top-2 left-1/2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-foreground" />
              <div className="overflow-hidden rounded-[2rem]" style={{ width: PHONE_W, height: WINDOW_H }}>
                <div
                  ref={contentRef}
                  className={cn('will-change-transform', reduced ? '' : 'transition-transform duration-150 ease-out')}
                  style={{ transform: `translateY(${-offset}px)` }}
                >
                  <GuideContent filled={filled} pressing={pressing} opened={opened} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
