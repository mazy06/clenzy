import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart as BarChartIcon, Delete as DeleteIcon } from '../../icons';
import EmptyState from '../../components/EmptyState';
import { useTranslation } from '../../hooks/useTranslation';
import {
  reportViewsApi,
  type ReportDimension,
  type ReportGranularity,
  type ReportMetric,
  type ReportResult,
} from '../../services/api/reportViewsApi';

const DIMENSIONS: ReportDimension[] = ['PROPERTY', 'CHANNEL', 'PERIOD', 'COUNTRY'];
const METRICS: ReportMetric[] = ['REVENUE', 'ADR', 'REVPAR', 'OCCUPANCY', 'FEES', 'MARGIN'];
const GRANULARITIES: ReportGranularity[] = ['DAY', 'WEEK', 'MONTH', 'YEAR'];
const NUM_SX = { fontVariantNumeric: 'tabular-nums' } as const;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Onglet « Rapport personnalisé » (Report Builder, fondations RMS R1) : composition
 * dimensions x métriques x granularité validée par la whitelist backend, exécution
 * via `/api/reports/views/execute`, vues sauvegardées réutilisables.
 */
const CustomReport: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [dimensions, setDimensions] = useState<ReportDimension[]>(['PERIOD', 'CHANNEL']);
  const [metrics, setMetrics] = useState<ReportMetric[]>(['REVENUE', 'OCCUPANCY']);
  const [granularity, setGranularity] = useState<ReportGranularity>('MONTH');
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 5);
    d.setDate(1);
    return isoDate(d);
  });
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [viewName, setViewName] = useState('');

  const viewsQuery = useQuery({ queryKey: ['report-views'], queryFn: reportViewsApi.list });

  const runMutation = useMutation({
    mutationFn: () => reportViewsApi.execute({ dimensions, metrics, granularity, from, to }),
  });

  const saveMutation = useMutation({
    mutationFn: () => reportViewsApi.create({ name: viewName.trim(), dimensions, metrics, granularity }),
    onSuccess: () => {
      setViewName('');
      queryClient.invalidateQueries({ queryKey: ['report-views'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => reportViewsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['report-views'] }),
  });

  const toggle = <T,>(list: T[], value: T, setter: (next: T[]) => void) => {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const loadView = (id: number) => {
    const view = viewsQuery.data?.find((v) => v.id === id);
    if (!view) return;
    setDimensions(view.dimensions as ReportDimension[]);
    setMetrics(view.metrics as ReportMetric[]);
    setGranularity((view.granularity as ReportGranularity) || 'MONTH');
  };

  const result: ReportResult | undefined = runMutation.data;
  const canRun = dimensions.length > 0 && metrics.length > 0 && from <= to;

  const dimensionLabel = (code: string) => t(`reports.custom.dimensions.${code}`, code);
  const metricLabel = (code: string) => t(`reports.custom.metrics.${code}`, code);

  const formatValue = useMemo(
    () => (metric: string, value: number | undefined) => {
      if (value == null) return '—';
      if (metric === 'OCCUPANCY') return `${value} %`;
      return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    [],
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* ── Définition ── */}
      <Card variant="outlined" sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Box>
          <Typography variant="caption" sx={{ color: 'var(--muted)' }}>
            {t('reports.custom.dimensionsLabel', 'Dimensions')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 0.5 }}>
            {DIMENSIONS.map((d) => (
              <Chip
                key={d}
                label={dimensionLabel(d)}
                size="small"
                color={dimensions.includes(d) ? 'primary' : 'default'}
                variant={dimensions.includes(d) ? 'filled' : 'outlined'}
                onClick={() => toggle(dimensions, d, setDimensions)}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>
        </Box>
        <Box>
          <Typography variant="caption" sx={{ color: 'var(--muted)' }}>
            {t('reports.custom.metricsLabel', 'Métriques')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 0.5 }}>
            {METRICS.map((m) => (
              <Chip
                key={m}
                label={metricLabel(m)}
                size="small"
                color={metrics.includes(m) ? 'primary' : 'default'}
                variant={metrics.includes(m) ? 'filled' : 'outlined'}
                onClick={() => toggle(metrics, m, setMetrics)}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Select size="small" value={granularity} onChange={(e) => setGranularity(e.target.value as ReportGranularity)}>
            {GRANULARITIES.map((g) => (
              <MenuItem key={g} value={g}>{t(`reports.custom.granularities.${g}`, g)}</MenuItem>
            ))}
          </Select>
          <TextField
            size="small"
            type="date"
            label={t('reports.custom.from', 'Du')}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            size="small"
            type="date"
            label={t('reports.custom.to', 'Au')}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <Button
            variant="contained"
            size="small"
            disabled={!canRun || runMutation.isPending}
            onClick={() => runMutation.mutate()}
          >
            {runMutation.isPending
              ? t('reports.custom.running', 'Calcul…')
              : t('reports.custom.run', 'Exécuter')}
          </Button>
          <Box sx={{ flex: 1 }} />
          <TextField
            size="small"
            placeholder={t('reports.custom.viewNamePlaceholder', 'Nom de la vue')}
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
          />
          <Button
            variant="outlined"
            size="small"
            disabled={!canRun || viewName.trim().length === 0 || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {t('reports.custom.save', 'Sauvegarder')}
          </Button>
        </Box>
        {(viewsQuery.data?.length ?? 0) > 0 && (
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: 'var(--muted)' }}>
              {t('reports.custom.savedViews', 'Vues sauvegardées :')}
            </Typography>
            {viewsQuery.data?.map((v) => (
              <Chip
                key={v.id}
                label={v.name}
                size="small"
                variant="outlined"
                onClick={() => loadView(v.id)}
                onDelete={() => deleteMutation.mutate(v.id)}
                deleteIcon={<DeleteIcon size={14} />}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>
        )}
      </Card>

      {/* ── Résultat ── */}
      {runMutation.isError && (
        <Alert severity="error">
          {t('reports.custom.runError', "L'exécution du rapport a échoué.")}
        </Alert>
      )}
      {runMutation.isPending && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      )}
      {result && !runMutation.isPending && (
        <Card variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="caption" sx={{ color: 'var(--muted)' }}>
            {t('reports.custom.resultCurrency', 'Montants en')} {result.currency}
          </Typography>
          {result.rows.length === 0 ? (
            <EmptyState
              icon={<BarChartIcon />}
              title={t('reports.custom.noData', 'Aucune donnée sur cette période')}
              variant="plain"
            />
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {result.dimensions.map((d) => (
                      <TableCell key={d}>{dimensionLabel(d)}</TableCell>
                    ))}
                    {result.metrics.map((m) => (
                      <TableCell key={m} align="right">{metricLabel(m)}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.rows.map((row) => (
                    <TableRow key={row.dimensionValues.join('|')} hover>
                      {row.dimensionValues.map((value, i) => (
                        <TableCell key={`${i}-${value}`}>{value}</TableCell>
                      ))}
                      {result.metrics.map((m) => (
                        <TableCell key={m} align="right" sx={NUM_SX}>
                          {formatValue(m, row.metrics[m])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </Card>
      )}
      {!result && !runMutation.isPending && !runMutation.isError && (
        <EmptyState
          icon={<BarChartIcon />}
          title={t('reports.custom.emptyTitle', 'Composez votre rapport')}
          description={t(
            'reports.custom.emptyDescription',
            'Choisissez des dimensions, des métriques et une période, puis exécutez.',
          )}
        />
      )}
    </Box>
  );
};

export default CustomReport;
