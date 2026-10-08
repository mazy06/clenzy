import { financeEventArtwork } from '../../billing/components/financeEventArtwork';
import FinanceWorkspace from '../../billing/components/FinanceWorkspace';
import { FinanceAmountKpis } from '../../billing/components/FinanceKpis';
/* ============================================================
   <HousekeeperPayoutsTab> — vue admin des versements PRESTATAIRES, tous métiers

   Versements Stripe directs aux prestataires (ménage), déclenchés à la
   validation de mission (Moteur Ménage 3B). À NE PAS confondre avec :
     - « Reversements » (payouts PROPRIÉTAIRES via PSP, OwnerPayout),
     - « Dépenses prestataires » (saisie manuelle de dépenses, ProviderExpense).
   Endpoints : GET /housekeeper-payouts/org · POST /{id}/retry (staff plateforme).
   ============================================================ */

import React, { useCallback, useMemo, useState } from 'react';
import { getErrorMessage } from '../../../utils/getErrorMessage';
import { cn } from '../../../utils/cn';
import StatusChip, { STATUS_TONES, type StatusTone } from '../../../components/StatusChip';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../../components/ui';
import { X, TriangleAlert } from '../../../icons/glyphs';
import PayoutActionResult from './PayoutActionResult';
import { Spinner } from '../../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui';
import { Link as RouterLink } from 'react-router-dom';
import { Build as RetryIcon, AccountBalance as PayoutIcon } from '../../../icons';
import FilterChipRow from '../../../components/baitly/FilterChipRow';
import HelpPopover from '../../../components/HelpPopover';
import { usePageHeaderActions } from '../../../components/PageHeaderActionsContext';
import { FinanceBatchPanel, type FinanceBatchResult } from '../../payments/FinanceBatchPanel';
import EmptyState from '../../../components/EmptyState';
import { useTranslation } from '../../../hooks/useTranslation';
import { useCurrency } from '../../../hooks/useCurrency';
import { useHighlightParam, useHighlightTarget } from '../../../hooks/useHighlight';
import { usersApi } from '../../../services/api/usersApi';
import {
  housekeeperPayoutsApi,
  type HousekeeperPayoutRecord,
  type HousekeeperPayoutStatus,
  type PayoutRetryQuote,
} from '../../../services/api/housekeeperPayoutsApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PagePagination from '../../../components/PagePagination';
import { activeIntlLocale } from '../../../utils/activeLocale';

// Cartes/tableaux : hairline Baitly UI, r14, pas d'ombre (baseline §2, aligné AccountingPage).
const CARD_CLASS = 'border border-solid border-border rounded-xl bg-card';

// Statuts : SENT vert doux, PENDING neutre, FAILED/BLOCKED ambre (jamais rouge criard).
// Un SEUL mapping domaine → ton sémantique : la puce le consomme tel quel, la
// rangée de filtres en dérive sa teinte via STATUS_TONES.
const STATUS_TONE: Record<HousekeeperPayoutStatus, StatusTone> = {
  SENT: 'ok',
  PENDING: 'neutral',
  FAILED: 'warn',
  BLOCKED: 'warn',
};
const STATUS_VALUES: HousekeeperPayoutStatus[] = ['PENDING', 'SENT', 'FAILED', 'BLOCKED'];

// Le backend re-gate à la relance (photo/onboarding/montant) : FAILED ET BLOCKED
// sont relançables — si la condition n'est toujours pas réunie, l'API renvoie une
// erreur claire (toast) plutôt que de créer un transfert.
const RETRYABLE: HousekeeperPayoutStatus[] = ['FAILED', 'BLOCKED'];

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString(activeIntlLocale()) : '—');

