/*
  Baitly Académie · catalogue des épisodes vidéo publiés sur la landing.
  GÉNÉRÉ par marketing/motion/academie-web.mjs à partir des sources de montage : ne pas éditer à la
  main (durée et chapitres suivent la voix calée). Transcriptions : baitlyAcademyTranscripts.ts.
  Textes affichés (titres, chapitres, programme) : lib/messages/baitlyAcademy.ts.
  Fichiers : vidéos sous ACADEMY_MEDIA_BASE (relayées vers le stockage objet en production, voir
  docker-runtime-config.sh), aperçus sous ACADEMY_POSTER_BASE (servis par le site).
*/
export type AcademyTheme = 'piloter' | 'revenus' | 'reglementation' | 'operations' | 'securite' | 'conciergeries';
export type AcademyFormat = '16x9' | '9x16';
export type AcademyQuality = '1080' | '720';

export interface AcademyEpisode {
  /** Segment d'URL : /ressources/academie/<slug>. */
  slug: string;
  /** Numéro dans le programme de la série (01 à 20). */
  number: string;
  theme: AcademyTheme;
  /** Date de mise en ligne (AAAA-MM-JJ). */
  uploadDate: string;
  /** Durée en secondes. */
  duration: number;
  /** Début de chaque chapitre, en secondes. */
  chapters: readonly number[];
  /** Langues dans lesquelles la vidéo existe. */
  languages: readonly ('fr' | 'en' | 'ar')[];
}

export const ACADEMY_MEDIA_BASE = '/academie/media';
export const ACADEMY_POSTER_BASE = '/academie/posters';

export const ACADEMY_EPISODES: readonly AcademyEpisode[] = [
  {
    "slug": "01-kpi",
    "number": "01",
    "theme": "piloter",
    "uploadDate": "2026-09-29",
    "duration": 163.1,
    "chapters": [
      0.2,
      11.4,
      41.7,
      66.5,
      92.2,
      115.4,
      142.7
    ],
    "languages": [
      "fr"
    ]
  },
  {
    "slug": "02-revenu-net",
    "number": "02",
    "theme": "piloter",
    "uploadDate": "2026-09-29",
    "duration": 134.6,
    "chapters": [
      0.2,
      11.8,
      31.2,
      50.2,
      78.7,
      99,
      116.3
    ],
    "languages": [
      "fr"
    ]
  },
  {
    "slug": "18-direct-ou-plateforme",
    "number": "18",
    "theme": "revenus",
    "uploadDate": "2026-09-29",
    "duration": 137.1,
    "chapters": [
      0.2,
      12.6,
      41.7,
      62.3,
      76.9,
      106.7,
      115.4
    ],
    "languages": [
      "fr"
    ]
  },
  {
    "slug": "03-delai-duree",
    "number": "03",
    "theme": "piloter",
    "uploadDate": "2026-09-29",
    "duration": 122.6,
    "chapters": [
      0.2,
      11.9,
      47.9,
      75.7,
      94.3,
      103.9
    ],
    "languages": [
      "fr"
    ]
  },
  {
    "slug": "04-qualite",
    "number": "04",
    "theme": "piloter",
    "uploadDate": "2026-09-29",
    "duration": 100.4,
    "chapters": [
      0.2,
      11.5,
      36.6,
      60.1,
      76.2,
      84
    ],
    "languages": [
      "fr"
    ]
  },
  {
    "slug": "17-prix-dynamique",
    "number": "17",
    "theme": "revenus",
    "uploadDate": "2026-09-30",
    "duration": 143.1,
    "chapters": [
      0.2,
      14.3,
      49.4,
      84.3,
      109.9,
      122.8
    ],
    "languages": [
      "fr"
    ]
  },
  {
    "slug": "19-extras",
    "number": "19",
    "theme": "revenus",
    "uploadDate": "2026-09-30",
    "duration": 145.1,
    "chapters": [
      0.2,
      13.8,
      49.2,
      86.7,
      110.2,
      125.7
    ],
    "languages": [
      "fr"
    ]
  },
  {
    "slug": "13-menage-rotation",
    "number": "13",
    "theme": "operations",
    "uploadDate": "2026-09-30",
    "duration": 153.4,
    "chapters": [
      0.2,
      13.6,
      51.9,
      93.5,
      116,
      131
    ],
    "languages": [
      "fr"
    ]
  },
  {
    "slug": "14-questions-voyageurs",
    "number": "14",
    "theme": "operations",
    "uploadDate": "2026-09-30",
    "duration": 121.7,
    "chapters": [
      0.2,
      12.2,
      31,
      62.7,
      86,
      99.1
    ],
    "languages": [
      "fr"
    ]
  }
];

export function academyEpisode(slug: string | undefined): AcademyEpisode | undefined {
  return ACADEMY_EPISODES.find((episode) => episode.slug === slug);
}

export function academyVideoUrl(episode: AcademyEpisode, language: 'fr' | 'en' | 'ar', format: AcademyFormat, quality: AcademyQuality): string {
  const lang = episode.languages.includes(language) ? language : episode.languages[0];
  return `${ACADEMY_MEDIA_BASE}/${lang}/${episode.slug}-${format}-${quality}.mp4`;
}

export function academyPosterUrl(episode: AcademyEpisode, format: AcademyFormat): string {
  return `${ACADEMY_POSTER_BASE}/${episode.slug}-${format}.jpg`;
}
