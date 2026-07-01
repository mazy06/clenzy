/* ============================================================
   AiUsageTrendSection — vue « Consommation » (Settings > IA)

   Série temporelle de conso IA (GET /ai/usage/daily) : courbe empilée par
   provider, filtre provider (dont OpenAI), période, bascule tokens/coût,
   seuil d'alerte de coût, et détail par (provider, modèle).
   ============================================================ */

import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { aiApi, type AiDailyUsage } from '../../services/api/aiApi';
import { useTranslation } from '../../hooks/useTranslation';

const PROVIDER_COLORS: Record<string, string> = {
  openai: '#10a37f',
  anthropic: '#c98a5b',
  nvidia: '#76a935',
  other: '#8a94a6',
};
const colorOf = (p: string) => PROVIDER_COLORS[p] ?? PROVIDER_COLORS.other;
const fmtTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));
const fmtCost = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;
const dayLabel = (iso: string) => (iso.length >= 10 ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : iso);

type ProviderFilter = 'all' | 'openai' | 'anthropic' | 'nvidia';

export default function AiUsageTrendSection() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [days, setDays] = useState(30);
  const [provider, setProvider] = useState<ProviderFilter>('all');
  const [metric, setMetric] = useState<'tokens' | 'cost'>('tokens');
  const [threshold, setThreshold] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['ai-usage-daily', days],
    queryFn: () => aiApi.getDailyUsage(days),
    staleTime: 60_000,
  });

  const rows: AiDailyUsage[] = useMemo(
    () => (data ?? []).filter((r) => provider === 'all' || r.provider === provider),
    [data, provider],
  );

  const providers = useMemo(() => Array.from(new Set(rows.map((r) => r.provider))).sort(), [rows]);

  // Une entrée par jour, empilée par provider (valeur = métrique sélectionnée).
  const chartData = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>();
    for (const r of rows) {
      const e = byDate.get(r.date) ?? { date: r.date };
      const v = metric === 'tokens' ? r.tokensIn + r.tokensOut : r.costUsd;
      e[r.provider] = ((e[r.provider] as number) ?? 0) + v;
      byDate.set(r.date, e);
    }
    return Array.from(byDate.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [rows, metric]);

  const totalTokens = rows.reduce((s, r) => s + r.tokensIn + r.tokensOut, 0);
  const totalCost = rows.reduce((s, r) => s + r.costUsd, 0);

  const thresholdNum = parseFloat(threshold);
  const over = !Number.isNaN(thresholdNum) && thresholdNum > 0 && totalCost > thresholdNum;

  // Détail par (provider, modèle), trié par coût décroissant.
  const byModel = useMemo(() => {
    const map = new Map<string, { provider: string; model: string; tokens: number; cost: number; calls: number }>();
    for (const r of rows) {
      const key = `${r.provider}|${r.model}`;
      const e = map.get(key) ?? { provider: r.provider, model: r.model, tokens: 0, cost: 0, calls: 0 };
      e.tokens += r.tokensIn + r.tokensOut;
      e.cost += r.costUsd;
      e.calls += r.calls;
      map.set(key, e);
    }
    return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
  }, [rows]);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  const empty = rows.length === 0;

  return (
    <Box>
      {/* ── Contrôles ── */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Select size="small" value={days} onChange={(e) => setDays(Number(e.target.value))} sx={{ minWidth: 120 }}>
          <MenuItem value={7}>{t('settings.ai.usage.days7', '7 jours')}</MenuItem>
          <MenuItem value={30}>{t('settings.ai.usage.days30', '30 jours')}</MenuItem>
          <MenuItem value={90}>{t('settings.ai.usage.days90', '90 jours')}</MenuItem>
        </Select>

        <ToggleButtonGroup
          size="small"
          exclusive
          value={provider}
          onChange={(_, v) => v && setProvider(v)}
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none', px: 1.5 } }}
        >
          <ToggleButton value="all">{t('settings.ai.usage.all', 'Tous')}</ToggleButton>
          <ToggleButton value="openai">OpenAI</ToggleButton>
          <ToggleButton value="anthropic">Claude</ToggleButton>
          <ToggleButton value="nvidia">NVIDIA</ToggleButton>
        </ToggleButtonGroup>

        <ToggleButtonGroup
          size="small"
          exclusive
          value={metric}
          onChange={(_, v) => v && setMetric(v)}
          sx={{ ml: 'auto', '& .MuiToggleButton-root': { textTransform: 'none', px: 1.5 } }}
        >
          <ToggleButton value="tokens">{t('settings.ai.usage.tokens', 'Tokens')}</ToggleButton>
          <ToggleButton value="cost">{t('settings.ai.usage.cost', 'Coût')}</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* ── Totaux + seuil ── */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 3, mb: 2 }}>
        <Box>
          <Typography variant="caption" color="text.secondary">{t('settings.ai.usage.totalTokens', 'Total tokens')}</Typography>
          <Typography variant="h6" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>{fmtTokens(totalTokens)}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">{t('settings.ai.usage.totalCost', 'Coût total')}</Typography>
          <Typography variant="h6" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>{fmtCost(totalCost)}</Typography>
        </Box>
        <TextField
          size="small"
          type="number"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          label={t('settings.ai.usage.threshold', 'Seuil d’alerte ($)')}
          placeholder="ex : 20"
          sx={{ ml: 'auto', width: 170 }}
          InputProps={{ startAdornment: <Box component="span" sx={{ mr: 0.5, color: 'text.secondary' }}>$</Box> }}
        />
      </Box>

      {over && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('settings.ai.usage.overThreshold', {
            defaultValue: 'Seuil dépassé : {{cost}} sur la période (seuil {{limit}}).',
            cost: fmtCost(totalCost),
            limit: fmtCost(thresholdNum),
          })}
        </Alert>
      )}

      {/* ── Courbe ── */}
      {empty ? (
        <Alert severity="info">{t('settings.ai.usage.empty', 'Aucune consommation sur la période.')}</Alert>
      ) : (
        <Box sx={{ height: 300, mb: 3 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
              <XAxis dataKey="date" tickFormatter={dayLabel} tick={{ fontSize: 11, fill: theme.palette.text.secondary }} interval="preserveStartEnd" />
              <YAxis tickFormatter={(v) => (metric === 'tokens' ? fmtTokens(v) : fmtCost(v))} tick={{ fontSize: 11, fill: theme.palette.text.secondary }} width={54} />
              <Tooltip
                labelFormatter={(l) => dayLabel(String(l))}
                formatter={(value, name) => {
                  const v = Number(value) || 0;
                  return [metric === 'tokens' ? `${fmtTokens(v)} tok` : fmtCost(v), String(name)];
                }}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${theme.palette.divider}` }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {providers.map((p) => (
                <Bar key={p} dataKey={p} name={p} stackId="s" fill={colorOf(p)} radius={[2, 2, 0, 0]} maxBarSize={28} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}

      {/* ── Détail par (provider, modèle) ── */}
      {!empty && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('settings.ai.usage.model', 'Modèle')}</TableCell>
              <TableCell align="right">{t('settings.ai.usage.tokens', 'Tokens')}</TableCell>
              <TableCell align="right">{t('settings.ai.usage.calls', 'Appels')}</TableCell>
              <TableCell align="right">{t('settings.ai.usage.cost', 'Coût')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {byModel.map((m) => (
              <TableRow key={`${m.provider}|${m.model}`}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: colorOf(m.provider), flexShrink: 0 }} />
                    <Typography variant="body2" fontWeight={600}>{m.model || m.provider}</Typography>
                    <Typography variant="caption" color="text.secondary">{m.provider}</Typography>
                  </Box>
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{fmtTokens(m.tokens)}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{m.calls}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{fmtCost(m.cost)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}
