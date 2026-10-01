import { describe, expect, it } from 'vitest';
import { resolveSiteLanguage } from './siteLanguage';

/**
 * Quelle langue voit un visiteur de la landing.
 *
 * <p>Le site etait en francais en dur pendant que le lancement se preparait en
 * Arabie saoudite : un prospect a Riyad recevait une page francaise, sans
 * recours. L'ordre des signaux est donc ce qui compte ici.</p>
 */
describe('Langue du site public', () => {
  it('obéit d’abord au lien', () => {
    // Une page publique se partage : le lien doit porter sa langue.
    expect(resolveSiteLanguage('?lang=ar', ['fr-FR'], 'en')).toBe('ar');
  });

  it('retient ensuite le choix déjà posé dans la session', () => {
    // Sans cela, chaque navigation interne reperdrait le choix.
    expect(resolveSiteLanguage('', ['fr-FR'], 'ar')).toBe('ar');
  });

  it('suit enfin la langue du navigateur', () => {
    expect(resolveSiteLanguage('', ['ar-SA', 'en-US'], null)).toBe('ar');
  });

  it('conserve la langue du HTML prérendu pour une URL sans paramètre', () => {
    expect(resolveSiteLanguage('', ['en-US'], null, 'fr')).toBe('fr');
    expect(resolveSiteLanguage('?lang=ar', ['en-US'], null, 'fr')).toBe('ar');
    expect(resolveSiteLanguage('', ['en-US'], 'ar', 'fr')).toBe('ar');
  });

  it('retient la première langue RECONNUE du navigateur', () => {
    // Un navigateur regle sur ['es-ES', 'ar'] doit donner l'arabe, pas le
    // repli francais.
    expect(resolveSiteLanguage('', ['es-ES', 'ar'], null)).toBe('ar');
  });

  it('ignore une langue de lien non supportée', () => {
    expect(resolveSiteLanguage('?lang=de', ['en-GB'], null)).toBe('en');
  });

  it('retombe sur le français quand aucun signal ne parle', () => {
    expect(resolveSiteLanguage('', ['es-ES'], null)).toBe('fr');
    expect(resolveSiteLanguage('', [], null)).toBe('fr');
  });
});
