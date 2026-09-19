import { describe, it, expect } from 'vitest';
import {
  getInlineScroll,
  nudgeInlineScroll,
  setInlineScroll,
} from '../inlineScroll';

/**
 * jsdom ne met pas en page : `scrollLeft` y est un simple champ. C'est
 * suffisant — ce qu'on verifie ici est la CONVENTION DE SIGNE, pas le
 * defilement lui-meme.
 */
function scroller(scrollLeft = 0): HTMLElement {
  const el = document.createElement('div');
  el.scrollLeft = scrollLeft;
  return el;
}

describe('getInlineScroll', () => {
  it('lit un decalage positif en LTR', () => {
    expect(getInlineScroll(scroller(640))).toBe(640);
  });

  it('lit le meme decalage positif quand le navigateur rend du negatif (RTL)', () => {
    expect(getInlineScroll(scroller(-640))).toBe(640);
  });
});

describe('setInlineScroll', () => {
  it('ecrit tel quel en LTR', () => {
    const el = scroller();
    setInlineScroll(el, 640, false);
    expect(el.scrollLeft).toBe(640);
  });

  it('ecrit un negatif en RTL — un positif serait ecrete a 0', () => {
    const el = scroller();
    setInlineScroll(el, 640, true);
    expect(el.scrollLeft).toBe(-640);
  });
});

describe('nudgeInlineScroll', () => {
  it('avance dans le contenu en LTR', () => {
    const el = scroller(100);
    nudgeInlineScroll(el, 50, false);
    expect(el.scrollLeft).toBe(150);
  });

  it('avance dans le CONTENU en RTL, donc vers la gauche de l ecran', () => {
    const el = scroller(-100);
    nudgeInlineScroll(el, 50, true);
    expect(el.scrollLeft).toBe(-150);
  });

  it('recule vers le debut du contenu sans jamais passer du bon cote', () => {
    const el = scroller(-100);
    nudgeInlineScroll(el, -40, true);
    expect(el.scrollLeft).toBe(-60);
  });
});
