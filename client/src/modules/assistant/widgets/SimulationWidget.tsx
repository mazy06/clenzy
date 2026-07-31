import React from 'react';
import { Box, Typography } from '@mui/material';
import { BarChartWidget } from './charts/BarChartWidget';
import { CHART_PRIMARY } from './charts/chartConstants';

interface ScenarioPayload {
  label: string;
  adr: number;
  occupancyRate: number;
  bookedNights: number;
  revenue: number;
}

interface PricingChangePayload {
  kind: 'pricing_change';
  title?: string;
  propertyName?: string;
  pctChange: number; // fraction (-0.10 = -10%)
  elasticity?: number;
  from?: string;
  to?: string;
  simulationDays?: number;
  baseline: ScenarioPayload;
  scenario: ScenarioPayload;
  deltaRevenue: number;
  deltaOccupancy: number; // fraction
  pctRevenueChange: number; // fraction
  recommendation?: string;
}

interface CalendarBlockPayload {
  kind: 'calendar_block';
  title?: string;
  propertyName?: string;
  from?: string;
  to?: string;
  daysBlocked: number;
  estimatedOccupancy: number; // fraction
  adr: number;
  expectedBookedNights: number;
  estimatedLostRevenue: number;
  reference?: string;
  alternativeSuggestions?: string[];
}

type SimulationData = PricingChangePayload | CalendarBlockPayload | Record<string, unknown>;

interface SimulationWidgetProps {
  data: SimulationData;
}

/**
 * Widget de rendu pour {@code displayHint="simulation"} — projections what-if
 * (changement de prix, blocage calendaire). Le type concret est porte par
 * {@code data.kind} :
 * <ul>
 *   <li>{@code pricing_change} : avant/apres side-by-side + bar chart + reco</li>
 *   <li>{@code calendar_block} : KPI perte + alternatives</li>
 * </ul>
 *
 * <p>Pattern « Signature » : tokens var(--…), deltas display tabular-nums et
 * couleurs semantiques {@code --ok}/{@code --err}/{@code --warn}.</p>
 */
export const SimulationWidget: React.FC<SimulationWidgetProps> = ({ data }) => {
  if (data && typeof data === 'object' && 'kind' in data) {
    if (data.kind === 'pricing_change') {
      return <PricingChangeView data={data as PricingChangePayload} />;
    }
    if (data.kind === 'calendar_block') {
      return <CalendarBlockView data={data as CalendarBlockPayload} />;
    }
  }
  return <FallbackUnknown />;
};

// ─── Pricing change ──────────────────────────────────────────────────────────

// Couleur « Avant » du bar chart : neutre slate aligné AXIS_TICK (couleurs
// data chart = hex, alignées Dashboard finalisé — voir chartConstants).
const CHART_BASELINE_GREY = '#94A3B8';

const PricingChangeView: React.FC<{ data: PricingChangePayload }> = ({ data }) => {
  const positive = data.pctRevenueChange > 0.005;
  const negative = data.pctRevenueChange < -0.005;

  return (
    <div className="mt-1.5 mb-2 flex flex-col gap-2">
      {data.title && (
        <p className="cn-text-body1 block text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)]">
          {data.title}
        </p>
      )}

      {/* Bandeau verdict — couleur selon delta */}
      <Box
        sx={{
          px: 1.5, py: 1.25,
          borderRadius: '12px',
          bgcolor: positive
            ? 'var(--ok-soft)'
            : negative
              ? 'var(--err-soft)'
              : 'var(--field)',
        }}
      >
        <div className="flex items-baseline gap-2 flex-wrap">
          <Typography sx={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.5rem', fontWeight: 600,
            color: deltaColor(data.pctRevenueChange),
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}>
            {formatPctSigned(data.pctRevenueChange)}
          </Typography>
          <p className="cn-text-body1 text-[10.5px] font-bold text-[var(--faint)] uppercase tracking-[.05em]">
            Revenue projete
          </p>
          <Typography sx={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.85rem', fontWeight: 600,
            color: deltaColor(data.deltaRevenue),
            fontVariantNumeric: 'tabular-nums',
            ml: 'auto',
          }}>
            {formatCurrencySigned(data.deltaRevenue)}
          </Typography>
        </div>
      </Box>

      {/* Side-by-side baseline / scenario */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
        gap: 1,
      }}>
        <ScenarioCard label="Avant" scenario={data.baseline} variant="neutral" />
        <ScenarioCard
          label={`Apres ${formatPctSigned(data.pctChange)}`}
          scenario={data.scenario}
          variant={positive ? 'positive' : negative ? 'negative' : 'neutral'}
        />
      </Box>

      {/* Bar chart cote a cote sur les 3 metriques */}
      <BarChartWidget
        data={{
          title: 'Comparaison detaillee',
          items: [
            { name: 'Revenue', Avant: data.baseline.revenue, Apres: data.scenario.revenue },
            { name: 'ADR', Avant: data.baseline.adr, Apres: data.scenario.adr },
            { name: 'Nuits', Avant: data.baseline.bookedNights, Apres: data.scenario.bookedNights },
          ],
          series: [
            { key: 'Avant', label: 'Avant', color: CHART_BASELINE_GREY },
            { key: 'Apres', label: 'Apres', color: CHART_PRIMARY },
          ],
        }}
      />

      {data.recommendation && (
        <div className="px-2 py-2 rounded-[12px] bg-[var(--accent-soft)]">
          <p className="cn-text-body1 block text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--accent)] mb-0.5">
            Recommandation
          </p>
          <p className="cn-text-body1 text-[12.5px] text-[var(--body)] leading-[1.45]">
            {data.recommendation}
          </p>
        </div>
      )}
    </div>
  );
};

