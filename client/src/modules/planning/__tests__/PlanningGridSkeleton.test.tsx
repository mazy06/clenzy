import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import PlanningGridSkeleton from '../PlanningGridSkeleton';
import { ROW_CONFIG, DATE_HEADER_HEIGHT, PAGINATION_BAR_HEIGHT } from '../constants';

/**
 * Le squelette doit etre LA grille, pas une evocation : c'est tout son interet.
 * Ces assertions tiennent la promesse de geometrie — si une rangee change de
 * hauteur ou la colonne de largeur d'un cote sans l'autre, elles tombent.
 */

const DAY_WIDTH = 80;

function days(count: number, from = new Date(2026, 8, 1)): Date[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function renderSkeleton(density: 'normal' | 'compact' = 'normal') {
  const timeline = days(30);
  return {
    timeline,
    ...render(
      <PlanningGridSkeleton
        days={timeline}
        dayWidth={DAY_WIDTH}
        zoom="month"
        density={density}
        anchorDate={timeline[10]}
        propertyColWidth={188}
        totalGridWidth={timeline.length * DAY_WIDTH}
      />,
    ),
  };
}

describe('PlanningGridSkeleton — la grille avant ses donnees', () => {
  it('whenItPaints_thenTheDateHeaderKeepsTheGridHeight', () => {
    const { container } = renderSkeleton();
    const header = container.querySelector<HTMLElement>('[style*="min-height"]');
    expect(header?.style.minHeight).toBe(`${DATE_HEADER_HEIGHT}px`);
  });

  it('whenTheDensityIsNormal_thenRowsAreTheRealRowHeight', () => {
    const { container } = renderSkeleton('normal');
    const rows = container.querySelectorAll<HTMLElement>(
      `[style*="height: ${ROW_CONFIG.normal.rowHeight}px"]`,
    );
    // Une rangee par cote : colonne logements + piste de la grille.
    expect(rows.length).toBeGreaterThan(1);
  });

  it('whenTheDensityIsCompact_thenRowsFollowIt', () => {
    const { container } = renderSkeleton('compact');
    const rows = container.querySelectorAll<HTMLElement>(
      `[style*="height: ${ROW_CONFIG.compact.rowHeight}px"]`,
    );
    expect(rows.length).toBeGreaterThan(1);
    expect(
      container.querySelectorAll(`[style*="height: ${ROW_CONFIG.normal.rowHeight}px"]`).length,
    ).toBe(0);
  });

  it('whenItPaints_thenDaySeparatorsUseTheRealColumnWidth', () => {
    // Le fond des rangees vient du composant PARTAGE avec PlanningRow : le
    // degrade des filets doit donc porter la largeur de colonne reelle.
    const { container } = renderSkeleton();
    const hairlines = Array.from(container.querySelectorAll<HTMLElement>('[aria-hidden]'))
      .filter((el) => el.style.backgroundImage.includes('repeating-linear-gradient'));
    expect(hairlines.length).toBeGreaterThan(0);
    expect(hairlines[0].style.backgroundImage).toContain(`${DAY_WIDTH - 1}px`);
  });

  it('whenABrickIsDrawn_thenItSnapsToWholeDayColumns', () => {
    const { container } = renderSkeleton();
    // Les briques portent leur geometrie en style inline (une classe Tailwind
    // ne peut pas naitre d'une variable) : c'est a cela qu'on les reconnait.
    const bars = Array.from(container.querySelectorAll<HTMLElement>('[data-slot="skeleton"]'))
      .filter((el) => el.style.borderRadius !== '' && el.style.left !== '');
    expect(bars.length).toBeGreaterThan(0);
    for (const bar of bars) {
      expect(parseFloat(bar.style.left) % DAY_WIDTH).toBe(0);
      expect(parseFloat(bar.style.width) % DAY_WIDTH).toBe(0);
      expect(bar.style.height).toBe(`${ROW_CONFIG.normal.reservationBarHeight}px`);
      expect(bar.style.top).toBe(`${ROW_CONFIG.normal.barPadding}px`);
    }
  });

  it('whenItPaints_thenThePaginationBarHoldsItsHeight', () => {
    // Sa hauteur est deja reservee par le calcul du nombre de lignes par page :
    // l'omettre faisait raccourcir la grille de 44 px a l'arrivee des donnees.
    const { container } = renderSkeleton();
    const bar = container.querySelector<HTMLElement>(
      `[style*="height: ${PAGINATION_BAR_HEIGHT}px"]`,
    );
    expect(bar).not.toBeNull();
    expect(bar!.style.minHeight).toBe(`${PAGINATION_BAR_HEIGHT}px`);

    // Et SOUS la grille, pas dedans : jsdom n'expose pas le raccourci
    // `border-top` quand sa valeur porte un `var()`, on verifie donc la
    // position plutot que le filet.
    const card = container.querySelector('[aria-busy]');
    expect(card).not.toBeNull();
    expect(card!.compareDocumentPosition(bar!) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });
});
