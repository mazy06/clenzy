// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PROVIDER_PRICING_MODELS } from './providerPricing';

describe('Provider pricing API contract', () => {
  it('offers exactly the models accepted by the backend enum', () => {
    const source = readFileSync(fileURLToPath(new URL(
      '../../../server/src/main/java/com/clenzy/marketplace/model/PricingModel.java', import.meta.url,
    )), 'utf8');
    const body = source.replace(/\/\*[\s\S]*?\*\//g, '').split('public enum PricingModel {')[1].split(';')[0];
    const accepted = body.split(',').map(value => value.trim()).filter(Boolean);
    expect([...PROVIDER_PRICING_MODELS].sort()).toEqual(accepted.sort());
  });
});
