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
import salon from '../assets/photos/salon.jpg';
import riad from '../assets/photos/riad.jpg';
import pool from '../assets/photos/pool.jpg';
import balloon from '../assets/photos/balloon.jpg';
import desert from '../assets/photos/desert.jpg';
import food from '../assets/photos/food.jpg';

/**
 * Livret d'accueil numérique — mockup mobile NEUTRE et photo-riche, dans le
 * design system Baitly (pas de thème éditorial). Le défilement interne du
 * téléphone est piloté par le SCROLL DE LA PAGE : le téléphone reste collé
 * (sticky) pendant que la section défile, et son contenu suit la progression.
 * prefers-reduced-motion : le contenu reste en haut.
 */

const PHONE_W = 300;
const WINDOW_H = 580;

const ESSENTIALS = [
  { icon: WifiIcon, label: 'Wi-Fi', value: 'DUPLEX-BADII' },
  { icon: KeyRoundIcon, label: 'Code d’accès', value: '4821' },
  { icon: ClockIcon, label: 'Arrivée', value: 'dès 15:00' },
  { icon: ClockIcon, label: 'Départ', value: 'avant 11:00' },
];

const SECTIONS = [
  { icon: KeyRoundIcon, title: 'Arrivée & accès', sub: 'Trouver le logement, entrer' },
  { icon: ShieldCheckIcon, title: 'Règlement intérieur', sub: 'Les règles de la maison' },
  { icon: MapPinIcon, title: 'Le quartier', sub: 'Nos adresses autour de vous' },
];

const GALLERY = [riad, pool, salon];

/** Champs de la fiche d'arrivée, remplis un à un au fil du défilement. */
const CHECKIN_FIELDS = [
  { label: 'Nom complet', value: 'Marie Lefebvre' },
  { label: 'Pièce d’identité', value: 'Passeport · 21FR8842' },
  { label: 'Date de naissance', value: '14/03/1991' },
  { label: 'Nationalité', value: 'France' },
];

/* Découpe de la course de scroll : saisie des champs, puis validation du
   formulaire, puis défilement du livret. La porte se franchit d'abord. */
/** Hauteur de la course de scroll : plus elle est grande, plus tout défile
    lentement (4,5 écrans de haut pour l'ensemble du déroulé). */
const SCROLL_RUN = '600vh';

const CHECKIN_PHASE = 0.42; // fin du remplissage des champs
const PRESS_AT = 0.5; // le curseur appuie sur le bouton
const OPENED_AT = 0.56; // formulaire replié, livret accessible

const ACTIVITIES = [
  { img: balloon, title: 'Montgolfière au lever du soleil', price: '1 200 MAD', tag: 'Coup de cœur' },
  { img: desert, title: 'Désert d’Agafay & dîner', price: '650 MAD', tag: null },
  { img: food, title: 'Cours de cuisine marocaine', price: '450 MAD', tag: null },
];

