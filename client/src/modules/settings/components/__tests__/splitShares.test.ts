import { describe, it, expect } from 'vitest';
import {
  redistributeShares,
  maxShareFor,
  isShareAdjustable,
  sumShares,
  type SplitShare,
} from '../splitShares';

const base = (): SplitShare[] => [
  { key: 'owner', value: 80 },
  { key: 'platform', value: 1 },
  { key: 'concierge', value: 19 },
];

describe('redistributeShares', () => {
  it('garde le total a 100 apres un ajustement', () => {
    const next = redistributeShares(base(), 'platform', 6);

    expect(sumShares(next)).toBe(100);
    expect(next.find((s) => s.key === 'platform')?.value).toBe(6);
  });

  it('repartit l ecart au prorata des parts libres', () => {
    // platform passe de 1 a 6 : 5 points a reprendre sur owner (80) et
    // concierge (19). Owner pese 80/99 de l'ensemble libre, donc encaisse
    // 4,04 points (80 - 4,04 = 75,96 -> 76,0 au dixieme) et concierge 0,96.
    const next = redistributeShares(base(), 'platform', 6);

    expect(next.find((s) => s.key === 'owner')?.value).toBe(76);
    expect(next.find((s) => s.key === 'concierge')?.value).toBe(18);
  });

  it('epargne totalement une part verrouillee', () => {
    const shares: SplitShare[] = [
      { key: 'owner', value: 80, locked: true },
      { key: 'platform', value: 1 },
      { key: 'concierge', value: 19 },
    ];

    const next = redistributeShares(shares, 'platform', 6);

    expect(next.find((s) => s.key === 'owner')?.value).toBe(80);
    // La conciergerie devient la seule variable d'ajustement.
    expect(next.find((s) => s.key === 'concierge')?.value).toBe(14);
    expect(sumShares(next)).toBe(100);
  });

  it('ne bouge rien quand toutes les autres parts sont verrouillees', () => {
    const shares: SplitShare[] = [
      { key: 'owner', value: 80, locked: true },
      { key: 'platform', value: 1 },
      { key: 'concierge', value: 19, locked: true },
    ];

    expect(redistributeShares(shares, 'platform', 6)).toEqual(shares);
  });

  it('plafonne la valeur a ce que les parts verrouillees laissent disponible', () => {
    const shares: SplitShare[] = [
      { key: 'owner', value: 70, locked: true },
      { key: 'platform', value: 10 },
      { key: 'concierge', value: 20 },
    ];

    const next = redistributeShares(shares, 'platform', 95);

    expect(next.find((s) => s.key === 'platform')?.value).toBe(30);
    expect(next.find((s) => s.key === 'concierge')?.value).toBe(0);
    expect(sumShares(next)).toBe(100);
  });

  it('refuse les valeurs negatives', () => {
    const next = redistributeShares(base(), 'owner', -15);

    expect(next.find((s) => s.key === 'owner')?.value).toBe(0);
    expect(sumShares(next)).toBe(100);
  });

  it('repartit a parts egales quand les absorbeurs sont a zero', () => {
    const shares: SplitShare[] = [
      { key: 'owner', value: 100 },
      { key: 'platform', value: 0 },
      { key: 'concierge', value: 0 },
    ];

    const next = redistributeShares(shares, 'owner', 50);

    expect(next.find((s) => s.key === 'platform')?.value).toBe(25);
    expect(next.find((s) => s.key === 'concierge')?.value).toBe(25);
    expect(sumShares(next)).toBe(100);
  });

  it('ne derive pas apres une longue serie d ajustements', () => {
    let shares = base();
    for (let i = 0; i < 200; i++) {
      shares = redistributeShares(shares, i % 2 === 0 ? 'platform' : 'concierge', (i % 37) + 0.3);
      expect(sumShares(shares)).toBe(100);
    }
  });

  it('ne mute pas le tableau d entree', () => {
    const shares = base();
    redistributeShares(shares, 'platform', 40);

    expect(shares.find((s) => s.key === 'platform')?.value).toBe(1);
  });
});

describe('maxShareFor', () => {
  it('vaut 100 sans aucun verrou', () => {
    expect(maxShareFor(base(), 'platform')).toBe(100);
  });

  it('retranche ce que retiennent les parts verrouillees', () => {
    const shares: SplitShare[] = [
      { key: 'owner', value: 70, locked: true },
      { key: 'platform', value: 10 },
      { key: 'concierge', value: 20 },
    ];

    expect(maxShareFor(shares, 'platform')).toBe(30);
  });
});

describe('isShareAdjustable', () => {
  it('est faux pour une part verrouillee', () => {
    const shares: SplitShare[] = [{ key: 'owner', value: 80, locked: true }, { key: 'rest', value: 20 }];

    expect(isShareAdjustable(shares, 'owner')).toBe(false);
  });

  it('est faux quand plus rien ne peut absorber', () => {
    const shares: SplitShare[] = [{ key: 'owner', value: 80, locked: true }, { key: 'rest', value: 20 }];

    expect(isShareAdjustable(shares, 'rest')).toBe(false);
  });

  it('est vrai des qu une autre part est libre', () => {
    expect(isShareAdjustable(base(), 'platform')).toBe(true);
  });
});
