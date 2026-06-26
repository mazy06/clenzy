/* ============================================================
   Runtime CopilotKit (Node) — routeur AG-UI + frontière de sécurité.

   Front CopilotKit → CE runtime (/api/copilotkit) → backend Java AG-UI
   (POST /api/agui/run, moteur multi-agent) → generative UI + HITL.

   Le JWT entrant (Authorization) est relayé vers le backend Java via la
   FACTORY d'agents per-requête : `agents: ({ request }) => …`. C'est le
   mécanisme officiel (cf. types @copilotkit/runtime/v2) — on construit un
   HttpAgent par requête avec les en-têtes d'auth de cette requête, donc pas
   de fuite/partage d'en-têtes entre utilisateurs.
   ============================================================ */

import express from 'express';
import { CopilotRuntime } from '@copilotkit/runtime/v2';
import { createCopilotExpressHandler } from '@copilotkit/runtime/v2/express';
import { HttpAgent } from '@ag-ui/client';

const PORT = process.env.PORT || 8080;
const ALLOWED_ORIGIN = process.env.COPILOT_ALLOWED_ORIGIN || 'http://localhost:3000';
const BASE_PATH = process.env.COPILOT_BASE_PATH || '/api/copilotkit';
// URL interne du backend Java (réseau Docker). Dev : clenzy-server:8080.
const AGUI_BACKEND_URL = process.env.AGUI_BACKEND_URL || 'http://clenzy-server:8080/api/agui/run';
const AGENT_NAME = process.env.COPILOT_AGENT_NAME || 'clenzy-supervisor';

const app = express();

// CORS — le front appelle ce service en cross-origin (dev). Bearer + cookie.
// On gère le CORS ici (donc `cors: false` côté handler CopilotKit).
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'copilot-runtime', aguiBackend: AGUI_BACKEND_URL }),
);

// Runtime CopilotKit (mode SSE) : un agent distant = notre backend Java AG-UI.
// La factory per-requête relaie l'Authorization (et le cookie) entrant.
const runtime = new CopilotRuntime({
  agents: ({ request }) => {
    const headers = {};
    const auth = request.headers.get('authorization');
    const cookie = request.headers.get('cookie');
    if (auth) headers.Authorization = auth;
    if (cookie) headers.Cookie = cookie;
    // Diagnostic : confirme que l'auth atteint le runtime (sinon 401 côté Java).
    console.log('[copilot-runtime] run auth →', { hasAuthorization: !!auth, hasCookie: !!cookie });
    return {
      [AGENT_NAME]: new HttpAgent({ url: AGUI_BACKEND_URL, headers }),
    };
  },
});

// Monte les routes /api/copilotkit. CORS géré au-dessus → `cors: false`.
app.use(createCopilotExpressHandler({ runtime, basePath: BASE_PATH, cors: false }));

app.listen(PORT, () =>
  console.log(
    `[copilot-runtime] runtime CopilotKit sur :${PORT}${BASE_PATH} → ${AGUI_BACKEND_URL} (agent "${AGENT_NAME}", origin ${ALLOWED_ORIGIN})`,
  ),
);
