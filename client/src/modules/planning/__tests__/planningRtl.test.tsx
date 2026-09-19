import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import i18n from '../../../i18n/config';
import PlanningDateHeaders from '../PlanningDateHeaders';
import PlanningRowBackdrop from '../PlanningRowBackdrop';
import PlanningBarGhost from '../PlanningBarGhost';
import { orderNameForReading } from '../../../utils/textDirection';
import { computeDateRange } from '../utils/dateUtils';
import { toHijri } from '../../../utils/localeDate';

/**
 * Le planning en arabe : calendrier hégirien pour les libellés, coordonnées
 * LOGIQUES pour la géométrie.
 *
 * <p>Chacun de ces cas correspond à un défaut constaté à l'écran : en-tête en
 * français sous une interface arabe, quantièmes grégoriens, colonnes posées à
 * l'opposé de leur date.</p>
 */

const DAY_WIDTH = 38;

/** Quinze jours à partir du 14 octobre 2024 (lundi). */
function days(): Date[] {
  return Array.from({ length: 15 }, (_, i) => new Date(2024, 9, 14 + i, 12));
}

async function setLanguage(lng: string) {
  await i18n.changeLanguage(lng);
}

afterAll(async () => {
  await setLanguage('fr');
});

describe('En-tête de dates', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 9, 20, 12));
  });
  afterAll(() => vi.useRealTimers());

  it('rend les quantièmes grégoriens en français', async () => {
    await setLanguage('fr');
    render(
      <PlanningDateHeaders
        days={days()}
        dayWidth={DAY_WIDTH}
        zoom="fortnight"
        totalGridWidth={DAY_WIDTH * 15}
        propertyColWidth={200}
        propertyCount={3}
      />,
    );
    expect(screen.getByText('14')).toBeTruthy();
  });

  it('rend les quantièmes HÉGIRIENS en arabe', async () => {
    await setLanguage('ar');
    const first = days()[0];
    const hijriDay = String(toHijri(first).day);

    render(
      <PlanningDateHeaders
        days={days()}
        dayWidth={DAY_WIDTH}
        zoom="fortnight"
        totalGridWidth={DAY_WIDTH * 15}
        propertyColWidth={200}
        propertyCount={3}
      />,
    );

    // Le 14 octobre 2024 est le 11 Rabi' al-Thani 1446 : le quantième affiché
    // est celui du calendrier hégirien, pas « 14 ».
    expect(hijriDay).not.toBe('14');
    expect(screen.getAllByText(hijriDay).length).toBeGreaterThan(0);
  });
});

describe('Fond de ligne', () => {
  const renderBackdrop = () =>
    render(
      <PlanningRowBackdrop
        days={days()}
        dayWidth={DAY_WIDTH}
        totalGridWidth={DAY_WIDTH * 15}
      />,
    );

  it('pose ses colonnes en inset-inline-start, jamais en left', () => {
    const { container } = renderBackdrop();
    const cells = Array.from(container.querySelectorAll<HTMLElement>('div[style]'))
      .filter((el) => el.style.backgroundColor !== '');
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      // `left` compterait les colonnes depuis le bord physique gauche : en
      // arabe, chacune atterrirait à l'opposé de sa date.
      expect(cell.style.left).toBe('');
      expect(cell.style.insetInlineStart).not.toBe('');
    }
  });

  /**
   * Les colonnes teintées sont celles du WEEK-END, et le week-end change de
   * jours avec la langue : vendredi-samedi en arabe (la semaine ouvrée va du
   * dimanche au jeudi, comme le début de semaine de la grille), samedi-dimanche
   * ailleurs. `isWeekend` de date-fns ne connaît que le second : en arabe, la
   * teinte tombait sur un dimanche ouvré et laissait le vendredi en jour ouvré.
   *
   * La fenêtre part du lundi 14 octobre 2024, donc : 4 = vendredi,
   * 5 = samedi, 6 = dimanche, 11 = vendredi, 12 = samedi, 13 = dimanche.
   */
  const tintedColumns = (container: HTMLElement): number[] =>
    Array.from(container.querySelectorAll<HTMLElement>('div[style]'))
      .filter((el) => el.style.backgroundColor !== '')
      .map((el) => Math.round(parseFloat(el.style.insetInlineStart) / DAY_WIDTH))
      .sort((a, b) => a - b);

  it('teinte samedi et dimanche en français', async () => {
    await setLanguage('fr');
    const { container } = renderBackdrop();
    expect(tintedColumns(container)).toEqual([5, 6, 12, 13]);
  });

  it('teinte vendredi et samedi en arabe', async () => {
    await setLanguage('ar');
    const { container } = renderBackdrop();
    expect(tintedColumns(container)).toEqual([4, 5, 11, 12]);
    await setLanguage('fr');
  });

  it('retourne le dégradé des filets en arabe', async () => {
    await setLanguage('ar');
    const { container } = renderBackdrop();
    const hairlines = container.querySelector<HTMLElement>('[aria-hidden]');
    // Un dégradé ne suit pas la direction du document : laissé « to right », le
    // motif partirait du bord opposé à la première colonne.
    expect(hairlines?.style.backgroundImage).toContain('to left');
    expect(hairlines?.style.backgroundPosition).toBe('100% 0px');
    await setLanguage('fr');
  });
});

