import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { PROVIDER_SECTOR_IMAGES } from './providerSectorImages';

it('covers every sector in the backend catalogue with a distinct, available image', () => {
  const seed = readFileSync(resolve('../server/src/main/resources/db/changelog/changes/0420__marketplace_service_catalog.sql'), 'utf8');
  const codes = [...seed.matchAll(/WHERE code = '([A-Z_]+)'/g)].map(match => match[1]);
  expect(codes.length).toBeGreaterThan(30);
  expect(Object.keys(PROVIDER_SECTOR_IMAGES).sort()).toEqual([...new Set(codes)].sort());
  expect(new Set(Object.values(PROVIDER_SECTOR_IMAGES)).size).toBe(codes.length);
  for (const code of codes) {
    expect(existsSync(resolve('public', '.' + PROVIDER_SECTOR_IMAGES[code])), code).toBe(true);
  }
});
