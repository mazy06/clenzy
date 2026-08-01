import React, { useState, useMemo } from 'react';
import { cn } from '../../utils/cn';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Paper, Skeleton } from '@mui/material';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import { Field, FieldLabel, NativeSelect, NativeSelectOption } from '../../components/ui';
import {
  AccountBalance,
  Gavel as StepTvaIcon,
  Assessment as StepReportIcon,
  DateRange as StepPeriodIcon,
} from '../../icons';
import HelpPopover from '../../components/HelpPopover';
import { usePageHeaderActions } from '../../components/PageHeaderActionsContext';
import EmptyState from '../../components/EmptyState';
import PeriodSegmented from './PeriodSegmented';
import { useTranslation } from '../../hooks/useTranslation';
import { useMonthlyVatSummary, useQuarterlyVatSummary, useAnnualVatSummary } from '../../hooks/useFiscalReporting';
import { formatTaxRate } from '../../utils/currencyUtils';
import { Money } from '../../components/Money';
import type { VatSummary } from '../../services/api/fiscalReportingApi';

// ─── Constants ──────────────────────────────────────────────────────────────

type PeriodMode = 'monthly' | 'quarterly' | 'annual';

// Tableaux : entetes overline / valeurs 12.5px portes par le primitif du kit.
// Seul l'ecart au gabarit reste ici : padding vertical 7.5px et tabular-nums.
const CELL_CLASS = 'py-[7.5px] tabular-nums';

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
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= currentYear - 4; y--) {
      years.push(y);
    }
    return years;
  }, []);

  const helpAction = usePageHeaderActions(
    <HelpPopover
      label={t('common.help', 'Aide')}
      title={t('accounting.fiscal.help.title', 'Comment fonctionne le rapport fiscal ?')}
      description={t('accounting.fiscal.help.description', 'Consultez la synthese TVA de vos factures par periode pour preparer vos declarations fiscales.')}
      steps={[
        { icon: <StepPeriodIcon size={14} strokeWidth={1.75} />, title: t('accounting.fiscal.help.step1Title', 'Periode'), description: t('accounting.fiscal.help.step1Desc', 'Choisissez la granularite (mensuel, trimestriel, annuel) et la periode souhaitee.'), accent: 'info' },
        { icon: <StepTvaIcon size={14} strokeWidth={1.75} />, title: t('accounting.fiscal.help.step2Title', 'Ventilation TVA'), description: t('accounting.fiscal.help.step2Desc', 'Le rapport ventile automatiquement la TVA par taux (20%, 10%, 5.5%) et categorie.'), accent: 'primary' },
        { icon: <StepReportIcon size={14} strokeWidth={1.75} />, title: t('accounting.fiscal.help.step3Title', 'Declaration'), description: t('accounting.fiscal.help.step3Desc', 'Utilisez les totaux HT/TVA/TTC pour completer votre declaration de TVA.'), accent: 'success' },
      ]}
    />,
  );

  return (
    <div>
      {helpAction}

      {/* Period selector */}
      <Paper sx={{ ...PANEL_SX, p: 2, mb: 2 }}>
        <div className="flex gap-3 flex-wrap items-center">
          <PeriodSegmented<PeriodMode>
            value={mode}
            onChange={setMode}
            options={PERIOD_MODE_OPTIONS}
            ariaLabel="Granularité de la période"
          />

          {/* Largeur bornee : le Field du kit est w-full, il occuperait toute la
              rangee au lieu de se ranger a cote du segmente de periode. */}
          <Field className="w-[110px]">
            <FieldLabel htmlFor="fiscal-report-year">Annee</FieldLabel>
            <NativeSelect
              id="fiscal-report-year"
              className="w-full"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {yearOptions.map(y => (
                <NativeSelectOption key={y} value={y}>{y}</NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          {mode === 'monthly' && (
            <Field className="w-[150px]">
              <FieldLabel htmlFor="fiscal-report-month">Mois</FieldLabel>
              <NativeSelect
                id="fiscal-report-month"
                className="w-full"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {MONTHS.map((m, i) => (
                  <NativeSelectOption key={m} value={i + 1}>{m}</NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}

          {mode === 'quarterly' && (
            <Field className="w-[140px]">
              <FieldLabel htmlFor="fiscal-report-quarter">Trimestre</FieldLabel>
              <NativeSelect
                id="fiscal-report-quarter"
                className="w-full"
                value={quarter}
                onChange={(e) => setQuarter(Number(e.target.value))}
              >
                <NativeSelectOption value={1}>T1 (Jan-Mar)</NativeSelectOption>
                <NativeSelectOption value={2}>T2 (Avr-Jun)</NativeSelectOption>
                <NativeSelectOption value={3}>T3 (Jul-Sep)</NativeSelectOption>
                <NativeSelectOption value={4}>T4 (Oct-Dec)</NativeSelectOption>
              </NativeSelect>
            </Field>
          )}
        </div>
      </Paper>

      {/* Loading / Error */}
      {activeQuery.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton variant="rounded" height={76} sx={{ borderRadius: 'var(--radius-lg)' }} />
          <Skeleton variant="rounded" height={200} sx={{ borderRadius: 'var(--radius-lg)' }} />
        </div>
      ) : activeQuery.error ? (
        <Alert variant="destructive" className="mb-3">
          <TriangleAlert />
          <AlertDescription>Erreur lors du chargement du rapport fiscal</AlertDescription>
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
          <div className="flex gap-3 mb-3 flex-wrap">
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
                <p className="cn-text-body1 block text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--faint)] mb-0.5">
                  {card.label}
                </p>
                <p className={cn('cn-text-body1 font-semibold tracking-[-0.025em] tabular-nums', card.isText ? 'text-[0.9rem]' : 'text-[1.1rem]', card.primary ? 'text-[var(--accent)]' : 'text-[var(--ink)]')} style={{ fontFamily: 'var(--font-display)' }}>
                  {card.value}
                </p>
              </Paper>
            ))}
          </div>

          {/* Breakdown table */}
          {summary.breakdown?.length > 0 && (
            <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-solid border-[var(--line)] bg-[var(--card)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categorie</TableHead>
                    <TableHead>Taxe</TableHead>
                    <TableHead className="text-end">Taux</TableHead>
                    <TableHead className="text-end">Base HT</TableHead>
                    <TableHead className="text-end">Montant TVA</TableHead>
                    <TableHead className="text-end">Lignes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.breakdown.map((row) => (
                    <TableRow key={`${row.taxCategory}-${row.taxName}-${row.taxRate}`}>
                      <TableCell className={CELL_CLASS}>{row.taxCategory}</TableCell>
                      <TableCell className={CELL_CLASS}>{row.taxName}</TableCell>
                      <TableCell className={cn(CELL_CLASS, 'text-end')}>{formatTaxRate(row.taxRate)}</TableCell>
                      <TableCell className={cn(CELL_CLASS, 'text-end')}><Money value={row.baseAmount} from={summary.currency} /></TableCell>
                      <TableCell className={cn(CELL_CLASS, 'text-end font-semibold')}><Money value={row.taxAmount} from={summary.currency} /></TableCell>
                      <TableCell className={cn(CELL_CLASS, 'text-end')}>{row.lineCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FiscalReportSection;
