import React, { useState, useMemo } from 'react';
import {
  Box, Paper, Typography, MenuItem, TextField, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import { AccountBalance } from '@mui/icons-material';
import { useMonthlyVatSummary, useQuarterlyVatSummary, useAnnualVatSummary } from '../../hooks/useFiscalReporting';
import { formatCurrency, formatTaxRate } from '../../utils/currencyUtils';
import type { VatSummary } from '../../services/api/fiscalReportingApi';

// ─── Constants ──────────────────────────────────────────────────────────────

type PeriodMode = 'monthly' | 'quarterly' | 'annual';

const CELL_SX = { fontSize: '0.8125rem', py: 1.25 } as const;
const HEAD_CELL_SX = { fontSize: '0.75rem', fontWeight: 700, py: 1, color: 'text.secondary' } as const;

const MONTHS = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
];

// ─── Component ──────────────────────────────────────────────────────────────

const FiscalReportSection: React.FC = () => {
  const now = new Date();
  const [mode, setMode] = useState<PeriodMode>('monthly');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3));

  // Conditional queries based on mode
  const monthlyQuery = useMonthlyVatSummary(
    mode === 'monthly' ? year : 0,
    mode === 'monthly' ? month : 0,
  );
  const quarterlyQuery = useQuarterlyVatSummary(
    mode === 'quarterly' ? year : 0,
    mode === 'quarterly' ? quarter : 0,
  );
  const annualQuery = useAnnualVatSummary(mode === 'annual' ? year : 0);

  // Active query
  const activeQuery = mode === 'monthly' ? monthlyQuery : mode === 'quarterly' ? quarterlyQuery : annualQuery;
  const summary: VatSummary | undefined = activeQuery.data;

  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = now.getFullYear(); y >= now.getFullYear() - 4; y--) {
      years.push(y);
    }
    return years;
  }, []);

  return (
    <Box>
      {/* Period selector */}
      <Paper sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'divider', boxShadow: 'none', borderRadius: 1.5 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <ToggleButtonGroup
            value={mode}
            exclusive
            onChange={(_e, v) => v && setMode(v)}
            size="small"
            sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontSize: '0.8125rem', px: 2 } }}
          >
            <ToggleButton value="monthly">Mensuel</ToggleButton>
            <ToggleButton value="quarterly">Trimestriel</ToggleButton>
            <ToggleButton value="annual">Annuel</ToggleButton>
          </ToggleButtonGroup>

          <TextField
            select
            label="Annee"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            size="small"
            sx={{ minWidth: 100 }}
          >
            {yearOptions.map(y => (
              <MenuItem key={y} value={y}>{y}</MenuItem>
            ))}
          </TextField>

          {mode === 'monthly' && (
            <TextField
              select
              label="Mois"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              size="small"
              sx={{ minWidth: 140 }}
            >
              {MONTHS.map((m, i) => (
                <MenuItem key={i + 1} value={i + 1}>{m}</MenuItem>
              ))}
            </TextField>
          )}

          {mode === 'quarterly' && (
            <TextField
              select
              label="Trimestre"
              value={quarter}
              onChange={(e) => setQuarter(Number(e.target.value))}
              size="small"
              sx={{ minWidth: 120 }}
            >
              <MenuItem value={1}>T1 (Jan-Mar)</MenuItem>
              <MenuItem value={2}>T2 (Avr-Jun)</MenuItem>
              <MenuItem value={3}>T3 (Jul-Sep)</MenuItem>
              <MenuItem value={4}>T4 (Oct-Dec)</MenuItem>
            </TextField>
          )}
        </Box>
      </Paper>

      {/* Loading / Error */}
      {activeQuery.isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : activeQuery.error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          Erreur lors du chargement du rapport fiscal
        </Alert>
      ) : !summary ? (
        <Paper sx={{ p: 4, textAlign: 'center', border: '1px solid', borderColor: 'divider', boxShadow: 'none', borderRadius: 1.5 }}>
          <AccountBalance sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">
            Aucune donnee fiscale pour cette periode
          </Typography>
        </Paper>
      ) : (
        <>
          {/* Summary cards */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            {[
              { label: 'Periode', value: summary.period, isText: true },
              { label: 'Factures', value: String(summary.invoiceCount), isText: true },
              { label: 'Total HT', value: formatCurrency(summary.totalHt, summary.currency) },
              { label: 'Total TVA', value: formatCurrency(summary.totalTax, summary.currency) },
              { label: 'Total TTC', value: formatCurrency(summary.totalTtc, summary.currency), primary: true },
            ].map(card => (
              <Paper
                key={card.label}
                sx={{
                  p: 1.5, flex: 1, minWidth: 130,
                  border: '1px solid', borderColor: card.primary ? 'primary.main' : 'divider',
                  boxShadow: 'none', borderRadius: 1.5, textAlign: 'center',
                  bgcolor: card.primary ? 'primary.50' : undefined,
                }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  {card.label}
                </Typography>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, fontSize: card.isText ? '0.9rem' : '1.1rem', color: card.primary ? 'primary.main' : 'text.primary' }}
                >
                  {card.value}
                </Typography>
              </Paper>
            ))}
          </Box>

          {/* Breakdown table */}
          {summary.breakdown?.length > 0 && (
            <TableContainer component={Paper} sx={{ border: '1px solid', borderColor: 'divider', boxShadow: 'none', borderRadius: 1.5 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={HEAD_CELL_SX}>Categorie</TableCell>
                    <TableCell sx={HEAD_CELL_SX}>Taxe</TableCell>
                    <TableCell sx={HEAD_CELL_SX} align="right">Taux</TableCell>
                    <TableCell sx={HEAD_CELL_SX} align="right">Base HT</TableCell>
                    <TableCell sx={HEAD_CELL_SX} align="right">Montant TVA</TableCell>
                    <TableCell sx={HEAD_CELL_SX} align="right">Lignes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {summary.breakdown.map((row, i) => (
                    <TableRow key={i} hover>
                      <TableCell sx={CELL_SX}>{row.taxCategory}</TableCell>
                      <TableCell sx={CELL_SX}>{row.taxName}</TableCell>
                      <TableCell sx={CELL_SX} align="right">{formatTaxRate(row.taxRate)}</TableCell>
                      <TableCell sx={CELL_SX} align="right">{formatCurrency(row.baseAmount, summary.currency)}</TableCell>
                      <TableCell sx={{ ...CELL_SX, fontWeight: 600 }} align="right">{formatCurrency(row.taxAmount, summary.currency)}</TableCell>
                      <TableCell sx={CELL_SX} align="right">{row.lineCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}
    </Box>
  );
};

export default FiscalReportSection;
