import { useState, useCallback, useRef, useLayoutEffect, useEffect, useMemo } from 'react';
import { createSettledScheduler } from '../../../utils/layoutShift';
import { useTranslation } from 'react-i18next';
import type { ZoomLevel } from '../types';
import { ZOOM_CONFIGS, BUFFER_MULTIPLIER, EXTEND_THRESHOLD_DAYS } from '../constants';
import { generateDays, addDays, subDays } from '../utils/dateUtils';
import { isRtlLanguage } from '../../../utils/localeDate';
import {
  getInlineScroll,
  nudgeInlineScroll,
  setInlineScroll,
  smoothInlineScroll,
} from '../../../utils/inlineScroll';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UseInfiniteTimelineConfig {
  anchorDate: Date;
  zoom: ZoomLevel;
  dayWidth: number;
  propertyColWidth: number;
}

export interface UseInfiniteTimelineReturn {
  days: Date[];
  totalGridWidth: number;
  bufferStart: Date;
  bufferEnd: Date;
  visibleRange: { start: Date; end: Date };
  scrollRef: React.RefObject<HTMLDivElement | null>;
  handleScroll: () => void;
  scrollToDate: (date: Date) => void;
  scrollToAnchor: () => void;
}

/**
 * Index du jour situe au bord AMONT de la zone de grille — a gauche en
 * francais, a droite en arabe. `offset` est un decalage logique (cf.
 * `utils/inlineScroll`), donc toujours positif.
 */
function firstVisibleIndex(offset: number, dayWidth: number): number {
  return Math.floor(Math.max(0, offset) / dayWidth);
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Fenetre de jours GLISSANTE, a taille CONSTANTE.
 *
 * <p>Le buffer ne grandit jamais : il compte toujours
 * {@code 2 × BUFFER_MULTIPLIER × visibleDays + 1} jours et se decale d'une
 * fenetre visible quand le defilement approche d'un bord. Une taille fixe
 * garantit un cout de rendu constant (le DOM de la grille ne depend plus de la
 * duree pendant laquelle on a fait defiler) et, surtout, un nombre de tranches
 * de donnees constant — c'est la croissance du buffer qui multipliait les
 * requetes.</p>
 *
 * <p><b>Le decalage DOIT etre compense sur le scrollLeft.</b> Retirer N jours
 * en tete deplace tout le contenu de N × dayWidth vers la gauche ; sans
 * correction, la vue saute d'autant. L'ancienne implementation compensait dans
 * un effet de mise en page declenche par {@code days.length} — or la taille ne
 * changeait justement JAMAIS lors d'un glissement (les deux bords bougeaient
 * ensemble), la compensation ne partait donc pas et chaque evenement de
 * defilement pres d'un bord faisait sauter la grille d'une fenetre entiere,
 * en boucle : d'ou les sauts de plusieurs mois et le defilement fige.</p>
 */
/** Colonnes de marge laissees avant le jour vise (« aujourd'hui » s'affiche en 7e colonne). */
const TARGET_DAY_LEADING_COLUMNS = 6;

/**
 * Decalage horizontal LOGIQUE (0 = debut du buffer, cf. `utils/inlineScroll`)
 * qui pose `targetDate` en 7e colonne de la grille, ou `null` si ce jour n'est
 * pas dans le buffer.
 *
 * <p>Pur et exporte : le squelette de chargement s'ouvre sur cette meme
 * fenetre, faute de quoi la grille sauterait lateralement en apparaissant.</p>
 */
export function inlineScrollForDateIn(days: Date[], targetDate: Date, dayWidth: number): number | null {
  const targetIndex = days.findIndex(
    (d) =>
      d.getFullYear() === targetDate.getFullYear() &&
      d.getMonth() === targetDate.getMonth() &&
      d.getDate() === targetDate.getDate(),
  );
  if (targetIndex < 0) return null;
  // Le jour vise se pose en 7e colonne (6 colonnes de marge en amont).
  return Math.max(0, (targetIndex - TARGET_DAY_LEADING_COLUMNS) * dayWidth);
}

