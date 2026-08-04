import { describe, it, expect } from 'vitest';

import { computePortfolioAggregates } from '../PropertiesPortfolioTiles';
import type { PropertyListItem } from '../../../hooks/usePropertiesList';
import type { PropertyKpiSummary } from '../../../services/api/propertyKpiApi';

const makeProperty = (id: number): PropertyListItem => ({ id: String(id) }) as PropertyListItem;

const makeKpi = (overrides: Partial<PropertyKpiSummary> & { propertyId: number }): PropertyKpiSummary => ({
  occupancyRate: 0,
  adr: 0,
  revenue: 0,
  operationalStatus: 'available',
  currentCheckOut: null,
  currentCheckOutTime: null,
  activeInterventionType: null,
  ...overrides,
});

describe('computePortfolioAggregates', () => {
  it('whenTwoProperties_thenOccupancyIsSimpleMean_andRevenueIsSum', () => {
    const kpiMap = new Map([
      [1, makeKpi({ propertyId: 1, occupancyRate: 0.8, adr: 100, revenue: 1000 })],
      [2, makeKpi({ propertyId: 2, occupancyRate: 0.6, adr: 50, revenue: 500 })],
    ]);

    const aggregates = computePortfolioAggregates([makeProperty(1), makeProperty(2)], kpiMap);

    expect(aggregates.occupancyPct).toBe(70);
    expect(aggregates.revenue).toBe(1500);
    expect(aggregates.covered).toBe(2);
  });

  it('whenAdrsDiffer_thenPortfolioAdrIsNightWeighted', () => {
    // 10 nuits à 100 € + 10 nuits à 50 € → ADR = 1500 / 20 = 75, pas la
    // moyenne simple des ADR (75 ici aussi par symétrie — on casse la symétrie).
    const kpiMap = new Map([
      [1, makeKpi({ propertyId: 1, occupancyRate: 0.5, adr: 100, revenue: 3000 })], // 30 nuits
      [2, makeKpi({ propertyId: 2, occupancyRate: 0.5, adr: 50, revenue: 500 })], // 10 nuits
    ]);

    const aggregates = computePortfolioAggregates([makeProperty(1), makeProperty(2)], kpiMap);

    // 3500 € / 40 nuits = 87,5 — la moyenne simple (75) serait fausse.
    expect(aggregates.adr).toBeCloseTo(87.5);
  });

  it('whenPropertyHasNoKpi_thenIgnoredFromAggregates', () => {
    const kpiMap = new Map([
      [1, makeKpi({ propertyId: 1, occupancyRate: 0.8, adr: 100, revenue: 1000 })],
    ]);

    const aggregates = computePortfolioAggregates([makeProperty(1), makeProperty(99)], kpiMap);

    expect(aggregates.occupancyPct).toBe(80);
    expect(aggregates.covered).toBe(1);
  });

  it('whenNoKpiAtAll_thenAllNull', () => {
    const aggregates = computePortfolioAggregates([makeProperty(1)], new Map());

    expect(aggregates).toEqual({ occupancyPct: null, adr: null, revenue: null, covered: 0 });
  });

  it('whenNoNightsSold_thenAdrIsNull', () => {
    const kpiMap = new Map([
      [1, makeKpi({ propertyId: 1, occupancyRate: 0, adr: 0, revenue: 0 })],
    ]);

    const aggregates = computePortfolioAggregates([makeProperty(1)], kpiMap);

    expect(aggregates.adr).toBeNull();
    expect(aggregates.occupancyPct).toBe(0);
  });
});
