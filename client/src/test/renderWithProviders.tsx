/* ============================================================
   renderWithProviders — le contexte minimal que l'application fournit

   Les composants de la constellation lisent le thème et la navigation. Montés
   nus, ils lèvent « useThemeMode must be used within a ThemeModeProvider » ou
   « useNavigate() may be used only in the context of a <Router> » — un échec de
   HARNAIS, qui ne dit rien du composant testé.

   Cinq fichiers de test échouaient pour cette seule raison. Les envelopper ici
   plutôt que dans chacun garde la cause au même endroit, et évite qu'un
   prochain test la redécouvre.
   ============================================================ */

import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeModeProvider } from '../hooks/useThemeMode';
import { CurrencyProvider } from '../hooks/useCurrency';

/**
 * Client neuf par rendu : aucun cache ne fuit d'un test à l'autre.
 *
 * <p>Sans `retry: false`, une requête en échec serait retentée en tâche de fond
 * et le test se terminerait avant — l'échec réapparaîtrait ailleurs, attribué
 * au mauvais test.</p>
 */
function newQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function AllProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={newQueryClient()}>
      <MemoryRouter>
        <ThemeModeProvider>
          <CurrencyProvider>{children}</CurrencyProvider>
        </ThemeModeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/** `render` de Testing Library, avec le contexte que l'application monte. */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
): RenderResult {
  return render(ui, { wrapper: AllProviders, ...options });
}

export * from '@testing-library/react';
