import { describe, expect, it } from 'vitest';
import { paidServiceTypeChoices } from './paidServiceTypes';
import type { UpsellTypeDto } from '../../services/api/upsellApi';

const type = (code: string, serviceItemCode?: string, platform = true): UpsellTypeDto => ({
  id: 1, code, serviceItemCode, platform, system: !serviceItemCode, sortOrder: 0,
  labelFr: code, labelEn: code,
});
const types = [type('CLEANING'), type('BREAKFAST', 'culinary-breakfast'),
  type('cleaning-turnover', 'cleaning-turnover'), type('cleaning-mid-stay', 'cleaning-mid-stay'),
  type('culinary-breakfast', 'culinary-breakfast'), type('custom', undefined, false), type('EARLY_CHECKIN')];

describe('shared paid service choices', () => {
  it('uses the precise catalogue codes without duplicate historical aliases', () => {
    expect(paidServiceTypeChoices(types, 'EARLY_CHECKIN').map(t => t.code)).toEqual([
      'cleaning-turnover', 'cleaning-mid-stay', 'culinary-breakfast', 'custom', 'EARLY_CHECKIN',
    ]);
  });
  it('preserves the current historical type without silently reclassifying it', () => {
    expect(paidServiceTypeChoices(types, 'CLEANING').map(t => t.code)).toContain('CLEANING');
    expect(paidServiceTypeChoices(types, 'BREAKFAST').map(t => t.code)).toContain('BREAKFAST');
  });
});
