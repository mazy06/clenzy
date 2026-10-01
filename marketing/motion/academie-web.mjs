/*
  Baitly Académie · export web des épisodes pour la landing (Ressources › Académie Baitly).

  À quoi sert ce fichier : à partir des vidéos rendues (out/<épisode>-fr-16x9.mp4 et -9x16.mp4) et des
  sources de montage (timeline.js : durée et chapitres calés sur la voix ; i18n.js : sous-titres), il
  produit :
    1. les vidéos web, deux qualités par format, lecture en continu (+faststart) :
       out/academie-web/fr/<slug>-16x9-1080.mp4, -16x9-720.mp4, -9x16-1080.mp4, -9x16-720.mp4
       → à téléverser dans le stockage objet OVH (voir marketing/academie/PUBLICATION.md) ;
       une copie va dans client/site/public/academie/media/fr/ (ignorée par git) pour `npm run dev:site` ;
    2. les images d'aperçu : client/site/public/academie/posters/<slug>-16x9.jpg et -9x16.jpg (versionnées) ;
    3. le catalogue du site : client/site/data/baitlyAcademyVideos.ts (généré, ne pas éditer) ;
    4. les transcriptions : client/site/data/baitlyAcademyTranscripts.ts (généré). Elles ne sont pas
       affichées : seul l'outillage de build les lit (données VideoObject, version Markdown), elles
       restent donc hors du JavaScript envoyé au navigateur.
  Les titres, chapitres et textes affichés vivent à part, en trois langues, dans
  client/site/lib/messages/baitlyAcademy.ts.
  Utilisation : node academie-web.mjs            (tout)
                node academie-web.mjs --data-only (catalogue et aperçus seulement, sans réencoder)
  À qui il s'adresse : motion designer, développeur du site.
*/
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = join(HERE, '../../client/site');
const OUT = join(HERE, 'out/academie-web');

// Épisodes publiés, dans l'ordre de PUBLICATION : le dernier est présenté comme « Dernier épisode »
// dans le menu Ressources ; le programme, lui, se trie par numéro. `poster` : instant de l'image d'aperçu (un plan posé,
// jamais en pleine animation) ; `uploadDate` : date de mise en ligne annoncée aux moteurs de recherche.
const EPISODES = [
  { dir: 'academie-01-kpi', slug: '01-kpi', number: '01', theme: 'piloter', poster: 26.9, uploadDate: '2026-09-29' },
  { dir: 'academie-02-revenu-net', slug: '02-revenu-net', number: '02', theme: 'piloter', poster: 64.5, uploadDate: '2026-09-29' },
  { dir: 'academie-18-direct-ou-plateforme', slug: '18-direct-ou-plateforme', number: '18', theme: 'revenus', poster: 40.5, uploadDate: '2026-09-29' },
  { dir: 'academie-03-delai-duree', slug: '03-delai-duree', number: '03', theme: 'piloter', poster: 72.5, uploadDate: '2026-09-29' },
  { dir: 'academie-04-qualite', slug: '04-qualite', number: '04', theme: 'piloter', poster: 57.5, uploadDate: '2026-09-29' },
  { dir: 'academie-17-prix-dynamique', slug: '17-prix-dynamique', number: '17', theme: 'revenus', poster: 68.0, uploadDate: '2026-09-30' },
  { dir: 'academie-19-extras', slug: '19-extras', number: '19', theme: 'revenus', poster: 70.5, uploadDate: '2026-09-30' },
  { dir: 'academie-13-menage-rotation', slug: '13-menage-rotation', number: '13', theme: 'operations', poster: 78.5, uploadDate: '2026-09-30' },
  { dir: 'academie-14-questions-voyageurs', slug: '14-questions-voyageurs', number: '14', theme: 'operations', poster: 47.0, uploadDate: '2026-09-30' },
  { dir: 'academie-15-avis-negatif', slug: '15-avis-negatif', number: '15', theme: 'operations', poster: 66.5, uploadDate: '2026-09-30' },
  { dir: 'academie-12-assurance', slug: '12-assurance', number: '12', theme: 'securite', poster: 82.0, uploadDate: '2026-09-30' },
  { dir: 'academie-20-gestion-proprietaire', slug: '20-gestion-proprietaire', number: '20', theme: 'conciergeries', poster: 73.0, uploadDate: '2026-10-01' },
  { dir: 'academie-11-securite', slug: '11-securite', number: '11', theme: 'securite', poster: 42.0, uploadDate: '2026-10-01' },
];
// 1080p pour les écrans qui en profitent, 720p pour l'économie de données (Save-Data, réseau lent).
const VARIANTS = [
  { fmt: '16x9', q: '1080', scale: '1920:1080', crf: 23 },
  { fmt: '16x9', q: '720', scale: '1280:720', crf: 24 },
  { fmt: '9x16', q: '1080', scale: '1080:1920', crf: 23 },
  { fmt: '9x16', q: '720', scale: '720:1280', crf: 24 },
];
const POSTERS = [{ fmt: '16x9', scale: '1280:720' }, { fmt: '9x16', scale: '720:1280' }];
const dataOnly = process.argv.includes('--data-only');

