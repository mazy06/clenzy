import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Langue du site public.
 *
 * <p>La landing etait en francais EN DUR — `<html lang="fr">` — alors que le
 * lancement se fait en Arabie saoudite. Le mecanisme existait pourtant deja,
 * mais sur deux pages seulement : l'inscription et l'activation prestataire
 * (cf. `providerLanguage`, dont ce module generalise la logique au site
 * entier).</p>
 *
 * <p>La preference vit dans l'URL (`?lang=ar`), pas en stockage : un lien
 * partage porte alors sa langue, ce qui compte pour une page publique qu'on
 * s'envoie. Elle est neanmoins retenue pour la session, sinon chaque
 * navigation interne la perdrait.</p>
 */
export type SiteLanguage = 'fr' | 'en' | 'ar';

export const SITE_LANGUAGES: readonly SiteLanguage[] = ['fr', 'en', 'ar'];

/** Session et non local : c'est un choix de consultation, pas de compte. */
const SESSION_KEY = 'clenzy_site_lang';

function isSupported(value: string | null | undefined): value is SiteLanguage {
  return SITE_LANGUAGES.includes(value as SiteLanguage);
}

function readSession(): SiteLanguage | null {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    return isSupported(stored) ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Langue a servir, du signal le plus fort au plus faible.
 *
 * <p>L'URL l'emporte : c'est une demande explicite, portee par le lien. Vient
 * ensuite le choix deja pose dans la session, puis la langue du HTML publie.
 * Le navigateur sert de repli si le document ne porte aucune langue connue.
 * Une URL publique conserve ainsi son contenu apres le chargement du script.</p>
 */
export function resolveSiteLanguage(
  search: string,
  browserLanguages: readonly string[],
  stored: SiteLanguage | null = null,
  documentLanguage: string | null = null,
): SiteLanguage {
  const requested = new URLSearchParams(search).get('lang');
  if (isSupported(requested)) return requested;
  if (stored) return stored;
  // A pre-rendered URL must keep its published language after JavaScript loads.
  // Browser detection is only a fallback when no document language is supplied.
  if (isSupported(documentLanguage)) return documentLanguage;
  for (const tag of browserLanguages) {
    const base = (tag ?? '').toLowerCase().split('-')[0];
    if (isSupported(base)) return base;
  }
  return 'fr';
}

interface SiteLanguageValue {
  language: SiteLanguage;
  direction: 'ltr' | 'rtl';
  changeLanguage: (next: SiteLanguage) => void;
}

const SiteLanguageContext = createContext<SiteLanguageValue | null>(null);

export function SiteLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<SiteLanguage>(() =>
    resolveSiteLanguage(
      window.location.search,
      [...(navigator.languages ?? []), navigator.language],
      readSession(),
      document.documentElement.lang,
    ),
  );

  const direction = language === 'ar' ? 'rtl' : 'ltr';

  // Le document porte la langue et la direction : c'est ce que lisent les
  // lecteurs d'ecran, la cesure, et la bascule de police arabe de base.css.
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = direction;
  }, [language, direction]);

  const value = useMemo<SiteLanguageValue>(
    () => ({
      language,
      direction,
      changeLanguage: (next) => {
        setLanguage(next);
        try {
          sessionStorage.setItem(SESSION_KEY, next);
        } catch {
          // Navigation privee : le choix vaut au moins pour cette page.
        }
        const params = new URLSearchParams(window.location.search);
        params.set('lang', next);
        window.history.replaceState(
          window.history.state,
          '',
          `${window.location.pathname}?${params.toString()}${window.location.hash}`,
        );
      },
    }),
    [language, direction],
  );

  return (
    <SiteLanguageContext.Provider value={value}>
      {children}
    </SiteLanguageContext.Provider>
  );
}

export function useSiteLanguage(): SiteLanguageValue {
  const value = useContext(SiteLanguageContext);
  if (!value) {
    throw new Error('useSiteLanguage hors SiteLanguageProvider');
  }
  return value;
}

/**
 * Choisit la traduction d'un dictionnaire.
 *
 * <p>Les dictionnaires sont des objets par langue, de meme forme — comme le
 * corpus juridique. Un texte de marketing se relit comme un texte, pas comme
 * trois cents cles plates.</p>
 */
export function pick<T>(
  dict: Record<SiteLanguage, T>,
  language: SiteLanguage,
): T {
  return dict[language];
}
