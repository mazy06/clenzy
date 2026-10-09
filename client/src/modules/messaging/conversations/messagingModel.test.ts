import { describe, expect, it } from 'vitest';
import {
  deliveryState,
  groupByBucket,
  groupMessages,
  inboxBucket,
  sentimentPosition,
  sentimentTone,
  stayInfo,
} from './messagingModel';
import type { ThreadMessage } from './unified';

const NOW = new Date('2026-10-08T15:00:00');

describe('inboxBucket / groupByBucket', () => {
  it('classe par ancienneté, sur le jour calendaire et non sur 24 h glissantes', () => {
    expect(inboxBucket('2026-10-08T00:05:00', NOW)).toBe('today');
    expect(inboxBucket('2026-10-07T23:55:00', NOW)).toBe('yesterday');
    expect(inboxBucket('2026-10-03T10:00:00', NOW)).toBe('week');
    expect(inboxBucket('2026-09-20T10:00:00', NOW)).toBe('older');
    expect(inboxBucket(null, NOW)).toBe('older');
  });

  it('conserve l’ordre reçu et n’émet aucun groupe vide', () => {
    const items = [
      { id: 'a', lastAt: '2026-10-08T14:00:00' },
      { id: 'b', lastAt: '2026-10-08T09:00:00' },
      { id: 'c', lastAt: '2026-09-01T09:00:00' },
    ];
    const groups = groupByBucket(items, NOW);
    expect(groups.map((g) => g.bucket)).toEqual(['today', 'older']);
    expect(groups[0].items.map((i) => i.id)).toEqual(['a', 'b']);
  });
});

describe('groupMessages', () => {
  const msg = (id: number, at: string, over: Partial<ThreadMessage> = {}): ThreadMessage => ({
    id, at, out: false, text: `m${id}`, sender: 'Sofia', ...over,
  });

  it('découpe par jour et trie chronologiquement', () => {
    const days = groupMessages([
      msg(3, '2026-10-08T09:00:00'),
      msg(1, '2026-10-07T20:00:00'),
      msg(2, '2026-10-07T21:00:00'),
    ]);
    expect(days.map((d) => d.key)).toEqual(['2026-10-07', '2026-10-08']);
    expect(days[0].runs.map((r) => r.message.id)).toEqual([1, 2]);
  });

  it('forme des séries : avatar et heure ne se répètent pas pour un même auteur proche', () => {
    const [day] = groupMessages([
      msg(1, '2026-10-08T09:00:00'),
      msg(2, '2026-10-08T09:02:00'),
      msg(3, '2026-10-08T09:03:00'),
    ]);
    expect(day.runs.map((r) => [r.first, r.last])).toEqual([[true, false], [false, false], [false, true]]);
  });

  it('coupe la série sur un changement d’auteur, de sens, de note ou après 5 minutes', () => {
    const [day] = groupMessages([
      msg(1, '2026-10-08T09:00:00'),
      msg(2, '2026-10-08T09:01:00', { sender: 'Karim' }),
      msg(3, '2026-10-08T09:02:00', { sender: 'Karim', out: true }),
      msg(4, '2026-10-08T09:03:00', { sender: 'Karim', out: true, internalNote: true }),
      msg(5, '2026-10-08T09:20:00', { sender: 'Karim', out: true, internalNote: true }),
    ]);
    expect(day.runs.map((r) => r.first)).toEqual([true, true, true, true, true]);
  });
});

describe('deliveryState', () => {
  it('ne reconnaît que les statuts connus, insensiblement à la casse', () => {
    expect(deliveryState('read')).toBe('read');
    expect(deliveryState('DELIVERED')).toBe('delivered');
    expect(deliveryState('sent')).toBe('sent');
    expect(deliveryState('FAILED')).toBe('failed');
    expect(deliveryState('PENDING')).toBeNull();
    expect(deliveryState(undefined)).toBeNull();
  });
});

describe('stayInfo', () => {
  const conv = (checkIn: string | null, checkOut: string | null, reservationId: number | null = 5) => ({
    reservationId, checkIn, checkOut,
  });

  it('sans réservation ni date d’arrivée, rien n’est inventé', () => {
    expect(stayInfo(conv('2026-10-10', '2026-10-12', null), NOW)).toBeNull();
    expect(stayInfo(conv(null, null), NOW)).toBeNull();
  });

  it('dit où en est le séjour et compte les nuits', () => {
    expect(stayInfo(conv('2026-10-10', '2026-10-13'), NOW)).toMatchObject({ key: 'upcoming', nights: 3 });
    expect(stayInfo(conv('2026-10-06', '2026-10-10'), NOW)).toMatchObject({ key: 'current', nights: 4 });
    expect(stayInfo(conv('2026-10-01', '2026-10-05'), NOW)).toMatchObject({ key: 'past', nights: 4 });
  });

  it('le jour du départ le séjour est encore en cours', () => {
    expect(stayInfo(conv('2026-10-05', '2026-10-08'), NOW)?.key).toBe('current');
  });

  it('sans départ connu, un séjour commencé reste en cours', () => {
    expect(stayInfo(conv('2026-10-05', null), NOW)).toMatchObject({ key: 'current', nights: null });
  });
});

describe('sentiment', () => {
  it('traduit le libellé serveur en ton', () => {
    expect(sentimentTone('NEGATIVE')).toBe('negative');
    expect(sentimentTone('positive')).toBe('positive');
    expect(sentimentTone('NEUTRAL')).toBe('neutral');
    expect(sentimentTone(undefined)).toBe('neutral');
  });

  it('place le score sur une jauge bornée', () => {
    expect(sentimentPosition(-1)).toBe(0);
    expect(sentimentPosition(0)).toBe(50);
    expect(sentimentPosition(1)).toBe(100);
    expect(sentimentPosition(7)).toBe(100);
    expect(sentimentPosition(Number.NaN)).toBe(50);
  });
});
