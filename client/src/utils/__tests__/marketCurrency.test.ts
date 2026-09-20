import { describe, expect, it } from 'vitest';
import { currencyForLanguage } from '../marketCurrency';

/**
 * La devise affichee sur une page publique suit la LANGUE du lecteur : un
 * prospect saoudien qui lit l'arabe ne doit pas voir des dirhams.
 */
describe('Devise d’affichage par langue', () => {
  it('sert des riyals à un lecteur arabophone', () => {
    expect(currencyForLanguage('ar')).toBe('SAR');
  });

  it('sert des dirhams à un lecteur francophone', () => {
    expect(currencyForLanguage('fr')).toBe('MAD');
  });

  it('sert des euros à un lecteur anglophone', () => {
    expect(currencyForLanguage('en')).toBe('EUR');
  });

  it('accepte les variantes régionales', () => {
    // Le detecteur i18next peut poser `ar-SA` la ou `resolvedLanguage` vaut
    // `ar` : un seul caractere de region ne doit pas changer la devise.
    expect(currencyForLanguage('ar-SA')).toBe('SAR');
    expect(currencyForLanguage('fr-MA')).toBe('MAD');
    expect(currencyForLanguage('en-GB')).toBe('EUR');
  });

  it('retombe sur le dirham pour une langue inconnue', () => {
    // `normalizeLanguage` ramene tout inconnu sur le francais, comme
    // `fallbackLng` : la devise suit, plutot que de rendre `undefined`.
    expect(currencyForLanguage('es')).toBe('MAD');
    expect(currencyForLanguage(undefined)).toBe('MAD');
    expect(currencyForLanguage(null)).toBe('MAD');
  });
});