export function useInfiniteTimeline({
  anchorDate,
  zoom,
  dayWidth,
  propertyColWidth,
}: UseInfiniteTimelineConfig): UseInfiniteTimelineReturn {
  const { i18n } = useTranslation();
  // En arabe la grille se lit de droite a gauche : `scrollLeft` y part de 0 au
  // bord DROIT et devient negatif. Toute la mecanique ci-dessous raisonne en
  // decalage logique, cette valeur ne sert qu'aux lectures/ecritures du DOM.
  const isRtl = isRtlLanguage(i18n.language);
  // L'ecouteur de molette est pose une fois par element, jamais a chaque rendu
  // (cf. plus bas) : sa fermeture figerait la direction du jour ou elle a ete
  // creee. Il la relit donc dans une reference.
  const isRtlRef = useRef(isRtl);
  isRtlRef.current = isRtl;
  const config = ZOOM_CONFIGS[zoom];
  /** Pas de glissement : une fenetre visible a la fois. */
  const slideAmount = config.visibleDays;
  /** Taille constante du buffer, en jours. */
  const bufferDays = config.visibleDays * BUFFER_MULTIPLIER * 2 + 1;

  // Seul le bord GAUCHE est un etat : le bord droit s'en deduit, la taille
  // etant fixe. Deux etats independants laissaient la porte ouverte a des
  // buffers de taille variable (et donc a des compensations fausses).
  const [bufferStart, setBufferStart] = useState(() =>
    subDays(anchorDate, config.visibleDays * BUFFER_MULTIPLIER),
  );
  const bufferEnd = useMemo(() => addDays(bufferStart, bufferDays - 1), [bufferStart, bufferDays]);

  const days = useMemo(() => generateDays(bufferStart, bufferEnd), [bufferStart, bufferEnd]);
  const totalGridWidth = days.length * dayWidth;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const viewport = useRef<{ element: HTMLDivElement | null; width: number }>({ element: null, width: 0 });
  const readViewportWidth = useCallback((element: HTMLDivElement) => {
    if (viewport.current.element !== element) {
      viewport.current = { element, width: element.clientWidth };
    }
    return viewport.current.width;
  }, []);
  const [visibleRange, setVisibleRange] = useState(() => ({
    start: subDays(anchorDate, TARGET_DAY_LEADING_COLUMNS),
    end: addDays(anchorDate, config.visibleDays),
  }));
  const publishedVisibleRange = useRef(visibleRange);
  const updateVisibleRange = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const viewportWidth = readViewportWidth(el);
    if (viewportWidth <= propertyColWidth) return;
    const offset = getInlineScroll(el);
    const first = Math.min(days.length - 1, firstVisibleIndex(offset, dayWidth));
    const last = Math.min(days.length - 1,
      Math.ceil((offset + viewportWidth - propertyColWidth) / dayWidth) - 1);
    const start = days[first];
    const end = days[Math.max(first, last)];
    const previous = publishedVisibleRange.current;
    // Un setter appelé dans chaque effet de mise en page peut entretenir une
    // boucle React, même si son updater retourne parfois la valeur précédente.
    if (previous.start.getTime() === start.getTime() && previous.end.getTime() === end.getTime()) return;
    const next = { start, end };
    publishedVisibleRange.current = next;
    setVisibleRange(next);
  }, [days, dayWidth, propertyColWidth, readViewportWidth]);
  /** Pixels a rendre au scrollLeft une fois le nouveau buffer peint. */
  const pendingCompensation = useRef(0);
  /**
   * Verrou : un glissement est dispatche mais pas encore compense. Il est
   * relache par l'effet de mise en page, PAS par une frame d'animation — sans
   * cela, plusieurs glissements partaient avant que le DOM ne rattrape, et la
   * grille defilait de plusieurs mois en quelques images.
   */
  const slidePending = useRef(false);
  const scrollRaf = useRef<number | null>(null);

  // ── Compensation du glissement (avant peinture) ───────────────────────────

  const bufferStartTime = bufferStart.getTime();
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && pendingCompensation.current !== 0) {
      nudgeInlineScroll(el, pendingCompensation.current, isRtl);
    }
    pendingCompensation.current = 0;
    slidePending.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bufferStartTime, dayWidth]);

  // ── Recentrage sur changement d'ancre ou de zoom ──────────────────────────

  const prevAnchorRef = useRef(anchorDate);
  const prevZoomRef = useRef(zoom);
  const pendingScrollTarget = useRef<Date | null>(null);

  useLayoutEffect(() => {
    const anchorChanged =
      anchorDate.getFullYear() !== prevAnchorRef.current.getFullYear() ||
      anchorDate.getMonth() !== prevAnchorRef.current.getMonth() ||
      anchorDate.getDate() !== prevAnchorRef.current.getDate();
    const zoomChanged = zoom !== prevZoomRef.current;

    if (anchorChanged || zoomChanged) {
      // Recentrage explicite : aucune compensation ne doit survivre a un saut
      // d'ancre, le scrollLeft est repositionne juste apres.
      pendingCompensation.current = 0;
      slidePending.current = false;
      setBufferStart(subDays(anchorDate, ZOOM_CONFIGS[zoom].visibleDays * BUFFER_MULTIPLIER));
      prevAnchorRef.current = anchorDate;
      prevZoomRef.current = zoom;

      pendingScrollTarget.current = zoomChanged ? new Date() : anchorDate;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorDate, zoom]);

  // ── Molette → defilement horizontal ──────────────────────────────────────

  /**
   * L'ecouteur est pose une seule fois par element, et seulement quand il
   * existe.
   *
   * <p>Deux ecueils s'annulaient ici. Sans liste de dependances, l'effet
   * desabonnait puis reabonnait un ecouteur NON PASSIF a chaque rendu — des
   * dizaines de fois par seconde pendant un defilement, avec des evenements
   * perdus entre les deux. Mais une liste vide ne marcherait pas non plus : la
   * grille n'est pas montee pendant le chargement, l'element n'existe donc pas
   * au premier rendu et l'ecouteur ne serait jamais pose. D'ou ce montage
   * imperatif, evalue a chaque rendu mais qui ne touche au DOM que si
   * l'element a reellement change.</p>
   */
  const attachedEl = useRef<HTMLDivElement | null>(null);
  const detachWheel = useRef<(() => void) | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || el === attachedEl.current) return;

    detachWheel.current?.();

    const handleWheel = (e: WheelEvent) => {
      // Ne PAS détourner le scroll vertical quand le pointeur est au-dessus d'une zone
      // à défilement vertical propre (colonne de cartes du Superviseur, etc.) : on laisse
      // le scroll natif s'appliquer. Sinon (au-dessus de la grille/briques du planning),
      // le scroll vertical de la molette pilote le défilement HORIZONTAL du calendrier.
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-vertical-scroll]')) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        // `+=` sur `scrollLeft` reculerait en arabe : on avance dans le
        // CONTENU, pas vers la gauche de l'ecran.
        nudgeInlineScroll(el, e.deltaY, isRtlRef.current);
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    attachedEl.current = el;
    detachWheel.current = () => el.removeEventListener('wheel', handleWheel);
  });

  useEffect(() => () => {
    detachWheel.current?.();
    detachWheel.current = null;
    attachedEl.current = null;
  }, []);

  // ── Surveillance du defilement (une evaluation par frame au plus) ─────────

  const evaluateSlide = useCallback(() => {
    const el = scrollRef.current;
    if (!el || slidePending.current) return;

    const gridViewportWidth = Math.max(0, readViewportWidth(el) - propertyColWidth);
    const startIndex = firstVisibleIndex(getInlineScroll(el), dayWidth);
    const endIndex = startIndex + Math.ceil(gridViewportWidth / dayWidth);

    // Glissement vers le passe : la fenetre recule, le contenu se decale vers
    // la droite → on rend au scrollLeft ce que la prepend lui a pris.
    if (startIndex < EXTEND_THRESHOLD_DAYS) {
      slidePending.current = true;
      pendingCompensation.current = slideAmount * dayWidth;
      setBufferStart((prev) => subDays(prev, slideAmount));
      return;
    }

    // Glissement vers le futur : la tete est rognee, tout recule d'autant.
    if (days.length - endIndex < EXTEND_THRESHOLD_DAYS) {
      slidePending.current = true;
      pendingCompensation.current = -slideAmount * dayWidth;
      setBufferStart((prev) => addDays(prev, slideAmount));
    }
  }, [dayWidth, days.length, propertyColWidth, slideAmount, readViewportWidth]);

  const handleScroll = useCallback(() => {
    if (scrollRaf.current !== null) return;
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = null;
      evaluateSlide();
      updateVisibleRange();
    });
  }, [evaluateSlide, updateVisibleRange]);

  useEffect(() => () => {
    if (scrollRaf.current !== null) cancelAnimationFrame(scrollRaf.current);
  }, []);

  // ── Defilement vers une date ─────────────────────────────────────────────

  const inlineScrollForDate = useCallback(
    (targetDate: Date): number | null => inlineScrollForDateIn(days, targetDate, dayWidth),
    [days, dayWidth],
  );

  const scrollToDate = useCallback(
    (targetDate: Date) => {
      const el = scrollRef.current;
      if (!el) return;
      const offset = inlineScrollForDate(targetDate);

      if (offset === null) {
        // Cible hors fenetre : on RECENTRE ici meme.
        //
        // L'ancienne version abandonnait en silence, en pariant sur le
        // recentrage declenche par un changement d'ancre. Or « Aujourd'hui »
        // remet l'ancre sur une date ou elle EST DEJA (defiler ne la deplace
        // pas) : le recentrage ne partait donc jamais, et le bouton ne faisait
        // rien du tout des qu'on avait defile au-dela de la fenetre. Constate
        // au navigateur : grille en 2053, clic sur « Aujourd'hui », seule
        // l'etiquette du mois changeait.
        pendingCompensation.current = 0;
        slidePending.current = false;
        pendingScrollTarget.current = targetDate;
        setBufferStart(subDays(targetDate, config.visibleDays * BUFFER_MULTIPLIER));
        return;
      }

      smoothInlineScroll(el, offset, isRtl);
    },
    [inlineScrollForDate, config.visibleDays, isRtl],
  );

  const scrollToAnchor = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const offset = inlineScrollForDate(anchorDate);
    if (offset !== null) setInlineScroll(el, offset, isRtl);
  }, [anchorDate, inlineScrollForDate, isRtl]);

  // ── Repositionnement differe apres recentrage du buffer ──────────────────

  const daysIdentity = days.length > 0 ? `${days.length}-${days[0].getTime()}` : '';
  useLayoutEffect(() => {
    if (!pendingScrollTarget.current) return;
    const target = pendingScrollTarget.current;
    pendingScrollTarget.current = null;

    const el = scrollRef.current;
    if (!el) return;
    const offset = inlineScrollForDate(target);
    if (offset !== null) setInlineScroll(el, offset, isRtl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysIdentity]);

  // The scroller mounts after loading. Check its identity every commit, but read
  // layout only on attachment/resize; local query renders reuse the measured width.
  const observedViewport = useRef<{
    element: HTMLDivElement | null; update: typeof updateVisibleRange; dispose: () => void;
  } | null>(null);
  const latestVisibleUpdate = useRef(updateVisibleRange);
  latestVisibleUpdate.current = updateVisibleRange;
  useLayoutEffect(() => {
    const element = scrollRef.current;
    const previous = observedViewport.current;
    if (previous?.element === element) {
      if (previous.update !== updateVisibleRange) {
        previous.update = updateVisibleRange;
        updateVisibleRange();
      }
      return;
    }
    previous?.dispose();
    if (!element) { observedViewport.current = null; return; }
    viewport.current = { element, width: element.clientWidth };
    const settled = createSettledScheduler(() => {
      viewport.current = { element, width: element.clientWidth };
      latestVisibleUpdate.current();
    });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(settled.schedule);
    // Set the attachment before publishing state to avoid a render feedback loop.
    observedViewport.current = { element, update: updateVisibleRange, dispose: () => {
      settled.cancel(); observer?.disconnect();
      window.removeEventListener('resize', settled.schedule);
    } };
    observer?.observe(element);
    window.addEventListener('resize', settled.schedule);
    updateVisibleRange();
  });
  useEffect(() => () => {
    observedViewport.current?.dispose();
    observedViewport.current = null;
  }, []);

  return {
    days,
    totalGridWidth,
    bufferStart,
    bufferEnd,
    visibleRange,
    scrollRef,
    handleScroll,
    scrollToDate,
    scrollToAnchor,
  };
}
