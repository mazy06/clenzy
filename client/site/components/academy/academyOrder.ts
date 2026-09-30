import { ACADEMY_EPISODES, type AcademyEpisode, type AcademyTheme } from '../../data/baitlyAcademyVideos';

/** Ordre de lecture conseillé : les chiffres d'abord, puis l'argent, puis le cadre légal. */
export const ACADEMY_THEME_ORDER: readonly AcademyTheme[] = ['piloter', 'revenus', 'reglementation', 'operations', 'securite', 'conciergeries'];

/** Les épisodes publiés dans l'ordre du programme : par thème, puis par numéro. */
export function academyReadingOrder(): AcademyEpisode[] {
  return [...ACADEMY_EPISODES].sort(
    (a, b) =>
      ACADEMY_THEME_ORDER.indexOf(a.theme) - ACADEMY_THEME_ORDER.indexOf(b.theme) ||
      a.number.localeCompare(b.number),
  );
}

/** L'épisode publié qui suit dans le programme ; aucun après le dernier. */
export function nextAcademyEpisode(slug: string): AcademyEpisode | undefined {
  const order = academyReadingOrder();
  const index = order.findIndex((episode) => episode.slug === slug);
  return index < 0 ? undefined : order[index + 1];
}
