import { afterEach, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/dom';
import { createEditorPreview } from './editorPreviewCore';
import type { BookingEngineConfig } from '../../../../services/api/bookingEngineApi';
import { propertiesApi } from '../../../../services/api/propertiesApi';

vi.mock('../../../../services/api/propertiesApi', () => ({ propertiesApi: { getAll: vi.fn().mockResolvedValue([
  { id: 41, name: 'Maison Nice', nightlyPrice: 120.5, cleaningBasePrice: 60, maxGuests: 6, minimumNights: 2 },
  { id: 42, name: 'Loft Paris', nightlyPrice: 180.75, cleaningBasePrice: 80, maxGuests: 4, minimumNights: 2 },
]) } }));
vi.mock('../../../../services/api/reviewsApi', () => ({ reviewsApi: { getStats: vi.fn().mockRejectedValue(new Error('No reviews')) } }));
const previews: ReturnType<typeof createEditorPreview>[] = [];
afterEach(() => { previews.forEach((preview) => preview.destroy()); previews.length = 0; vi.clearAllMocks(); });

it('re-seeds selected properties in REAL mode without leaking other catalogue entries or losing valid dates', async () => {
  const config = { dataSourceMode: 'REAL', featuredPropertyIds: '[42]', defaultCurrency: 'EUR' } as BookingEngineConfig;
  const preview = createEditorPreview(config);
  previews.push(preview);
  await waitFor(() => expect(preview.ctx.core.state.get().properties.map((p) => p.id)).toEqual([42]));
  preview.selectProperty(42);
  preview.ctx.core.state.set({ checkIn: '2027-06-10', checkOut: '2027-06-13' }, 'dateSelected');
  expect(preview.ctx.core.state.get().pricing?.total).toBe(622.25);
  expect([...preview.ctx.core.state.get().availability.values()][0]).toMatchObject({ minPrice: 180.75, minNights: 2 });
  preview.reseed({ ...config, featuredPropertyIds: '[41]' });
  await waitFor(() => expect(preview.ctx.core.state.get().properties.map((p) => p.id)).toEqual([41]));
  expect(preview.ctx.core.state.get()).toMatchObject({ selectedPropertyId: 41, checkIn: '2027-06-10', checkOut: '2027-06-13' });
  expect(preview.ctx.core.state.get().pricing?.total).toBe(421.5);
  expect([...preview.ctx.core.state.get().availability.values()][0].minPrice).toBe(120.5);
  expect(propertiesApi.getAll).toHaveBeenCalledTimes(2);
});

it('does not keep a bookable preview quote after capacity or minimum-night constraints fail', async () => {
  const preview = createEditorPreview({ dataSourceMode: 'REAL', featuredPropertyIds: '[42]' } as BookingEngineConfig);
  previews.push(preview);
  await waitFor(() => expect(preview.ctx.core.state.get().properties[0]?.id).toBe(42));
  const state = preview.ctx.core.state;
  state.set({ checkIn: '2027-06-10', checkOut: '2027-06-13' }, 'dateSelected');
  expect(state.get().pricing).not.toBeNull();
  state.set({ adults: 5 });
  expect(state.get().pricing).toBeNull();
  state.set({ adults: 2, checkOut: '2027-06-11' }, 'dateSelected');
  expect(state.get().pricing).toBeNull();
});
