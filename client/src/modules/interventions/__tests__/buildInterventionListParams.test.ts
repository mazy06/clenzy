import { describe, it, expect } from 'vitest';
import { buildInterventionListParams } from '../useInterventionsList';

describe('buildInterventionListParams — mapping filtres UI vers params serveur', () => {
  it("whenAllFiltersAreAll_thenNoServerFilterIsSent", () => {
    const params = buildInterventionListParams({
      page: 0,
      size: 6,
      type: 'all',
      status: 'all',
      priority: 'all',
    });

    expect(params).toEqual({
      page: 0,
      size: 6,
      type: undefined,
      status: undefined,
      priority: undefined,
      propertyId: undefined,
    });
  });

  it('whenFiltersAreSet_thenTheyArePassedThrough', () => {
    const params = buildInterventionListParams({
      page: 3,
      size: 25,
      type: 'CLEANING',
      status: 'SCHEDULED',
      priority: 'HIGH',
      propertyId: 42,
    });

    expect(params).toEqual({
      page: 3,
      size: 25,
      type: 'CLEANING',
      status: 'SCHEDULED',
      priority: 'HIGH',
      propertyId: 42,
    });
  });

  it('whenPageZero_thenPageParamIsKept', () => {
    // page=0 ne doit pas être confondu avec "absent" (falsy).
    const params = buildInterventionListParams({
      page: 0,
      size: 10,
      type: 'all',
      status: 'all',
      priority: 'all',
    });
    expect(params.page).toBe(0);
  });


});
