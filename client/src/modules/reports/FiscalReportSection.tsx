import FinanceHeaderFilters from '../billing/components/FinanceHeaderFilters';
import React, { useState, useMemo } from 'react';
import { cn } from '../../utils/cn';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Skeleton, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
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
import { activeIntlLocaleGregorian } from '../../utils/activeLocale';
import { useMonthlyVatSummary, useQuarterlyVatSummary, useAnnualVatSummary } from '../../hooks/useFiscalReporting';
import { formatTaxRate } from '../../utils/currencyUtils';
import type { VatSummary } from '../../services/api/fiscalReportingApi';
import type { DashboardPeriod } from '../dashboard/DashboardDateFilter';
import { tiles, type TileOrNothing } from '../../components/stats';
import type { ReportContent } from './reportShell';
import FinanceKpis from '../billing/components/FinanceKpis';
import FinanceWorkspace from '../billing/components/FinanceWorkspace';

// ─── Constants ──────────────────────────────────────────────────────────────

type PeriodMode = 'monthly' | 'quarterly' | 'annual';

// Tableaux : entetes overline / valeurs 12.5px portes par le primitif du kit.
// Seul l'ecart au gabarit reste ici : padding vertical 7.5px et tabular-nums.
const CELL_CLASS = 'py-[7.5px] tabular-nums';

// Carte/panneau : filet discret, rayon lg (baseline §2 Cartes), aucune ombre.
const PANEL_CLASS = 'border border-solid border-border shadow-none rounded-lg bg-card';

// Seules les CLEFS vivent ici : un libellé figé à l'import resterait français.
const PERIOD_MODES: PeriodMode[] = ['monthly', 'quarterly', 'annual'];

const QUARTERS = [1, 2, 3, 4] as const;
const fiscalMoney = (value: number, currency: string) => new Intl.NumberFormat(activeIntlLocaleGregorian(), { style: 'currency', currency }).format(value);


// ─── Blocs reutilisables ────────────────────────────────────────────────────
//
// Sortis du composant pour que le tableau de bord puisse les importer sans
// recopier leur rendu : une correction ici vaut aux deux endroits.

/** Les cinq chiffres d'une periode : periode, factures, HT, TVA, TTC. */
export const VatSummaryCards: React.FC<{ summary: VatSummary; className?: string }> = ({
  summary,
  className,
}) => {
  const { t } = useTranslation();
  if (summary.issuers?.length) return <div className="space-y-4">{summary.issuers.map(issuer => <section key={issuer.issuerKey}>
    <h3 className="mb-2 text-sm font-medium">{issuer.sellerName || t('documentVerification.unknownIssuer')} · {issuer.summary.countryCode} · {issuer.summary.currency}</h3>
    <VatSummaryCards summary={issuer.summary} className={className} />
  </section>)}</div>;

  return (
  <div className={cn('flex gap-3 flex-wrap', className)}>
    {[
      { label: t('reports.fiscal.cards.period', 'Période'), value: summary.period, isText: true },
      { label: t('reports.fiscal.cards.invoices', 'Factures'), value: String(summary.invoiceCount), isText: true },
      { label: t('reports.fiscal.cards.totalHt', 'Total HT'), value: fiscalMoney(summary.totalHt, summary.currency) },
      { label: t('reports.fiscal.cards.totalTax', 'Total TVA'), value: fiscalMoney(summary.totalTax, summary.currency) },
      { label: t('reports.fiscal.cards.totalTtc', 'Total TTC'), value: fiscalMoney(summary.totalTtc, summary.currency), primary: true },
    ].map(card => (
      <div
        key={card.label}
        className={cn(
          PANEL_CLASS,
          'p-[9px] flex-1 min-w-[130px]',
          // KPI accentué (Total TTC) : fond pastel de marque + filet à 30 %
          card.primary && 'bg-primary-soft border-primary/30',
        )}
      >
        <p className="block text-2xs font-bold uppercase tracking-[0.05em] text-faint mb-0.5">
          {card.label}
        </p>
        <p className={cn('font-semibold tracking-[-0.025em] tabular-nums', card.isText ? 'text-[0.9rem]' : 'text-[1.1rem]', card.primary ? 'text-primary' : 'text-foreground')} style={{ fontFamily: 'var(--font-display)' }}>
          {card.value}
        </p>
      </div>
    ))}
  </div>
  );
};

