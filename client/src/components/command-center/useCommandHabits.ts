import { useCallback, useMemo } from 'react';
import { useUserPreference } from '../../hooks/useUserPreference';

/**
 * Habitudes d'usage du centre de commande — le « adapté à chaque client ».
 *
 * <p>Chaque déclenchement incrémente un compteur par commande. Le classement
 * n'est pas un simple « le plus utilisé » : c'est une <b>frécence</b>, le
 * compte pondéré par la fraîcheur (demi-vie de 14 jours). Sans elle, l'écran
 * matraqué pendant la semaine de mise en service resterait en tête six mois
 * plus tard, et un changement de métier ne se verrait jamais.</p>
 *
 * <p>Persisté dans `user_ui_preferences` (clé-valeur JSONB) : les habitudes
 * suivent l'utilisateur d'un appareil à l'autre, ce que localStorage ne
 * permettrait pas.</p>
 */

const HABITS_KEY = 'commandCenter.habits';

/** Au-delà, on oublie la queue de distribution — elle ne remonte jamais. */
const MAX_ENTRIES = 60;

/** Un usage vieux de 14 jours pèse moitié moins qu'un usage d'aujourd'hui. */
const HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000;

export interface HabitEntry {
  /** Nombre de déclenchements. */
  n: number;
  /** Dernier déclenchement (epoch ms). */
  t: number;
}

export type HabitMap = Record<string, HabitEntry>;

const EMPTY: HabitMap = {};

function decay(entry: HabitEntry, now: number): number {
  const age = Math.max(0, now - entry.t);
  return entry.n * Math.pow(0.5, age / HALF_LIFE_MS);
}

export interface CommandHabits {
  /** Score de frécence, 0 si la commande n'a jamais servi. */
  score: (id: string) => number;
  /** Enregistre un déclenchement. */
  record: (id: string) => void;
  /** true dès que le backend a répondu — évite d'écrire par-dessus les vraies valeurs. */
  isLoaded: boolean;
}

/**
 * @param now instant de référence du classement. Le passer explicitement (et
 *            non `Date.now()` à chaque rendu) fige l'ordre pendant qu'on tape :
 *            une liste qui se réordonne sous le curseur est intenable.
 */
export function useCommandHabits(now: number): CommandHabits {
  const [habits, setHabits, { isLoaded }] = useUserPreference<HabitMap>(HABITS_KEY, EMPTY);

  const scores = useMemo(() => {
    const result: Record<string, number> = {};
    Object.entries(habits).forEach(([id, entry]) => {
      if (entry && typeof entry.n === 'number' && typeof entry.t === 'number') {
        result[id] = decay(entry, now);
      }
    });
    return result;
  }, [habits, now]);

  const score = useCallback((id: string) => scores[id] ?? 0, [scores]);

  const record = useCallback(
    (id: string) => {
      // Tant que le backend n'a pas répondu, `habits` vaut le défaut vide :
      // écrire ici effacerait l'historique réel de l'utilisateur.
      if (!isLoaded) return;
      const at = Date.now();
      const previous = habits[id];
      const next: HabitMap = { ...habits, [id]: { n: (previous?.n ?? 0) + 1, t: at } };

      const ids = Object.keys(next);
      if (ids.length > MAX_ENTRIES) {
        const kept = ids
          .sort((a, b) => decay(next[b], at) - decay(next[a], at))
          .slice(0, MAX_ENTRIES);
        const trimmed: HabitMap = {};
        kept.forEach((key) => {
          trimmed[key] = next[key];
        });
        setHabits(trimmed);
        return;
      }
      setHabits(next);
    },
    [habits, isLoaded, setHabits],
  );

  return { score, record, isLoaded };
}
