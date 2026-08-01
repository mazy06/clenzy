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
import StatusChip from '../../../components/StatusChip';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../../components/ui';
import { CircleCheck, X, TriangleAlert } from 'lucide-react';
import { Spinner } from '../../../components/ui';
import { Paper, IconButton, Tooltip, Link, Dialog, DialogTitle, DialogContent, DialogActions, Skeleton } from '@mui/material';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui';
import { Link as RouterLink } from 'react-router-dom';
import { Build as RetryIcon, AccountBalance as PayoutIcon } from '../../../icons';
import FilterChipRow from '../../../components/FilterChipRow';
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

// Cartes/tableaux : hairline --line, r14, pas d'ombre (baseline §2, aligné AccountingPage).
const CARD_SX = {
  border: '1px solid var(--line)',
  boxShadow: 'none',
  borderRadius: 'var(--radius-lg)',
  bgcolor: 'var(--card)',
} as const;

// Chip statut sobre (pattern softChipSx AccountingPage) : texte couleur + fond 9 %.
const softChipSx = (color: string) => ({
  backgroundColor: `color-mix(in srgb, ${color} 9%, transparent)`,
  color,
  borderRadius: 999,
  fontWeight: 700,
  fontSize: '10.5px',
  height: 22,
  '& .MuiChip-label': { px: 1.25 },
});

// Statuts : SENT vert doux, PENDING neutre, FAILED/BLOCKED ambre (jamais rouge criard).
const STATUS_COLORS: Record<HousekeeperPayoutStatus, string> = {
  SENT: 'var(--ok)',
  PENDING: 'var(--muted)',
  FAILED: 'var(--warn)',
  BLOCKED: 'var(--warn)',
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
      <Paper sx={{ ...CARD_SX, p: 2, mb: 1.5, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <FilterChipRow
          options={STATUS_VALUES.map((v) => ({
            value: v,
            label: t(`accounting.housekeeperPayouts.statuses.${v}`, v),
            color: STATUS_COLORS[v],
          }))}
          value={filterStatus}
          onChange={(v) => { setFilterStatus(v as HousekeeperPayoutStatus | ''); setPage(0); }}
          allLabel={t('common.all', 'Tous')}
          size="compact"
        />
      </Paper>

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
            <Skeleton key={i} variant="rounded" height={44} sx={{ borderRadius: 'var(--radius-sm)' }} />
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
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-solid border-[var(--line)] bg-[var(--card)]">
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
                      <Link
                        component={RouterLink}
                        to={`/interventions/${r.interventionId}`}
                        sx={{ fontSize: '12.5px', color: 'var(--accent)', textDecoration: 'none', fontVariantNumeric: 'tabular-nums', '&:hover': { textDecoration: 'underline' } }}
                      >
                        {t('accounting.housekeeperPayouts.missionRef', 'Mission')} #{r.interventionId}
                      </Link>
                    </TableCell>
                    <TableCell className="py-[7.5px] tabular-nums text-end font-bold">{fmtCurrency(r.amount)}</TableCell>
                    <TableCell className="py-[7.5px] tabular-nums text-end">
                      {r.commissionAmount > 0 ? fmtCurrency(r.commissionAmount) : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-0.5">
                        <StatusChip color={STATUS_COLORS[r.status]} label={t(`accounting.housekeeperPayouts.statuses.${r.status}`, r.status)} />
                        {showReason && (
                          <Tooltip title={reason as string}>
                            <span className="cn-text-body1 text-[0.6875rem] text-[var(--warn)] cursor-help">
                              ({reason})
                            </span>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-[7.5px] tabular-nums text-[0.75rem]">{fmtDate(r.createdAt)}</TableCell>
                    <TableCell className="text-end whitespace-nowrap">
                      {RETRYABLE.includes(r.status) && (
                        <Tooltip title={t('accounting.housekeeperPayouts.retry', 'Relancer le versement')}>
                          <span>
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={() => setRetryTarget(r)}
                              disabled={retryMutation.isPending}
                            >
                              {retryMutation.isPending && retryMutation.variables === r.id
                                ? <Spinner className="size-3.5" />
                                : <RetryIcon size={'1rem'} strokeWidth={1.75} />}
                            </IconButton>
                          </span>
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
      <Dialog open={!!retryTarget} onClose={() => setRetryTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('accounting.housekeeperPayouts.retryTitle', 'Relancer le versement')}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          {retryTarget && (
            <p className="cn-text-body1 text-[0.8125rem] text-muted-foreground">
              {t(
                'accounting.housekeeperPayouts.retryConfirm',
                'Relancer le versement de {{amount}} à {{provider}} ?',
                { amount: fmtCurrency(retryTarget.amount), provider: providerName(retryTarget) },
              )}
            </p>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <BuiButton variant="ghost" size="sm" onClick={() => setRetryTarget(null)}>
            {t('common.cancel', 'Annuler')}
          </BuiButton>
          {/* Relance d'un versement (money-path) : le `color="warning"` d'origine
              se reporte en outline teinte --warn, faute de variante dediee. */}
          <BuiButton
            variant="outline"
            size="sm"
            className="text-[var(--warn)] border-[var(--warn)] hover:bg-[var(--warn-soft)]"
            onClick={handleConfirmRetry}
          >
            {t('accounting.housekeeperPayouts.retryConfirmBtn', 'Relancer')}
          </BuiButton>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default HousekeeperPayoutsTab;
