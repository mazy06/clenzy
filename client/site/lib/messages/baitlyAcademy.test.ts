import { describe, expect, it } from 'vitest';
import { ACADEMY_EPISODES } from '../../data/baitlyAcademyVideos';
import { ACADEMY_TRANSCRIPTS } from '../../data/baitlyAcademyTranscripts';
import { BAITLY_ACADEMY_MESSAGES } from './baitlyAcademy';

/**
 * Le catalogue des épisodes est généré depuis le montage (chapitres calés sur la voix), les textes
 * sont écrits à la main en trois langues : un chapitre ajouté d'un côté sans l'autre afficherait un
 * chapitre sans nom. Ces tests rattrapent l'écart avant la mise en ligne.
 */
describe('Baitly Académie : textes et catalogue', () => {
  it.each(['fr', 'en', 'ar'] as const)('nomme chaque chapitre de chaque épisode publié en %s', (language) => {
    const m = BAITLY_ACADEMY_MESSAGES[language];
    for (const episode of ACADEMY_EPISODES) {
      const text = m.episodes[episode.slug];
      expect(text, `${language}/${episode.slug}`).toBeDefined();
      expect(text.chapters).toHaveLength(episode.chapters.length);
      expect(text.learn.length).toBeGreaterThanOrEqual(2);
      expect(text.description.length).toBeGreaterThan(50);
    }
  });

  it.each(['fr', 'en', 'ar'] as const)('annonce un programme de 20 épisodes contenant les épisodes publiés en %s', (language) => {
    const program = BAITLY_ACADEMY_MESSAGES[language].program;
    expect(program).toHaveLength(20);
    expect(new Set(program.map((item) => item.number)).size).toBe(20);
    for (const episode of ACADEMY_EPISODES) {
      expect(program.find((item) => item.number === episode.number)?.theme).toBe(episode.theme);
    }
  });

  it('publie des épisodes aux chapitres ordonnés, dans la durée, avec une transcription', () => {
    for (const episode of ACADEMY_EPISODES) {
      expect(episode.slug).toMatch(/^\d{2}-[a-z0-9-]+$/);
      expect(episode.chapters[0]).toBeLessThan(1);
      episode.chapters.forEach((start, index) => {
        if (index) expect(start).toBeGreaterThan(episode.chapters[index - 1]);
        expect(start).toBeLessThan(episode.duration);
      });
      expect(ACADEMY_TRANSCRIPTS[episode.slug]?.fr?.length).toBeGreaterThan(500);
    }
  });
});
