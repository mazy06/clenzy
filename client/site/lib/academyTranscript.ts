import { ACADEMY_TRANSCRIPTS } from '../data/baitlyAcademyTranscripts';
import type { SiteLanguage } from './siteLanguage';

/** Keep the language of the actual text when a translation is not published yet. */
export function academyTranscript(slug: string, language: SiteLanguage) {
  const translations = ACADEMY_TRANSCRIPTS[slug];
  if (translations?.[language])
    return { text: translations[language], language };
  if (translations?.fr)
    return { text: translations.fr, language: 'fr' as const };
  return undefined;
}