const ScenarioCard: React.FC<{
  label: string;
  scenario: ScenarioPayload;
  variant: 'neutral' | 'positive' | 'negative';
}> = ({ label, scenario, variant }) => {
  const bg =
    variant === 'positive' ? 'var(--ok-soft)'
    : variant === 'negative' ? 'var(--err-soft)'
    : 'var(--field)';

  return (
    <Box
      sx={{
        px: 1.25, py: 1,
        borderRadius: '10px',
        bgcolor: bg,
      }}
    >
      <p className="cn-text-body1 block text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)] mb-0.5">
        {label}
      </p>
      <p className="cn-text-body1 font-[var(--font-display)] text-[1.35rem] font-semibold text-[var(--ink)] tabular-nums tracking-[-0.01em] leading-[1.1]">
        {formatCurrency(scenario.revenue)}
      </p>
      <div className="flex gap-2 mt-0.5 flex-wrap text-[var(--muted)]">
        <MetricInline label="ADR" value={`${Math.round(scenario.adr)} €`} />
        <MetricInline label="Occ." value={`${Math.round(scenario.occupancyRate * 100)}%`} />
        <MetricInline label="Nuits" value={String(scenario.bookedNights)} />
      </div>
    </Box>
  );
};

const MetricInline: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="inline-flex items-baseline gap-0.5">
    <p className="cn-text-body1 text-[10.5px] font-bold text-[var(--faint)] uppercase tracking-[.04em]">
      {label}
    </p>
    <p className="cn-text-body1 text-[12.5px] font-semibold text-[var(--ink)] tabular-nums">
      {value}
    </p>
  </div>
);

// ─── Calendar block ──────────────────────────────────────────────────────────

const CalendarBlockView: React.FC<{ data: CalendarBlockPayload }> = ({ data }) => {
  return (
    <div className="mt-1.5 mb-2 flex flex-col gap-2">
      {data.title && (
        <p className="cn-text-body1 block text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)]">
          {data.title}
        </p>
      )}

      <div className="px-2 py-2 rounded-[12px] bg-[var(--warn-soft)] flex flex-col gap-0.5">
        <p className="cn-text-body1 text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--warn)]">
          Perte estimee de revenue
        </p>
        <p className="cn-text-body1 font-[var(--font-display)] text-[1.75rem] font-semibold text-[var(--warn)] tabular-nums tracking-[-0.02em] leading-[1]">
          {formatCurrency(data.estimatedLostRevenue)}
        </p>
        <p className="cn-text-body1 text-[11.5px] text-[var(--muted)] mt-0.5">
          sur {data.daysBlocked} jour(s){data.reference ? ` · base sur ${data.reference}` : ''}
        </p>
      </div>

      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
        gap: 1,
      }}>
        <KpiTile label="Occupation attendue"
                  value={`${Math.round(data.estimatedOccupancy * 100)}%`} />
        <KpiTile label="ADR estime" value={`${Math.round(data.adr)} €`} />
        <KpiTile label="Nuits perdues" value={String(data.expectedBookedNights)} />
      </Box>

      {data.alternativeSuggestions && data.alternativeSuggestions.length > 0 && (
        <div className="px-2 py-2 rounded-[12px] bg-[var(--accent-soft)]">
          <p className="cn-text-body1 block text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--accent)] mb-0.5">
            Alternatives suggerees
          </p>
          <ul className="ps-3.5 m-0 my-0.5">
            {data.alternativeSuggestions.map((s, i) => (
              <li className="text-[12.5px] text-[var(--body)] leading-[1.45] mb-0.5" key={i}>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const KpiTile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="px-2 py-1.5 rounded-[10px] bg-[var(--field)]">
    <p className="cn-text-body1 block text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)] mb-0.5">
      {label}
    </p>
    <p className="cn-text-body1 font-[var(--font-display)] text-[1rem] font-semibold text-[var(--ink)] tabular-nums">
      {value}
    </p>
  </div>
);

// ─── Fallback ────────────────────────────────────────────────────────────────

const FallbackUnknown: React.FC = () => (
  <div className="mt-1.5 mb-2">
    <div className="p-3 rounded-[12px] bg-[var(--field)] text-center">
      <p className="cn-text-body1 text-[12.5px] text-[var(--muted)]">
        Simulation non interpretable.
      </p>
    </div>
  </div>
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatCurrencySigned(value: number): string {
  const formatted = formatCurrency(Math.abs(value));
  return value >= 0 ? `+${formatted}` : `−${formatted}`;
}

function formatPctSigned(frac: number): string {
  const pct = Math.round(frac * 100);
  return (pct > 0 ? '+' : pct < 0 ? '−' : '') + Math.abs(pct) + '%';
}

function deltaColor(value: number): string {
  if (value > 0.005) return 'var(--ok)';
  if (value < -0.005) return 'var(--err)';
  return 'var(--ink)';
}
