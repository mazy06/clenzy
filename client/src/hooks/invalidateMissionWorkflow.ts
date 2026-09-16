import type { QueryClient } from '@tanstack/react-query';

/** Les surfaces d'une mission relisent ensemble les décisions du serveur. */
export function invalidateMissionWorkflow(client: QueryClient): Promise<void[]> {
  return Promise.all([
    ['quote-requests'], ['service-quotes'], ['interventions'],
    ['field', 'missions'], ['field', 'quotes'], ['field', 'agreed-rates'],
    ['contact'], ['planning'], ['service-proposals'], ['service-requests-list'],
    ['assignment-history'], ['service-request-details'],
  ].map((queryKey) => client.invalidateQueries({ queryKey })));
}
