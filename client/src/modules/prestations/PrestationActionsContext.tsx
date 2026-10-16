import { createContext, useContext } from 'react';
import type { useInterventionsList } from '../interventions/useInterventionsList';
import type { useServiceRequestsList } from '../service-requests/useServiceRequestsList';

/**
 * Actions de l'écran Prestations. Chaque type garde les siennes, portées par le hook de son
 * ancien écran : l'écran les instancie une fois, les lignes (liste comme carte) les lisent ici.
 */
export interface PrestationActions {
  intervention: ReturnType<typeof useInterventionsList>;
  request: ReturnType<typeof useServiceRequestsList>;
}

export const PrestationActionsContext = createContext<PrestationActions | null>(null);

export function usePrestationActions(): PrestationActions | null {
  return useContext(PrestationActionsContext);
}
