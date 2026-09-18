import { describe, expect, it } from 'vitest';
import { readableInstructions, requestStage } from '../requestDetailPresentation';
import { convertDetail } from '../../../hooks/useServiceRequestDetails';

describe('request detail data', () => {
  it('preserves zero prices, studio bedrooms, photos and assignment deadlines', () => {
    const detail = convertDetail({ id: 1, property: { id: 3, coverPhotoUrl: '/cover.jpg', bedroomCount: 0, timezone: 'Africa/Casablanca' }, estimatedCost: 0, assignmentExpiresAt: '2026-09-30T10:00:00Z', convertedInterventionId: 7 });
    expect(detail).toMatchObject({ propertyId: 3, propertyPhotoUrl: '/cover.jpg', propertyBedroomCount: 0, estimatedCost: 0, interventionId: 7, assignmentExpiresAt: '2026-09-30T10:00:00Z' });
    expect(detail.estimatedDuration).toBe(0);
    expect(detail.recommendedCost).toBeUndefined();
  });
  it('removes import metadata while preserving access instructions and user brackets', () => {
    expect(readableInstructions('[ICAL:private-id] [SOURCE:Airbnb] Code 4712. [Terrasse]')).toBe('Code 4712. [Terrasse]');
  });
  it('does not confuse request acceptance with intervention execution', () => {
    expect(requestStage({ status: 'PENDING', assignmentPhase: 'PUBLIC' })).toBe(1);
    expect(requestStage({ status: 'PENDING', assignmentPhase: 'PROPOSED' })).toBe(2);
    expect(requestStage({ status: 'APPROVED', interventionId: 12 })).toBe(3);
    expect(requestStage({ status: 'COMPLETED' })).toBe(-1);
    expect(requestStage({ status: 'CANCELLED' })).toBe(-1);
  });
});
