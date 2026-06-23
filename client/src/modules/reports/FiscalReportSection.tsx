import React, { useState, useMemo } from 'react';
import {
  Box, Paper, Typography, MenuItem, TextField, Skeleton, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
  AccountBalance,
  Gavel as StepTvaIcon,
  Assessment as StepReportIcon,
  DateRange as StepPeriodIcon,
} from '../../icons';
import HelpBanner from '../../components/HelpBanner';
import EmptyState from '../../components/EmptyState';
import PeriodSegmented from './PeriodSegmented';
import { useTranslation } from '../../hooks/useTranslation';
import { useMonthlyVatSummary, useQuarterlyVatSummary, useAnnualVatSummary } from '../../hooks/useFiscalReporting';
import { formatTaxRate } from '../../utils/currencyUtils';
import { Money } from '../../components/Money';
import type { VatSummary } from '../../services/api/fiscalReportingApi';

// ─── Constants ──────────────────────────────────────────────────────────────

type PeriodMode = 'monthly' | 'quarterly' | 'annual';

// Tableaux : entêtes overline / valeurs 12.5px via le thème global Signature.
const CELL_SX = { fontSize: '12.5px', py: 1.25, fontVariantNumeric: 'tabular-nums' } as const;
const HEAD_CELL_SX = { py: 1 } as const;

// Carte/panneau : hairline --line, r14 (baseline §2 Cartes), aucune ombre.
const PANEL_SX = {
  border: '1px solid var(--line)',
  boxShadow: 'none',
  borderRadius: 'var(--radius-lg)',
  bgcolor: 'var(--card)',
} as const;

const PERIOD_MODE_OPTIONS: { value: PeriodMode; label: string }[] = [
  { value: 'monthly', label: 'Mensuel' },
  { value: 'quarterly', label: 'Trimestriel' },
  { value: 'annual', label: 'Annuel' },
];

const MONTHS = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
];

// ─── Component ──────────────────────────────────────────────────────────────

const FiscalReportSection: React.FC = () => {
  const { t } = useTranslation();
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
      <HelpBanner
        storageKey="clenzy_fiscal_help_dismissed"
        title={t('accounting.fiscal.help.title', 'Comment fonctionne le rapport fiscal ?')}
        description={t('accounting.fiscal.help.description', 'Consultez la synthese TVA de vos factures par periode pour preparer vos declarations fiscales.')}
        dismissLabel={t('accounting.fiscal.help.dismiss', 'Ne plus afficher')}
        steps={[
          { icon: <StepPeriodIcon size={14} strokeWidth={1.75} />, title: t('accounting.fiscal.help.step1Title', 'Periode'), description: t('accounting.fiscal.help.step1Desc', 'Choisissez la granularite (mensuel, trimestriel, annuel) et la periode souhaitee.'), accent: 'info' },
          { icon: <StepTvaIcon size={14} strokeWidth={1.75} />, title: t('accounting.fiscal.help.step2Title', 'Ventilation TVA'), description: t('accounting.fiscal.help.step2Desc', 'Le rapport ventile automatiquement la TVA par taux (20%, 10%, 5.5%) et categorie.'), accent: 'primary' },
          { icon: <StepReportIcon size={14} strokeWidth={1.75} />, title: t('accounting.fiscal.help.step3Title', 'Declaration'), description: t('accounting.fiscal.help.step3Desc', 'Utilisez les totaux HT/TVA/TTC pour completer votre declaration de TVA.'), accent: 'success' },
        ]}
      />

      {/* Period selector */}
      <Paper sx={{ ...PANEL_SX, p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <PeriodSegmented<PeriodMode>
            value={mode}
            onChange={setMode}
            options={PERIOD_MODE_OPTIONS}
            ariaLabel="Granularité de la période"
          />

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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Skeleton variant="rounded" height={76} sx={{ borderRadius: 'var(--radius-lg)' }} />
          <Skeleton variant="rounded" height={200} sx={{ borderRadius: 'var(--radius-lg)' }} />
        </Box>
      ) : activeQuery.error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          Erreur lors du chargement du rapport fiscal
        </Alert>
      ) : !summary ? (
        <EmptyState
          icon={<AccountBalance />}
          title="Aucune donnée fiscale"
          description="Aucune facture sur cette période — ajustez la granularité ou la période sélectionnée."
          variant="plain"
        />
      ) : (
        <>
          {/* Summary cards */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            {[
              { label: 'Periode', value: summary.period, isText: true },
              { label: 'Factures', value: String(summary.invoiceCount), isText: true },
              { label: 'Total HT', value: <Money value={summary.totalHt} from={summary.currency} /> },
              { label: 'Total TVA', value: <Money value={summary.totalTax} from={summary.currency} /> },
              { label: 'Total TTC', value: <Money value={summary.totalTtc} from={summary.currency} />, primary: true },
            ].map(card => (
              <Paper
                key={card.label}
                sx={{
                  ...PANEL_SX,
                  p: 1.5, flex: 1, minWidth: 130,
                  // KPI accentué (Total TTC) : fond accent-soft + hairline accent 30 %
                  ...(card.primary && {
                    bgcolor: 'var(--accent-soft)',
                    borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)',
                  }),
                }}
              >
                <Typography sx={{ display: 'block', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--faint)', mb: 0.25 }}>
                  {card.label}
                </Typography>
                <Typography
                  sx={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    letterSpacing: '-0.025em',
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: card.isText ? '0.9rem' : '1.1rem',
                    color: card.primary ? 'var(--accent)' : 'var(--ink)',
                  }}
                >
                  {card.value}
                </Typography>
              </Paper>
            ))}
          </Box>

          {/* Breakdown table */}
          {summary.breakdown?.length > 0 && (
            <TableContainer component={Paper} sx={PANEL_SX}>
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
                      <TableCell sx={CELL_SX} align="right"><Money value={row.baseAmount} from={summary.currency} /></TableCell>
                      <TableCell sx={{ ...CELL_SX, fontWeight: 600 }} align="right"><Money value={row.taxAmount} from={summary.currency} /></TableCell>
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
