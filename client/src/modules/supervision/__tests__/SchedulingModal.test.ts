import { describe, expect, it } from 'vitest';
import { toLocalIso } from '../components/SchedulingModal';
import { familyOf, opensModal } from '../components/actionRegistry';

/**
 * Deux pièges silencieux de la planification : le fuseau, qui peut décaler la
 * mission d'un jour, et l'aiguillage des cartes vers la modale.
 */
describe('toLocalIso', () => {
  it('compose la date locale sans passer par UTC', () => {
    // Minuit trente : c'est là que `toISOString()` bascule sur la veille pour
    // tout fuseau à l'est de Greenwich.
    const day = new Date(2026, 7, 25, 0, 30);

    expect(toLocalIso(day, '09:00')).toBe('2026-08-25T09:00:00');
  });

  it('complète les composantes sur deux chiffres', () => {
    expect(toLocalIso(new Date(2026, 0, 5), '08:05')).toBe('2026-01-05T08:05:00');
  });

  it('retombe sur l’heure par défaut quand la saisie est vide', () => {
    // Un champ `time` vidé rend '' — sans repli, on construirait `…T:00`.
    expect(toLocalIso(new Date(2026, 7, 25), '')).toBe('2026-08-25T10:00:00');
  });
});

describe('famille « planification »', () => {
  it('reconnaît les deux cartes qui créent une intervention', () => {
    expect(familyOf('LOCK_BATTERY_REPLACE')).toBe('schedule');
    expect(familyOf('PREVENTIVE_MAINTENANCE')).toBe('schedule');
  });

  it('n’y range aucune autre carte', () => {
    expect(familyOf('CALENDAR_BLOCK')).toBe('params');
    expect(familyOf('TYPE_INEXISTANT')).toBeNull();
    // PRICE_DROP est déclaré au registre pour son TEXTE, mais garde son éditeur :
    // il a donc une famille sans pour autant ouvrir une modale générique.
    expect(opensModal('PRICE_DROP')).toBe(false);
  });
});
