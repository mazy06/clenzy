import React, { useState, useCallback } from 'react';
import StatusChip from '../../components/StatusChip';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { CircleCheck, X, TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Card } from '../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import { Skeleton, Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import { Field, FieldLabel, Input, NativeSelect, NativeSelectOption } from '../../components/ui';
import { Refresh, CurrencyExchange, TrendingUp } from '../../icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../components/PageHeader';
import StatTile from '../../components/baitly/StatTile';
import { exchangeRateApi, type ExchangeRateHistoryParams } from '../../services/api/exchangeRateApi';
import { useCurrency } from '../../hooks/useCurrency';
import PagePagination from '../../components/PagePagination';

// Palette catégorielle devises (accents Baitly — pattern catégoriel à arbitrer, cf. baseline §7)
const CURRENCY_COLORS: Record<string, string> = {
  EUR: '#4A9B8E',
  MAD: '#D4A574',
  SAR: '#7B68A8',
  USD: '#6B8A9A',
  GBP: '#C97A7A',
};

const currencyHex = (code: string): string => CURRENCY_COLORS[code] ?? '#8A8378';

// Equivalents Baitly UI de la palette ci-dessus, pour les icones de tuile (classe, pas hex).
const CURRENCY_ICON_CLASSES: Record<string, string> = {
  EUR: 'text-success',
  MAD: 'text-warning',
  SAR: 'text-primary',
  USD: 'text-primary',
  GBP: 'text-destructive',
};

const currencyIconClass = (code: string): string =>
  CURRENCY_ICON_CLASSES[code] ?? 'text-muted-foreground';

/**
 * Tokens des puces de statistique. Baitly UI expose trois jetons par famille et
 * ils ne sont pas interchangeables : `-ink` pour le TEXTE (la teinte vive
 * plafonne a ~2,2:1 en clair), `-soft` pour le fond pastel. Ils restent en
 * VALEUR CSS : StatusChip peint en style inline, une classe Tailwind ne pouvant
 * naitre d'une valeur resolue au rendu.
 */
const STAT_TOKENS = {
  min: { color: 'var(--bui-info-ink)', bg: 'var(--bui-info-soft)' },
  max: { color: 'var(--bui-warning-ink)', bg: 'var(--bui-warning-soft)' },
  avg: { color: 'var(--bui-primary)', bg: 'var(--bui-primary-soft)' },
  neutral: { color: 'var(--bui-muted-foreground)', bg: 'var(--bui-muted)' },
} as const;

// ─── Constants ──────────────────────────────────────────────────────────────

const CURRENCY_PAIRS = [
  { base: 'EUR', target: 'MAD', label: 'EUR → MAD' },
  { base: 'MAD', target: 'EUR', label: 'MAD → EUR' },
  { base: 'EUR', target: 'SAR', label: 'EUR → SAR' },
  { base: 'SAR', target: 'EUR', label: 'SAR → EUR' },
  { base: 'MAD', target: 'SAR', label: 'MAD → SAR' },
  { base: 'SAR', target: 'MAD', label: 'SAR → MAD' },
];

const DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });

function formatDate(iso: string): string {
  try {
    return DATE_FORMATTER.format(new Date(iso));
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

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handleRowsPerPageChange = useCallback((rows: number) => {
    setRowsPerPage(rows);
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
    <div>
      <PageHeader
        title="Historique des taux de change"
        subtitle="Taux de change BCE mis a jour quotidiennement"
        iconBadge={<CurrencyExchange />}
        showBackButton={false}
        actions={
          <BuiButton
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            {refreshMutation.isPending ? <Spinner className="size-4" /> : <Refresh />}
            Actualiser les taux
          </BuiButton>
        }
      />

      {/* Current rates summary */}
      {matrix && (
        // Le nombre de colonnes >=900px suit CURRENCY_PAIRS.length : il passe par
        // une variable CSS, une classe Tailwind ne pouvant naitre d'une valeur runtime.
        <div
          className="grid grid-cols-2 min-[600px]:grid-cols-3 min-[900px]:grid-cols-[repeat(var(--pair-cols),1fr)] gap-3 mb-[18px]"
          style={{ '--pair-cols': String(CURRENCY_PAIRS.length) } as React.CSSProperties}
        >
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
              <StatTile
                key={p.label}
                icon={<CurrencyExchange />}
                label={p.label}
                value={formatRate(rate)}
                iconClassName={currencyIconClass(p.base)}
                hint={`Au ${rateDate ?? matrix.date}`}
              />
            ) : null;
          })}
        </div>
      )}

      {/* Filters */}
      <Card className="gap-0 py-0 p-3 mb-4">
        <div className="flex gap-3 items-center flex-wrap">
          {/* Largeurs figees : ces champs vivent dans une rangee flex, le `w-full`
              du kit les ferait passer chacun sur sa propre ligne. */}
          <Field className="w-[190px]">
            <FieldLabel htmlFor="exchange-rate-pair">Paire de devises</FieldLabel>
            <NativeSelect
              id="exchange-rate-pair"
              className="w-full"
              value={selectedPair}
              onChange={(e) => {
                setSelectedPair(Number(e.target.value));
                setPage(0);
              }}
            >
              {CURRENCY_PAIRS.map((p, i) => (
                <NativeSelectOption key={p.label} value={i}>
                  {p.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          <Field className="w-[165px]">
            <FieldLabel htmlFor="exchange-rate-from">Du</FieldLabel>
            <Input
              id="exchange-rate-from"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(0);
              }}
            />
          </Field>

          <Field className="w-[165px]">
            <FieldLabel htmlFor="exchange-rate-to">Au</FieldLabel>
            <Input
              id="exchange-rate-to"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(0);
              }}
            />
          </Field>

          {stats && (
            <div className="flex gap-1.5 ms-auto">
              {/* Le trigger enveloppe un <span> : Radix pose sa ref d'ancrage sur
                  l'enfant, que StatusChip (composant fonction, React 18) ne transmet pas. */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <StatusChip tokens={STAT_TOKENS.min} label={`Min: ${formatRate(stats.min)}`} />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Minimum sur la periode</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <StatusChip tokens={STAT_TOKENS.max} label={`Max: ${formatRate(stats.max)}`} />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Maximum sur la periode</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <StatusChip tokens={STAT_TOKENS.avg} label={`Moy: ${formatRate(stats.avg)}`} icon={<TrendingUp size={14} strokeWidth={1.75} />} />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Moyenne sur la periode</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </Card>

      {refreshMutation.isSuccess && (
        <BuiAlert variant="success" className="mb-3">
          <CircleCheck />
          <AlertDescription>Taux de change mis a jour avec succes depuis la BCE.</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => refreshMutation.reset()}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}

      {error && (
        <BuiAlert variant="destructive" className="mb-3">
          <TriangleAlert />
          <AlertDescription>Erreur lors du chargement de l'historique des taux.</AlertDescription>
        </BuiAlert>
      )}

      {/* Table — `Card` porte le fond, l'arrondi, le filet et l'ecretage ; le
          defilement horizontal vit dans un conteneur interne. */}
      <Card className="gap-0 py-0">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex flex-col gap-1.5 p-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-md" />
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Base</TableHead>
                    <TableHead>Cible</TableHead>
                    <TableHead className="text-end">Taux</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6">
                        <p className="text-sm text-muted-foreground">
                          Aucun taux de change sur cette periode.
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((rate) => (
                    <TableRow key={rate.id}>
                      <TableCell>{formatDate(rate.rateDate)}</TableCell>
                      <TableCell>
                        <StatusChip color={currencyHex(rate.baseCurrency)} label={rate.baseCurrency} />
                      </TableCell>
                      <TableCell>
                        <StatusChip color={currencyHex(rate.targetCurrency)} label={rate.targetCurrency} />
                      </TableCell>
                      <TableCell className="text-end font-mono tabular-nums font-medium">
                        {formatRate(rate.rate)}
                      </TableCell>
                      <TableCell>
                        <StatusChip tokens={STAT_TOKENS.neutral} label={rate.source} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PagePagination
                count={rows.length}
                page={page}
                onPageChange={handlePageChange}
                rowsPerPage={rowsPerPage}
                rowsPerPageOptions={[10, 25, 50]}
                onRowsPerPageChange={handleRowsPerPageChange}
              />
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