export const HousekeeperPayoutsTab: React.FC = () => {
  const { t } = useTranslation();
  const fmtCurrency = (n: number) => new Intl.NumberFormat(activeIntlLocale(), { style: 'currency', currency: 'EUR' }).format(n);
  const queryClient = useQueryClient();

  const [filterStatus, setFilterStatus] = useState<HousekeeperPayoutStatus | ''>('');
  const [page, setPage] = useState(0);
  const [retryTarget, setRetryTarget] = useState<HousekeeperPayoutRecord | null>(null);

  const ROWS_PER_PAGE = 20;

  const { data: records = [], isLoading, isError } = useQuery({
    queryKey: ['housekeeper-payouts-org'],
    queryFn: () => housekeeperPayoutsApi.listOrg(),
    staleTime: 30_000,
  });

  const candidates = records.filter(r => RETRYABLE.includes(r.status) && !r.stripeTransferId
    && r.failureReason !== 'RECONCILIATION_REQUIRED');
  const { data: quotes = [], isFetching: quotesLoading } = useQuery({
    queryKey: ['provider-payout-retry-quotes', candidates.map(r => `${r.id}:${r.updatedAt}:${r.amount}`)],
    queryFn: () => Promise.all(candidates.map(async r => {
      try { return { id: r.id, quote: await housekeeperPayoutsApi.previewRetry(r.id), error: null }; }
      catch (cause) { return { id: r.id, quote: null, error: getErrorMessage(cause, t('financeBatch.failed')) }; }
    })),
    enabled: candidates.length > 0,
  });

  // Résolution nom prestataire (userId → « Prénom Nom ») — même pattern que la vue Dépenses.
  const { data: users = [] } = useQuery({
    queryKey: ['users-all'],
    queryFn: () => usersApi.getAll(),
    staleTime: 120_000,
  });
  const nameByUserId = useMemo(() => {
    const map = new Map<number, string>();
    for (const u of users) map.set(u.id, `${u.firstName} ${u.lastName}`.trim());
    return map;
  }, [users]);

  const retryMutation = useMutation({
    mutationFn: ({ id, quote }: { id: number; quote: PayoutRetryQuote }) => housekeeperPayoutsApi.retry(id, quote),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['housekeeper-payouts-org'] });
      void queryClient.invalidateQueries({ queryKey: ['provider-payout-retry-quotes'] });
    },
  });

  const filtered = useMemo(
    () => (filterStatus ? records.filter((r) => r.status === filterStatus) : records),
    [records, filterStatus],
  );
  const paged = useMemo(
    () => filtered.slice(page * ROWS_PER_PAGE, page * ROWS_PER_PAGE + ROWS_PER_PAGE),
    [filtered, page],
  );

  // Deep-link notification (?highlight=<recordId>) — surligne la ligne ciblée.
  const highlightId = useHighlightParam();
  useHighlightTarget(highlightId, !isLoading && records.length > 0);

  const providerName = (r: HousekeeperPayoutRecord) => r.beneficiaryOrganizationId != null
    ? t('providerPayoutBeneficiary.organization', 'Organisation #{{id}}', { id: r.beneficiaryOrganizationId })
    : r.userId != null
      ? nameByUserId.get(r.userId) ?? `${t('accounting.housekeeperPayouts.provider', 'Prestataire')} #${r.userId}`
      : t('providerPayoutBeneficiary.title', 'Bénéficiaire du versement');

  const handleConfirmRetry = useCallback(() => {
    if (!retryTarget) return;
    retryMutation.mutate({ id: retryTarget.id, quote: { amount: retryTarget.amount, commissionAmount: retryTarget.commissionAmount } });
    setRetryTarget(null);
  }, [retryTarget, retryMutation]);

  const helpAction = usePageHeaderActions(
    <HelpPopover
      label={t('common.help', 'Aide')}
      title={t('accounting.housekeeperPayouts.help.title', 'Versements prestataires')}
      description={t(
        'accounting.housekeeperPayouts.help.description',
        'Versements aux prestataires de tous les métiers, personnes ou organisations. Chaque mission doit être terminée, encaissée et justifiée avant son versement.',
      )}
    />,
  );

  return (
    <>
      {helpAction}

      <FinanceBatchPanel title={t('financeBatch.providerTransfers')} actionLabel={t('financeBatch.retryTransfers')}
        disabled={isLoading || isError || quotesLoading || retryMutation.isPending}
        items={filtered.flatMap(record => {
          const quote = quotes.find(q => q.id === record.id)?.quote;
          return quote ? [{ key: String(record.id), label: `${providerName(record)} · #${record.interventionId}`, amount: quote.amount, currency: 'EUR' }] : [];
        })}
        onExecute={async items => {
          const results: FinanceBatchResult[] = [];
          for (const item of items) {
            try {
              const current = (await housekeeperPayoutsApi.listOrg()).find(record => String(record.id) === item.key);
              if (!current || !RETRYABLE.includes(current.status) || current.stripeTransferId) {
                results.push({ key: item.key, state: 'blocked' }); continue;
              }
              const quote = await housekeeperPayoutsApi.previewRetry(current.id);
              if (quote.amount !== item.amount) { results.push({ key: item.key, state: 'blocked', message: t('accounting.housekeeperPayouts.amountChanged') }); continue; }
              const result = await retryMutation.mutateAsync({ id: current.id, quote });
              results.push({ key: item.key, state: result.status === 'SENT' || result.status === 'PENDING' ? 'sent' : 'blocked',
                message: result.failureReason ? t(`accounting.housekeeperPayouts.reasons.${result.failureReason}`, result.failureReason) : undefined });
            } catch (cause) {
              results.push({ key: item.key, state: 'error', message: getErrorMessage(cause, t('financeBatch.failed')) });
            }
          }
          return results;
        }} />

      {/* ── Filtre statut ── */}
      <div className={cn(CARD_CLASS, 'p-3 mb-[9px] flex gap-3 items-center flex-wrap')}>
        <FilterChipRow
          options={STATUS_VALUES.map((v) => ({
            value: v,
            label: t(`accounting.housekeeperPayouts.statuses.${v}`, v),
            color: STATUS_TONES[STATUS_TONE[v]].color,
          }))}
          value={filterStatus}
          onChange={(v) => { setFilterStatus(v as HousekeeperPayoutStatus | ''); setPage(0); }}
          allLabel={t('common.all', 'Tous')}
          size="compact"
        />
      </div>

      {/* ── Feedback relance ── */}
      {retryMutation.isSuccess && retryMutation.data && <PayoutActionResult
        status={retryMutation.data.status}
        reason={retryMutation.data.failureReason ? t(`accounting.housekeeperPayouts.reasons.${retryMutation.data.failureReason}`, retryMutation.data.failureReason) : null}
        onClose={() => retryMutation.reset()}
      />}
      {retryMutation.isError && (
        <BuiAlert variant="destructive" className="mb-2 text-[0.8125rem]">
          <TriangleAlert />
          <AlertDescription>{(retryMutation.error as { message?: string })?.message
            || t('accounting.housekeeperPayouts.retryError', 'Conditions du versement toujours non réunies (preuve / onboarding).')}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => retryMutation.reset()}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}

      {!isError && <FinanceAmountKpis kind="payouts" records={filtered.map(row => ({
        status: row.status,
        amount: quotes.find(preview => preview.id === row.id)?.quote?.amount ?? row.amount,
        currency: 'EUR',
      }))} loading={isLoading || quotesLoading} />}
      {/* Liste et détail */}
      {isLoading ? (
        <div className="flex flex-col gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-11 w-full rounded-md" />
          ))}
        </div>
      ) : isError ? (
        <BuiAlert variant="destructive" className="text-[0.8125rem]">
          <TriangleAlert />
          <AlertDescription>{t('accounting.housekeeperPayouts.error', 'Erreur lors du chargement des versements prestataires')}</AlertDescription>
        </BuiAlert>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<PayoutIcon />}
          title={t('accounting.housekeeperPayouts.empty', 'Aucun versement prestataire')}
          description={t(
            'accounting.housekeeperPayouts.emptyDescription',
            'Les versements des missions apparaîtront ici une fois leur bénéficiaire désigné.',
          )}
          variant="plain"
        />
      ) : (
        <FinanceWorkspace artwork="transfer"  items={paged.map((r) => {
                const preview = quotes.find(q => q.id === r.id);
                const reason = r.failureReason
                  ? t(`accounting.housekeeperPayouts.reasons.${r.failureReason}`, r.failureReason)
                  : null;
                const showReason = reason && (r.status === 'FAILED' || r.status === 'BLOCKED');
                return (
                  { id: r.id, eventImage: financeEventArtwork('', 'PROVIDER_PAYOUT'), identity: { interventionId: r.interventionId, actorName: providerName(r) }, title: <>{providerName(r)}</>, amount: <>{fmtCurrency(preview?.quote?.amount ?? r.amount)}</>, status: <>
                      <div className="inline-flex items-center gap-0.5">
                        <StatusChip tone={STATUS_TONE[r.status]} label={t(`accounting.housekeeperPayouts.statuses.${r.status}`, r.status)} />
                        {showReason && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[0.6875rem] text-warning-ink cursor-help">
                                ({reason})
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{reason}</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </>,  meta: <>{fmtDate(r.createdAt)}</>, actions: <>
                      {RETRYABLE.includes(r.status) && (
                        <Tooltip>
                          {/* Le trigger enveloppe un <span> (element hote) : Radix y pose
                              sa ref d'ancrage, qu'un composant fonction ne peut recevoir. */}
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <BuiButton
                                variant="ghost"
                                size="icon-sm"
                                className="text-primary"
                                aria-label={t('accounting.housekeeperPayouts.retry', 'Relancer le versement')}
                                onClick={() => preview?.quote && setRetryTarget({ ...r, ...preview.quote })}
                                disabled={retryMutation.isPending || quotesLoading || !preview?.quote}
                              >
                                {retryMutation.isPending && retryMutation.variables?.id === r.id
                                  ? <Spinner className="size-3.5" />
                                  : <RetryIcon size={'1rem'} strokeWidth={1.75} />}
                              </BuiButton>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {preview?.error || t('accounting.housekeeperPayouts.retry', 'Relancer le versement')}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </>, fields: [{label: <>{t('accounting.housekeeperPayouts.col.mission', 'Mission')}</>, value: <>
                      <RouterLink
                        to={`/interventions/${r.interventionId}`}
                        className="text-xs text-primary no-underline tabular-nums hover:underline"
                      >
                        {t('accounting.housekeeperPayouts.missionRef', 'Mission')} #{r.interventionId}
                      </RouterLink>
                    </>}, ...(preview?.error ? [{label: <>{t('accounting.housekeeperPayouts.retry', 'Relancer le versement')}</>, value: <span className="text-warning-ink">{preview.error}</span>}] : []), {label: <>{t('accounting.housekeeperPayouts.col.net', 'Montant net')}</>, value: <>{fmtCurrency(preview?.quote?.amount ?? r.amount)}</>},{label: <>{t('accounting.housekeeperPayouts.col.commission', 'Commission')}</>, value: <>
                      {r.commissionAmount > 0 ? fmtCurrency(r.commissionAmount) : '—'}
                    </>},{label: <>{t('accounting.housekeeperPayouts.col.date', 'Date')}</>, value: <>{fmtDate(r.createdAt)}</>}],  }
                );
              })} pagination={<>{filtered.length > ROWS_PER_PAGE && (
            <PagePagination
              count={filtered.length}
              page={page}
              onPageChange={(p) => setPage(p)}
              rowsPerPage={ROWS_PER_PAGE}
            />
          )}</>} />
      )}

      {/* ── Confirmation de relance (money-path) ── */}
      <Dialog open={!!retryTarget} onOpenChange={(next) => { if (!next) setRetryTarget(null); }}>
        <DialogContent className="sm:max-w-[444px]">
          <DialogHeader>
            <DialogTitle>{t('accounting.housekeeperPayouts.retryTitle', 'Relancer le versement')}</DialogTitle>
          </DialogHeader>
          {retryTarget && (
            <p className="text-[0.8125rem] text-muted-foreground">
              {t(
                'accounting.housekeeperPayouts.retryConfirm',
                'Relancer le versement de {{amount}} à {{provider}} ?',
                { amount: fmtCurrency(retryTarget.amount), provider: providerName(retryTarget) },
              )}
            </p>
          )}
          <DialogFooter>
            <BuiButton variant="ghost" size="sm" onClick={() => setRetryTarget(null)}>
              {t('common.cancel', 'Annuler')}
            </BuiButton>
            <BuiButton
              variant="default"
              size="sm"
              onClick={handleConfirmRetry}
              disabled={retryMutation.isPending}
            >
              {t('accounting.housekeeperPayouts.retryConfirmBtn', 'Relancer')}
            </BuiButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default HousekeeperPayoutsTab;
