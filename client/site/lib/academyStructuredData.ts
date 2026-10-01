/*
  Baitly Académie · données structurées schema.org (VideoObject) d'une page d'épisode.
  Utilisées par l'outillage de build (en-têtes HTML prégénérés, lus par les moteurs de recherche) et
  par SiteMetadata lors de la navigation dans le site. Chaque chapitre devient un Clip avec un lien
  horodaté (?t=) que la page sait ouvrir : les moteurs peuvent alors afficher les moments clés.
  La transcription est aussi consultable sur la page et dans sa version Markdown.
*/
import {
  academyPosterUrl,
  academyVideoUrl,
  type AcademyEpisode,
} from '../data/baitlyAcademyVideos';
import { academyTranscript } from './academyTranscript';
import { BAITLY_ACADEMY_MESSAGES } from './messages/baitlyAcademy';
import type { SiteLanguage } from './siteLanguage';

export interface AcademyVideoMetadata {
  /** Objet JSON-LD prêt à sérialiser. */
  jsonLd: Record<string, unknown>;
  poster: string;
  video: string;
}

/** Durée ISO 8601 (PT2M43S). */
export const isoDuration = (seconds: number) => {
  const total = Math.round(seconds);
  return `PT${Math.floor(total / 60)}M${total % 60}S`;
};

export function academyVideoMetadata(
  episode: AcademyEpisode,
  language: SiteLanguage,
  origin: string,
): AcademyVideoMetadata {
  const text = BAITLY_ACADEMY_MESSAGES[language].episodes[episode.slug];
  const page = `${origin}/ressources/academie/${episode.slug}`;
  const canonical = `${page}${language === 'fr' ? '' : `?lang=${language}`}`;
  const at = (seconds: number) =>
    `${page}?${language === 'fr' ? '' : `lang=${language}&`}t=${Math.round(seconds)}`;
  const poster = origin + academyPosterUrl(episode, '16x9');
  const video = origin + academyVideoUrl(episode, language, '16x9', '1080');
  return {
    poster,
    video,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      '@id': `${canonical}#video`,
      url: canonical,
      mainEntityOfPage: canonical,
      name: text.title,
      description: text.description,
      thumbnailUrl: [poster, origin + academyPosterUrl(episode, '9x16')],
      uploadDate: episode.uploadDate,
      duration: isoDuration(episode.duration),
      contentUrl: video,
      inLanguage: episode.languages.includes(language)
        ? language
        : episode.languages[0],
      isAccessibleForFree: true,
      transcript: academyTranscript(episode.slug, language)?.text,
      publisher: { '@type': 'Organization', name: 'Baitly', url: origin },
      hasPart: episode.chapters.map((start, index) => ({
        '@type': 'Clip',
        name: text.chapters[index],
        startOffset: Math.round(start),
        endOffset: Math.round(episode.chapters[index + 1] ?? episode.duration),
        url: at(start),
      })),
    },
  };
}

/** JSON sûr dans une balise <script> : aucun « </script> » ni commentaire HTML possible. */
export const scriptSafeJson = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
