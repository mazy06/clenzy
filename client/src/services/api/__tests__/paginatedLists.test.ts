import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from '../../apiClient';
import { usersApi } from '../usersApi';
import { teamsApi } from '../teamsApi';
import { serviceRequestsApi } from '../serviceRequestsApi';
import { interventionsApi } from '../interventionsApi';

/**
 * Quatre listes dont le type mentait.
 *
 * `/users`, `/teams`, `/service-requests` et `/interventions` renvoient une PAGE
 * Spring (`{content: […], totalElements}`), alors que leurs méthodes annonçaient
 * `Promise<T[]>`. Le type est affirmé à la main sur `apiClient.get<T>` : rien ne
 * pouvait le contredire, et chaque appelant contournait le problème à sa façon —
 * jusqu'à celui qui a fait confiance et est tombé sur
 * « teams.filter is not a function ».
 *
 * Ces tests figent le contrat : quelle que soit la forme rendue par le serveur,
 * ces méthodes rendent un tableau.
 */

vi.mock('../../apiClient', () => ({
  default: { get: vi.fn() },
}));

const page = <T,>(content: T[]) => ({ content, totalElements: content.length, number: 0, size: 20 });

const CASES = [
  { label: '/users', call: () => usersApi.getAll(), row: { id: 1, firstName: 'Yasmine' } },
  { label: '/teams', call: () => teamsApi.getAll(), row: { id: 2, name: 'Équipe Marrakech' } },
  { label: '/service-requests', call: () => serviceRequestsApi.getAll(), row: { id: 3, title: 'Ménage' } },
  { label: '/interventions', call: () => interventionsApi.getAll(), row: { id: 4, title: 'Plomberie' } },
];

describe('listes paginées — le type doit dire la vérité', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(CASES)('$label rend un tableau quand le serveur rend une page', async ({ call, row }) => {
    vi.mocked(apiClient.get).mockResolvedValue(page([row]) as never);

    const result = await call();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    // La garantie qui manquait : on peut enchaîner sans se demander la forme.
    expect(() => (result as unknown[]).filter(Boolean)).not.toThrow();
  });

  it.each(CASES)('$label rend un tableau quand le serveur rend déjà un tableau', async ({ call, row }) => {
    // Un endpoint peut cesser d'être paginé : la méthode ne doit pas s'y casser.
    vi.mocked(apiClient.get).mockResolvedValue([row] as never);

    expect(await call()).toHaveLength(1);
  });

  it.each(CASES)('$label rend un tableau vide sur une réponse inattendue', async ({ call }) => {
    vi.mocked(apiClient.get).mockResolvedValue(null as never);

    expect(await call()).toEqual([]);
  });
});
