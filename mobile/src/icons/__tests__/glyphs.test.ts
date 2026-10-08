import { GLYPHS } from '../glyphs';

describe('GLYPHS (Reicon, noms Ionicons)', () => {
  it('sert le duotone pour les noms -outline', () => {
    expect(GLYPHS['home-outline']).toContain('opacity');
  });

  it('distingue la variante pleine de sa version -outline (états actifs)', () => {
    expect(GLYPHS.star).not.toBe(GLYPHS['star-outline']);
    expect(GLYPHS.checkbox).not.toBe(GLYPHS['square-outline']);
  });

  it('ne contient que des corps SVG remplis en currentColor', () => {
    const invalid = Object.entries(GLYPHS)
      .filter(([, body]) => !body.startsWith('<') || !body.includes('currentColor'))
      .map(([name]) => name);
    expect(invalid).toEqual([]);
  });
});
