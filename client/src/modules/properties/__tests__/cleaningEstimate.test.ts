import { describe, expect, it } from 'vitest';
import type { PropertyDetailsData } from '../../../hooks/usePropertyDetails';
import { estimateCleaningPrice, formatCleaningDuration } from '../cleaningEstimate';

function property(overrides: Partial<PropertyDetailsData>): PropertyDetailsData {
  return {
    id: '1', name: 'Duplex Hivernage', address: '8 rue du Temple', city: 'Marrakech', postalCode: '40000', country: 'Maroc',
    propertyType: 'DUPLEX', status: 'ACTIVE', nightlyPrice: 0, bedrooms: 1, bathrooms: 1, surfaceArea: 45, description: '',
    amenities: [], cleaningFrequency: 'AFTER_EACH_STAY', maxGuests: 2, contactPhone: '', contactEmail: '',
    ...overrides,
  };
}

describe('estimateCleaningPrice', () => {
  it('whenOnlyTheSurfaceIsKnown_thenTheSurfaceTierGivesTheBase', () => {
    expect(estimateCleaningPrice(property({ surfaceArea: 45 }))).toBe(45);
  });

  it('whenABasePriceIsSet_thenSurchargesAddUpAndRoundToFiveEuros', () => {
    // 80 € + étage (8) + extérieur (12) + linge (8) + 2 voyageurs au-delà de 4 (6) = 114 → 115.
    const duplex = property({ surfaceArea: 120, cleaningBasePrice: 80, numberOfFloors: 2, hasExterior: true, hasLaundry: true, maxGuests: 6 });
    expect(estimateCleaningPrice(duplex)).toBe(115);
  });

  it('whenTheBasePriceIsVeryLow_thenTheEstimateNeverGoesUnderThirtyEuros', () => {
    expect(estimateCleaningPrice(property({ cleaningBasePrice: 10 }))).toBe(30);
  });

  it('whenNeitherSurfaceNorBasePriceIsKnown_thenThereIsNoEstimate', () => {
    expect(estimateCleaningPrice(property({ surfaceArea: 0 }))).toBeNull();
  });
});

describe('formatCleaningDuration', () => {
  it('whenFormattingMinutes_thenHoursAndMinutesReadNaturally', () => {
    expect(formatCleaningDuration(220)).toBe('3h40');
    expect(formatCleaningDuration(120)).toBe('2h');
    expect(formatCleaningDuration(45)).toBe('45 min');
  });
});
