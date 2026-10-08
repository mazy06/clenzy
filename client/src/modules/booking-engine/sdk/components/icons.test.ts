import { describe, it, expect } from 'vitest';
import { amenityIcon, heart, star, users, check } from './icons';

describe('icônes du widget (Reicon)', () => {
  it('construit un SVG statique sans innerHTML, rempli en currentColor', () => {
    const svg = users();
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    const g = svg.firstElementChild!;
    expect(g.getAttribute('fill')).toBe('currentColor');
    expect(g.getAttribute('stroke')).toBe('none');
    expect(svg.querySelectorAll('circle, ellipse, path').length).toBeGreaterThan(0);
  });

  it('privilégie le duotone (second ton translucide)', () => {
    expect(users().querySelector('[opacity]')).not.toBeNull();
  });

  it('distingue état plein et contour (note, favori)', () => {
    expect(star(true).innerHTML).not.toBe(star(false).innerHTML);
    expect(heart(true).innerHTML).not.toBe(heart(false).innerHTML);
  });

  it('retombe sur une icône générique pour un équipement inconnu', () => {
    expect(amenityIcon('CUSTOM_XYZ').querySelector('path')).not.toBeNull();
    expect(amenityIcon('WIFI').innerHTML).not.toBe(amenityIcon('CUSTOM_XYZ').innerHTML);
  });

  it('crée un nouveau nœud à chaque appel', () => {
    expect(check()).not.toBe(check());
  });
});
