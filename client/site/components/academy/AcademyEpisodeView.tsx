import { useRef, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import type { AcademyEpisode } from '../../data/baitlyAcademyVideos';
import { BAITLY_ACADEMY_MESSAGES } from '../../lib/messages/baitlyAcademy';
import type { SiteLanguage } from '../../lib/siteLanguage';
import BaitlyVideoPlayer, {
  chapterAt,
  formatClock,
  type BaitlyVideoPlayerHandle,
} from './BaitlyVideoPlayer';
import AcademyUpNext, { ACADEMY_PLAYER_ID } from './AcademyUpNext';
import { nextAcademyEpisode } from './academyOrder';

export const ACADEMY_PRACTICE_ID = 'academie-pratique';

interface Props {
  episode: AcademyEpisode;
  language: SiteLanguage;
  startAt?: number;
  /** Le visiteur arrive de l'épisode précédent : la vidéo démarre seule. */
  autoPlay?: boolean;
}

/** « 2 min 43 » ; en arabe, l'horloge 2:43 se lit sans ambiguïté de sens. */
const minutes = (seconds: number, unit: string, language: SiteLanguage) => {
  const total = Math.round(seconds);
  if (language === 'ar') return formatClock(total);
  return `${Math.floor(total / 60)} ${unit} ${String(total % 60).padStart(2, '0')}`;
};

/**
 * Un épisode : le lecteur, ce qu'on va apprendre et les chapitres cliquables ; en fin de vidéo,
 * l'épisode suivant du programme est proposé. La transcription n'est pas affichée : elle sert au
 * référencement (données VideoObject et version Markdown de la page).
 */
export default function AcademyEpisodeView({ episode, language, startAt, autoPlay }: Props) {
  const m = BAITLY_ACADEMY_MESSAGES[language];
  const text = m.episodes[episode.slug];
  const player = useRef<BaitlyVideoPlayerHandle>(null);
  const [time, setTime] = useState(startAt ?? 0);
  const current = chapterAt(episode.chapters, time);
  const next = nextAcademyEpisode(episode.slug);

  return (
    <div className="bac-episode" id={ACADEMY_PLAYER_ID}>
      <div className="bac-feature">
        <BaitlyVideoPlayer
          key={episode.slug}
          ref={player}
          episode={episode}
          language={language}
          ui={m.ui}
          title={text.title}
          chapterLabels={text.chapters}
          startAt={startAt}
          autoPlay={autoPlay}
          endScreen={(replay) => <AcademyUpNext next={next} language={language} onReplay={replay} />}
          onTime={setTime}
        />
        <aside className="bac-side">
          <p className="bac-meta">
            <span className="bac-tag">{m.ui.episode} {episode.number}</span>
            <span>{m.themes[episode.theme]} · {minutes(episode.duration, m.ui.minutes, language)}</span>
            {!episode.languages.includes(language) && m.ui.languageNote && (
              <span className="bac-lang">{m.ui.languageNote}</span>
            )}
          </p>
          <h2>{text.title}</h2>
          <div>
            <span className="brs-eyebrow">{m.ui.learn}</span>
            <ul className="bac-learn">
              {text.learn.map((item) => (
                <li key={item}>
                  <Check size={18} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <span className="brs-eyebrow">{m.ui.chapters}</span>
            <ol className="bac-chapters">
              {episode.chapters.map((start, index) => (
                <li key={start}>
                  <button
                    type="button"
                    aria-current={index === current ? 'true' : undefined}
                    onClick={() => player.current?.seek(start)}
                  >
                    <small>{formatClock(start)}</small>
                    <span>{text.chapters[index]}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <div className="bac-actions">
            <a className="brs-button" href={`#${ACADEMY_PRACTICE_ID}`}>
              {m.ui.practice}
              <ArrowRight size={18} aria-hidden="true" />
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