describe('Ordre du nom dans une brique', () => {
  /**
   * « Emma Rossi » reste un run latin dans une interface arabe : le moteur le
   * rend de gauche à droite, donc l'œil qui balaie de droite à gauche
   * rencontre « Rossi » en premier. Le nom étant collé à son avatar, du côté
   * où l'on commence à lire, on attend le PRÉNOM en premier.
   */
  const renderGhost = () =>
    render(
      <PlanningBarGhost
        layout={{
          event: {
            id: 'r-1',
            type: 'reservation',
            propertyId: 1,
            startDate: '2024-10-14',
            endDate: '2024-10-17',
            label: 'Emma Rossi',
            status: 'confirmed',
          },
          left: 0,
          top: 0,
          width: 240,
          height: 34,
        } as never}
        isConflict={false}
      />,
    );

  it('laisse le nom intact en français', async () => {
    await setLanguage('fr');
    renderGhost();
    expect(screen.getByText('Emma Rossi')).toBeTruthy();
  });

  it('inverse l’ordre des mots en arabe — le prénom se lit en premier', async () => {
    await setLanguage('ar');
    renderGhost();
    // Rendu de gauche à droite, « Rossi Emma » place « Emma » du côté où l'on
    // commence à lire.
    expect(screen.getByText('Rossi Emma')).toBeTruthy();
    await setLanguage('fr');
  });

  it('ne touche pas à un nom déjà arabe', () => {
    expect(orderNameForReading('محمد العمري', true)).toBe('محمد العمري');
  });

  it('ne touche à rien en interface latine', () => {
    expect(orderNameForReading('Emma Rossi', false)).toBe('Emma Rossi');
  });
});

describe('Nombre de nuits', () => {
  /**
   * Deux nœuds séparés (`{n} {mot}`) formaient deux runs bidi : dans une brique
   * lue de droite à gauche, l'algorithme les replaçait dans l'ordre inverse et
   * l'écran affichait « nuits 7 ». Une chaîne unique n'a qu'un run.
   */
  it('rend le compte et le mot d’un seul tenant, dans les trois langues', async () => {
    for (const [lng, pattern] of [
      ['fr', /7\s+nuits/],
      ['en', /7\s+nights/],
      ['ar', /ليال/],
    ] as const) {
      await setLanguage(lng);
      const label = i18n.t('planning.panel.nights', { count: 7 });
      expect(label).toMatch(pattern);
      // Un seul segment : aucun espace en tête ni en queue à recoller.
      expect(label).toBe(label.trim());
    }
    await setLanguage('fr');
  });

  it('décline les six formes du pluriel arabe', async () => {
    await setLanguage('ar');
    const forms = [0, 1, 2, 3, 11, 100].map((n) => i18n.t('planning.panel.nights', { count: n }));
    expect(new Set(forms).size).toBeGreaterThan(3);
    await setLanguage('fr');
  });
});

describe('computeDateRange', () => {
  it('cale la semaine sur lundi en français', () => {
    const range = computeDateRange(new Date(2024, 9, 17, 12), 'week', 'fr');
    expect(range.start.getDay()).toBe(1);
  });

  it('cale la semaine sur lundi en anglais AUSSI', () => {
    // `enUS` ouvrirait sa semaine le dimanche : seul l'arabe se decale.
    const range = computeDateRange(new Date(2024, 9, 17, 12), 'week', 'en');
    expect(range.start.getDay()).toBe(1);
  });

  it('cale la semaine sur dimanche en arabe', () => {
    const range = computeDateRange(new Date(2024, 9, 17, 12), 'week', 'ar');
    expect(range.start.getDay()).toBe(0);
  });

  it('borne le mois sur le mois HÉGIRIEN en arabe', () => {
    const range = computeDateRange(new Date(2024, 9, 17, 12), 'month', 'ar');
    expect(toHijri(range.start).day).toBe(1);
    // Un mois hégirien compte 29 ou 30 jours, et ne coïncide pas avec le
    // 1er octobre — le borner en grégorien afficherait un mois à cheval.
    expect(toHijri(range.end).month).toBe(toHijri(range.start).month);
    expect(range.start.getDate()).not.toBe(1);
  });

  it('borne le mois sur le mois grégorien en français', () => {
    const range = computeDateRange(new Date(2024, 9, 17, 12), 'month', 'fr');
    expect(range.start.getDate()).toBe(1);
    expect(range.end.getDate()).toBe(31);
  });
});
