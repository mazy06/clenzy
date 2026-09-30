import { Link } from 'react-router-dom';
import { ACADEMY_EPISODES, academyPosterUrl } from '../../data/baitlyAcademyVideos';
import { BAITLY_ACADEMY_MESSAGES, fillAcademyText } from '../../lib/messages/baitlyAcademy';
import type { SiteLanguage } from '../../lib/siteLanguage';
import { formatClock } from './BaitlyVideoPlayer';
import { ACADEMY_THEME_ORDER } from './academyOrder';

/** Ancre du programme (lien « Voir le programme » de la fin du dernier épisode). */
export const ACADEMY_PROGRAM_ID = 'academie-programme';

interface Props {
  language: SiteLanguage;
  /** Épisode affiché sur la page, mis en évidence dans le programme. */
  current?: string;
}

/** Le programme complet : épisodes publiés (liens) et épisodes en préparation (annoncés). */
export default function AcademyProgram({ language, current }: Props) {
  const m = BAITLY_ACADEMY_MESSAGES[language];
  const published = new Map(ACADEMY_EPISODES.map((episode) => [episode.number, episode]));
  return (
    <section className="bac-program" aria-labelledby={ACADEMY_PROGRAM_ID}>
      <div className="bac-program-head">
        <h2 id={ACADEMY_PROGRAM_ID}>{m.ui.program}</h2>
        <p>
          {fillAcademyText(m.ui.programCount, {
            available: published.size,
            soon: m.program.length - published.size,
          })}
        </p>
      </div>
      <div className="bac-themes">
        {ACADEMY_THEME_ORDER.map((theme) => {
          const items = m.program.filter((item) => item.theme === theme);
          return (
            <div className="bac-theme" key={theme}>
              <h3>
                {m.themes[theme]}
                {items.some((item) => item.legal) && <em>{m.ui.legalReview}</em>}
              </h3>
              <ul>
                {items.map((item) => {
                  const episode = published.get(item.number);
                  const title = episode ? m.episodes[episode.slug]?.title ?? item.title : item.title;
                  if (!episode)
                    return (
                      <li key={item.number} className="bac-ep is-soon">
                        <span className="bac-ep-thumb" aria-hidden="true">{item.number}</span>
                        <span className="bac-ep-text">
                          <small>{m.ui.episode} {item.number}</small>
                          <strong>{title}</strong>
                        </span>
                        <span className="bac-soon">{m.ui.soon}</span>
                      </li>
                    );
                  return (
                    <li key={item.number} className="bac-ep">
                      <Link
                        to={`/ressources/academie/${episode.slug}?lang=${language}`}
                        aria-current={episode.slug === current ? 'page' : undefined}
                      >
                        <img src={academyPosterUrl(episode, '16x9')} alt="" loading="lazy" width={128} height={72} />
                        <span className="bac-ep-text">
                          <small>{m.ui.episode} {item.number}</small>
                          <strong>{title}</strong>
                        </span>
                        <span className="bac-duration">{formatClock(Math.round(episode.duration))}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
