/* ============================================================
   <AgentConstellation> — composant public

   Orchestre : normalise un snapshot (par logement OU portefeuille) en
   vue de rendu, gère l'état local (focus), et délègue au renderer
   swappable (FramerConstellation par défaut).

   Phase 2 : statique + lecture seule (branché sur un snapshot). Le flux
   temps réel et les actions arrivent en Phase 3/4.
   ============================================================ */

import { useMemo, useState, type ReactNode } from 'react';
import { FramerConstellation } from '../renderers/FramerConstellation';
import type {
  ConstellationAgentView,
  ConstellationHud,
  ConstellationRenderer,
  ConstellationReport,
} from '../renderers/ConstellationRenderer';
import type { AgentId, OrchestratorSnapshot, PortfolioSnapshot, SupervisionSnapshot } from '../types';

export interface AgentConstellationProps {
  snapshot: SupervisionSnapshot;
  /** Renderer alternatif (le visuel est swappable). Défaut : FramerConstellation. */
  renderer?: ConstellationRenderer;
  /** Surcharge l'état en ligne (sinon snapshot.online). Piloté par useSupervision. */
  online?: boolean;
  onSelectAgent?: (id: AgentId) => void;
  /** Action posée dans le HUD (ex. bouton « Scanner » en icône). */
  headerAction?: ReactNode;
  /** Bilan de valeur (fenêtre = zoom planning) affiché dans le HUD. */
  report?: ConstellationReport;
  /** Fenêtre du bilan sélectionnée (jours) + handler du sélecteur HUD. */
  reportWindow?: number;
  onReportWindowChange?: (days: number) => void;
  /** Contenu empilé juste sous le HUD (ex. flux « En direct »). */
  belowHud?: ReactNode;
  /** Rendu pleine-cellule (accordéon Planning) : canvas sans arrondi ni ombre. */
  flush?: boolean;
}

interface NormalizedView {
  agents: ConstellationAgentView[];
  hud: ConstellationHud;
}

function normalize(snapshot: SupervisionSnapshot): NormalizedView {
  if (snapshot.scope === 'portfolio') {
    const portfolio: PortfolioSnapshot = snapshot;
    const agents: ConstellationAgentView[] = portfolio.agents.map((a) => ({
      id: a.id,
      status: a.status,
      autonomy: a.autonomy,
      task: a.task,
      badge: a.propertyCount, // badge = nb de logements concernés
    }));
    return {
      agents,
      hud: {
        agentsCount: agents.length,
        actingCount: agents.filter((a) => a.status === 'act').length,
        awaitingCount: portfolio.pending.length,
      },
    };
  }

  const property: OrchestratorSnapshot = snapshot;
  const agents: ConstellationAgentView[] = property.agents.map((a) => ({
    id: a.id,
    status: a.status,
    autonomy: a.autonomy,
    task: a.task,
    thinkingProgress: a.thinkingProgress,
  }));
  return {
    agents,
    hud: {
      agentsCount: agents.length,
      actingCount: agents.filter((a) => a.status === 'act').length,
      awaitingCount: property.pending.length,
    },
  };
}

export function AgentConstellation({
  snapshot,
  renderer: Renderer = FramerConstellation,
  online,
  onSelectAgent,
  headerAction,
  report,
  reportWindow,
  onReportWindowChange,
  belowHud,
  flush,
}: AgentConstellationProps) {
  const [focused, setFocused] = useState(false);
  const { agents, hud } = useMemo(() => normalize(snapshot), [snapshot]);

  return (
    <Renderer
      agents={agents}
      hud={hud}
      online={online ?? snapshot.online}
      paused={snapshot.paused}
      focused={focused}
      onToggleFocus={() => setFocused((f) => !f)}
      onSelectAgent={onSelectAgent}
      headerAction={headerAction}
      report={report}
      reportWindow={reportWindow}
      onReportWindowChange={onReportWindowChange}
      belowHud={belowHud}
      flush={flush}
    />
  );
}
