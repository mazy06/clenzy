import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePlanningPagination } from '../hooks/usePlanningPagination';
import { ROW_CONFIG, DATE_HEADER_HEIGHT, OCCUPANCY_ROW_HEIGHT } from '../constants';
import type { PlanningProperty } from '../types';

function properties(n: number): PlanningProperty[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `Logement ${i + 1}`,
    address: '',
    city: '',
    ownerName: '',
    maxGuests: 2,
    type: 'apartment',
    nightlyPrice: 100,
    photoUrls: [],
  })) as PlanningProperty[];
}

function setup(gridHeight: number, total = 30) {
  return renderHook(() =>
    usePlanningPagination({
      totalProperties: properties(total),
      density: 'normal',
      isFullscreen: false,
      showPrices: true,
      gridHeight,
      hasOccupancyRow: true,
    }),
  );
}

describe('usePlanningPagination', () => {
  // ── Le drapeau qui retient les requêtes de la page ────────────────────────

  describe('isPageSizeMeasured', () => {
    it('est faux tant que la grille n\'a pas publié sa hauteur', () => {
      const { result } = setup(0);

      // Sans mesure, la taille de page vient d'une estimation qui tombe
      // rarement juste : tout ce qui dépend de la liste affichée doit attendre.
      expect(result.current.isPageSizeMeasured).toBe(false);
      expect(result.current.pageSize).toBeGreaterThan(0);
    });

    it('devient vrai dès que la hauteur mesurée arrive', () => {
      const { result } = setup(600);

      expect(result.current.isPageSizeMeasured).toBe(true);
    });

    it('la mesure prime sur l\'estimation et change la liste affichée', () => {
      const rowHeight = ROW_CONFIG.normal.rowHeight;
      // Hauteur choisie pour tenir EXACTEMENT 10 lignes une fois le chrome ôté.
      const gridHeight = DATE_HEADER_HEIGHT + OCCUPANCY_ROW_HEIGHT + rowHeight * 10;

      const estime = setup(0).result;
      const mesure = setup(gridHeight).result;

      expect(mesure.current.pageSize).toBe(10);
      expect(mesure.current.paginatedProperties).toHaveLength(10);
      // C'est bien cet ecart qui faisait partir les requetes deux fois : la
      // liste affichee n'est pas la meme avant et apres la mesure.
      expect(estime.current.pageSize).not.toBe(mesure.current.pageSize);
    });
  });

  // ── Découpage ─────────────────────────────────────────────────────────────

  it('découpe les logements sur la taille de page mesurée', () => {
    const rowHeight = ROW_CONFIG.normal.rowHeight;
    const gridHeight = DATE_HEADER_HEIGHT + OCCUPANCY_ROW_HEIGHT + rowHeight * 4;

    const { result } = setup(gridHeight, 10);

    expect(result.current.pageSize).toBe(4);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.paginatedProperties.map((p) => p.id)).toEqual([1, 2, 3, 4]);
    expect(result.current.rangeStart).toBe(1);
    expect(result.current.rangeEnd).toBe(4);
  });

  it('garde au moins une ligne même sur une grille minuscule', () => {
    const { result } = setup(1, 10);

    expect(result.current.pageSize).toBe(1);
    expect(result.current.isPageSizeMeasured).toBe(true);
  });
});
