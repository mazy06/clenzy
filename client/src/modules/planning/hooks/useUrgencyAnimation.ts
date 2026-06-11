import { useCallback, useState } from 'react';
import { STORAGE_KEYS, getItem, setItem } from '../../../services/storageService';
import type { UrgencyAnimationMode } from '../types';

// Preference per-device (storage decision tree §3) : variante de l'animation
// « wizz » des briques en urgence (paiement en attente / info voyageur
// manquante). Lecture synchrone au mount, ecriture immediate au changement.

const VALID_MODES: UrgencyAnimationMode[] = ['shake', 'wobble', 'pop', 'tada', 'none'];
const DEFAULT_MODE: UrgencyAnimationMode = 'shake';

function readStoredMode(): UrgencyAnimationMode {
  const raw = getItem(STORAGE_KEYS.PLANNING_URGENCY_ANIMATION);
  return VALID_MODES.includes(raw as UrgencyAnimationMode)
    ? (raw as UrgencyAnimationMode)
    : DEFAULT_MODE;
}

export function useUrgencyAnimation(): [UrgencyAnimationMode, (mode: UrgencyAnimationMode) => void] {
  const [mode, setMode] = useState<UrgencyAnimationMode>(readStoredMode);

  const updateMode = useCallback((next: UrgencyAnimationMode) => {
    setMode(next);
    setItem(STORAGE_KEYS.PLANNING_URGENCY_ANIMATION, next);
  }, []);

  return [mode, updateMode];
}
