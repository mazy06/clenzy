import { afterEach, describe, expect, it, vi } from 'vitest';
import { markBaitlyBoot } from '../baitlyBootTiming';

afterEach(() => vi.unstubAllGlobals());
describe('mesure du boot Baitly', () => {
  it('ne duplique pas les repères lors des rendus suivants', () => {
    const names = new Set<string>();
    const mark = vi.fn((name: string) => names.add(name));
    vi.stubGlobal('performance', { mark, getEntriesByName: (name: string) => names.has(name) ? [{}] : [] });
    markBaitlyBoot('user-ready'); markBaitlyBoot('user-ready'); markBaitlyBoot('root-render');
    expect(mark.mock.calls).toEqual([['baitly:boot:user-ready'], ['baitly:boot:root-render']]);
  });
  it('laisse démarrer l’application quand les mesures ne sont pas disponibles', () => {
    vi.stubGlobal('performance', undefined);
    expect(() => markBaitlyBoot('root-render')).not.toThrow();
  });
});
