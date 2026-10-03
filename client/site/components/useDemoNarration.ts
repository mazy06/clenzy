import { useCallback, useEffect, useRef } from 'react';
import type { SiteLanguage } from '../lib/siteLanguage';

/** URL du clip de voix off d'une étape (`undefined` : pas de voix pour cette langue). */
export type ClipUrl = (language: SiteLanguage, step: number) => string | undefined;

/**
 * Lecture de la voix off calée sur la chorégraphie : chaque étape lance son
 * clip ; activer la voix ou reprendre la démo rejoint l'étape là où en est la
 * tête de lecture, sans jamais rejouer une étape passée.
 */
export function useDemoNarration(
  clipUrl: ClipUrl,
  language: SiteLanguage,
  audible: boolean,
  onBlocked: () => void,
) {
  const onBlockedRef = useRef(onBlocked);
  onBlockedRef.current = onBlocked;
  /* Un lecteur par étape, préchargé dès que la voix est activée : changer de
     source au début de l'étape ajoutait un délai de chargement variable, et
     la voix arrivait après le geste qu'elle commente. */
  const players = useRef(new Map<number, HTMLAudioElement>());
  const clockRef = useRef<() => number>(() => 0);
  const current = useRef<{ step: number; startedAt: number } | null>(null);
  const audibleRef = useRef(audible);
  audibleRef.current = audible;

  const player = useCallback(
    (step: number) => {
      const url = clipUrl(language, step);
      if (!url) return null;
      let audio = players.current.get(step);
      if (!audio) {
        audio = new Audio(url);
        audio.preload = 'auto';
        players.current.set(step, audio);
      }
      return audio;
    },
    [clipUrl, language],
  );

  const stopAll = () => players.current.forEach((audio) => audio.pause());

  const playFrom = useCallback(
    (step: number, offsetMs: number) => {
      stopAll();
      const audio = player(step);
      if (!audio) return;
      const seek = () => {
        if (Number.isFinite(audio.duration) && offsetMs / 1000 >= audio.duration) return;
        audio.currentTime = Math.max(0, offsetMs) / 1000;
        // Lecture refusée (autoplay, onglet muet) : la démo continue sans voix.
        audio.play()?.catch((error: unknown) => {
          if ((error as { name?: string } | null)?.name === 'NotAllowedError') {
            onBlockedRef.current();
          }
        });
      };
      // Depuis le début : lecture immédiate. Reprise en cours d'étape : il
      // faut la durée du clip pour s'y positionner.
      if (offsetMs <= 0 || audio.readyState >= 1) seek();
      else audio.addEventListener('loadedmetadata', seek, { once: true });
    },
    [player],
  );

  useEffect(() => {
    if (!audible) {
      stopAll();
      return;
    }
    // Préchargement de toutes les étapes de la langue.
    for (let step = 0; clipUrl(language, step); step += 1) player(step);
    const playingStep = current.current;
    if (playingStep) {
      playFrom(playingStep.step, clockRef.current() - playingStep.startedAt);
    }
  }, [audible, clipUrl, language, player, playFrom]);

  useEffect(() => {
    const all = players.current;
    return () => {
      all.forEach((audio) => audio.pause());
      all.clear();
    };
  }, [language]);

  const narrate = useCallback(
    (step: number) => {
      current.current = { step, startedAt: clockRef.current() };
      if (audibleRef.current) playFrom(step, 0);
    },
    [playFrom],
  );
  const reset = useCallback(() => {
    current.current = null;
  }, []);
  return { clockRef, narrate, reset };
}
