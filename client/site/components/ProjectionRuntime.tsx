import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CurrencyProvider } from '../../src/hooks/useCurrency';

/**
 * Fournit les providers runtime dont dépendent certaines projections embarquées
 * (<Money> → useCurrency, react-query). Sans auth, useUserPreferences est
 * désactivé → le provider boote sur localStorage, fixé en MAD (marché marocain).
 */
if (typeof window !== 'undefined') {
  window.localStorage.setItem('clenzy_currency', 'MAD');
}

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

export default function ProjectionRuntime({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <CurrencyProvider>{children}</CurrencyProvider>
    </QueryClientProvider>
  );
}
