import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import type { ToolCallExecuted } from '../../../hooks/useAgent';
import { KpiSummaryWidget } from './KpiSummaryWidget';
import { DataTableWidget } from './DataTableWidget';
import { PieChartWidget } from './charts/PieChartWidget';
import { BarChartWidget } from './charts/BarChartWidget';
import { LineChartWidget } from './charts/LineChartWidget';
import { InsightsWidget } from './InsightsWidget';
import { NavigationCardWidget } from './NavigationCardWidget';
import { PortfolioOverviewWidget } from './PortfolioOverviewWidget';
import { WeatherWidget } from './WeatherWidget';
import { EventsWidget } from './EventsWidget';
import { SimulationWidget } from './SimulationWidget';
import { WorkflowWidget } from './WorkflowWidget';
import { KnowledgeWidget } from './KnowledgeWidget';

interface ToolResultWidgetProps {
  call: ToolCallExecuted;
}

/**
 * Routeur de rendu pour les resultats de tools — choisit le widget approprie
 * selon {@code displayHint} :
 *
 * <ul>
 *   <li>{@code "summary"}            → {@link KpiSummaryWidget} (snapshot KPI dashboard)</li>
 *   <li>{@code "list"}               → {@link DataTableWidget} (table generique)</li>
 *   <li>{@code "chart_pie/bar/line"} → charts</li>
 *   <li>{@code "insights"}           → {@link InsightsWidget}</li>
 *   <li>{@code "navigation"}         → {@link NavigationCardWidget}</li>
 *   <li>{@code "portfolio_overview"} → {@link PortfolioOverviewWidget}</li>
 *   <li>{@code "weather"}            → {@link WeatherWidget}</li>
 *   <li>{@code "events"}             → {@link EventsWidget}</li>
 *   <li>{@code "simulation"}         → {@link SimulationWidget}</li>
 *   <li>{@code "workflow_step"}      → {@link WorkflowWidget}</li>
 *   <li>{@code "knowledge"}          → {@link KnowledgeWidget}</li>
 *   <li>autre / sans hint            → fallback minimal cle/valeur</li>
 * </ul>
 *
 * <p>En cas de JSON invalide, le widget se replie silencieusement sur null —
 * le LLM aura formule un texte qui compense (et la chip "tool executed"
 * reste visible).</p>
 */
export const ToolResultWidget: React.FC<ToolResultWidgetProps> = ({ call }) => {
  const parsed = useMemo(() => {
    if (!call.toolResult || call.toolError) return null;
    try {
      return JSON.parse(call.toolResult) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [call.toolResult, call.toolError]);

  // Pas de payload OU erreur → on n'affiche pas de widget (la chip + texte assistant suffisent)
  if (!parsed) {
    return null;
  }

  switch (call.displayHint) {
    case 'summary':
      return <KpiSummaryWidget data={parsed as Parameters<typeof KpiSummaryWidget>[0]['data']} />;

    case 'list':
      return <DataTableWidget data={parsed as Parameters<typeof DataTableWidget>[0]['data']}
                              toolName={call.toolName} />;

    case 'chart_pie':
      return <PieChartWidget data={parsed as Parameters<typeof PieChartWidget>[0]['data']} />;

    case 'chart_bar':
      return <BarChartWidget data={parsed as Parameters<typeof BarChartWidget>[0]['data']} />;

    case 'chart_line':
      return <LineChartWidget data={parsed as Parameters<typeof LineChartWidget>[0]['data']} />;

    case 'insights':
      return <InsightsWidget data={parsed as Parameters<typeof InsightsWidget>[0]['data']} />;

    case 'navigation':
      return <NavigationCardWidget data={parsed as Parameters<typeof NavigationCardWidget>[0]['data']} />;

    case 'portfolio_overview':
      return <PortfolioOverviewWidget data={parsed as Parameters<typeof PortfolioOverviewWidget>[0]['data']} />;

    case 'weather':
      return <WeatherWidget data={parsed as Parameters<typeof WeatherWidget>[0]['data']} />;

    case 'events':
      return <EventsWidget data={parsed as Parameters<typeof EventsWidget>[0]['data']} />;

    case 'simulation':
      return <SimulationWidget data={parsed as Parameters<typeof SimulationWidget>[0]['data']} />;

    case 'workflow_step':
      return <WorkflowWidget data={parsed as Parameters<typeof WorkflowWidget>[0]['data']} />;

    case 'knowledge':
      return <KnowledgeWidget data={parsed as Parameters<typeof KnowledgeWidget>[0]['data']} />;

    default:
      // Hint inconnu : on tente de rendre une representation minimale
      // (le LLM expliquera dans son texte, donc on reste discret ici)
      return <UnknownPayloadFallback payload={parsed} />;
  }
};

/**
 * Fallback pour un payload sans displayHint connu. Affiche une carte compacte
 * avec les paires cle/valeur de niveau 1 (sans nesting). Le LLM portera le
 * detail dans son texte.
 */
const UnknownPayloadFallback: React.FC<{
  payload: Record<string, unknown>;
}> = ({ payload }) => {
  // Limit to non-object keys, max 6 entries
  const entries = Object.entries(payload)
    .filter(([, v]) => typeof v !== 'object' || v === null)
    .slice(0, 6);

  if (entries.length === 0) return null;

  return (
    <Box
      sx={{
        mt: 1, mb: 1.5,
        p: 1.5,
        borderRadius: '10px',
        border: '1px solid var(--line)',
        bgcolor: 'var(--card)',
      }}
    >
      {entries.map(([k, v]) => (
        <Box key={k} sx={{ display: 'flex', gap: 1, py: 0.25 }}>
          <Typography
            sx={{ minWidth: 100, color: 'var(--muted)', fontSize: '11.5px', lineHeight: 1.6 }}
          >
            {k}
          </Typography>
          <Typography
            sx={{ fontSize: '12.5px', color: 'var(--body)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}
          >
            {String(v)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};
