import React from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { BarChartWidget } from './charts/BarChartWidget';

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
 * <p>Borderless, bg tonal. Deltas avec tabular-nums et couleurs semantiques.</p>
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

const PricingChangeView: React.FC<{ data: PricingChangePayload }> = ({ data }) => {
  const theme = useTheme();
  const positive = data.pctRevenueChange > 0.005;
  const negative = data.pctRevenueChange < -0.005;

  return (
    <Box sx={{ mt: 1, mb: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {data.title && (
        <Typography variant="caption" sx={{
          display: 'block', fontSize: '0.7rem', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.04em',
          color: theme.palette.text.secondary,
        }}>
          {data.title}
        </Typography>
      )}

      {/* Bandeau verdict — couleur selon delta */}
      <Box
        sx={{
          px: 1.5, py: 1.25,
          borderRadius: 1.5,
          bgcolor: positive
            ? alpha(theme.palette.success.main, 0.1)
            : negative
              ? alpha(theme.palette.error.main, 0.1)
              : alpha(theme.palette.text.primary, 0.04),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={{
            fontSize: '1.5rem', fontWeight: 700,
            color: deltaColor(data.pctRevenueChange, theme),
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}>
            {formatPctSigned(data.pctRevenueChange)}
          </Typography>
          <Typography variant="caption" sx={{
            fontSize: '0.75rem', fontWeight: 600,
            color: theme.palette.text.secondary,
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            Revenue projete
          </Typography>
          <Typography sx={{
            fontSize: '0.85rem', fontWeight: 600,
            color: deltaColor(data.deltaRevenue, theme),
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
            { key: 'Avant', label: 'Avant', color: alpha(theme.palette.text.primary, 0.45) },
            { key: 'Apres', label: 'Apres', color: theme.palette.primary.main },
          ],
        }}
      />

      {data.recommendation && (
        <Box sx={{
          px: 1.5, py: 1.25,
          borderRadius: 1.5,
          bgcolor: alpha(theme.palette.primary.main, 0.06),
        }}>
          <Typography variant="caption" sx={{
            display: 'block', fontSize: '0.65rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            color: theme.palette.primary.dark, mb: 0.25,
          }}>
            Recommandation
          </Typography>
          <Typography variant="body2" sx={{
            fontSize: '0.8125rem',
            color: theme.palette.text.primary,
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
  const theme = useTheme();
  const color =
    variant === 'positive' ? theme.palette.success.main
    : variant === 'negative' ? theme.palette.error.main
    : theme.palette.primary.main;

  return (
    <Box
      sx={{
        px: 1.25, py: 1,
        borderRadius: 1.5,
        bgcolor: alpha(color, variant === 'neutral' ? 0.04 : 0.08),
      }}
    >
      <Typography variant="caption" sx={{
        display: 'block', fontSize: '0.65rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.05em',
        color: theme.palette.text.secondary, mb: 0.5,
      }}>
        {label}
      </Typography>
      <Typography sx={{
        fontSize: '1.35rem', fontWeight: 700,
        color: theme.palette.text.primary,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.01em',
        lineHeight: 1.1,
      }}>
        {formatCurrency(scenario.revenue)}
      </Typography>
      <Box sx={{
        display: 'flex', gap: 1.5, mt: 0.5, flexWrap: 'wrap',
        color: theme.palette.text.secondary,
      }}>
        <MetricInline label="ADR" value={`${Math.round(scenario.adr)} €`} />
        <MetricInline label="Occ." value={`${Math.round(scenario.occupancyRate * 100)}%`} />
        <MetricInline label="Nuits" value={String(scenario.bookedNights)} />
      </Box>
    </Box>
  );
};

const MetricInline: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const theme = useTheme();
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.4 }}>
      <Typography variant="caption" sx={{
        fontSize: '0.65rem', color: theme.palette.text.disabled,
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{
        fontSize: '0.78rem', fontWeight: 600,
        color: theme.palette.text.primary,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </Typography>
    </Box>
  );
};

// ─── Calendar block ──────────────────────────────────────────────────────────

const CalendarBlockView: React.FC<{ data: CalendarBlockPayload }> = ({ data }) => {
  const theme = useTheme();
  return (
    <Box sx={{ mt: 1, mb: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {data.title && (
        <Typography variant="caption" sx={{
          display: 'block', fontSize: '0.7rem', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.04em',
          color: theme.palette.text.secondary,
        }}>
          {data.title}
        </Typography>
      )}

      <Box sx={{
        px: 1.5, py: 1.25,
        borderRadius: 1.5,
        bgcolor: alpha(theme.palette.warning.main, 0.08),
        display: 'flex', flexDirection: 'column', gap: 0.5,
      }}>
        <Typography variant="caption" sx={{
          fontSize: '0.65rem', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.05em',
          color: theme.palette.warning.dark,
        }}>
          Perte estimee de revenue
        </Typography>
        <Typography sx={{
          fontSize: '1.75rem', fontWeight: 700,
          color: theme.palette.warning.dark,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}>
          {formatCurrency(data.estimatedLostRevenue)}
        </Typography>
        <Typography variant="caption" sx={{
          fontSize: '0.75rem', color: theme.palette.text.secondary, mt: 0.25,
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
          borderRadius: 1.5,
          bgcolor: alpha(theme.palette.primary.main, 0.06),
        }}>
          <Typography variant="caption" sx={{
            display: 'block', fontSize: '0.65rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            color: theme.palette.primary.dark, mb: 0.5,
          }}>
            Alternatives suggerees
          </Typography>
          <Box component="ul" sx={{ pl: 2.5, m: 0, my: 0.25 }}>
            {data.alternativeSuggestions.map((s, i) => (
              <Box component="li" key={i} sx={{
                fontSize: '0.8125rem',
                color: theme.palette.text.primary,
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

const KpiTile: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const theme = useTheme();
  return (
    <Box sx={{
      px: 1.25, py: 1,
      borderRadius: 1.5,
      bgcolor: alpha(theme.palette.text.primary, 0.04),
    }}>
      <Typography variant="caption" sx={{
        display: 'block', fontSize: '0.7rem',
        color: theme.palette.text.secondary, mb: 0.25,
      }}>
        {label}
      </Typography>
      <Typography sx={{
        fontSize: '1rem', fontWeight: 600,
        color: theme.palette.text.primary,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </Typography>
    </Box>
  );
};

// ─── Fallback ────────────────────────────────────────────────────────────────

const FallbackUnknown: React.FC = () => {
  const theme = useTheme();
  return (
    <Box sx={{ mt: 1, mb: 1.5 }}>
      <Box sx={{
        p: 2, borderRadius: 2,
        bgcolor: alpha(theme.palette.text.primary, 0.04),
        textAlign: 'center',
      }}>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          Simulation non interpretable.
        </Typography>
      </Box>
    </Box>
  );
};

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

function deltaColor(value: number, theme: Theme): string {
  if (value > 0.005) return theme.palette.success.dark;
  if (value < -0.005) return theme.palette.error.dark;
  return theme.palette.text.primary;
}
