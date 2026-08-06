import { describe, it, expect } from 'vitest';
import { rankCommands, EMPTY_GROUP_LIMIT, SUGGESTION_COUNT } from '../ranking';
import type { CommandDescriptor } from '../types';

const noop = () => {};

const make = (
  id: string,
  label: string,
  section: CommandDescriptor['section'] = 'navigation',
  extra: Partial<CommandDescriptor> = {},
): CommandDescriptor => ({ id, section, label, run: noop, ...extra });

const CATALOG: CommandDescriptor[] = [
  make('nav:/reservations', 'Réservations'),
  make('nav:/properties', 'Propriétés', 'navigation', { keywords: 'logement bien' }),
  make('nav:/interventions', 'Interventions', 'navigation', { keywords: 'ménage nettoyage' }),
  make('action:property.create', 'Ajouter un logement', 'actions'),
  make('view:theme.dark', 'Passer en thème sombre', 'views', { neverSuggest: true }),
];

const noHabits = () => 0;

describe('rankCommands — recherche', () => {
  it('ignore les accents dans la requête comme dans le libellé', () => {
    const result = rankCommands({
      commands: CATALOG,
      query: 'reserv',
      score: noHabits,
      defaultSuggestionIds: [],
    });
    expect(result.flat.map((c) => c.id)).toEqual(['nav:/reservations']);
  });

  it('trouve par vocabulaire métier, pas seulement par nom d’écran', () => {
    const result = rankCommands({
      commands: CATALOG,
      query: 'ménage',
      score: noHabits,
      defaultSuggestionIds: [],
    });
    expect(result.flat.map((c) => c.id)).toEqual(['nav:/interventions']);
  });

  it('fait primer le préfixe de libellé sur le synonyme', () => {
    const result = rankCommands({
      commands: CATALOG,
      query: 'logement',
      score: noHabits,
      defaultSuggestionIds: [],
    });
    // « Ajouter un logement » contient le mot ; « Propriétés » ne l'a qu'en mot-clé.
    expect(result.flat[0].id).toBe('action:property.create');
    expect(result.flat.map((c) => c.id)).toContain('nav:/properties');
  });

  it('exige que TOUS les mots de la requête portent', () => {
    const result = rankCommands({
      commands: CATALOG,
      query: 'ajouter facture',
      score: noHabits,
      defaultSuggestionIds: [],
    });
    expect(result.flat).toHaveLength(0);
  });

  it('ne laisse pas une habitude détourner une recherche explicite', () => {
    const result = rankCommands({
      commands: CATALOG,
      query: 'reserv',
      // Habitude massive sur une commande qui ne correspond PAS à la requête.
      score: (id) => (id === 'nav:/properties' ? 99 : 0),
      defaultSuggestionIds: [],
    });
    expect(result.flat.map((c) => c.id)).toEqual(['nav:/reservations']);
  });

  it('ne propose aucune suggestion quand une requête est saisie', () => {
    const result = rankCommands({
      commands: CATALOG,
      query: 'res',
      score: () => 5,
      defaultSuggestionIds: ['nav:/properties'],
    });
    expect(result.suggestions).toHaveLength(0);
  });
});

describe('rankCommands — requête vide', () => {
  it('met l’usage réel devant le profil métier', () => {
    const result = rankCommands({
      commands: CATALOG,
      query: '',
      score: (id) => (id === 'nav:/interventions' ? 10 : 0),
      defaultSuggestionIds: ['nav:/reservations', 'nav:/properties'],
    });
    expect(result.suggestions[0].id).toBe('nav:/interventions');
    expect(result.suggestions[1].id).toBe('nav:/reservations');
  });

  it('retombe sur le profil métier quand il n’y a pas d’historique', () => {
    const result = rankCommands({
      commands: CATALOG,
      query: '',
      score: noHabits,
      defaultSuggestionIds: ['nav:/properties', 'nav:/reservations'],
    });
    expect(result.suggestions.map((c) => c.id)).toEqual(['nav:/properties', 'nav:/reservations']);
  });

  it('ignore un identifiant de profil qui ne correspond à aucune commande accessible', () => {
    const result = rankCommands({
      commands: CATALOG,
      query: '',
      score: noHabits,
      defaultSuggestionIds: ['nav:/admin/monitoring', 'nav:/properties'],
    });
    expect(result.suggestions.map((c) => c.id)).toEqual(['nav:/properties']);
  });

  it('tient les bascules d’affichage hors des suggestions', () => {
    const result = rankCommands({
      commands: CATALOG,
      query: '',
      score: (id) => (id === 'view:theme.dark' ? 100 : 0),
      defaultSuggestionIds: ['view:theme.dark'],
    });
    expect(result.suggestions.map((c) => c.id)).not.toContain('view:theme.dark');
  });

  it('ne dépasse jamais le nombre de suggestions affichables', () => {
    const many = Array.from({ length: 20 }, (_, i) => make(`nav:/screen-${i}`, `Écran ${i}`));
    const result = rankCommands({
      commands: many,
      query: '',
      score: (id) => Number(id.split('-')[1]),
      defaultSuggestionIds: [],
    });
    expect(result.suggestions).toHaveLength(SUGGESTION_COUNT);
  });

  it('groupe par section et n’affiche que les sections peuplées', () => {
    const result = rankCommands({
      commands: CATALOG,
      query: '',
      score: noHabits,
      defaultSuggestionIds: [],
    });
    expect(result.groups.map((g) => g.section)).toEqual(['navigation', 'actions', 'views']);
    expect(result.groups.every((g) => g.hidden === 0)).toBe(true);
  });

  it('plafonne un groupe volumineux et annonce le reste', () => {
    // La tab Intégrations publie 71 commandes d'écran : sans plafond, elles
    // repousseraient toutes les autres sections hors de vue.
    const many = Array.from({ length: 71 }, (_, i) =>
      make(`screen:svc-${i}`, `Service ${i}`, 'screen'),
    );
    const result = rankCommands({
      commands: [...many, ...CATALOG],
      query: '',
      score: noHabits,
      defaultSuggestionIds: [],
    });
    const screenGroup = result.groups.find((g) => g.section === 'screen')!;
    expect(screenGroup.commands).toHaveLength(EMPTY_GROUP_LIMIT);
    expect(screenGroup.hidden).toBe(71 - EMPTY_GROUP_LIMIT);
    // Les sections suivantes restent visibles.
    expect(result.groups.map((g) => g.section)).toContain('navigation');
  });
});

describe('rankCommands — plafond', () => {
  it('ne plafonne jamais les résultats d’une recherche', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      make(`screen:svc-${i}`, `Service ${i}`, 'screen'),
    );
    const result = rankCommands({
      commands: many,
      query: 'service',
      score: noHabits,
      defaultSuggestionIds: [],
    });
    expect(result.flat).toHaveLength(30);
    expect(result.groups[0].hidden).toBe(0);
  });
});
