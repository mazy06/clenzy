import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Maximize, Pause, Play, Volume2, VolumeX } from '../../../src/icons/glyphs';
import {
  academyPosterUrl,
  academyVideoUrl,
  type AcademyEpisode,
} from '../../data/baitlyAcademyVideos';
import type { AcademyMessages } from '../../lib/messages/baitlyAcademy';
import type { SiteLanguage } from '../../lib/siteLanguage';
import { academyQuality, useAcademyFormat } from './useAcademyFormat';
import { SITE_ORIGIN } from '../../lib/siteSeo';

export interface BaitlyVideoPlayerHandle {
  /** Place la lecture au début d'un chapitre et la lance. */
  seek: (seconds: number) => void;
}

interface Props {
  episode: AcademyEpisode;
  language: SiteLanguage;
  ui: AcademyMessages['ui'];
  title: string;
  chapterLabels: readonly string[];
  /** Instant de départ (lien ?t= vers un chapitre). */
  startAt?: number;
  /** Lance la lecture dès le chargement (le visiteur enchaîne depuis l'épisode précédent). */
  autoPlay?: boolean;
  /** Écran de fin, affiché sur l'image une fois la vidéo terminée ; `replay` la relance du début. */
  endScreen?: (replay: () => void) => ReactNode;
  onTime?: (seconds: number) => void;
}

