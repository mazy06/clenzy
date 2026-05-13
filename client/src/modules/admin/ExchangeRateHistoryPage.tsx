import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Button,
  Typography,
  CircularProgress,
  TextField,
  MenuItem,
  Chip,
  Tooltip,
  Alert,
} from '@mui/material';
import { Refresh, CurrencyExchange, TrendingUp } from '../../icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../components/PageHeader';
import { exchangeRateApi, type ExchangeRateHistoryParams } from '../../services/api/exchangeRateApi';
import { useCurrency } from '../../hooks/useCurrency';

// ─── Constants ──────────────────────────────────────────────────────────────

const CURRENCY_PAIRS = [
  { base: 'EUR', target: 'MAD', label: 'EUR → MAD' },
  { base: 'MAD', target: 'EUR', label: 'MAD → EUR' },
  { base: 'EUR', target: 'SAR', label: 'EUR → SAR' },
  { base: 'SAR', target: 'EUR', label: 'SAR → EUR' },
  { base: 'MAD', target: 'SAR', label: 'MAD → SAR' },
  { base: 'SAR', target: 'MAD', label: 'SAR → MAD' },
];

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatRate(rate: number): string {
  return rate.toFixed(6);
}

function defaultFrom(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return d.toISOString().slice(0, 10);
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ExchangeRateHistoryPage() {
  const queryClient = useQueryClient();
  const { rateDate } = useCurrency();

  // Filters
  const [selectedPair, setSelectedPair] = useState(0);
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const pair = CURRENCY_PAIRS[selectedPair];

  const params: ExchangeRateHistoryParams = {
    baseCurrency: pair.base,
    targetCurrency: pair.target,
    from: dateFrom,
    to: dateTo,
    page,
    size: rowsPerPage,
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['exchange-rate-history', params],
    queryFn: () => exchangeRateApi.getHistory(params),
    staleTime: 5 * 60 * 1000,
  });

  const { data: matrix } = useQuery({
    queryKey: ['exchange-rate-matrix'],
    queryFn: () => exchangeRateApi.getMatrix(),
    staleTime: 30 * 60 * 1000,
  });

  const refreshMutation = useMutation({
    mutationFn: () => exchangeRateApi.refresh(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-rate-history'] });
      queryClient.invalidateQueries({ queryKey: ['exchange-rate-matrix'] });
    },
  });

  const handlePageChange = useCallback((_: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handleRowsPerPageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  }, []);

  // data is now a flat array
  const rows = data ?? [];

  // Compute min/max/avg for the visible data
  const stats = rows.length
    ? {
        min: Math.min(...rows.map((r) => r.rate)),
        max: Math.max(...rows.map((r) => r.rate)),
        avg: rows.reduce((s, r) => s + r.rate, 0) / rows.length,
      }
    : null;

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Historique des taux de change"
        subtitle="Taux de change BCE mis a jour quotidiennement"
        iconBadge={<CurrencyExchange />}
        showBackButton={false}
        actions={
          <Button
            variant="contained"
            startIcon={refreshMutation.isPending ? <CircularProgress size={16} /> : <Refresh />}
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            Actualiser les taux
          </Button>
        }
      />

      {/* Current rates summary */}
      {matrix && (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            sm: 'repeat(3, 1fr)',
            md: `repeat(${CURRENCY_PAIRS.length}, 1fr)`,
          },
          gap: 2,
          mb: 3,
        }}>
          {CURRENCY_PAIRS.map((p) => {
            let rate: number | null = null;
            if (p.base === 'EUR' && matrix.rates[p.target]) {
              rate = matrix.rates[p.target];
            } else if (p.target === 'EUR' && matrix.rates[p.base]) {
              rate = 1 / matrix.rates[p.base];
            } else if (matrix.rates[p.base] && matrix.rates[p.target]) {
              rate = matrix.rates[p.target] / matrix.rates[p.base];
            }
            return rate ? (
              <Paper key={p.label} sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}><CurrencyExchange size={18} strokeWidth={1.75} /></Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    {p.label}
                  </Typography>
                </Box>
                <Typography variant="h5" fontWeight={700}>
                  {formatRate(rate)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Au {rateDate ?? matrix.date}
                </Typography>
              </Paper>
            ) : null;
          })}
        </Box>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            select
            label="Paire de devises"
            value={selectedPair}
            onChange={(e) => {
              setSelectedPair(Number(e.target.value));
              setPage(0);
            }}
            size="small"
            sx={{ minWidth: 180 }}
          >
            {CURRENCY_PAIRS.map((p, i) => (
              <MenuItem key={i} value={i}>
                {p.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Du"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(0);
            }}
            size="small"
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label="Au"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(0);
            }}
            size="small"
            InputLabelProps={{ shrink: true }}
          />

          {stats && (
            <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
              <Tooltip title="Minimum sur la periode">
                <Chip label={`Min: ${formatRate(stats.min)}`} size="small" variant="outlined" />
              </Tooltip>
              <Tooltip title="Maximum sur la periode">
                <Chip label={`Max: ${formatRate(stats.max)}`} size="small" variant="outlined" />
              </Tooltip>
              <Tooltip title="Moyenne sur la periode">
                <Chip
                  icon={<TrendingUp size={14} strokeWidth={1.75} />}
                  label={`Moy: ${formatRate(stats.avg)}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              </Tooltip>
            </Box>
          )}
        </Box>
      </Paper>

      {refreshMutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => refreshMutation.reset()}>
          Taux de change mis a jour avec succes depuis la BCE.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Erreur lors du chargement de l'historique des taux.
        </Alert>
      )}

      {/* Table */}
      <TableContainer component={Paper}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Base</TableCell>
                  <TableCell>Cible</TableCell>
                  <TableCell align="right">Taux</TableCell>
                  <TableCell>Source</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        Aucun taux de change sur cette periode.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((rate) => (
                  <TableRow key={rate.id} hover>
                    <TableCell>{formatDate(rate.rateDate)}</TableCell>
                    <TableCell>
                      <Chip label={rate.baseCurrency} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip label={rate.targetCurrency} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                      {formatRate(rate.rate)}
                    </TableCell>
                    <TableCell>
                      <Chip label={rate.source} size="small" color="default" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={rows.length}
              page={page}
              onPageChange={handlePageChange}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleRowsPerPageChange}
              rowsPerPageOptions={[10, 25, 50]}
              labelRowsPerPage="Lignes par page"
            />
          </>
        )}
      </TableContainer>
    </Box>
  );
}
