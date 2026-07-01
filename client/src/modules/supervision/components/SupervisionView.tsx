/* ============================================================
   <SupervisionView> — point d'entrée : sélecteur de portée + panneau

   Bascule « Par logement » ⇄ « Vue d'ensemble ». Providers mockés par
   défaut ; un appelant peut injecter les vrais (adaptateur CopilotKit).
   ============================================================ */

import { useCallback, useState } from 'react';
import { Box } from '@mui/material';
import { ScopeSwitch, type SupervisionScope } from './ScopeSwitch';
import { SupervisionPanel } from './SupervisionPanel';
import { PortfolioPanel } from './PortfolioPanel';
import { MockSupervisionProvider, MockPortfolioProvider } from '../provider/MockSupervisionProvider';
import { AgUiSupervisionProvider } from '../provider/AgUiSupervisionProvider';
import { isSupervisionLiveEnabled } from '../provider/supervisionFlags';
import type { SupervisionProvider } from '../provider/SupervisionProvider';
import type { AgentId } from '../types';

export interface SupervisionViewProps {
  propertyId: string;
  defaultScope?: SupervisionScope;
  /**
   * Override explicite du provider par logement (priorité absolue sur le flag).
   * Sinon : provider RÉEL (AG-UI) si le flag live est actif, MOCK par défaut.
   */
  createPropertyProvider?: () => SupervisionProvider;
  createPortfolioProvider?: () => SupervisionProvider;
  /** Force le mode réel/mock (override du flag global) — utile pour tests/démo. */
  live?: boolean;
  onSelectAgent?: (id: AgentId) => void;
  onActing?: (agentId: AgentId, reservationId: string) => void;
  onEditAction?: (actionId: string) => void;
}

export function SupervisionView({
  propertyId,
  defaultScope = 'property',
  createPropertyProvider,
  createPortfolioProvider,
  live,
  onSelectAgent,
  onActing,
  onEditAction,
}: SupervisionViewProps) {
  const [scope, setScope] = useState<SupervisionScope>(defaultScope);
  // Réel si : override `live` explicite, sinon flag global. Le MOCK reste le
  // défaut tant que `live` n'est pas demandé.
  const useLive = live ?? isSupervisionLiveEnabled();

  const propertyFactory = useCallback(
    () =>
      createPropertyProvider
        ? createPropertyProvider()
        : useLive
          ? new AgUiSupervisionProvider(propertyId)
          : new MockSupervisionProvider(propertyId),
    [createPropertyProvider, useLive, propertyId],
  );
  const portfolioFactory = useCallback(
    () => (createPortfolioProvider ? createPortfolioProvider() : new MockPortfolioProvider()),
    [createPortfolioProvider],
  );

  return (
    <Box>
      <Box sx={{ mb: 1.5 }}>
        <ScopeSwitch value={scope} onChange={setScope} />
      </Box>
      {scope === 'property' ? (
        // Hôte autonome (démo/spike) : hauteur responsive bornée pour que le
        // panneau (height:100%) ait une hauteur définie à remplir.
        <Box sx={{ height: 'clamp(460px, calc(100dvh - 220px), 760px)' }}>
          <SupervisionPanel
            createProvider={propertyFactory}
            deps={[propertyId]}
            onSelectAgent={onSelectAgent}
            onActing={onActing}
            onEditAction={onEditAction}
          />
        </Box>
      ) : (
        <PortfolioPanel createProvider={portfolioFactory} deps={['portfolio']} onEditAction={onEditAction} />
      )}
    </Box>
  );
}
