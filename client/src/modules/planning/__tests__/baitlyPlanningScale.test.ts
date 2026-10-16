import { describe, expect, it, vi } from 'vitest';
import { BaitlyPlanningReadQueue } from '../../../services/baitlyPlanningReadQueue';
import { detectConflicts, detectBaitlyConflictEventIds } from '../utils/conflictUtils';
import { computeDayOccupiedCounts } from '../PlanningOccupancyRow';
import { mergeBaitlyReservationDetails } from '../hooks/useBaitlyReservationDetails';
import type { PlanningEvent } from '../types';
import type { Reservation } from '../../../services/api';

function stay(id: number, propertyId: number, startDate: string, endDate: string): PlanningEvent {
  return { id: `res-${id}`, propertyId, startDate, endDate, type: 'reservation', status: 'confirmed', label: '', color: '' };
}

describe('montée en volume du planning Baitly', () => {
  it('les IDs de conflits restent identiques aux paires sur des intervalles imbriqués et adjacents', () => {
    const events = [stay(1, 1, '2026-10-01', '2026-10-20'), stay(2, 1, '2026-10-02', '2026-10-03'),
      stay(3, 1, '2026-10-04', '2026-10-05'), stay(4, 1, '2026-10-20', '2026-10-21'),
      stay(5, 2, '2026-10-01', '2026-10-20'), { ...stay(6, 1, '2026-10-01', '2026-10-20'), status: 'cancelled' }];
    const expected = new Set(detectConflicts(events).flatMap(({ eventA, eventB }) => [eventA.id, eventB.id]));
    expect(detectBaitlyConflictEventIds(events)).toEqual(expected);
  });

  it('traite 10 000 séjours superposés sans construire 49 995 000 paires', () => {
    const events = Array.from({ length: 10_000 }, (_, i) => stay(i, 1, '2026-10-01', '2026-10-31'));
    expect(detectBaitlyConflictEventIds(events).size).toBe(10_000);
  });

  it('retrouve exactement les conflits et l’occupation sur 500 intervalles variés', () => {
    let seed = 42;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed; };
    const date = (offset: number) => new Date(Date.UTC(2026, 9, 1 + offset)).toISOString().slice(0, 10);
    const events = Array.from({ length: 500 }, (_, i) => {
      const start = random() % 90;
      const event = stay(i, random() % 50, date(start), date(start + 1 + random() % 15));
      if (i % 13 === 0) event.status = 'cancelled';
      return event;
    });
    expect(detectBaitlyConflictEventIds(events)).toEqual(new Set(detectConflicts(events)
      .flatMap(({ eventA, eventB }) => [eventA.id, eventB.id])));
    const days = Array.from({ length: 90 }, (_, i) => new Date(`${date(i)}T12:00:00`));
    const expected = days.map((_, i) => new Set(events.filter((event) => event.status !== 'cancelled'
      && event.startDate <= date(i) && date(i) < event.endDate).map((event) => event.propertyId)).size);
    expect(computeDayOccupiedCounts(days, events)).toEqual(expected);
  });

  it('compte chaque logement une fois, avec jours non triés, doublons et départ exclusif', () => {
    const events = [stay(1, 1, '2026-10-01', '2026-10-04'), stay(2, 1, '2026-10-02', '2026-10-05'),
      stay(3, 2, '2026-10-02', '2026-10-03'), { ...stay(4, 3, '2026-10-01', '2026-10-10'), status: 'cancelled' }];
    const days = ['2026-10-05', '2026-10-02', '2026-10-04', '2026-10-02', '2026-10-01'].map((s) => new Date(`${s}T12:00:00`));
    expect(computeDayOccupiedCounts(days, events)).toEqual([0, 2, 1, 2, 1]);
  });

  it('conserve les séjours hors page pour la validation, en enrichissant seulement la page', () => {
    const index = [{ id: 1, propertyId: 1 }, { id: 2, propertyId: 2 }] as Reservation[];
    const detail = { id: 1, propertyId: 1, guestEmail: 'alice@example.test' } as Reservation;
    const merged = mergeBaitlyReservationDetails(index, [detail]);
    expect(merged[0]).toBe(detail);
    expect(merged[1]).toBe(index[1]);
  });

  it('borne les lectures et retire les demandes annulées avant leur départ', async () => {
    const queue = new BaitlyPlanningReadQueue(1);
    let release!: () => void;
    const first = queue.run(undefined, () => new Promise<void>((resolve) => { release = resolve; }));
    const controller = new AbortController();
    const neverRead = vi.fn(async () => 2);
    const aborted = queue.run(controller.signal, neverRead);
    const rejection = expect(aborted).rejects.toMatchObject({ name: 'AbortError' });
    const nextRead = vi.fn(async () => 3);
    const third = queue.run(undefined, nextRead);
    await Promise.resolve();
    expect(nextRead).not.toHaveBeenCalled();
    controller.abort();
    await rejection;
    release();
    await first;
    expect(await third).toBe(3);
    expect(neverRead).not.toHaveBeenCalled();
  });

  it('libère aussi un créneau après une erreur réseau', async () => {
    const queue = new BaitlyPlanningReadQueue(1);
    const failed = queue.run(undefined, async () => { throw new Error('network'); });
    const next = queue.run(undefined, async () => 42);
    await expect(failed).rejects.toThrow('network');
    expect(await next).toBe(42);
  });
});
