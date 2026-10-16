import { describe, expect, it } from 'vitest';
import { BrushCleaning, ClipboardList, Droplets, Wrench } from '../../../icons/glyphs';
import { prestationTypeIcon } from './prestationVisuals';

describe('prestationTypeIcon', () => {
  it('donne à chaque métier son icône, jamais l’engrenage', () => {
    expect(prestationTypeIcon('CLEANING')).toBe(BrushCleaning);
    expect(prestationTypeIcon('plumbing_repair')).toBe(Droplets);
    expect(prestationTypeIcon('CLEANING')).not.toBe(Wrench);
  });

  it('retombe sur une icône neutre pour un type inconnu', () => {
    expect(prestationTypeIcon('SOMETHING_NEW')).toBe(ClipboardList);
    expect(prestationTypeIcon(null)).toBe(ClipboardList);
  });
});
