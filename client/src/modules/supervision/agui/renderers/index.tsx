/* ============================================================
   Generative UI — routage displayHint → composant renderer.

   Le backend Java (AgentSseEventToAgUi) emballe chaque résultat d'outil
   en { displayHint, isError, data }. CopilotKit le restitue dans
   `props.result` (string JSON) quand `props.status === 'complete'`.

   `ToolResultRenderer` est le point d'entrée unique :
     1. parseToolResult(props.result) → { displayHint, isError, data }
     2. isError → carte d'erreur discrète
     3. displayHint connu → composant dédié
     4. sinon → carte clé/valeur élégante (PAS de JSON brut)

   Le routage est piloté par DISPLAY_HINT_RENDERERS : ajouter un hint =
   ajouter une entrée, aucun branchement à modifier ailleurs.
   ============================================================ */
import React from 'react';
import { Box, Typography } from '@mui/material';
import { parseToolResult } from './parseToolResult';
import { humanizeKey, ErrorCard } from './shared';

import { ListResult } from './ListResult';
import { DetailsResult } from './DetailsResult';
import { BarChartResult } from './BarChartResult';
import { KpiSummaryResult } from './KpiSummaryResult';
import { DataTableResult } from './DataTableResult';
import { AvailabilityResult } from './AvailabilityResult';
import { QuoteResult } from './QuoteResult';
import { SummaryResult } from './SummaryResult';
import { NavigationResult } from './NavigationResult';

/** Contexte injecté par le spike (navigation, etc.) sans coupler les renderers à react-router. */
export interface RenderContext {
  onNavigate?: (path: string) => void;
}

type RendererFn = (data: unknown, ctx: RenderContext) => React.ReactElement;

/**
 * Registre displayHint → renderer. Chaque renderer reçoit le `data` déjà
 * décapsulé. Les casts sont locaux (chaque composant valide ses propres champs
 * de façon défensive : tableaux/objets manquants tolérés).
 */
export const DISPLAY_HINT_RENDERERS: Record<string, RendererFn> = {
  list: (data) => <ListResult data={data as Parameters<typeof ListResult>[0]['data']} />,
  details: (data) => <DetailsResult data={data as Parameters<typeof DetailsResult>[0]['data']} />,
  chart_bar: (data) => <BarChartResult data={data as Parameters<typeof BarChartResult>[0]['data']} />,
  kpi_summary: (data) => <KpiSummaryResult data={data as Parameters<typeof KpiSummaryResult>[0]['data']} />,
  data_table: (data) => <DataTableResult data={data as Parameters<typeof DataTableResult>[0]['data']} />,
  availability: (data) => <AvailabilityResult data={data as Parameters<typeof AvailabilityResult>[0]['data']} />,
  quote: (data) => <QuoteResult data={data as Parameters<typeof QuoteResult>[0]['data']} />,
  summary: (data) => <SummaryResult data={data as Parameters<typeof SummaryResult>[0]['data']} />,
  navigation: (data, ctx) => (
    <NavigationResult data={data as Parameters<typeof NavigationResult>[0]['data']} onNavigate={ctx.onNavigate} />
  ),
};

/**
 * Default displayHint par OUTIL connu — utilisé quand le backend n'émet pas
 * encore le hint dans le wrapper (robustesse), et pour enregistrer un
 * `useRenderTool` par outil côté spike. Source : les `ToolResult.success(..,
 * "<hint>")` du backend (com.clenzy.service.agent.tools).
 */