/** Contenu du livret (neutre, design system) — rendu dans le cadre téléphone. */
function GuideContent({ filled, pressing, opened }: { filled: number; pressing: boolean; opened: boolean }) {
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
            <MapPinIcon className="size-3" /> Marrakech · 20 → 25 juillet
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
              <p className="text-xs font-semibold">Complétez votre arrivée</p>
              <p className="text-[10px] leading-snug text-muted-foreground">
                Obligatoire pour accéder au livret
              </p>
            </div>
          </div>
          <div className="mt-2.5 flex flex-col gap-1.5">
            {CHECKIN_FIELDS.map((field, index) => {
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
          {filled >= CHECKIN_FIELDS.length && (
            <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-success/12 px-2 py-1.5">
              <ShieldCheckIcon className="size-3 shrink-0 text-success" />
              <p className="text-[10px] leading-snug text-success">
                Fiche de police transmise à la DGSN — rien à ressaisir pour l’hôte.
              </p>
            </div>
          )}
          <span
            className={cn(
              'mt-2.5 flex w-full items-center justify-center rounded-lg py-2 text-[11px] font-semibold transition-colors duration-300',
              filled >= CHECKIN_FIELDS.length
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground',
              pressing && 'scale-[.97]',
            )}
          >
            {filled >= CHECKIN_FIELDS.length
              ? 'Accéder au livret'
              : `${filled} / ${CHECKIN_FIELDS.length} renseignés`}
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
            <p className="text-xs font-semibold">Votre hôte Amine</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              Bienvenue chez nous ! Installez-vous, tout ce qu’il faut pour un séjour parfait est
              dans ce livret.
            </p>
          </div>
        </div>

        {/* Essentiels */}
        <div>
          <p className="mb-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Les essentiels
          </p>
          <div className="grid grid-cols-2 gap-2">
            {ESSENTIALS.map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-card p-2.5">
                <item.icon className="size-3.5 text-primary" />
                <p className="mt-1.5 text-[10px] text-muted-foreground">{item.label}</p>
                <p className="text-xs font-semibold tabular-nums">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Explorer le livret */}
        <div>
          <p className="mb-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Explorer le livret
          </p>
          <div className="flex flex-col gap-1.5">
            {SECTIONS.map((section) => (
              <div
                key={section.title}
                className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5"
              >
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <section.icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">{section.title}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{section.sub}</p>
                </div>
                <ChevronRightIcon className="size-3.5 text-muted-foreground" />
              </div>
            ))}
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
            Expériences à réserver
          </p>
          <div className="flex flex-col gap-2.5">
            {ACTIVITIES.map((activity) => (
              <div
                key={activity.title}
                className="overflow-hidden rounded-xl border border-border bg-card"
              >
                <div className="relative">
                  <img src={activity.img} alt="" className="h-24 w-full object-cover" loading="lazy" />
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
                    Réserver
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="pt-1 text-center text-[9px] text-muted-foreground">
          Propulsé par <span className="font-semibold text-foreground">Baitly</span>
        </p>
      </div>
    </div>
  );
}

/** Étapes du livret : la courante s'allume au rythme du défilement. */
const STEPS = [
  {
    title: 'Check-in en ligne',
    copy: 'Le voyageur saisit son identité — la fiche de police part toute seule.',
  },
  { title: 'Accueil personnalisé', copy: 'Le mot de l’hôte, une fois l’arrivée validée.' },
  { title: 'Les essentiels', copy: 'Wi-Fi, code d’accès, horaires — sans avoir à les écrire.' },
  { title: 'Le quartier', copy: 'Vos adresses, pas celles d’un guide générique.' },
  { title: 'Expériences à réserver', copy: 'Activités et services, réservables en un geste.' },
];

export default function ScrollGuideSection() {
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
  const filled = Math.min(
    CHECKIN_FIELDS.length,
    Math.floor((Math.min(p, CHECKIN_PHASE) / CHECKIN_PHASE) * (CHECKIN_FIELDS.length + 0.5)),
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
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-4 lg:grid-cols-2">
          {/* Colonne récit : le fil d'étapes se synchronise avec le téléphone */}
          <Reveal>
            <Badge variant="outline">Aperçu</Badge>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
              Le livret que reçoit votre voyageur.
            </h2>
            <p className="mt-3 max-w-md text-muted-foreground">
              Un simple lien, sans application — tout le séjour dans sa poche.
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
                Voir une démo <ArrowRightIcon />
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
              <p className="mt-2 text-[11px] text-muted-foreground">Code d’accès</p>
              <p className="text-lg font-semibold tabular-nums">4821</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Actif du 20 au 25 juillet</p>
            </div>

            <div
              className="shadow-brand absolute -right-8 bottom-10 z-10 hidden w-48 overflow-hidden rounded-2xl border border-border bg-card sm:block"
              style={{ transform: `translateY(${p * 90}px)` }}
            >
              <img src={balloon} alt="" className="h-20 w-full object-cover" loading="lazy" />
              <div className="p-3">
                <p className="text-xs font-semibold">Montgolfière au lever du soleil</p>
                <p className="mt-0.5 text-[11px] font-semibold text-primary-deep tabular-nums">
                  1 200 MAD
                </p>
                <p className="mt-1 flex items-center gap-1 text-[10px] text-success">
                  <SparklesIcon className="size-3" /> Commission reversée
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
