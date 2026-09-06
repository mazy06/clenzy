import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInfiniteTimeline } from '../hooks/useInfiniteTimeline';
import { ZOOM_CONFIGS, BUFFER_MULTIPLIER } from '../constants';
import { toDateStr } from '../utils/dateUtils';
import type { ZoomLevel } from '../types';

/**
 * Faux element de defilement : `scrollLeft` est une vraie valeur mutable, ce
 * que jsdom ne fournit pas (il rend toujours 0). C'est precisement la grandeur
 * que le hook doit corriger apres un glissement.
 */
function attachScroller(
  ref: React.RefObject<HTMLDivElement | null>,
  { clientWidth, scrollLeft }: { clientWidth: number; scrollLeft: number },
) {
  const el = {
    scrollLeft,
    clientWidth,
    scrollTo: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  (ref as { current: unknown }).current = el;
  return el;
}

const ANCHOR = new Date(2026, 8, 6); // 6 septembre 2026
const PROPERTY_COL = 188;

function setup(zoom: ZoomLevel) {
  const { dayWidth } = ZOOM_CONFIGS[zoom];
  const hook = renderHook(() =>
    useInfiniteTimeline({ anchorDate: ANCHOR, zoom, dayWidth, propertyColWidth: PROPERTY_COL }),
  );
  return { hook, dayWidth, visibleDays: ZOOM_CONFIGS[zoom].visibleDays };
}

describe('useInfiniteTimeline', () => {
  beforeEach(() => {
    // rAF synchrone : le hook n'evalue le glissement qu'une fois par frame.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Taille de la fenetre ──────────────────────────────────────────────────

  it.each(['week', 'fortnight', 'month'] as const)(
    'garde une fenetre de taille constante en vue %s',
    (zoom) => {
      const { hook, visibleDays } = setup(zoom);
      const expected = visibleDays * BUFFER_MULTIPLIER * 2 + 1;

      expect(hook.result.current.days).toHaveLength(expected);

      const el = attachScroller(hook.result.current.scrollRef, {
        clientWidth: 1300,
        scrollLeft: 0,
      });
      act(() => hook.result.current.handleScroll());

      // Le glissement decale la fenetre, il ne l'agrandit pas : c'est ce qui
      // garde constants le cout de rendu et le nombre de tranches chargees.
      expect(hook.result.current.days).toHaveLength(expected);
      expect(el.scrollLeft).toBeGreaterThan(0);
    },
  );

  // ── Le bug : sauts de plusieurs mois / defilement fige ────────────────────

  it('rend au scrollLeft ce que le glissement vers le passe lui prend', () => {
    const { hook, dayWidth, visibleDays } = setup('month');
    const firstDayBefore = hook.result.current.days[0];

    // Bord gauche : sous le seuil de declenchement (7 jours).
    const el = attachScroller(hook.result.current.scrollRef, {
      clientWidth: 1300,
      scrollLeft: 2 * dayWidth,
    });

    act(() => hook.result.current.handleScroll());

    const firstDayAfter = hook.result.current.days[0];
    // La fenetre a bien recule d'une fenetre visible…
    expect(toDateStr(firstDayAfter)).toBe(
      toDateStr(new Date(firstDayBefore.getTime() - visibleDays * 86_400_000)),
    );
    // …et le scrollLeft a ete corrige d'autant. Sans cette compensation, la
    // grille sautait d'un mois entier a chaque evenement de defilement.
    expect(el.scrollLeft).toBe(2 * dayWidth + visibleDays * dayWidth);
  });

  it('rend au scrollLeft ce que le glissement vers le futur lui prend', () => {
    const { hook, dayWidth, visibleDays } = setup('month');
    const daysCount = hook.result.current.days.length;
    const firstDayBefore = hook.result.current.days[0];

    // Bord droit : la fin de la fenetre entre dans le seuil.
    const gridWidth = 1300 - PROPERTY_COL;
    const scrollLeft = (daysCount - 2) * dayWidth - gridWidth;
    const el = attachScroller(hook.result.current.scrollRef, { clientWidth: 1300, scrollLeft });

    act(() => hook.result.current.handleScroll());

    expect(toDateStr(hook.result.current.days[0])).toBe(
      toDateStr(new Date(firstDayBefore.getTime() + visibleDays * 86_400_000)),
    );
    expect(el.scrollLeft).toBe(scrollLeft - visibleDays * dayWidth);
  });

  it('ne glisse qu\'une fois par position : le bord ne declenche pas en boucle', () => {
    const { hook, dayWidth, visibleDays } = setup('month');
    const firstDay = hook.result.current.days[0];

    const el = attachScroller(hook.result.current.scrollRef, {
      clientWidth: 1300,
      scrollLeft: 2 * dayWidth,
    });

    // Trois evenements de defilement d'affilee, sans que la position change :
    // le premier glisse et compense, les suivants ne trouvent plus de bord.
    act(() => hook.result.current.handleScroll());
    act(() => hook.result.current.handleScroll());
    act(() => hook.result.current.handleScroll());

    // Un seul glissement au total — pas trois mois d'un coup.
    expect(toDateStr(hook.result.current.days[0])).toBe(
      toDateStr(new Date(firstDay.getTime() - visibleDays * 86_400_000)),
    );
    expect(el.scrollLeft).toBe(2 * dayWidth + visibleDays * dayWidth);
  });

  it('ne glisse pas quand le defilement reste loin des bords', () => {
    const { hook, dayWidth } = setup('month');
    const firstDay = hook.result.current.days[0];
    const daysCount = hook.result.current.days.length;

    const el = attachScroller(hook.result.current.scrollRef, {
      clientWidth: 1300,
      scrollLeft: Math.floor(daysCount / 2) * dayWidth,
    });
    const before = el.scrollLeft;

    act(() => hook.result.current.handleScroll());

    expect(hook.result.current.days[0]).toEqual(firstDay);
    expect(el.scrollLeft).toBe(before);
  });

  // ── Cible hors fenetre ────────────────────────────────────────────────────

  describe('scrollToDate hors fenetre', () => {
    it('recentre la fenetre sur une date qu\'elle ne contient pas', () => {
      const { hook, visibleDays } = setup('month');
      attachScroller(hook.result.current.scrollRef, { clientWidth: 1300, scrollLeft: 0 });

      // Loin devant : aucune chance qu'elle soit dans les 125 jours affiches.
      const cible = new Date(2053, 2, 8);
      expect(hook.result.current.days.some((d) => toDateStr(d) === toDateStr(cible))).toBe(false);

      act(() => hook.result.current.scrollToDate(cible));

      // La fenetre s'est deplacee ET contient desormais la cible. Sans cela,
      // « Aujourd'hui » ne faisait RIEN une fois la grille defilee au-dela de
      // la fenetre : l'ancre valait deja aujourd'hui, donc aucun recentrage
      // n'etait declenche, et scrollToDate abandonnait en silence.
      const { days } = hook.result.current;
      expect(days.some((d) => toDateStr(d) === toDateStr(cible))).toBe(true);
      expect(toDateStr(days[0])).toBe(
        toDateStr(new Date(cible.getTime() - visibleDays * 2 * 86_400_000)),
      );
    });

    it('ne touche pas a la fenetre quand la date y est deja', () => {
      const { hook } = setup('month');
      attachScroller(hook.result.current.scrollRef, { clientWidth: 1300, scrollLeft: 1000 });
      const avant = hook.result.current.days[0];

      act(() => hook.result.current.scrollToDate(ANCHOR));

      expect(hook.result.current.days[0]).toEqual(avant);
    });
  });

  // ── Ancrage ───────────────────────────────────────────────────────────────

  it('centre la fenetre sur la date d\'ancre', () => {
    const { hook, visibleDays } = setup('fortnight');
    const { days } = hook.result.current;
    const anchorIndex = days.findIndex((d) => toDateStr(d) === toDateStr(ANCHOR));

    expect(anchorIndex).toBe(visibleDays * BUFFER_MULTIPLIER);
  });
});