/** Ventilation de la TVA par categorie et par taux. */
export const VatBreakdownTable: React.FC<{ summary: VatSummary }> = ({ summary }) => {
  const { t } = useTranslation();
  if (summary.issuers?.length) return <div className="space-y-4">{summary.issuers.map(issuer => <section key={issuer.issuerKey}>
    <h3 className="mb-2 text-sm font-medium">{issuer.sellerName || t('documentVerification.unknownIssuer')} · {issuer.summary.currency}</h3>
    <VatBreakdownTable summary={issuer.summary} />
  </section>)}</div>;

  return (
  <div className="overflow-x-auto rounded-lg border border-solid border-border bg-card">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('reports.fiscal.cols.category', 'Catégorie')}</TableHead>
          <TableHead>{t('reports.fiscal.cols.tax', 'Taxe')}</TableHead>
          <TableHead className="text-end">{t('reports.fiscal.cols.rate', 'Taux')}</TableHead>
          <TableHead className="text-end">{t('reports.fiscal.cols.base', 'Base HT')}</TableHead>
          <TableHead className="text-end">{t('reports.fiscal.cols.amount', 'Montant TVA')}</TableHead>
          <TableHead className="text-end">{t('reports.fiscal.cols.lines', 'Lignes')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {summary.breakdown.map((row) => (
          <TableRow key={`${row.taxCategory}-${row.taxName}-${row.taxRate}`}>
            <TableCell className={CELL_CLASS}>{row.taxCategory}</TableCell>
            <TableCell className={CELL_CLASS}>{row.taxName}</TableCell>
            <TableCell className={cn(CELL_CLASS, 'text-end')}>{formatTaxRate(row.taxRate)}</TableCell>
            <TableCell className={cn(CELL_CLASS, 'text-end')}>{fiscalMoney(row.baseAmount, summary.currency)}</TableCell>
            <TableCell className={cn(CELL_CLASS, 'text-end font-semibold')}>{fiscalMoney(row.taxAmount, summary.currency)}</TableCell>
            <TableCell className={cn(CELL_CLASS, 'text-end')}>{row.lineCount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
  );
};


// ─── Contenu importable ─────────────────────────────────────────────────────

/**
 * Granularite fiscale correspondant a la periode du tableau de bord.
 *
 * <p>La TVA ne se declare pas a la semaine : une periode hebdomadaire retombe
 * sur le MOIS en cours, la seule reponse honnete. Le reste s'aligne
 * naturellement.</p>
 */
export function fiscalModeFor(period: DashboardPeriod): PeriodMode {
  if (period === 'quarter') return 'quarterly';
  if (period === 'year') return 'annual';
  return 'monthly';
}

/**
 * Contenu de l'onglet Comptabilite, adressable depuis le tableau de bord.
 *
 * <p>Cet onglet choisit sa periode LUI-MEME (granularite + annee + mois), ce
 * qui n'a pas d'equivalent sur un tableau de bord. La tuile importee suit donc
 * la periode de l'ecran d'accueil, ramenee a la granularite fiscale la plus
 * proche, sur la periode EN COURS — et son intitule le dit, pour qu'on ne
 * croie pas lire une declaration passee.</p>
 */
export function useFiscalReport(period: DashboardPeriod = 'month'): ReportContent {
  const { t } = useTranslation();
  const mode = fiscalModeFor(period);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const quarter = Math.ceil(month / 3);

  const monthlyQuery = useMonthlyVatSummary(mode === 'monthly' ? year : 0, mode === 'monthly' ? month : 0);
  const quarterlyQuery = useQuarterlyVatSummary(mode === 'quarterly' ? year : 0, mode === 'quarterly' ? quarter : 0);
  const annualQuery = useAnnualVatSummary(mode === 'annual' ? year : 0);

  const activeQuery = mode === 'monthly' ? monthlyQuery : mode === 'quarterly' ? quarterlyQuery : annualQuery;
  const summary: VatSummary | undefined = activeQuery.data;

  const items = summary
    ? tiles([
      {
        key: 'vat-summary',
        fluid: true,
        title: t('reports.fiscal.summary', 'Synthèse TVA'),
        hint: summary.period,
        render: () => <VatSummaryCards summary={summary} />,
      },
      summary.breakdown?.length > 0 && {
        key: 'vat-breakdown',
        fluid: true,
        span: 2,
        title: t('reports.fiscal.breakdown', 'Ventilation de la TVA'),
        hint: `${summary.period} · ${t('reports.fiscal.invoiceCount', { count: summary.invoiceCount })}`,
        render: () => <VatBreakdownTable summary={summary} />,
      },
    ] as TileOrNothing[])
    : [];

  return {
    figures: [],
    items,
    loading: activeQuery.isLoading,
    error: activeQuery.error ? t('reports.fiscal.loadError') : null,
    retry: () => { void activeQuery.refetch(); },
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

const FiscalReportSection: React.FC = () => {
  const { t } = useTranslation();
  const [country, setCountry] = useState('');
  const [issuerKey, setIssuerKey] = useState('');
  const now = new Date();
  const [mode, setMode] = useState<PeriodMode>('monthly');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3));

  // Conditional queries based on mode
  const monthlyQuery = useMonthlyVatSummary(
    mode === 'monthly' ? year : 0,
    mode === 'monthly' ? month : 0, country || undefined,
  );
  const quarterlyQuery = useQuarterlyVatSummary(
    mode === 'quarterly' ? year : 0,
    mode === 'quarterly' ? quarter : 0, country || undefined,
  );
  const annualQuery = useAnnualVatSummary(mode === 'annual' ? year : 0, country || undefined);

  // Active query
  const activeQuery = mode === 'monthly' ? monthlyQuery : mode === 'quarterly' ? quarterlyQuery : annualQuery;
  const issuers = activeQuery.data?.issuers ?? [];
  const issuer = issuers.find(value => value.issuerKey === issuerKey) ?? issuers[0];
  const summary: VatSummary | undefined = issuer?.summary ?? activeQuery.data;

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
      <FinanceHeaderFilters>
        <div className="flex gap-3 flex-wrap items-center">
          <Field className="w-[170px]">
            <FieldLabel htmlFor="fiscal-report-country">{t('fiscal.profile.country')}</FieldLabel>
            <NativeSelect id="fiscal-report-country" value={country} onChange={e => setCountry(e.target.value)}>
              <NativeSelectOption value="">{t('fiscal.jurisdictions.primary')}</NativeSelectOption>
              {['FR', 'MA', 'SA'].map(code => <NativeSelectOption key={code} value={code}>{t('countries.' + code)}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          <PeriodSegmented<PeriodMode>
            value={mode}
            onChange={setMode}
            options={PERIOD_MODES.map((value) => ({
              value,
              label: t(`reports.fiscal.modes.${value}`),
            }))}
            ariaLabel={t('reports.fiscal.granularity', 'Granularité de la période')}
          />

          {/* Largeur bornee : le Field du kit est w-full, il occuperait toute la
              rangee au lieu de se ranger a cote du segmente de periode. */}
          <Field className="w-[110px]">
            <FieldLabel htmlFor="fiscal-report-year">{t('reports.fiscal.year', 'Année')}</FieldLabel>
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
              <FieldLabel htmlFor="fiscal-report-month">{t('reports.fiscal.month', 'Mois')}</FieldLabel>
              <NativeSelect
                id="fiscal-report-month"
                className="w-full"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <NativeSelectOption key={i} value={i + 1}>
                    {new Date(2024, i, 1).toLocaleDateString(activeIntlLocaleGregorian(), { month: 'long' })}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}

          {mode === 'quarterly' && (
            <Field className="w-[140px]">
              <FieldLabel htmlFor="fiscal-report-quarter">{t('reports.fiscal.quarter', 'Trimestre')}</FieldLabel>
              <NativeSelect
                id="fiscal-report-quarter"
                className="w-full"
                value={quarter}
                onChange={(e) => setQuarter(Number(e.target.value))}
              >
                {QUARTERS.map((q) => (
                  <NativeSelectOption key={q} value={q}>
                    {t(`reports.fiscal.quarters.${q}`)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )}
        </div>

      {!!issuers.length && <Field className="max-w-lg"><FieldLabel htmlFor="fiscal-issuer">{t('documentVerification.issuerScope')}</FieldLabel>
        <NativeSelect id="fiscal-issuer" value={issuer?.issuerKey ?? ''} onChange={event => setIssuerKey(event.target.value)}>
          {issuers.map(value => <NativeSelectOption key={value.issuerKey} value={value.issuerKey}>{value.sellerName || t('documentVerification.unknownIssuer')} · {value.summary.countryCode} · {value.summary.currency}</NativeSelectOption>)}
        </NativeSelect>
      </Field>}
      </FinanceHeaderFilters>
      {/* Loading / Error */}
      {activeQuery.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-[76px] w-full rounded-lg" />
          <Skeleton className="h-[200px] w-full rounded-lg" />
        </div>
      ) : activeQuery.error ? (
        <Alert variant="destructive" className="mb-3">
          <TriangleAlert />
          <AlertDescription>{t('reports.fiscal.loadError')}</AlertDescription>
        </Alert>
      ) : !summary ? (
        <EmptyState
          icon={<AccountBalance />}
          title={t('reports.fiscal.emptyTitle', 'Aucune donnée fiscale')}
          description={t('reports.fiscal.emptyBody')}
          variant="plain"
        />
      ) : (
        <>
          <FinanceKpis scope={summary.period} items={[
            { key: 'invoices', label: t('reports.fiscal.cards.invoices'), value: summary.invoiceCount, artwork: 'documents' },
            { key: 'ht', label: t('reports.fiscal.cards.totalHt'), value: new Intl.NumberFormat(activeIntlLocaleGregorian(), { style: 'currency', currency: summary.currency }).format(summary.totalHt), artwork: 'received' },
            { key: 'tax', label: t('reports.fiscal.cards.totalTax'), value: new Intl.NumberFormat(activeIntlLocaleGregorian(), { style: 'currency', currency: summary.currency }).format(summary.totalTax), artwork: 'pending' },
            { key: 'ttc', label: t('reports.fiscal.cards.totalTtc'), value: new Intl.NumberFormat(activeIntlLocaleGregorian(), { style: 'currency', currency: summary.currency }).format(summary.totalTtc), artwork: 'transfer' },
          ].map(item => ({ ...item, artwork: item.artwork as 'documents' | 'received' | 'pending' | 'transfer',
            description: t('accounting.fiscal.help.description'), advice: t('accounting.fiscal.help.step2Desc'),
          }))} />
          {summary.breakdown?.length > 0 && <FinanceWorkspace items={summary.breakdown.map(row => ({
            id: `${row.taxCategory}-${row.taxName}-${row.taxRate}`, title: row.taxName, subtitle: row.taxCategory,
            amount: new Intl.NumberFormat(activeIntlLocaleGregorian(), { style: 'currency', currency: summary.currency }).format(row.taxAmount),
            status: formatTaxRate(row.taxRate), fields: [
              { label: t('reports.fiscal.cols.category'), value: row.taxCategory },
              { label: t('reports.fiscal.cols.rate'), value: formatTaxRate(row.taxRate) },
              { label: t('reports.fiscal.cols.base'), value: new Intl.NumberFormat(activeIntlLocaleGregorian(), { style: 'currency', currency: summary.currency }).format(row.baseAmount) },
              { label: t('reports.fiscal.cols.amount'), value: new Intl.NumberFormat(activeIntlLocaleGregorian(), { style: 'currency', currency: summary.currency }).format(row.taxAmount) },
              { label: t('reports.fiscal.cols.lines'), value: row.lineCount },
            ],
          }))} />}
        </>
      )}
    </div>
  );
};

export default FiscalReportSection;
