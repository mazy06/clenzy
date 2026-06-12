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
    <Box sx={{ mt: 1, mb: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {data.title && (
        <Typography sx={{
          display: 'block', fontSize: '10.5px', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '.05em',
          color: 'var(--faint)',
        }}>
          {data.title}
        </Typography>
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
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.5rem', fontWeight: 600,
            color: deltaColor(data.pctRevenueChange),
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}>
            {formatPctSigned(data.pctRevenueChange)}
          </Typography>
          <Typography sx={{
            fontSize: '10.5px', fontWeight: 700,
            color: 'var(--faint)',
            textTransform: 'uppercase', letterSpacing: '.05em',
          }}>
            Revenue projete
          </Typography>
          <Typography sx={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.85rem', fontWeight: 600,
            color: deltaColor(data.deltaRevenue),
            fontVariantNumeric: 'tabular-nums',
            ml: 'auto',
          }}>
            {formatCurrencySigned(data.deltaRevenue)}
          </Typography>
        </Box>
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
        <Box sx={{
          px: 1.5, py: 1.25,
          borderRadius: '12px',
          bgcolor: 'var(--accent-soft)',
        }}>
          <Typography sx={{
            display: 'block', fontSize: '10.5px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '.05em',
            color: 'var(--accent)', mb: 0.25,
          }}>
            Recommandation
          </Typography>
          <Typography sx={{
            fontSize: '12.5px',
            color: 'var(--body)',
            lineHeight: 1.45,
          }}>
            {data.recommendation}
          </Typography>
        </Box>
      )}
    </Box>
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
      <Typography sx={{
        display: 'block', fontSize: '10.5px', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '.05em',
        color: 'var(--faint)', mb: 0.5,
      }}>
        {label}
      </Typography>
      <Typography sx={{
        fontFamily: 'var(--font-display)',
        fontSize: '1.35rem', fontWeight: 600,
        color: 'var(--ink)',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.01em',
        lineHeight: 1.1,
      }}>
        {formatCurrency(scenario.revenue)}
      </Typography>
      <Box sx={{
        display: 'flex', gap: 1.5, mt: 0.5, flexWrap: 'wrap',
        color: 'var(--muted)',
      }}>
        <MetricInline label="ADR" value={`${Math.round(scenario.adr)} €`} />
        <MetricInline label="Occ." value={`${Math.round(scenario.occupancyRate * 100)}%`} />
        <MetricInline label="Nuits" value={String(scenario.bookedNights)} />
      </Box>
    </Box>
  );
};

const MetricInline: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.4 }}>
    <Typography sx={{
      fontSize: '10.5px', fontWeight: 700, color: 'var(--faint)',
      textTransform: 'uppercase', letterSpacing: '.04em',
    }}>
      {label}
    </Typography>
    <Typography sx={{
      fontSize: '12.5px', fontWeight: 600,
      color: 'var(--ink)',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {value}
    </Typography>
  </Box>
);

// ─── Calendar block ──────────────────────────────────────────────────────────

const CalendarBlockView: React.FC<{ data: CalendarBlockPayload }> = ({ data }) => {
  return (
    <Box sx={{ mt: 1, mb: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {data.title && (
        <Typography sx={{
          display: 'block', fontSize: '10.5px', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '.05em',
          color: 'var(--faint)',
        }}>
          {data.title}
        </Typography>
      )}

      <Box sx={{
        px: 1.5, py: 1.25,
        borderRadius: '12px',
        bgcolor: 'var(--warn-soft)',
        display: 'flex', flexDirection: 'column', gap: 0.5,
      }}>
        <Typography sx={{
          fontSize: '10.5px', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '.05em',
          color: 'var(--warn)',
        }}>
          Perte estimee de revenue
        </Typography>
        <Typography sx={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.75rem', fontWeight: 600,
          color: 'var(--warn)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}>
          {formatCurrency(data.estimatedLostRevenue)}
        </Typography>
        <Typography sx={{
          fontSize: '11.5px', color: 'var(--muted)', mt: 0.25,
        }}>
          sur {data.daysBlocked} jour(s){data.reference ? ` · base sur ${data.reference}` : ''}
        </Typography>
      </Box>

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
        <Box sx={{
          px: 1.5, py: 1.25,
          borderRadius: '12px',
          bgcolor: 'var(--accent-soft)',
        }}>
          <Typography sx={{
            display: 'block', fontSize: '10.5px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '.05em',
            color: 'var(--accent)', mb: 0.5,
          }}>
            Alternatives suggerees
          </Typography>
          <Box component="ul" sx={{ pl: 2.5, m: 0, my: 0.25 }}>
            {data.alternativeSuggestions.map((s, i) => (
              <Box component="li" key={i} sx={{
                fontSize: '12.5px',
                color: 'var(--body)',
                lineHeight: 1.45,
                mb: 0.25,
              }}>
                {s}
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

const KpiTile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box sx={{
    px: 1.25, py: 1,
    borderRadius: '10px',
    bgcolor: 'var(--field)',
  }}>
    <Typography sx={{
      display: 'block', fontSize: '10.5px', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '.05em',
      color: 'var(--faint)', mb: 0.25,
    }}>
      {label}
    </Typography>
    <Typography sx={{
      fontFamily: 'var(--font-display)',
      fontSize: '1rem', fontWeight: 600,
      color: 'var(--ink)',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {value}
    </Typography>
  </Box>
);

// ─── Fallback ────────────────────────────────────────────────────────────────

const FallbackUnknown: React.FC = () => (
  <Box sx={{ mt: 1, mb: 1.5 }}>
    <Box sx={{
      p: 2, borderRadius: '12px',
      bgcolor: 'var(--field)',
      textAlign: 'center',
    }}>
      <Typography sx={{ fontSize: '12.5px', color: 'var(--muted)' }}>
        Simulation non interpretable.
      </Typography>
    </Box>
  </Box>
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(value);
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
