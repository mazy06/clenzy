import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, RotateCcw } from 'lucide-react';
import { academyPosterUrl, type AcademyEpisode } from '../../data/baitlyAcademyVideos';
import { BAITLY_ACADEMY_MESSAGES, fillAcademyText } from '../../lib/messages/baitlyAcademy';
import type { SiteLanguage } from '../../lib/siteLanguage';
import { formatClock } from './BaitlyVideoPlayer';
import { ACADEMY_PROGRAM_ID } from './AcademyProgram';

/** Ancre du lecteur : la page de l'épisode suivant s'ouvre directement sur la vidéo. */
export const ACADEMY_PLAYER_ID = 'academie-lecteur';
/** Délai avant l'enchaînement automatique, annulable. */
export const ACADEMY_UP_NEXT_SECONDS = 8;

interface Props {
  /** Épisode suivant dans l'ordre du programme ; absent après le dernier épisode publié. */
  next?: AcademyEpisode;
  language: SiteLanguage;
  onReplay: () => void;
}

/**
 * Fin d'épisode, posée sur l'image du lecteur : propose l'épisode suivant et l'enchaîne après un
 * compte à rebours que le visiteur peut annuler. Après le dernier épisode : revoir, ou parcourir
 * le programme.
 */
export default function AcademyUpNext({ next, language, onReplay }: Props) {
  const m = BAITLY_ACADEMY_MESSAGES[language];
  const navigate = useNavigate();
  const [left, setLeft] = useState(ACADEMY_UP_NEXT_SECONDS);
  const [counting, setCounting] = useState(Boolean(next));
  const primary = useRef<HTMLButtonElement & HTMLAnchorElement>(null);

  const playNext = () => {
    if (!next) return;
    navigate(`/ressources/academie/${next.slug}?lang=${language}#${ACADEMY_PLAYER_ID}`, {
      state: { academyAutoplay: true },
    });
  };

  // Au clavier, le focus était dans le lecteur : il passe sur l'action principale de la fin.
  useEffect(() => {
    const button = primary.current;
    if (button?.closest('.bac-player')?.contains(document.activeElement)) button.focus();
  }, []);

  useEffect(() => {
    if (!counting) return undefined;
    if (left <= 0) {
      playNext();
      return undefined;
    }
    const timer = window.setTimeout(() => setLeft((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [counting, left]);

  if (!next) {
    return (
      <div className="bac-next is-done" role="group" aria-labelledby="bac-next-title">
        <div className="bac-next-body">
          <h3 id="bac-next-title">{m.ui.seriesDone}</h3>
          <div className="bac-next-actions">
            <a ref={primary} className="bac-next-primary" href={`#${ACADEMY_PROGRAM_ID}`}>
              {m.ui.seeProgram}
            </a>
            <button type="button" className="bac-next-secondary" onClick={onReplay}>
              <RotateCcw size={18} aria-hidden="true" />
              {m.ui.replay}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const text = m.episodes[next.slug];
  return (
    <div className="bac-next" role="group" aria-labelledby="bac-next-title">
      <img
        className="bac-next-poster"
        src={academyPosterUrl(next, '16x9')}
        alt=""
        width={320}
        height={180}
      />
      <div className="bac-next-body">
        <p className="bac-next-eyebrow">
          {m.ui.upNext} · {m.ui.episode} {next.number}
        </p>
        <h3 id="bac-next-title">{text?.title}</h3>
        <p className="bac-next-meta">
          {m.themes[next.theme]} · {formatClock(Math.round(next.duration))}
        </p>
        <div className="bac-next-actions">
          <button ref={primary} type="button" className="bac-next-primary" onClick={playNext}>
            {counting && (
              <span
                className="bac-next-fill"
                style={{ animationDuration: `${ACADEMY_UP_NEXT_SECONDS}s` }}
                aria-hidden="true"
              />
            )}
            <Play size={18} aria-hidden="true" />
            <span>{m.ui.playNext}</span>
          </button>
          {counting ? (
            <button type="button" className="bac-next-secondary" onClick={() => setCounting(false)}>
              {m.ui.cancelAutoplay}
            </button>
          ) : (
            <button type="button" className="bac-next-secondary" onClick={onReplay}>
              <RotateCcw size={18} aria-hidden="true" />
              {m.ui.replay}
            </button>
          )}
        </div>
        {counting && (
          <p className="bac-next-note">{fillAcademyText(m.ui.autoplayIn, { seconds: left })}</p>
        )}
      </div>
    </div>
  );
}
