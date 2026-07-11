/* ============================================================
   <HousekeeperPayoutsTab> — vue admin des versements PRESTATAIRES (ménage)

   Versements Stripe directs aux prestataires (ménage), déclenchés à la
   validation de mission (Moteur Ménage 3B). À NE PAS confondre avec :
     - « Reversements » (payouts PROPRIÉTAIRES, SEPA, OwnerPayout),
     - « Dépenses prestataires » (saisie manuelle de dépenses, ProviderExpense).
   Endpoints : GET /housekeeper-payouts/org · POST /{id}/retry (staff plateforme).
   ============================================================ */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Box, Paper, Typography, Button, Chip, IconButton, Tooltip, Link,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination,
  Alert, Skeleton, CircularProgress,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { Build as RetryIcon, AccountBalance as PayoutIcon } from '../../../icons';
import FilterChipRow from '../../../components/FilterChipRow';
import HelpBanner from '../../../components/HelpBanner';
import EmptyState from '../../../components/EmptyState';
import { useTranslation } from '../../../hooks/useTranslation';
import { useCurrency } from '../../../hooks/useCurrency';
import { useHighlightParam, useHighlightTarget } from '../../../hooks/useHighlight';
import { usersApi } from '../../../services/api/usersApi';
import { extractApiList } from '../../../types';
import {
  housekeeperPayoutsApi,
  type HousekeeperPayoutRecord,
  type HousekeeperPayoutStatus,
} from '../../../services/api/housekeeperPayoutsApi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Cartes/tableaux : hairline --line, r14, pas d'ombre (baseline §2, aligné AccountingPage).
const CARD_SX = {
  border: '1px solid var(--line)',
  boxShadow: 'none',
  borderRadius: 'var(--radius-lg)',
  bgcolor: 'var(--card)',
} as const;
const CELL_SX = { fontSize: '12.5px', py: 1.25, fontVariantNumeric: 'tabular-nums' } as const;
const HEAD_CELL_SX = { py: 1 } as const;

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
  // /users renvoie une forme paginée : normaliser via extractApiList (pattern projet,
    // cf. usePropertyForm/UsersList) — apiClient.get<User[]> ment sur le type réel.
  const { data: users = [] } = useQuery({
    queryKey: ['users-all'],
    queryFn: async () => extractApiList<{ id: number; firstName: string; lastName: string }>(await usersApi.getAll()),
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

  return (
    <>
      <HelpBanner
        storageKey="clenzy_housekeeper_payouts_help_dismissed"
        title={t('accounting.housekeeperPayouts.help.title', 'Versements prestataires (ménage)')}
        description={t(
          'accounting.housekeeperPayouts.help.description',
          'Versements Stripe directs aux prestataires (ménage), déclenchés automatiquement à la validation de mission. Distincts des reversements propriétaires et de la saisie de dépenses.',
        )}
        dismissLabel={t('accounting.housekeeperPayouts.help.dismiss', 'Ne plus afficher')}
        steps={[]}
      />

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
        <Alert severity="success" sx={{ mb: 1.5, fontSize: '0.8125rem' }} onClose={() => retryMutation.reset()}>
          {t('accounting.housekeeperPayouts.retrySuccess', 'Relance du versement effectuée')}
        </Alert>
      )}
      {retryMutation.isError && (
        <Alert severity="error" sx={{ mb: 1.5, fontSize: '0.8125rem' }} onClose={() => retryMutation.reset()}>
          {(retryMutation.error as { message?: string })?.message
            || t('accounting.housekeeperPayouts.retryError', 'Conditions du versement toujours non réunies (preuve / onboarding).')}
        </Alert>
      )}

      {/* ── Table ── */}
      {isLoading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={44} sx={{ borderRadius: 'var(--radius-sm)' }} />
          ))}
        </Box>
      ) : isError ? (
        <Alert severity="error" sx={{ fontSize: '0.8125rem' }}>
          {t('accounting.housekeeperPayouts.error', 'Erreur lors du chargement des versements prestataires')}
        </Alert>
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
        <TableContainer component={Paper} sx={CARD_SX}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={HEAD_CELL_SX}>{t('accounting.housekeeperPayouts.col.provider', 'Prestataire')}</TableCell>
                <TableCell sx={HEAD_CELL_SX}>{t('accounting.housekeeperPayouts.col.mission', 'Mission')}</TableCell>
                <TableCell sx={HEAD_CELL_SX} align="right">{t('accounting.housekeeperPayouts.col.net', 'Montant net')}</TableCell>
                <TableCell sx={HEAD_CELL_SX} align="right">{t('accounting.housekeeperPayouts.col.commission', 'Commission')}</TableCell>
                <TableCell sx={HEAD_CELL_SX} align="center">{t('accounting.housekeeperPayouts.col.status', 'Statut')}</TableCell>
                <TableCell sx={HEAD_CELL_SX}>{t('accounting.housekeeperPayouts.col.date', 'Date')}</TableCell>
                <TableCell sx={HEAD_CELL_SX} align="right">{t('common.actions', 'Actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map((r) => {
                const reason = r.failureReason
                  ? t(`accounting.housekeeperPayouts.reasons.${r.failureReason}`, r.failureReason)
                  : null;
                const showReason = reason && (r.status === 'FAILED' || r.status === 'BLOCKED');
                return (
                  <TableRow key={r.id} data-highlight-id={String(r.id)} hover>
                    <TableCell sx={CELL_SX}>{providerName(r)}</TableCell>
                    <TableCell sx={CELL_SX}>
                      <Link
                        component={RouterLink}
                        to={`/interventions/${r.interventionId}`}
                        sx={{ fontSize: '12.5px', color: 'var(--accent)', textDecoration: 'none', fontVariantNumeric: 'tabular-nums', '&:hover': { textDecoration: 'underline' } }}
                      >
                        {t('accounting.housekeeperPayouts.missionRef', 'Mission')} #{r.interventionId}
                      </Link>
                    </TableCell>
                    <TableCell sx={{ ...CELL_SX, fontWeight: 700 }} align="right">{fmtCurrency(r.amount)}</TableCell>
                    <TableCell sx={CELL_SX} align="right">
                      {r.commissionAmount > 0 ? fmtCurrency(r.commissionAmount) : '—'}
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                        <Chip
                          label={t(`accounting.housekeeperPayouts.statuses.${r.status}`, r.status)}
                          size="small"
                          sx={softChipSx(STATUS_COLORS[r.status])}
                        />
                        {showReason && (
                          <Tooltip title={reason as string}>
                            <Typography component="span" sx={{ fontSize: '0.6875rem', color: 'var(--warn)', cursor: 'help' }}>
                              ({reason})
                            </Typography>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ ...CELL_SX, fontSize: '0.75rem' }}>{fmtDate(r.createdAt)}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
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
                                ? <CircularProgress size={14} />
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
            <TablePagination
              component="div"
              count={filtered.length}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={ROWS_PER_PAGE}
              rowsPerPageOptions={[ROWS_PER_PAGE]}
            />
          )}
        </TableContainer>
      )}

      {/* ── Confirmation de relance (money-path) ── */}
      <Dialog open={!!retryTarget} onClose={() => setRetryTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('accounting.housekeeperPayouts.retryTitle', 'Relancer le versement')}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          {retryTarget && (
            <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
              {t(
                'accounting.housekeeperPayouts.retryConfirm',
                'Relancer le versement de {{amount}} à {{provider}} ?',
                { amount: fmtCurrency(retryTarget.amount), provider: providerName(retryTarget) },
              )}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRetryTarget(null)} size="small" sx={{ textTransform: 'none', fontSize: '0.8125rem' }}>
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button
            variant="contained"
            size="small"
            color="warning"
            onClick={handleConfirmRetry}
            sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
          >
            {t('accounting.housekeeperPayouts.retryConfirmBtn', 'Relancer')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default HousekeeperPayoutsTab;
