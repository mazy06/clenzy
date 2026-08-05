import { useEffect, useRef } from 'react';
import type { CommandDescriptor } from './types';

/**
 * Raccourcis clavier du centre de commande.
 *
 * Deux niveaux :
 *   - **⌘K / Ctrl+K** ouvre la palette. C'est le seul raccourci à modificateur
 *     de l'application, et la convention que tout le monde connaît.
 *   - **Accords de touches** (`g` puis `p`) déclenchent une commande sans
 *     ouvrir la palette. Sans modificateur, donc sans collision possible avec
 *     le navigateur ou le système — mais alors uniquement quand le focus n'est
 *     PAS dans une zone de saisie, sinon on ne pourrait plus taper « gp ».
 */

/** Fenêtre pendant laquelle la 1re touche d'un accord reste armée. */
const CHORD_WINDOW_MS = 1200;

/** true sur un Mac / iPad — décide de ⌘ vs Ctrl dans les libellés. */
export function isAppleKeyboard(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
}

/** Libellé du raccourci d'ouverture, adapté à la plateforme. */
export function openShortcutLabel(): string {
  return isAppleKeyboard() ? '⌘K' : 'Ctrl K';
}

/** `['g','p']` → `G P`. */
export function formatChord(chord: readonly string[]): string {
  return chord.map((key) => key.toUpperCase()).join(' ');
}

/** Raccourci à afficher pour une commande (accord ou libellé explicite). */
export function shortcutOf(command: CommandDescriptor): string | undefined {
  if (command.chord) return formatChord(command.chord);
  return command.shortcutLabel;
}

/** Raccourci prêt à afficher : une touche par pastille. */
export interface ShortcutDisplay {
  keys: string[];
  /**
   * true = touches à enfoncer L'UNE APRÈS L'AUTRE (accord). C'est la
   * distinction que l'affichage doit rendre lisible : « G D » sans indication
   * se lit comme une combinaison, alors qu'il faut relâcher entre les deux.
   */
  sequence: boolean;
}

export function shortcutDisplay(command: CommandDescriptor): ShortcutDisplay | undefined {
  if (command.chord) {
    return { keys: command.chord.map((key) => key.toUpperCase()), sequence: true };
  }
  if (command.shortcutLabel) return { keys: [command.shortcutLabel], sequence: false };
  return undefined;
}

/**
 * Énoncé du raccourci pour les lecteurs d'écran et l'infobulle — les pastilles
 * ne disent pas, à elles seules, qu'il s'agit d'une suite de touches.
 */
export function shortcutAria(display: ShortcutDisplay): string {
  return display.sequence ? display.keys.join(' puis ') : display.keys.join(' ');
}

/**
 * true si la frappe part d'une zone de saisie — champ, zone de texte, contenu
 * éditable, ou n'importe quel widget qui gère lui-même son clavier (le
 * `role=textbox` des éditeurs riches).
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.getAttribute('role') === 'textbox';
}

interface ChordListenerOptions {
  /** Commandes armées (déjà filtrées par permission). */
  commands: CommandDescriptor[];
  /** ⌘K / Ctrl+K. */
  onOpen: () => void;
  /** Palette ouverte : on désarme les accords, la saisie a la priorité. */
  paused: boolean;
}

/**
 * Écoute globale du clavier. Un seul listener pour toute l'application, monté
 * par le provider — chaque commande n'a qu'à déclarer son accord.
 */
export function useCommandShortcuts({ commands, onOpen, paused }: ChordListenerOptions): void {
  // Les commandes changent à chaque rendu (lambdas `run` recréées) : les lire
  // au moment de la frappe plutôt que de relancer l'effet à chaque rendu.
  const commandsRef = useRef(commands);
  commandsRef.current = commands;
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const pendingRef = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      // ── Ouverture ─────────────────────────────────────────────────────────
      // Fonctionne AUSSI depuis un champ : c'est tout l'intérêt d'un
      // modificateur, et l'utilisateur qui filtre une liste doit pouvoir
      // basculer sur la palette sans sortir du champ.
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenRef.current();
        return;
      }

      if (pausedRef.current) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if (key.length !== 1) return;

      const pending = pendingRef.current;
      const now = event.timeStamp;

      if (pending && now - pending.at <= CHORD_WINDOW_MS) {
        pendingRef.current = null;
        const match = commandsRef.current.find(
          (command) => command.chord?.[0] === pending.key && command.chord?.[1] === key,
        );
        if (match) {
          event.preventDefault();
          match.run();
        }
        return;
      }

      // Première touche : ne l'armer que si un accord commence par elle, pour
      // qu'une frappe quelconque ne mange pas la touche suivante.
      const armed = commandsRef.current.some((command) => command.chord?.[0] === key);
      pendingRef.current = armed ? { key, at: now } : null;
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