export const TOOL_DISPLAY_HINTS: Record<string, string> = {
  // list
  list_reservations: 'list',
  list_properties: 'list',
  list_invoices: 'list',
  list_reviews: 'list',
  list_guests: 'list',
  list_cleaning_tasks: 'list',
  get_owner_payout_summary: 'list',
  get_noise_alerts: 'list',
  get_property_amenities: 'list',
  get_channel_sync_status: 'list',
  // details
  get_reservation_details: 'details',
  get_property_details: 'details',
  get_billing_overview: 'details',
  // chart_bar
  get_financial_summary: 'chart_bar',
  get_properties_performance: 'chart_bar',
  // availability / quote
  get_availability: 'availability',
  get_price_quote: 'quote',
  // kpi snapshot (SummaryResult délègue à KpiSummaryResult si forme KPI)
  get_dashboard_summary: 'summary',
  // navigation
  suggest_navigation: 'navigation',
  // summary (confirmations d'écriture) — défaut générique
  create_reservation: 'summary',
  cancel_reservation: 'summary',
  update_reservation_status: 'summary',
  create_invoice: 'summary',
  assign_intervention: 'summary',
  create_intervention: 'summary',
  update_intervention_status: 'summary',
  set_rate_override: 'summary',
  block_calendar_day: 'summary',
  send_guest_message: 'summary',
  reply_to_review: 'summary',
  update_property_status: 'summary',
  remember_fact: 'summary',
  forget_fact: 'summary',
};

/**
 * Point d'entrée unique : décapsule un `result` brut et rend le bon composant.
 * `hintFallback` (le default-hint du tool) est utilisé quand le wrapper n'a
 * pas de displayHint explicite.
 */
export const ToolResultRenderer: React.FC<{
  result: unknown;
  hintFallback?: string | null;
  ctx?: RenderContext;
}> = ({ result, hintFallback, ctx = {} }) => {
  const { displayHint, isError, data } = parseToolResult(result);

  if (isError) {
    return <ErrorCard message={typeof data === 'string' ? data : undefined} />;
  }

  if (data === null || data === undefined) {
    return null;
  }

  const hint = displayHint ?? hintFallback ?? null;
  const renderer = hint ? DISPLAY_HINT_RENDERERS[hint] : undefined;

  if (renderer) {
    return renderer(data, ctx);
  }

  return <KeyValueFallback data={data} />;
};

/**
 * Fallback élégant pour un hint inconnu / absent : carte clé/valeur des champs
 * scalaires de niveau 1 (jamais de JSON brut visible). Le LLM porte le détail
 * dans son texte ; on reste discret mais lisible.
 */
const KeyValueFallback: React.FC<{ data: unknown }> = ({ data }) => {
  // Chaîne brute (tool non-JSON) → petite note texte.
  if (typeof data === 'string') {
    return (
      <div className="mt-1.5 mb-2 px-2 py-2 rounded-[10px] border border-[var(--line)] bg-[var(--card)]">
        <p className="cn-text-body1 text-[12.5px] text-[var(--body)] whitespace-pre-wrap">{data}</p>
      </div>
    );
  }

  if (typeof data !== 'object' || data === null) return null;

  // Array : on délègue au tableau générique si possible.
  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    return <DataTableResult data={{ rows: data as Record<string, unknown>[] }} />;
  }

  const entries = Object.entries(data as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== '' && (typeof v !== 'object' || Array.isArray(v) === false) && typeof v !== 'object')
    .slice(0, 8);

  if (entries.length === 0) return null;

  return (
    <div className="mt-1.5 mb-2 p-2 rounded-[10px] border border-[var(--line)] bg-[var(--card)]">
      {entries.map(([k, v], idx) => (
        <Box
          key={k}
          sx={{ display: 'flex', gap: 1.5, py: 0.5, alignItems: 'baseline', borderTop: idx > 0 ? '1px solid var(--line)' : 'none' }}
        >
          <Typography sx={{ flex: '0 0 38%', color: 'var(--muted)', fontSize: '11.5px' }}>
            {humanizeKey(k)}
          </Typography>
          <p className="cn-text-body1 flex-1 text-[12.5px] text-[var(--body)] font-medium tabular-nums">
            {String(v)}
          </p>
        </Box>
      ))}
    </div>
  );
};
