import type { CommandDescriptor, CommandSection } from './types';
import { COMMAND_SECTIONS } from './types';

/**
 * Filtrage et classement des commandes.
 *
 * <p>Le filtre de `cmdk` est désactivé au profit de celui-ci, pour deux raisons
 * qu'il ne sait pas couvrir : la recherche doit ignorer les accents (« reserv »
 * doit trouver « Réservations ») et le classement doit tenir compte des
 * habitudes de l'utilisateur, que le composant ne connaît pas.</p>
 */

/** Nombre de suggestions affichées en tête, requête vide. */
export const SUGGESTION_COUNT = 5;

/**
 * Taille maximale d'un groupe à la REQUÊTE VIDE. Un écran peut publier des
 * dizaines de commandes (la tab Intégrations en publie 71) : les dérouler
 * toutes au repos noierait les sections suivantes. À la frappe, aucun plafond —
 * un résultat filtré doit toujours être atteignable.
 */
export const EMPTY_GROUP_LIMIT = 7;

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Pertinence textuelle d'une commande, ou `null` si elle ne correspond pas.
 * Un préfixe de libellé prime sur un début de mot, qui prime sur une occurrence
 * quelconque, qui prime sur un synonyme : « rés » doit remonter
 * « Réservations » avant « Signaler une demande » (mot-clé « demande service »).
 */
function textScore(command: CommandDescriptor, tokens: string[]): number | null {
  const label = normalize(command.label);
  const keywords = command.keywords ? normalize(command.keywords) : '';
  let total = 0;

  for (const token of tokens) {
    if (label.startsWith(token)) {
      total += 100;
    } else if (new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(label)) {
      total += 60;
    } else if (label.includes(token)) {
      total += 30;
    } else if (keywords.includes(token)) {
      total += 15;
    } else {
      return null; // tous les mots de la requête doivent porter
    }
  }
  return total;
}

export interface RankingInput {
  commands: CommandDescriptor[];
  query: string;
  /** Frécence de l'utilisateur (cf. `useCommandHabits`). */
  score: (id: string) => number;
  /** Ordre de départ par métier, tant que l'utilisateur n'a pas d'historique. */
  defaultSuggestionIds: string[];
}

export interface RankedGroup {
  section: CommandSection;
  commands: CommandDescriptor[];
  /** Commandes du groupe masquées par le plafond — 0 si le groupe est entier. */
  hidden: number;
}

export interface RankingResult {
  /** Requête vide uniquement : ce que l'utilisateur fait le plus souvent. */
  suggestions: CommandDescriptor[];
  groups: RankedGroup[];
  /** Toutes les commandes affichées, dans l'ordre — sert au « premier résultat ». */
  flat: CommandDescriptor[];
}

/**
 * Le poids d'une habitude face à la pertinence textuelle. Assez pour départager
 * deux résultats équivalents, jamais assez pour faire passer une commande
 * moins pertinente devant : on ne veut pas qu'un raccourci favori détourne une
 * recherche explicite.
 */
const HABIT_WEIGHT = 8;

export function rankCommands({
  commands,
  query,
  score,
  defaultSuggestionIds,
}: RankingInput): RankingResult {
  const trimmed = normalize(query.trim());
  const tokens = trimmed ? trimmed.split(/\s+/) : [];

  // ── Requête vide : ordre par habitude dans chaque section ────────────────
  if (tokens.length === 0) {
    const byId = new Map(commands.map((command) => [command.id, command]));

    const suggestions: CommandDescriptor[] = [];
    const seen = new Set<string>();
    const suggestible = commands.filter((command) => !command.neverSuggest);

    // 1) L'usage réel d'abord…
    suggestible
      .filter((command) => score(command.id) > 0)
      .sort((a, b) => score(b.id) - score(a.id))
      .forEach((command) => {
        if (suggestions.length < SUGGESTION_COUNT && !seen.has(command.id)) {
          suggestions.push(command);
          seen.add(command.id);
        }
      });

    // 2) …complété par le profil métier tant qu'il reste de la place.
    defaultSuggestionIds.forEach((id) => {
      const command = byId.get(id);
      if (command && !command.neverSuggest && !seen.has(id) && suggestions.length < SUGGESTION_COUNT) {
        suggestions.push(command);
        seen.add(id);
      }
    });

    const groups = COMMAND_SECTIONS.map((section) => {
      const all = commands
        .filter((command) => command.section === section)
        .sort((a, b) => score(b.id) - score(a.id));
      return {
        section,
        commands: all.slice(0, EMPTY_GROUP_LIMIT),
        hidden: Math.max(0, all.length - EMPTY_GROUP_LIMIT),
      };
    }).filter((group) => group.commands.length > 0);

    return { suggestions, groups, flat: [...suggestions, ...groups.flatMap((g) => g.commands)] };
  }

  // ── Recherche ────────────────────────────────────────────────────────────
  const matched = commands
    .map((command) => {
      const relevance = textScore(command, tokens);
      return relevance === null
        ? null
        : { command, weight: relevance + Math.min(score(command.id), 4) * HABIT_WEIGHT };
    })
    .filter((entry): entry is { command: CommandDescriptor; weight: number } => entry !== null)
    .sort((a, b) => b.weight - a.weight);

  // Aucun plafond à la frappe : un résultat filtré doit rester atteignable.
  const groups = COMMAND_SECTIONS.map((section) => ({
    section,
    commands: matched.filter((entry) => entry.command.section === section).map((entry) => entry.command),
    hidden: 0,
  })).filter((group) => group.commands.length > 0);

  return { suggestions: [], groups, flat: matched.map((entry) => entry.command) };
}
