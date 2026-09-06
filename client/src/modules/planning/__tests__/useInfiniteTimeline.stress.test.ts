import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInfiniteTimeline } from '../hooks/useInfiniteTimeline';
import { ZOOM_CONFIGS, BUFFER_MULTIPLIER, PROPERTY_COL_WIDTH } from '../constants';
import type { ZoomLevel } from '../types';

/**
 * Banc de charge du defilement horizontal du planning.
 *
 * <p>Les bugs corriges (sauts de plusieurs mois, defilement fige) ne se
 * manifestaient qu'en RAFALE : un evenement isole se comportait bien, c'est
 * l'enchainement rapide pres d'un bord qui partait en vrille. Un test qui
 * n'envoie qu'un evenement ne les aurait pas vus. Ici on envoie des milliers
 * d'evenements et on verifie une propriete que l'oeil verifie tout seul devant
 * l'ecran : <b>la date sous un point fixe du viewport doit avancer exactement
 * du nombre de jours qu'on a fait defiler</b>. Un glissement non compense la
 * fait bondir d'une fenetre entiere — c'etait exactement le symptome.</p>
 */

const ANCHOR = new Date(2026, 8, 6);
const CLIENT_WIDTH = 1280;
const MS_PER_DAY = 86_400_000;
/** Point de sonde : dans la zone de grille, apres la colonne logements. */
const PROBE_OFFSET = PROPERTY_COL_WIDTH + 200;

/**
 * Element de defilement fidele au vrai : `scrollLeft` est BORNE a
 * [0, contentWidth − clientWidth]. Sans ce bornage le banc validerait des
 * positions qu'un navigateur n'atteint jamais, et raterait justement ce qui se
 * passe aux bords — la ou le bug vivait.
 */
function makeScroller(contentWidth: number) {
  let value = 0;
  const max = Math.max(0, contentWidth - CLIENT_WIDTH);
  return {
    clientWidth: CLIENT_WIDTH,
    scrollTo: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    get scrollLeft() {
      return value;
    },
    set scrollLeft(next: number) {
      value = Math.min(max, Math.max(0, next));
    },
    get maxScroll() {
      return max;
    },
  };
}

type Harness = ReturnType<typeof setup>;

function setup(zoom: ZoomLevel) {
  const { dayWidth, visibleDays } = ZOOM_CONFIGS[zoom];
  const hook = renderHook(
    (props: { zoom: ZoomLevel }) =>
      useInfiniteTimeline({
        anchorDate: ANCHOR,
        zoom: props.zoom,
        dayWidth: ZOOM_CONFIGS[props.zoom].dayWidth,
        propertyColWidth: PROPERTY_COL_WIDTH,
      }),
    { initialProps: { zoom } },
  );

  const windowSize = visibleDays * BUFFER_MULTIPLIER * 2 + 1;
  const el = makeScroller(PROPERTY_COL_WIDTH + windowSize * dayWidth);
  (hook.result.current.scrollRef as { current: unknown }).current = el;

  return { hook, el, dayWidth, visibleDays, windowSize, zoom };
}

/** Date affichee sous le point de sonde, ou null si hors fenetre. */
function dateAtProbe(h: Harness): Date | null {
  const { days } = h.hook.result.current;
  const idx = Math.floor((h.el.scrollLeft + PROBE_OFFSET) / h.dayWidth);
  return idx >= 0 && idx < days.length ? days[idx] : null;
}

