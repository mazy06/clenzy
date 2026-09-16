import { useState } from 'react';

export type ProviderLanguage = 'fr' | 'en' | 'ar';

export function resolveProviderLanguage(search: string, browserLanguage: string): ProviderLanguage {
  const requested = new URLSearchParams(search).get('lang');
  const value = (requested || browserLanguage).toLowerCase().split('-')[0];
  return value === 'en' || value === 'ar' ? value : 'fr';
}

/** Préférence publique portée par le lien, sans stockage d'identité ni de secret. */
export function useProviderLanguage() {
  const [language, setLanguage] = useState<ProviderLanguage>(() =>
    resolveProviderLanguage(window.location.search, navigator.language));
  const changeLanguage = (next: ProviderLanguage) => {
    setLanguage(next);
    const params = new URLSearchParams(window.location.search);
    params.set('lang', next);
    window.history.replaceState(window.history.state, '', window.location.pathname + '?' + params.toString());
  };
  return { language, changeLanguage, direction: language === 'ar' ? 'rtl' as const : 'ltr' as const };
}

export function ProviderLanguagePicker({ language, onChange }: {
  language: ProviderLanguage; onChange: (language: ProviderLanguage) => void;
}) {
  const label = { fr: 'Langue', en: 'Language', ar: 'اللغة' }[language];
  return <label className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
    {label}
    <select value={language} onChange={event => onChange(event.target.value as ProviderLanguage)}
      className="cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-foreground focus-visible:ring-2 focus-visible:ring-primary">
      <option value="fr" lang="fr">Français</option>
      <option value="en" lang="en">English</option>
      <option value="ar" lang="ar">العربية</option>
    </select>
  </label>;
}
