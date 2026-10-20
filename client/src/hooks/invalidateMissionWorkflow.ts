import type { QueryClient } from '@tanstack/react-query';

/** Les surfaces d'une mission relisent ensemble les décisions du serveur. */
export function invalidateMissionWorkflow(client: QueryClient): Promise<void[]> {
  return Promise.all([
    ['quote-requests'], ['service-quotes'], ['interventions'],
    ['field', 'missions'], ['field', 'quotes'], ['field', 'agreed-rates'],
    ['contact'], ['planning'], ['service-proposals'], ['service-requests-list'],
    ['assignment-history'], ['assignment-quotes'], ['service-request-details'],
    ['paid-service-execution'], ['upsell-orders'],
  ].map((queryKey) => client.invalidateQueries({ queryKey })));
}