function dayDelta(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/**
 * Un « geste » : on pousse le scrollLeft de `delta` px comme le ferait la
 * molette, puis on laisse le hook reagir. Retourne l'ecart entre le deplacement
 * de date CONSTATE et celui ATTENDU d'apres les pixels reellement parcourus.
 */
function gesture(h: Harness, delta: number): { drift: number; slid: boolean } {
  const before = dateAtProbe(h);
  const firstDayBefore = h.hook.result.current.days[0];
  const scrollBefore = h.el.scrollLeft;

  h.el.scrollLeft = scrollBefore + delta;
  const movedPx = h.el.scrollLeft - scrollBefore;

  act(() => {
    h.hook.result.current.handleScroll();
  });

  const after = dateAtProbe(h);
  const slid = h.hook.result.current.days[0].getTime() !== firstDayBefore.getTime();

  if (!before || !after) return { drift: 0, slid };
  return { drift: dayDelta(before, after) - Math.round(movedPx / h.dayWidth), slid };
}

describe('useInfiniteTimeline — charge', () => {
  beforeEach(() => {
    // rAF synchrone : chaque evenement de defilement est evalue, comme le ferait
    // le navigateur sur une frame ou le doigt bouge encore.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => vi.unstubAllGlobals());

  // ── Rafale continue dans une direction ────────────────────────────────────

  it.each(['week', 'fortnight', 'month'] as const)(
    'vue %s : 600 poussees vers le futur, aucune date ne saute',
    (zoom) => {
      const h = setup(zoom);
      let worstDrift = 0;
      let slides = 0;

      for (let i = 0; i < 600; i++) {
        const { drift, slid } = gesture(h, 240);
        worstDrift = Math.max(worstDrift, Math.abs(drift));
        if (slid) slides++;
        expect(h.hook.result.current.days).toHaveLength(h.windowSize);
      }

      // ±1 jour = arrondi de la sonde au pixel pres. Au-dela, c'est un saut.
      expect(worstDrift).toBeLessThanOrEqual(1);

      // Le nombre de glissements doit suivre la distance parcourue, pas le
      // nombre d'evenements : c'est la signature de l'emballement d'origine
      // (un glissement par frame, soit 600 mois avales).
      const expectedSlides = (600 * 240) / (h.visibleDays * h.dayWidth);
      expect(slides).toBeLessThanOrEqual(Math.ceil(expectedSlides) + 2);
    },
  );

  it.each(['week', 'fortnight', 'month'] as const)(
    'vue %s : 600 poussees vers le passe, aucune date ne saute',
    (zoom) => {
      const h = setup(zoom);
      // Partir du milieu pour avoir de la marge dans les deux sens.
      h.el.scrollLeft = h.el.maxScroll / 2;
      let worstDrift = 0;

      for (let i = 0; i < 600; i++) {
        worstDrift = Math.max(worstDrift, Math.abs(gesture(h, -240).drift));
        expect(h.hook.result.current.days).toHaveLength(h.windowSize);
      }

      expect(worstDrift).toBeLessThanOrEqual(1);
    },
  );

  // ── Rafale erratique (va-et-vient, inertie) ───────────────────────────────

  it('marche aleatoire de 2000 gestes en vue Mois', () => {
    const h = setup('month');
    // Generateur deterministe : un echec doit etre rejouable.
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    let worstDrift = 0;
    for (let i = 0; i < 2000; i++) {
      // Amplitudes melangees : micro-ajustements et flings violents.
      const delta = Math.round((rand() * 2 - 1) * 1400);
      worstDrift = Math.max(worstDrift, Math.abs(gesture(h, delta).drift));

      const { days } = h.hook.result.current;
      expect(days).toHaveLength(h.windowSize);
      expect(Number.isNaN(days[0].getTime())).toBe(false);
      expect(h.el.scrollLeft).toBeGreaterThanOrEqual(0);
      expect(h.el.scrollLeft).toBeLessThanOrEqual(h.el.maxScroll);
    }

    expect(worstDrift).toBeLessThanOrEqual(1);
  });

  // ── Martelage sur place, colle au bord ────────────────────────────────────

  it('500 evenements colles au bord gauche ne font glisser qu\'a la demande', () => {
    const h = setup('month');
    const firstDay = h.hook.result.current.days[0];

    // scrollLeft reste a 0 : le navigateur borne, l'utilisateur pousse dans le
    // vide. C'est le cas qui bouclait — la condition de bord restait vraie et
    // relancait un glissement a chaque frame.
    for (let i = 0; i < 500; i++) {
      act(() => h.hook.result.current.handleScroll());
    }

    const drift = Math.abs(dayDelta(firstDay, h.hook.result.current.days[0]));
    // Un seul glissement au total : apres compensation, le bord n'est plus la.
    expect(drift).toBe(h.visibleDays);
    expect(h.hook.result.current.days).toHaveLength(h.windowSize);
  });

  it('500 evenements colles au bord droit ne font glisser qu\'a la demande', () => {
    const h = setup('month');
    h.el.scrollLeft = h.el.maxScroll;
    const firstDay = h.hook.result.current.days[0];

    for (let i = 0; i < 500; i++) {
      act(() => h.hook.result.current.handleScroll());
    }

    expect(Math.abs(dayDelta(firstDay, h.hook.result.current.days[0]))).toBe(h.visibleDays);
    expect(h.hook.result.current.days).toHaveLength(h.windowSize);
  });

  // ── Changement d'echelle sous la rafale ───────────────────────────────────

  it('alterner l\'echelle en plein defilement garde une fenetre coherente', () => {
    const zooms: ZoomLevel[] = ['month', 'week', 'fortnight', 'month', 'week'];
    const h = setup('month');

    for (const zoom of zooms) {
      act(() => h.hook.rerender({ zoom }));

      const { dayWidth, visibleDays } = ZOOM_CONFIGS[zoom];
      const expectedSize = visibleDays * BUFFER_MULTIPLIER * 2 + 1;
      expect(h.hook.result.current.days).toHaveLength(expectedSize);

      // Le scroller suit la nouvelle largeur de contenu, comme le ferait le DOM.
      const next = makeScroller(PROPERTY_COL_WIDTH + expectedSize * dayWidth);
      next.scrollLeft = next.maxScroll / 2;
      (h.hook.result.current.scrollRef as { current: unknown }).current = next;
      Object.assign(h, { el: next, dayWidth, visibleDays, windowSize: expectedSize });

      let worstDrift = 0;
      for (let i = 0; i < 200; i++) {
        worstDrift = Math.max(worstDrift, Math.abs(gesture(h, 300).drift));
      }
      expect(worstDrift).toBeLessThanOrEqual(1);
    }
  });

  // ── Derive de la fenetre ──────────────────────────────────────────────────

  it('la fenetre revient a son point de depart apres un aller-retour', () => {
    const h = setup('fortnight');
    h.el.scrollLeft = h.el.maxScroll / 2;
    const firstDayBefore = h.hook.result.current.days[0];

    for (let i = 0; i < 400; i++) gesture(h, 320);
    for (let i = 0; i < 400; i++) gesture(h, -320);

    // Aller puis retour de la meme distance : la fenetre doit retomber sur ses
    // pieds a une fenetre visible pres (le glissement est quantifie).
    const drift = Math.abs(dayDelta(firstDayBefore, h.hook.result.current.days[0]));
    expect(drift).toBeLessThanOrEqual(h.visibleDays);
  });
});
