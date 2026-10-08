import { describe, expect, it } from 'vitest';
import { AMENITY_CATEGORIES, NEUTRAL_AMENITY_TONE, amenityTone, sortByAmenityCategory } from '../amenityCategories';

describe('Familles d’équipements', () => {
  it('whenTwoFamiliesAreCompared_thenEachHasItsOwnColour', () => {
    const inks = AMENITY_CATEGORIES.map((category) => category.tone.ink);
    expect(new Set(inks).size).toBe(AMENITY_CATEGORIES.length);
  });

  it('whenAnAmenityBelongsToAFamily_thenItTakesThatFamilyColour', () => {
    expect(amenityTone('POOL')).toEqual({ ink: 'var(--bui-success-ink)', soft: 'var(--bui-success-soft)' });
    expect(amenityTone('OVEN')).toEqual({ ink: 'var(--bui-warning-ink)', soft: 'var(--bui-warning-soft)' });
  });

  it('whenTheAmenityIsCustom_thenItStaysNeutral', () => {
    expect(amenityTone('ROOFTOP_CINEMA')).toBe(NEUTRAL_AMENITY_TONE);
  });

  it('whenSorting_thenFamiliesFollowTheFormOrderAndCustomAmenitiesComeLast', () => {
    expect(sortByAmenityCategory(['ROOFTOP_CINEMA', 'BABY_BED', 'POOL', 'TV', 'PARKING', 'WIFI']))
      .toEqual(['TV', 'WIFI', 'POOL', 'PARKING', 'BABY_BED', 'ROOFTOP_CINEMA']);
  });
});
