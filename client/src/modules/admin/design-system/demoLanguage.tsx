import { createContext, useContext } from 'react';

/** Explicit language for public, server-rendered demonstrations; the gallery keeps
 * its document language when no presentation provider is mounted. */
const DemoLanguageContext = createContext<string | null>(null);
export const DemoLanguageProvider = DemoLanguageContext.Provider;
export function useDemoLanguage() {
  const language = useContext(DemoLanguageContext);
  return (
    language ??
    (typeof document === 'undefined'
      ? 'fr'
      : (document.documentElement.lang || 'fr').split('-')[0])
  );
}