export const formatClock = (value: number) => {
  const seconds = Math.max(0, Math.floor(value || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** Index du chapitre en cours : le dernier dont le début est passé. */
export const chapterAt = (chapters: readonly number[], time: number) =>
  chapters.reduce((current, start, index) => (time >= start ? index : current), 0);

/**
 * Lecteur de l'Académie : 16:9 ou 9:16 selon l'écran, une seule vidéo téléchargée, et en cas de
 * rotation la lecture reprend à la même seconde, dans le même état. Lecture automatique seulement
 * quand le visiteur enchaîne depuis l'épisode précédent ; si le navigateur la refuse, le bouton de
 * lecture reste affiché.
 */
const BaitlyVideoPlayer = forwardRef<BaitlyVideoPlayerHandle, Props>(function BaitlyVideoPlayer(
  { episode, language, ui, title, chapterLabels, startAt = 0, autoPlay = false, endScreen, onTime },
  ref,
) {
  const format = useAcademyFormat();
  const src = academyVideoUrl(episode, language, format, academyQuality());
  // A real media URL and native controls are available even before JavaScript.
  // URL ABSOLUE canonique : le HTML pré-rendu doit annoncer exactement la vidéo que
  // déclarent les données structurées et le sitemap vidéo (contrôle de découvrabilité).
  const initialSrc = useRef(SITE_ORIGIN + academyVideoUrl(episode, language, '16x9', '1080'));
  const [enhanced, setEnhanced] = useState(false);
  const initialized = useRef(false);
  const video = useRef<HTMLVideoElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const resume = useRef({ time: startAt, playing: autoPlay });
  const requestedStart = useRef(startAt);
  const [time, setTime] = useState(startAt);
  const [duration, setDuration] = useState(episode.duration);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ended, setEnded] = useState(false);

  // La source change avec le format : on mémorise la position et l'état avant de la remplacer.
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    // Comparaison d'URL résolues : la source absolue pré-rendue et le chemin du même
    // fichier ne doivent pas provoquer de rechargement sur baitly.fr.
    const sourceChanged = element.src !== new URL(src, window.location.href).href;
    if (initialized.current && sourceChanged) {
      resume.current = { time: element.currentTime, playing: !element.paused && !element.ended };
    }
    if (requestedStart.current !== startAt) {
      requestedStart.current = startAt;
      resume.current.time = startAt;
      setTime(startAt);
    }
    initialized.current = true;
    setEnhanced(true);
    const { time: at, playing: wasPlaying } = resume.current;
    const restore = () => {
      // Jamais au-delà de la fin (une demi-seconde de marge) quand la durée est connue.
      const limit = element.duration ? element.duration - 0.5 : at;
      if (at > 0) element.currentTime = Math.min(at, Math.max(0, limit));
      if (wasPlaying) void element.play()?.catch(() => undefined);
    };
    setFailed(false);
    if (sourceChanged) {
      element.setAttribute('src', src);
      element.load();
    }
    if (element.readyState >= 1) restore();
    element.addEventListener('loadedmetadata', restore, { once: true });
    return () => element.removeEventListener('loadedmetadata', restore);
  }, [src, startAt]);

  const play = () => {
    setStarted(true);
    void video.current?.play()?.catch(() => undefined);
  };
  const toggle = () => {
    const element = video.current;
    if (!element) return;
    if (element.paused || element.ended) play();
    else element.pause();
  };
  const seekTo = (seconds: number) => {
    const element = video.current;
    if (!element) return;
    element.currentTime = Math.min(Math.max(0, seconds), duration);
    setTime(element.currentTime);
    setEnded(false);
  };
  const replay = () => {
    seekTo(0);
    play();
  };
  useImperativeHandle(ref, () => ({
    seek: (seconds) => {
      seekTo(seconds);
      play();
    },
  }));

  const onTrackClick = (event: MouseEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const ratio = (rtl ? box.right - event.clientX : event.clientX - box.left) / box.width;
    seekTo(Math.min(1, Math.max(0, ratio)) * duration);
  };
  const onTrackKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const step = { ArrowRight: rtl ? -5 : 5, ArrowLeft: rtl ? 5 : -5, ArrowUp: 5, ArrowDown: -5 }[event.key];
    if (step) seekTo(time + step);
    else if (event.key === 'Home') seekTo(0);
    else if (event.key === 'End') seekTo(duration);
    else return;
    event.preventDefault();
  };
  const fullscreen = () => {
    const element = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else if (shell.current?.requestFullscreen) void shell.current.requestFullscreen().catch(() => undefined);
    else element?.webkitEnterFullscreen?.();
  };

  const chapter = chapterAt(episode.chapters, time);
  return (
    <div
      ref={shell}
      className={`bac-player${format === '9x16' ? ' is-tall' : ''}`}
      data-enhanced={enhanced || undefined}
      role="region"
      aria-label={title}
    >
      <div className="bac-screen">
        <video
          ref={video}
          src={initialSrc.current}
          controls={!enhanced}
          playsInline
          preload={enhanced ? 'metadata' : 'none'}
          poster={SITE_ORIGIN + academyPosterUrl(episode, format)}
          onClick={toggle}
          onPlay={() => { setPlaying(true); setStarted(true); setEnded(false); }}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setEnded(true); }}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || episode.duration)}
          onTimeUpdate={(event) => { setTime(event.currentTarget.currentTime); onTime?.(event.currentTarget.currentTime); }}
          onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
          onError={() => setFailed(true)}
        />
        {!started && !failed && (
          <button type="button" className="bac-big" onClick={play} aria-label={ui.play}>
            <span><Play size={30} aria-hidden="true" /></span>
          </button>
        )}
        {failed && <p className="bac-unavailable" role="status">{ui.unavailable}</p>}
        {ended && !failed && endScreen?.(replay)}
      </div>
      <div className="bac-bar">
        <button type="button" onClick={toggle} aria-label={playing ? ui.pause : ui.play} disabled={failed}>
          {playing ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
        </button>
        <span className="bac-clock">{formatClock(time)} / {formatClock(duration)}</span>
        <div
          className="bac-track"
          role="slider"
          tabIndex={failed ? -1 : 0}
          aria-label={ui.seek}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(time)}
          aria-valuetext={`${formatClock(time)} ${ui.of} ${formatClock(duration)}`}
          onClick={onTrackClick}
          onKeyDown={onTrackKey}
        >
          <span className="bac-now" aria-hidden="true">{chapterLabels[chapter]}</span>
          <span className="bac-segments" aria-hidden="true">
            {episode.chapters.map((start, index) => {
              const end = episode.chapters[index + 1] ?? duration;
              const progress = Math.min(1, Math.max(0, (time - start) / Math.max(0.1, end - start)));
              return (
                <i key={start} style={{ flexGrow: end - start }}>
                  <b style={{ transform: `scaleX(${progress})` }} />
                </i>
              );
            })}
          </span>
        </div>
        <button
          type="button"
          onClick={() => { if (video.current) video.current.muted = !video.current.muted; }}
          aria-label={muted ? ui.unmute : ui.mute}
          aria-pressed={muted}
        >
          {muted ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
        </button>
        <button type="button" className="bac-fs" onClick={fullscreen} aria-label={ui.fullscreen}>
          <Maximize size={20} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
});

export default BaitlyVideoPlayer;
