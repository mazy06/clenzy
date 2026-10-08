import { expect, it } from 'vitest';
import { BAITLY_BILLING_COUNTRIES as shared } from '../../../shared/src/types/baitlySubscription';
import { BAITLY_BILLING_COUNTRIES as web } from './baitlyBillingCountries';

it('la liste des pays de facturation web reste identique à celle du mobile (shared)', () => {
  expect([...web]).toEqual([...shared]);
});
