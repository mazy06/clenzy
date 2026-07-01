/* ============================================================
   Superviseur d'agents IA — API publique du module
   ============================================================ */

// Types (data-contract)
export type * from './types';

// Constantes & métadonnées
export * from './constants';

// Gate de rôle (RBAC)
export { useCanSuperviseAgents } from './useCanSuperviseAgents';
export type { SupervisionAccess } from './useCanSuperviseAgents';
export { SUPERVISION_OPERATOR_ROLES, SUPERVISION_VIEWER_ROLES } from './roles';

// Config org-level (Settings > IA : master + modules + autonomie)
export { useSupervisionConfig, useUpdateSupervisionConfig, runSupervisionScan } from './useSupervisionConfig';
export type { SupervisionConfig, SupervisionModuleConfig, SupervisionScanResult } from './useSupervisionConfig';

// Seam provider
export type { SupervisionProvider } from './provider/SupervisionProvider';
export {
  MockSupervisionProvider,
  MockPortfolioProvider,
} from './provider/MockSupervisionProvider';
export type { MockProviderOptions } from './provider/MockSupervisionProvider';
// Provider RÉEL (AG-UI) + mapping + bascule mock⇄réel
export { AgUiSupervisionProvider } from './provider/AgUiSupervisionProvider';
export type { AgUiProviderOptions } from './provider/AgUiSupervisionProvider';
export { mapSpecialistToAgent } from './provider/specialistMapping';
export { isSupervisionLiveEnabled, setSupervisionLive } from './provider/supervisionFlags';
export {
  buildPropertySnapshot,
  buildPortfolioSnapshot,
} from './provider/mockData';
export type { PropertyScenario } from './provider/mockData';

// Constellation (cœur headless + renderer swappable)
export { AgentConstellation } from './components/AgentConstellation';
export type { AgentConstellationProps } from './components/AgentConstellation';
export { FramerConstellation } from './renderers/FramerConstellation';
export type {
  ConstellationRenderer,
  ConstellationRendererProps,
  ConstellationAgentView,
  ConstellationHud,
} from './renderers/ConstellationRenderer';
export { computeConstellationLayout } from './core/geometry';
export type {
  ConstellationLayout,
  SatelliteLayout,
  BeamLayout,
  RingLayout,
  LayoutAgentInput,
} from './core/geometry';

// Temps réel (Phase 3)
export { useSupervision } from './core/useSupervision';
export type {
  SupervisionStatus,
  SupervisionController,
  SupervisionActions,
  UseSupervisionOptions,
} from './core/useSupervision';
export { applyStreamEvent } from './core/applyStreamEvent';
export { useCountdown } from './core/useCountdown';
export type { Countdown } from './core/useCountdown';
export { SupervisionPanel } from './components/SupervisionPanel';
export type { SupervisionPanelProps } from './components/SupervisionPanel';
export { ConstellationSkeleton } from './components/ConstellationSkeleton';
export { SupervisionChatBar } from './components/SupervisionChatBar';
export type { SupervisionChatBarProps } from './components/SupervisionChatBar';

// File HITL (Phase 4)
export { PendingActionCard } from './components/PendingActionCard';
export type { PendingActionCardProps } from './components/PendingActionCard';
export { PendingQueue } from './components/PendingQueue';
export type { PendingQueueProps } from './components/PendingQueue';

// Comète & démo (Phase 5)
export { spawnComet } from './core/spawnComet';
export type { SpawnCometArgs } from './core/spawnComet';
export { SupervisionDemo } from './components/SupervisionDemo';

// Vue d'ensemble portefeuille (Phase 6)
export { aggregatePortfolio } from './core/aggregate';
export { useResolutionToasts } from './core/useResolutionToasts';
export type { ResolutionToast, ResolutionToastsController } from './core/useResolutionToasts';
export { ResolutionToasts } from './components/ResolutionToasts';
export { ActivityFeed } from './components/ActivityFeed';
export { AgentDrawer } from './components/AgentDrawer';
export type { AgentDetail } from './components/AgentDrawer';
export { PortfolioPanel } from './components/PortfolioPanel';
export type { PortfolioPanelProps } from './components/PortfolioPanel';
export { ScopeSwitch } from './components/ScopeSwitch';
export type { SupervisionScope } from './components/ScopeSwitch';
export { SupervisionView } from './components/SupervisionView';
export type { SupervisionViewProps } from './components/SupervisionView';