const ffmpeg = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });

/** Lit timeline.js et i18n.js dans un bac à sable (ce sont des scripts de page, pas des modules). */
function episodeSources(dir) {
  const ctx = { location: { search: '' }, document: { documentElement: { classList: { add() {} } } }, URLSearchParams };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(HERE, dir, 'timeline.js'), 'utf8'), ctx);
  vm.runInContext(readFileSync(join(HERE, dir, 'i18n.js'), 'utf8'), ctx);
  const timing = ctx.TIMELINE.lang.fr;
  const transcript = ctx.STRINGS.fr.subtitles.map((s) => `${s.text}${s.em}`.trim()).join(' ')
    .replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  return { duration: timing.duration, chapters: timing.slots.map(([start]) => Math.max(0, Math.round(start * 10) / 10)), transcript };
}

mkdirSync(join(OUT, 'fr'), { recursive: true });
mkdirSync(join(SITE, 'public/academie/media/fr'), { recursive: true });
mkdirSync(join(SITE, 'public/academie/posters'), { recursive: true });

const catalog = [];
const transcripts = {};
for (const ep of EPISODES) {
  const src = (fmt) => join(HERE, 'out', `${ep.dir}-fr-${fmt}.mp4`);
  for (const fmt of ['16x9', '9x16']) if (!existsSync(src(fmt))) throw new Error(`Vidéo absente : ${src(fmt)} (rendre l'épisode d'abord)`);
  if (!dataOnly) {
    for (const v of VARIANTS) {
      const file = `${ep.slug}-${v.fmt}-${v.q}.mp4`;
      // Déjà encodée depuis le dernier rendu : on ne refait pas le travail.
      const target = join(OUT, 'fr', file);
      if (existsSync(target) && statSync(target).mtimeMs >= statSync(src(v.fmt)).mtimeMs) {
        copyFileSync(target, join(SITE, 'public/academie/media/fr', file));
        continue;
      }
      ffmpeg(['-i', src(v.fmt), '-vf', `scale=${v.scale}:flags=lanczos`, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(v.crf),
        '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-movflags', '+faststart', join(OUT, 'fr', file)]);
      copyFileSync(join(OUT, 'fr', file), join(SITE, 'public/academie/media/fr', file));
      console.log(`${file}  ${(readFileSync(join(OUT, 'fr', file)).length / 1e6).toFixed(1)} Mo`);
    }
  }
  for (const p of POSTERS) {
    ffmpeg(['-ss', String(ep.poster), '-i', src(p.fmt), '-frames:v', '1', '-vf', `scale=${p.scale}:flags=lanczos`, '-q:v', '4',
      join(SITE, 'public/academie/posters', `${ep.slug}-${p.fmt}.jpg`)]);
  }
  const { duration, chapters, transcript } = episodeSources(ep.dir);
  catalog.push({ slug: ep.slug, number: ep.number, theme: ep.theme, uploadDate: ep.uploadDate, duration, chapters, languages: ['fr'] });
  transcripts[ep.slug] = { fr: transcript };
}

const ts = `/*
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

export const ACADEMY_EPISODES: readonly AcademyEpisode[] = ${JSON.stringify(catalog, null, 2)};

export function academyEpisode(slug: string | undefined): AcademyEpisode | undefined {
  return ACADEMY_EPISODES.find((episode) => episode.slug === slug);
}

export function academyVideoUrl(episode: AcademyEpisode, language: 'fr' | 'en' | 'ar', format: AcademyFormat, quality: AcademyQuality): string {
  const lang = episode.languages.includes(language) ? language : episode.languages[0];
  return \`\${ACADEMY_MEDIA_BASE}/\${lang}/\${episode.slug}-\${format}-\${quality}.mp4\`;
}

export function academyPosterUrl(episode: AcademyEpisode, format: AcademyFormat): string {
  return \`\${ACADEMY_POSTER_BASE}/\${episode.slug}-\${format}.jpg\`;
}
`;
writeFileSync(join(SITE, 'data/baitlyAcademyVideos.ts'), ts);
writeFileSync(join(SITE, 'data/baitlyAcademyTranscripts.ts'), `/*
  Baitly Académie · transcriptions des épisodes (texte dit, écrit comme les sous-titres).
  GÉNÉRÉ par marketing/motion/academie-web.mjs : ne pas éditer à la main.
  Non affichées sur la landing : lues seulement par l'outillage de build (données VideoObject des
  en-têtes HTML, version Markdown des pages). Ne pas importer depuis un composant du site, sinon
  elles partiraient dans le JavaScript envoyé au navigateur.
*/
export const ACADEMY_TRANSCRIPTS: Readonly<Record<string, Readonly<Partial<Record<'fr' | 'en' | 'ar', string>>>>> = ${JSON.stringify(transcripts, null, 2)};
`);
console.log(`Catalogue : ${catalog.length} épisodes → client/site/data/baitlyAcademyVideos.ts`);
