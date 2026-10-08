import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { createIcon } from '../createIcon';
import { Star, Home, CheckCircle, Trash2 } from '../glyphs';

const Probe = createIcon('ProbeIcon', {
  duotone: { body: '<path data-w="duotone"/>' },
  outline: { body: '<path data-w="outline"/>' },
  filled: { body: '<path data-w="filled"/>' },
});

const weightOf = (container: HTMLElement) => container.querySelector('path')?.getAttribute('data-w');

describe('createIcon', () => {
  it('sert le duotone par défaut', () => {
    const { container } = render(<Probe />);
    expect(weightOf(container)).toBe('duotone');
  });

  it('traduit `fill` façon Lucide : vide → contour, couleur → plein teinté', () => {
    expect(weightOf(render(<Probe fill="none" />).container)).toBe('outline');
    const { container } = render(<Probe fill="var(--gold)" />);
    expect(weightOf(container)).toBe('filled');
    expect(container.querySelector('svg')?.style.color).toBe('var(--gold)');
  });

  it('`weight` explicite prime sur `fill`, et retombe sur une variante existante', () => {
    expect(weightOf(render(<Probe weight="outline" fill="currentColor" />).container)).toBe('outline');
    const OutlineOnly = createIcon('OutlineOnly', { outline: { body: '<path data-w="outline"/>' } });
    expect(weightOf(render(<OutlineOnly weight="filled" />).container)).toBe('outline');
  });

  it('relaie size, color, className et masque l’icône décorative aux lecteurs d’écran', () => {
    const { container } = render(<Probe size={16} color="red" className="extra" strokeWidth={1.5} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('16');
    expect(svg.getAttribute('height')).toBe('16');
    expect(svg.style.color).toBe('red');
    expect(svg.getAttribute('class')).toBe('reicon reicon-probe-icon extra');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.hasAttribute('stroke-width')).toBe(false);
  });

  it('expose l’icône quand elle est étiquetée', () => {
    const { container } = render(<Probe aria-label="Favori" />);
    expect(container.querySelector('svg')?.hasAttribute('aria-hidden')).toBe(false);
  });
});

describe('glyphes Reicon générés', () => {
  it('branchent les noms historiques Lucide sur des glyphes réels', () => {
    for (const Glyph of [Home, CheckCircle, Trash2]) {
      const { container } = render(<Glyph />);
      expect(container.querySelector('svg g')?.innerHTML).toMatch(/<path/);
    }
  });

  it('privilégient le duotone (aplat à 50 %)', () => {
    const { container } = render(<Home />);
    expect(container.querySelector('svg g')?.innerHTML).toContain('opacity=".5"');
  });

  it('servent la variante pleine aux étoiles de notation', () => {
    const empty = render(<Star fill="none" />).container.querySelector('svg g')?.innerHTML;
    const full = render(<Star fill="currentColor" />).container.querySelector('svg g')?.innerHTML;
    expect(empty).not.toBe(full);
  });
});
