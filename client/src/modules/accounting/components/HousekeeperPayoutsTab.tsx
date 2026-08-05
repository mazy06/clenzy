/* ============================================================
   <HousekeeperPayoutsTab> — vue admin des versements PRESTATAIRES (ménage)

   Versements Stripe directs aux prestataires (ménage), déclenchés à la
   validation de mission (Moteur Ménage 3B). À NE PAS confondre avec :
     - « Reversements » (payouts PROPRIÉTAIRES, SEPA, OwnerPayout),
     - « Dépenses prestataires » (saisie manuelle de dépenses, ProviderExpense).
   Endpoints : GET /housekeeper-payouts/org · POST /{id}/retry (staff plateforme).
   ============================================================ */

import React, { useCallback, useMemo, useState } from 'react';
import { cn } from '../../../utils/cn';
import StatusChip, { STATUS_TONES, type StatusTone } from '../../../components/StatusChip';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../../components/ui';
import { CircleCheck, X, TriangleAlert } from 'lucide-react';
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
import EmptyState from '../../../components/EmptyState';
import { useTranslation } from '../../../hooks/useTranslation';
import { useCurrency } from '../../../hooks/useCurrency';
import { useHighlightParam, useHighlightTarget } from '../../../hooks/useHighlight';
import { usersApi } from '../../../services/api/usersApi';
import {
  housekeeperPayoutsApi,
  type HousekeeperPayoutRecord,
  type HousekeeperPayoutStatus,
} from '../../../services/api/housekeeperPayoutsApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PagePagination from '../../../components/PagePagination';

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

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

export const HousekeeperPayoutsTab: React.FC = () => {
  const { t } = useTranslation();
  const { convertAndFormat } = useCurrency();
  const fmtCurrency = useCallback((n: number) => convertAndFormat(n, 'EUR'), [convertAndFormat]);
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
    mutationFn: (recordId: number) => housekeeperPayoutsApi.retry(recordId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['housekeeper-payouts-org'] }),
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

  const providerName = (r: HousekeeperPayoutRecord) =>
    nameByUserId.get(r.userId) ?? `${t('accounting.housekeeperPayouts.provider', 'Prestataire')} #${r.userId}`;

  const handleConfirmRetry = useCallback(() => {
    if (!retryTarget) return;
    retryMutation.mutate(retryTarget.id);
    setRetryTarget(null);
  }, [retryTarget, retryMutation]);

  const helpAction = usePageHeaderActions(
    <HelpPopover
      label={t('common.help', 'Aide')}
      title={t('accounting.housekeeperPayouts.help.title', 'Versements prestataires (ménage)')}
      description={t(
        'accounting.housekeeperPayouts.help.description',
        'Versements Stripe directs aux prestataires (ménage), déclenchés automatiquement à la validation de mission. Distincts des reversements propriétaires et de la saisie de dépenses.',
      )}
    />,
  );

  return (
    <>
      {helpAction}

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
      {retryMutation.isSuccess && (
        <BuiAlert variant="success" className="mb-2 text-[0.8125rem]">
          <CircleCheck />
          <AlertDescription>{t('accounting.housekeeperPayouts.retrySuccess', 'Relance du versement effectuée')}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => retryMutation.reset()}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}
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

      {/* ── Table ── */}
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
            'Les versements apparaîtront ici automatiquement à la validation des missions de ménage.',
          )}
          variant="plain"
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-solid border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('accounting.housekeeperPayouts.col.provider', 'Prestataire')}</TableHead>
                <TableHead>{t('accounting.housekeeperPayouts.col.mission', 'Mission')}</TableHead>
                <TableHead className="text-end">{t('accounting.housekeeperPayouts.col.net', 'Montant net')}</TableHead>
                <TableHead className="text-end">{t('accounting.housekeeperPayouts.col.commission', 'Commission')}</TableHead>
                <TableHead className="text-center">{t('accounting.housekeeperPayouts.col.status', 'Statut')}</TableHead>
                <TableHead>{t('accounting.housekeeperPayouts.col.date', 'Date')}</TableHead>
                <TableHead className="text-end">{t('common.actions', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((r) => {
                const reason = r.failureReason
                  ? t(`accounting.housekeeperPayouts.reasons.${r.failureReason}`, r.failureReason)
                  : null;
                const showReason = reason && (r.status === 'FAILED' || r.status === 'BLOCKED');
                return (
                  <TableRow key={r.id} data-highlight-id={String(r.id)}>
                    <TableCell className="py-[7.5px] tabular-nums">{providerName(r)}</TableCell>
                    <TableCell className="py-[7.5px] tabular-nums">
                      <RouterLink
                        to={`/interventions/${r.interventionId}`}
                        className="text-xs text-primary no-underline tabular-nums hover:underline"
                      >
                        {t('accounting.housekeeperPayouts.missionRef', 'Mission')} #{r.interventionId}
                      </RouterLink>
                    </TableCell>
                    <TableCell className="py-[7.5px] tabular-nums text-end font-bold">{fmtCurrency(r.amount)}</TableCell>
                    <TableCell className="py-[7.5px] tabular-nums text-end">
                      {r.commissionAmount > 0 ? fmtCurrency(r.commissionAmount) : '—'}
                    </TableCell>
                    <TableCell className="text-center">
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
                    </TableCell>
                    <TableCell className="py-[7.5px] tabular-nums text-[0.75rem]">{fmtDate(r.createdAt)}</TableCell>
                    <TableCell className="text-end whitespace-nowrap">
                      {RETRYABLE.includes(r.status) && (
                        <Tooltip>
                          {/* Le trigger enveloppe un <span> (element hote) : Radix y pose
                              sa ref d'ancrage, qu'un composant fonction ne peut recevoir. */}
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <BuiButton
                                variant="ghost"
                                size="icon-sm"
                                className="text-warning"
                                aria-label={t('accounting.housekeeperPayouts.retry', 'Relancer le versement')}
                                onClick={() => setRetryTarget(r)}
                                disabled={retryMutation.isPending}
                              >
                                {retryMutation.isPending && retryMutation.variables === r.id
                                  ? <Spinner className="size-3.5" />
                                  : <RetryIcon size={'1rem'} strokeWidth={1.75} />}
                              </BuiButton>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {t('accounting.housekeeperPayouts.retry', 'Relancer le versement')}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {filtered.length > ROWS_PER_PAGE && (
            <PagePagination
              count={filtered.length}
              page={page}
              onPageChange={(p) => setPage(p)}
              rowsPerPage={ROWS_PER_PAGE}
            />
          )}
        </div>
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
            {/* Relance d'un versement (money-path) : le `color="warning"` d'origine
                se reporte en outline teinte avertissement, faute de variante dediee. */}
            <BuiButton
              variant="outline"
              size="sm"
              className="text-warning-ink border-warning hover:bg-warning-soft"
              onClick={handleConfirmRetry}
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
