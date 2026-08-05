import { describe, it, expect } from 'vitest';
import { shortcutDisplay, shortcutAria, formatChord } from '../shortcuts';
import type { CommandDescriptor } from '../types';

const base: CommandDescriptor = {
  id: 'nav:/dashboard',
  section: 'navigation',
  label: 'Tableau de bord',
  run: () => {},
};

describe('shortcutDisplay', () => {
  it('découpe un accord en une touche par pastille', () => {
    expect(shortcutDisplay({ ...base, chord: ['g', 'd'] })).toEqual({
      keys: ['G', 'D'],
      sequence: true,
    });
  });

  it('marque un raccourci à modificateur comme NON séquentiel', () => {
    // `⌘B` s'enfonce d'un bloc : l'afficher comme une suite induirait en erreur.
    expect(shortcutDisplay({ ...base, shortcutLabel: '⌘B' })).toEqual({
      keys: ['⌘B'],
      sequence: false,
    });
  });

  it('ne renvoie rien quand la commande n’a pas de raccourci', () => {
    expect(shortcutDisplay(base)).toBeUndefined();
  });

  it('donne la priorité à l’accord sur le libellé explicite', () => {
    const display = shortcutDisplay({ ...base, chord: ['g', 'd'], shortcutLabel: '⌘D' });
    expect(display).toEqual({ keys: ['G', 'D'], sequence: true });
  });
});

describe('shortcutAria', () => {
  it('énonce un accord comme une suite de touches', () => {
    expect(shortcutAria({ keys: ['G', 'D'], sequence: true })).toBe('G puis D');
  });

  it('énonce une combinaison telle quelle', () => {
    expect(shortcutAria({ keys: ['⌘B'], sequence: false })).toBe('⌘B');
  });
});

describe('formatChord', () => {
  it('met les touches en capitales', () => {
    expect(formatChord(['g', 'p'])).toBe('G P');
  });
});
