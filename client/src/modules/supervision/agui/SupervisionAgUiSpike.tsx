/* ============================================================
   Phase 0 — Spike CopilotKit ↔ AG-UI ↔ moteur multi-agent Java

   Prouve la boucle complète sur le VRAI moteur (OrchestratorAgent) :
   front CopilotKit v2 → runtime Node (/api/copilotkit) → backend Java
   (/api/agui/run) → multi-agent → generative UI + HITL.

   Generative UI : chaque résultat d'outil est emballé par le backend en
   { displayHint, isError, data } (JSON dans props.result). Un renderer par
   displayHint vit dans `renderers/` ; `ToolResultRenderer` décapsule et route.
   On enregistre UN SEUL renderer wildcard (`name: "*"`) : il lit le nom de
   l'outil (props.name → TOOL_DISPLAY_HINTS pour le hint de repli) et délègue
   au routeur central. Le displayHint réel du wrapper prime sur le repli.
   (Évite ~30 useRenderTool en boucle = pas de risque Rules-of-Hooks.)

   Emplacement isolé (route de spike) : ne touche PAS le SupervisionPanel
   sur mock. À fusionner dans la section Superviseur une fois validé.
   ============================================================ */

import {
  CopilotKitProvider,
  CopilotChat,
  CopilotChatConfigurationProvider,
  useRenderTool,
  useInterrupt,
} from '@copilotkit/react-core/v2';
import '@copilotkit/react-core/v2/styles.css';
import { getAccessToken } from '../../../keycloak';
import { useNavigate } from 'react-router-dom';
import { ToolResultRenderer, TOOL_DISPLAY_HINTS, type RenderContext } from './renderers';
import { PendingHint } from './renderers/shared';

/** Agent exposé par le backend Java via /api/agui/info. */
const AGENT_ID = 'clenzy-supervisor';

/**
 * URL du runtime Node CopilotKit. En dev, le front (Vite :3000) appelle le
 * service `copilot-runtime` exposé sur :8087 (URLs API absolues, pas de proxy
 * Vite dans ce projet). Repli relatif `/api/copilotkit` pour la prod (nginx).
 */
const RUNTIME_URL =
  (import.meta.env as Record<string, string | undefined>).VITE_COPILOT_RUNTIME_URL ||
  '/api/copilotkit';

/**
 * En-têtes d'auth envoyés au runtime Node (qui les relaiera au backend Java) —
 * même schéma que les appels assistant existants : Bearer + cookie HttpOnly.
 */
function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Libellé « en cours » par hint, le temps que le tool s'exécute. */
const PENDING_LABEL_BY_HINT: Record<string, string> = {
  list: 'Récupération de la liste',
  details: 'Chargement du détail',
  chart_bar: 'Calcul du graphique',
  kpi_summary: 'Analyse du tableau de bord',
  data_table: 'Préparation des données',
  availability: 'Vérification de la disponibilité',
  quote: 'Calcul du devis',
  summary: 'Traitement',
  navigation: 'Recherche de la bonne page',
};

function SpikeInner() {
  const navigate = useNavigate();
  const ctx: RenderContext = { onNavigate: (path) => navigate(path) };

  // Generative UI : un SEUL renderer wildcard pour tous les outils du moteur.
  // Il lit le nom de l'outil (props.name) pour résoudre le hint de repli via
  // TOOL_DISPLAY_HINTS, puis délègue au routeur central qui choisit le
  // composant selon le displayHint du wrapper backend (qui prime).
  useRenderTool(
    {
      name: '*',
      agentId: AGENT_ID,
      render: (props: { name?: string; status: string; result?: string }) => {
        const hint = (props.name && TOOL_DISPLAY_HINTS[props.name]) || null;
        if (props.status !== 'complete') {
          return <PendingHint label={(hint && PENDING_LABEL_BY_HINT[hint]) || 'Traitement'} />;
        }
        return <ToolResultRenderer result={props.result} hintFallback={hint} ctx={ctx} />;
      },
    },
    [],
  );

  // HITL : interrupt AG-UI (RUN_FINISHED outcome=interrupt, émis par le backend
  // sur tool_confirmation_request) → carte approuver / refuser.
  useInterrupt({
    agentId: AGENT_ID,
    render: ({ resolve, cancel }) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
        <strong>Validation requise par l'agent</strong>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => void resolve({ confirmed: true })}>Approuver</button>
          <button onClick={() => void cancel()}>Refuser</button>
        </div>
      </div>
    ),
  });

  return (
    <CopilotChatConfigurationProvider agentId={AGENT_ID}>
      <CopilotChat />
    </CopilotChatConfigurationProvider>
  );
}

/** Racine du spike : provider CopilotKit branché sur le runtime Node. */
export default function SupervisionAgUiSpike() {
  return (
    <CopilotKitProvider runtimeUrl={RUNTIME_URL} credentials="include" headers={authHeaders}>
      <SpikeInner />
    </CopilotKitProvider>
  );
}
