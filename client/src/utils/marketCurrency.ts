import { normalizeLanguage } from './localeDate';

/**
 * Devise d'affichage d'un prix PUBLIC, deduite de la langue du lecteur.
 *
 * <p>Regle produit : la langue dit le marche. Un lecteur arabophone est un
 * prospect saoudien et voit des riyals ; un francophone voit des dirhams ; un
 * anglophone, des euros.</p>
 *
 * <p><b>Ce n'est pas la devise de facturation.</b> Celle-ci suit le pays de
 * l'organisation ({@code countryDefaults}) et se decide apres souscription.
 * Ici, il ne s'agit que de la vitrine : afficher un tarif dans une monnaie que
 * le prospect manipule.</p>
 *
 * <p>Le francais couvre DEUX marches — la France et le Maroc — et la regle
 * tranche pour le dirham. Un prospect francais verra donc des dirhams : c'est
 * un arbitrage assume tant que la France n'est pas un marche de lancement.</p>
 */
export type MarketCurrency = 'SAR' | 'MAD' | 'EUR';

const BY_LANGUAGE: Record<'ar' | 'fr' | 'en', MarketCurrency> = {
  ar: 'SAR',
  fr: 'MAD',
  en: 'EUR',
};

export function currencyForLanguage(language: string | undefined | null): MarketCurrency {
  return BY_LANGUAGE[normalizeLanguage(language)];
}
