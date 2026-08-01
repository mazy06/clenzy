import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { TriangleAlert, X, CircleCheck } from 'lucide-react';
import { Spinner, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import { Paper, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Select, FormControl, InputLabel, Skeleton, Tabs, Tab, Card, CardContent } from '@mui/material';
import {
  Add as AddIcon,
  CheckCircle as ApproveIcon,
  Payment as PaidIcon,
  AccountBalance as AccountIcon,
  Cancel as CancelIcon,
  Description as PoIcon,
  Download as DownloadIcon,
  Receipt as ReceiptIcon,
  ListAlt as ListAltIcon,
  AttachMoney as AttachMoneyIcon,
  Build as BuildIcon,
  Article as ArticleIcon,
  AttachFile as AttachFileIcon,
  DeleteOutline as DeleteReceiptIcon,
  PlaylistAddCheck as StepGenIcon,
  Calculate as StepCalcIcon,
  TaskAlt as StepValidIcon,
  TrendingUp as StepRevenueIcon,
  Percent as StepPercentIcon,
  Category as StepCategoryIcon,
  DateRange as StepPeriodIcon,
  FileDownload as StepExportIcon,
  Inventory as StepFormatIcon,
  Visibility as VisibilityIcon,
} from '../../icons';
import FilterChipRow from '../../components/FilterChipRow';
import HelpPopover from '../../components/HelpPopover';
import { usePageHeaderActions } from '../../components/PageHeaderActionsContext';
import EmptyState from '../../components/EmptyState';
import { useTranslation } from '../../hooks/useTranslation';
import { propertiesApi } from '../../services/api/propertiesApi';
import type { Property } from '../../services/api/propertiesApi';
import {
  usePayouts,
  useApprovePayout,
  useMarkAsPaid,
  useExecutePayout,
  useRetryPayout,
} from '../../hooks/useAccounting';
import type { OwnerPayout, OwnerPayoutConfig, PayoutStatus } from '../../services/api/accountingApi';
import { PAYOUT_STATUS_COLORS, accountingApi } from '../../services/api/accountingApi';
import {
  providerExpensesApi,
  EXPENSE_STATUS_COLORS,
  EXPENSE_CATEGORY_COLORS,
} from '../../services/api/providerExpensesApi';
import type {
  ProviderExpense,
  ExpenseStatus,
  ExpenseCategory,
  CreateProviderExpenseRequest,
} from '../../services/api/providerExpensesApi';
import { documentsApi } from '../../services/api/documentsApi';
import { usersApi } from '../../services/api/usersApi';
import { accountingExportApi } from '../../services/api/accountingExportApi';
import ExportPreviewDialog from './ExportPreviewDialog';
import SepaTransferProcedureTooltip from './components/SepaTransferProcedureTooltip';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrency } from '../../hooks/useCurrency';
import { Money } from '../../components/Money';
import { useHighlightParam, useHighlightTarget } from '../../hooks/useHighlight';

// ─── Constants ──────────────────────────────────────────────────────────────

const PAYOUT_STATUS_VALUES: (PayoutStatus | '')[] = [
  '', 'PENDING', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED',
];

// Carte/panneau : hairline --line, r14 (baseline §2 Cartes), aucune ombre.
const CARD_SX = {
  border: '1px solid var(--line)',
  boxShadow: 'none',
  borderRadius: 'var(--radius-lg)',
  bgcolor: 'var(--card)',
} as const;

// Tableaux : la typo / le padding / le filet viennent des primitifs du kit ;
// il ne reste ici que ce que les cellules ajoutent EN PLUS.
const CELL_CLASS = 'tabular-nums';
// Tableau de detail (modale SEPA) : mise en page cle/valeur, donc plus serree et sans filet.
const DETAIL_CELL_CLASS = 'py-[4.5px] border-b-0 tabular-nums';
const DETAIL_LABEL_CLASS = `${DETAIL_CELL_CLASS} font-semibold text-[var(--muted)]`;
// Report en classes de `CARD_SX` pour les conteneurs de tableau (r-lg, hairline, fond carte).
const CARD_CLASS = 'overflow-x-auto rounded-[var(--radius-lg)] border border-solid border-[var(--line)] bg-[var(--card)]';

const TAB_SX = { textTransform: 'none', fontSize: '0.8125rem', fontWeight: 600, minHeight: 40 } as const;

// Label overline des tuiles KPI (pattern StatTile).
const KPI_LABEL_SX = {
  display: 'block',
  fontSize: '10.5px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--faint)',
  mb: 0.5,
} as const;

/** Report en classes de `KPI_LABEL_SX`. */
const KPI_LABEL_CLASS = 'block text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--faint)] mb-[3px]';

// Valeur KPI : display tabular-nums (pattern StatTile).
const KPI_VALUE_SX = {
  fontFamily: 'var(--font-display)',
  fontSize: '1.125rem',
  fontWeight: 600,
  letterSpacing: '-0.025em',
  fontVariantNumeric: 'tabular-nums',
  color: 'var(--ink)',
} as const;

/** Report en classes de `KPI_VALUE_SX`. */
const KPI_VALUE_CLASS = 'cn-text-body1 [font-family:var(--font-display)] text-[1.125rem] font-semibold tracking-[-0.025em] tabular-nums text-[var(--ink)]';

/** Chip statut — pattern baseline §2 : pilule r999, 10.5px fw700 h22, texte couleur + fond soft (hex ou var(--…)). */
const softChipSx = (color: string) => ({
  backgroundColor: `color-mix(in srgb, ${color} 9%, transparent)`,
  color,
  borderRadius: 999,
  fontWeight: 700,
  fontSize: '10.5px',
  height: 22,
  '& .MuiChip-label': { px: 1.25 },
});

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '—';

const fmtPercent = (n: number) => `${(n * 100).toFixed(1)}%`;

// ═══════════════════════════════════════════════════════════════════════════
//  Payouts Tab
// ═══════════════════════════════════════════════════════════════════════════

export const PayoutsTab: React.FC = () => {
  const { t } = useTranslation();
  const { convertAndFormat } = useCurrency();
  const fmtCurrency = (n: number, currency = 'EUR') => convertAndFormat(n, currency);

  // Filters
  const [filterOwnerId, setFilterOwnerId] = useState<number | ''>('');
  const [filterStatus, setFilterStatus] = useState<PayoutStatus | ''>('');

  // Dialogs
  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<OwnerPayout | null>(null);
  const [payRef, setPayRef] = useState('');

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPayout, setDetailPayout] = useState<OwnerPayout | null>(null);

  // Owner payout configs (IBAN, BIC, holder)
  const { data: payoutConfigs = [] } = useQuery<OwnerPayoutConfig[]>({
    queryKey: ['ownerPayoutConfigs'],
    queryFn: () => accountingApi.getAllOwnerPayoutConfigs(),
    staleTime: 5 * 60 * 1000,
  });
  const configByOwnerId = useMemo(() => {
    const map = new Map<number, OwnerPayoutConfig>();
    for (const c of payoutConfigs) map.set(c.ownerId, c);
    return map;
  }, [payoutConfigs]);

  // Data
  const ownerId = filterOwnerId === '' ? undefined : filterOwnerId;
  const status = filterStatus === '' ? undefined : filterStatus;
  const { data: payouts = [], isLoading, isError } = usePayouts(ownerId, status);

  // Deep-link notification (?highlight=<payoutId>) — surligne la ligne ciblee.
  const highlightId = useHighlightParam();
  useHighlightTarget(highlightId, !isLoading && payouts.length > 0);

  // SEPA XML download
  const [sepaDownloading, setSepaDownloading] = useState(false);
  const [sepaError, setSepaError] = useState<string | null>(null);

  // Mutations
  const approveMutation = useApprovePayout();
  const markPaidMutation = useMarkAsPaid();
  const executeMutation = useExecutePayout();
  const retryMutation = useRetryPayout();

  // Owner list from payouts (unique owners with resolved names)
  const ownerOptions = useMemo(() => {
    const map = new Map<number, string | null>();
    for (const p of payouts) {
      if (!map.has(p.ownerId)) {
        map.set(p.ownerId, p.ownerName);
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '') || a.id - b.id);
  }, [payouts]);

  // Handlers
  const handleApprove = useCallback(
    (id: number) => approveMutation.mutate(id),
    [approveMutation],
  );

  const handleMarkPaid = useCallback(async () => {
    if (!payTarget || !payRef.trim()) return;
    await markPaidMutation.mutateAsync({ id: payTarget.id, paymentReference: payRef.trim() });
    setPayOpen(false);
    setPayTarget(null);
    setPayRef('');
  }, [payTarget, payRef, markPaidMutation]);

  const openPayDialog = useCallback((payout: OwnerPayout) => {
    setPayTarget(payout);
    setPayRef('');
    setPayOpen(true);
  }, []);

  const processingSepaPayouts = useMemo(
    () => payouts.filter((p) => p.status === 'PROCESSING' && p.payoutMethod === 'SEPA_TRANSFER'),
    [payouts],
  );

  const handleDownloadSepaXml = useCallback(async (ids: number[]) => {
    if (ids.length === 0) return;
    setSepaDownloading(true);
    setSepaError(null);
    try {
      await accountingExportApi.downloadSepaXml(ids);
    } catch (err) {
      setSepaError((err as Error)?.message || t('accounting.sepaDownloadError', 'Erreur lors du telechargement SEPA'));
    } finally {
      setSepaDownloading(false);
    }
  }, [t]);

  const helpAction = usePageHeaderActions(
    <HelpPopover
      label={t('common.help', 'Aide')}
      title={t('accounting.payouts.help.title', 'Comment fonctionnent les payouts ?')}
      description={t('accounting.payouts.help.description', 'Les payouts vous permettent de calculer et suivre les reversements dus a chaque proprietaire.')}
      steps={[
        { icon: <StepGenIcon size={14} strokeWidth={1.75} />, title: t('accounting.payouts.help.step1Title', 'Generer'), description: t('accounting.payouts.help.step1Desc', 'Selectionnez un proprietaire et une periode pour calculer le reversement.'), accent: 'primary' },
        { icon: <StepCalcIcon size={14} strokeWidth={1.75} />, title: t('accounting.payouts.help.step2Title', 'Verifier'), description: t('accounting.payouts.help.step2Desc', 'Le systeme calcule : revenus - commission - depenses = montant net.'), accent: 'info' },
        { icon: <StepValidIcon size={14} strokeWidth={1.75} />, title: t('accounting.payouts.help.step3Title', 'Valider & Payer'), description: t('accounting.payouts.help.step3Desc', 'Approuvez le payout puis marquez-le comme paye apres le virement.'), accent: 'success' },
      ]}
    />,
  );

  return (
    <>
      {helpAction}

      {/* ── Filters + Actions ── */}
      <Paper sx={{ ...CARD_SX, p: 2, mb: 1.5, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel sx={{ fontSize: '0.8125rem' }}>
            {t('accounting.filterOwner', 'Proprietaire')}
          </InputLabel>
          <Select
            value={filterOwnerId}
            onChange={(e) => setFilterOwnerId(e.target.value as number | '')}
            label={t('accounting.filterOwner', 'Proprietaire')}
            sx={{ fontSize: '0.8125rem' }}
          >
            <MenuItem value="">
              <em>{t('common.all', 'Tous')}</em>
            </MenuItem>
            {ownerOptions.map((owner) => (
              <MenuItem key={owner.id} value={owner.id} sx={{ fontSize: '0.8125rem' }}>
                {owner.name ?? `${t('accounting.owner', 'Proprietaire')} #${owner.id}`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FilterChipRow
          options={PAYOUT_STATUS_VALUES
            .filter((v): v is PayoutStatus => v !== '')
            .map((v) => ({
              value: v,
              label: t(`accounting.payoutStatuses.${v}`, v),
              color: PAYOUT_STATUS_COLORS[v],
            }))}
          value={filterStatus}
          onChange={(v) => setFilterStatus(v as PayoutStatus | '')}
          allLabel={t('common.all', 'Tous')}
          size="compact"
        />

        {sepaError && (
          <BuiAlert variant="destructive" className="text-[0.8125rem]">
            <TriangleAlert />
            <AlertDescription>{sepaError}</AlertDescription>
            <AlertAction>
              <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setSepaError(null)}>
                <X />
              </BuiButton>
            </AlertAction>
          </BuiAlert>
        )}

        <div className="ms-auto flex gap-1.5">
          {processingSepaPayouts.length > 0 && (
            <SepaTransferProcedureTooltip placement="bottom">
              {/* Le Tooltip MUI pose une ref sur son enfant : le Button du kit
                  ne la transmet pas, d'ou le span intermediaire. */}
              <span className="inline-flex">
                <BuiButton
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownloadSepaXml(processingSepaPayouts.map((p) => p.id))}
                  disabled={sepaDownloading}
                >
                  {sepaDownloading ? <Spinner className="size-3.5" /> : <DownloadIcon />}
                  {t('accounting.downloadSepaXml', 'SEPA XML')} ({processingSepaPayouts.length})
                </BuiButton>
              </span>
            </SepaTransferProcedureTooltip>
          )}
        </div>
      </Paper>

      {/* ── Alerts ── */}
      {approveMutation.isSuccess && (
        <BuiAlert variant="success" className="mb-2 text-[0.8125rem]">
          <CircleCheck />
          <AlertDescription>{t('accounting.approveSuccess', 'Payout approuve')}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => approveMutation.reset()}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}
      {executeMutation.isSuccess && (
        <BuiAlert variant="success" className="mb-2 text-[0.8125rem]">
          <CircleCheck />
          <AlertDescription>{t('accounting.executeSuccess', 'Virement execute avec succes')}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => executeMutation.reset()}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}
      {executeMutation.isError && (
        <BuiAlert variant="destructive" className="mb-2 text-[0.8125rem]">
          <TriangleAlert />
          <AlertDescription>{(executeMutation.error as { message?: string })?.message
            || t('accounting.executeError', 'Erreur lors de l\'execution du virement')}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => executeMutation.reset()}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}
      {retryMutation.isSuccess && (
        <BuiAlert variant="success" className="mb-2 text-[0.8125rem]">
          <CircleCheck />
          <AlertDescription>{t('accounting.retrySuccess', 'Relance effectuee avec succes')}</AlertDescription>
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
          <AlertDescription>{t('accounting.retryError', 'Erreur lors de la relance du virement')}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => retryMutation.reset()}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}
      {markPaidMutation.isSuccess && (
        <BuiAlert variant="success" className="mb-2 text-[0.8125rem]">
          <CircleCheck />
          <AlertDescription>{t('accounting.paidSuccess', 'Payout marque comme paye')}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => markPaidMutation.reset()}>
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
          <AlertDescription>{t('accounting.error', 'Erreur lors du chargement des payouts')}</AlertDescription>
        </BuiAlert>
      ) : payouts.length === 0 ? (
        <EmptyState
          icon={<AccountIcon />}
          title={t('accounting.payouts.emptyTitle', 'Aucun payout trouve')}
          description={t(
            'accounting.payouts.emptyDescription',
            'Generez votre premier payout pour calculer le reversement du a un proprietaire.',
          )}
          tip={t('accounting.payouts.emptyAutoHint', 'Les payouts sont generes automatiquement selon la planification configuree dans les parametres.')}
          variant="plain"
        />
      ) : (
        <div className={CARD_CLASS}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('accounting.col.owner', 'Proprietaire')}</TableHead>
                <TableHead>{t('accounting.col.period', 'Periode')}</TableHead>
                <TableHead className="text-end">{t('accounting.col.gross', 'Revenu brut')}</TableHead>
                <TableHead className="text-end">{t('accounting.col.commission', 'Commission')}</TableHead>
                <TableHead className="text-end">{t('accounting.col.expenses', 'Depenses')}</TableHead>
                <TableHead className="text-end">{t('accounting.col.net', 'Net')}</TableHead>
                <TableHead className="text-center">{t('accounting.col.status', 'Status')}</TableHead>
                <TableHead className="text-end">{t('common.actions', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((payout) => (
                <TableRow key={payout.id} data-highlight-id={String(payout.id)}>
                  <TableCell className={CELL_CLASS}>
                    {payout.ownerName ?? `${t('accounting.owner', 'Proprietaire')} #${payout.ownerId}`}
                  </TableCell>
                  <TableCell className={`${CELL_CLASS} text-xs`}>
                    {fmtDate(payout.periodStart)} → {fmtDate(payout.periodEnd)}
                  </TableCell>
                  <TableCell className={`${CELL_CLASS} text-end`}>{fmtCurrency(payout.grossRevenue)}</TableCell>
                  <TableCell className={`${CELL_CLASS} text-end`}>
                    {fmtCurrency(payout.commissionAmount)}{' '}
                    <span className="text-[0.6875rem] text-muted-foreground">
                      ({fmtPercent(payout.commissionRate)})
                    </span>
                  </TableCell>
                  <TableCell className={`${CELL_CLASS} text-end`}>{fmtCurrency(payout.expenses)}</TableCell>
                  <TableCell className={`${CELL_CLASS} text-end font-bold`}>
                    {fmtCurrency(payout.netAmount)}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusChip color={PAYOUT_STATUS_COLORS[payout.status] ?? 'var(--muted)'} label={t(`accounting.payoutStatuses.${payout.status}`, payout.status)} />
                  </TableCell>
                  <TableCell className="text-end whitespace-nowrap">
                    <div className="flex items-center justify-end gap-0.5">
                    {payout.status === 'PENDING' && (
                      <Tooltip title={t('accounting.approve', 'Approuver')}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleApprove(payout.id)}
                          disabled={approveMutation.isPending}
                        >
                          <ApproveIcon size={'1rem'} strokeWidth={1.75} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {payout.status === 'APPROVED' && (
                      <>
                        <Tooltip title={t('accounting.executePayout', 'Executer le virement')}>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => executeMutation.mutate(payout.id)}
                            disabled={executeMutation.isPending}
                          >
                            {executeMutation.isPending ? (
                              <Spinner className="size-3.5" />
                            ) : (
                              <AccountIcon size={'1rem'} strokeWidth={1.75} />
                            )}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('accounting.markPaid', 'Marquer paye')}>
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => openPayDialog(payout)}
                            disabled={markPaidMutation.isPending}
                          >
                            <PaidIcon size={'1rem'} strokeWidth={1.75} />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                    {payout.status === 'PROCESSING' && (
                      <div className="flex items-center gap-0.5">
                        <Tooltip title={t('accounting.markAsPaid', 'Marquer comme payé')}>
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => openPayDialog(payout)}
                            disabled={markPaidMutation.isPending}
                          >
                            <PaidIcon size={'1rem'} strokeWidth={1.75} />
                          </IconButton>
                        </Tooltip>
                        {payout.payoutMethod === 'SEPA_TRANSFER' && (
                          <SepaTransferProcedureTooltip placement="left">
                            <IconButton
                              size="small"
                              onClick={() => handleDownloadSepaXml([payout.id])}
                              disabled={sepaDownloading}
                            >
                              <DownloadIcon size={'1rem'} strokeWidth={1.75} />
                            </IconButton>
                          </SepaTransferProcedureTooltip>
                        )}
                      </div>
                    )}
                    {payout.status === 'FAILED' && (
                      <Tooltip title={payout.failureReason ?? t('accounting.failedPayout', 'Echec du reversement')}>
                        <IconButton
                          size="small"
                          color="warning"
                          onClick={() => retryMutation.mutate(payout.id)}
                          disabled={retryMutation.isPending || payout.retryCount >= 3}
                        >
                          {retryMutation.isPending ? (
                            <Spinner className="size-3.5" />
                          ) : (
                            <BuildIcon size={'1rem'} strokeWidth={1.75} />
                          )}
                        </IconButton>
                      </Tooltip>
                    )}
                    {payout.status === 'PAID' && payout.paymentReference && (
                      <Tooltip title={`Ref: ${payout.paymentReference}`}>
                        <span className="cn-text-body1 text-[0.6875rem] text-[var(--muted)] cursor-help">
                          {payout.paymentReference}
                        </span>
                      </Tooltip>
                    )}
                    {/* Detail button — all statuses except PENDING */}
                    {payout.status !== 'PENDING' && (
                      <Tooltip title={t('accounting.viewDetail', 'Voir le détail')}>
                        <IconButton
                          size="small"
                          onClick={() => { setDetailPayout(payout); setDetailOpen(true); }}
                        >
                          <VisibilityIcon size={'1rem'} strokeWidth={1.75} />
                        </IconButton>
                      </Tooltip>
                    )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          Mark as Paid Dialog
          ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={payOpen}
        onClose={() => setPayOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {t('accounting.payTitle', 'Marquer comme paye')}
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          {payTarget && (
            <p className="cn-text-body1 text-[0.8125rem] mb-3 text-muted-foreground">
              {t('accounting.paySubtitle', 'Payout')} #{payTarget.id} — {fmtCurrency(payTarget.netAmount)}
            </p>
          )}
          <TextField
            label={t('accounting.form.payRef', 'Reference de paiement')}
            size="small"
            fullWidth
            value={payRef}
            onChange={(e) => setPayRef(e.target.value)}
            placeholder="VIR-2024-001, CB-xxx..."
            InputProps={{ sx: { fontSize: '0.8125rem' } }}
            InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <BuiButton variant="ghost" size="sm" onClick={() => setPayOpen(false)}>
            {t('common.cancel', 'Annuler')}
          </BuiButton>
          {/* `color="success"` d'origine restait decoratif : c'est l'action
              principale de la modale, donc `default` et non une teinte --ok. */}
          <BuiButton
            size="sm"
            onClick={handleMarkPaid}
            disabled={markPaidMutation.isPending || !payRef.trim()}
          >
            {markPaidMutation.isPending ? <Spinner className="size-4" /> : t('accounting.confirmPaid', 'Confirmer paiement')}
          </BuiButton>
        </DialogActions>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          Detail SEPA Modal
          ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <span className="inline-flex text-[var(--accent)]"><AccountIcon size={'1.25rem'} strokeWidth={1.75} /></span>
          {t('accounting.payoutDetail', 'Détail du reversement')}
        </DialogTitle>
        {detailPayout && (() => {
          const config = configByOwnerId.get(detailPayout.ownerId);
          return (
            <DialogContent sx={{ pt: '8px !important' }}>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className={`${DETAIL_LABEL_CLASS} w-[160px]`}>Bénéficiaire</TableCell>
                    <TableCell className={DETAIL_CELL_CLASS}>{config?.bankAccountHolder || detailPayout.ownerName || '—'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className={DETAIL_LABEL_CLASS}>IBAN</TableCell>
                    <TableCell className={`${DETAIL_CELL_CLASS} font-mono tracking-[1px]`}>{config?.maskedIban || '—'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className={DETAIL_LABEL_CLASS}>BIC</TableCell>
                    <TableCell className={`${DETAIL_CELL_CLASS} font-mono`}>{config?.bic || '—'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className={DETAIL_LABEL_CLASS}>Méthode</TableCell>
                    <TableCell className={DETAIL_CELL_CLASS}>
                      <StatusChip color={'var(--info)'} label={detailPayout.payoutMethod === 'SEPA_TRANSFER' ? 'Virement SEPA' : detailPayout.payoutMethod === 'STRIPE_CONNECT' ? 'Stripe Connect' : 'Manuel'} />
                    </TableCell>
                  </TableRow>
                  <TableRow><TableCell colSpan={2} className={`${DETAIL_CELL_CLASS} pt-[12px]`}><div className="border-b border-[var(--line)]" /></TableCell></TableRow>
                  <TableRow>
                    <TableCell className={DETAIL_LABEL_CLASS}>Période</TableCell>
                    <TableCell className={DETAIL_CELL_CLASS}>{detailPayout.periodStart} → {detailPayout.periodEnd}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className={DETAIL_LABEL_CLASS}>Revenu brut</TableCell>
                    <TableCell className={DETAIL_CELL_CLASS}>{fmtCurrency(detailPayout.grossRevenue)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className={DETAIL_LABEL_CLASS}>Commission ({(detailPayout.commissionRate * 100).toFixed(1)}%)</TableCell>
                    <TableCell className={`${DETAIL_CELL_CLASS} text-[var(--err)]`}>- {fmtCurrency(detailPayout.commissionAmount)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className={DETAIL_LABEL_CLASS}>Dépenses</TableCell>
                    <TableCell className={detailPayout.expenses > 0 ? `${DETAIL_CELL_CLASS} text-[var(--err)]` : `${DETAIL_CELL_CLASS} text-[var(--muted)]`}>
                      {detailPayout.expenses > 0 ? `- ${fmtCurrency(detailPayout.expenses)}` : fmtCurrency(0)}
                    </TableCell>
                  </TableRow>
                  <TableRow><TableCell colSpan={2} className={DETAIL_CELL_CLASS}><div className="border-b border-[var(--line)]" /></TableCell></TableRow>
                  <TableRow>
                    <TableCell className={`${DETAIL_CELL_CLASS} font-bold text-sm`}>Net à virer</TableCell>
                    <TableCell className={`${DETAIL_CELL_CLASS} font-[family-name:var(--font-display)] font-semibold text-sm text-[var(--ok)]`}>{fmtCurrency(detailPayout.netAmount)}</TableCell>
                  </TableRow>
                  {detailPayout.paymentReference && (
                    <TableRow>
                      <TableCell className={DETAIL_LABEL_CLASS}>Réf. paiement</TableCell>
                      <TableCell className={`${DETAIL_CELL_CLASS} font-mono`}>{detailPayout.paymentReference}</TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                    <TableCell className={DETAIL_LABEL_CLASS}>Statut</TableCell>
                    <TableCell className={DETAIL_CELL_CLASS}>
                      <StatusChip color={PAYOUT_STATUS_COLORS[detailPayout.status] ?? 'var(--muted)'} label={detailPayout.status} />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </DialogContent>
          );
        })()}
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <BuiButton variant="ghost" size="sm" onClick={() => setDetailOpen(false)}>
            {t('common.close', 'Fermer')}
          </BuiButton>
        </DialogActions>
      </Dialog>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  Expenses Tab
// ═══════════════════════════════════════════════════════════════════════════

const EXPENSE_STATUS_OPTIONS: { value: ExpenseStatus | ''; label: string; labelKey: string }[] = [
  { value: '', label: 'Tous', labelKey: 'common.all' },
  { value: 'DRAFT', label: 'Brouillon', labelKey: 'accounting.expenses.statuses.DRAFT' },
  { value: 'APPROVED', label: 'Approuvee', labelKey: 'accounting.expenses.statuses.APPROVED' },
  { value: 'INCLUDED', label: 'Incluse', labelKey: 'accounting.expenses.statuses.INCLUDED' },
  { value: 'PAID', label: 'Payee', labelKey: 'accounting.expenses.statuses.PAID' },
  { value: 'CANCELLED', label: 'Annulee', labelKey: 'accounting.expenses.statuses.CANCELLED' },
];

const CATEGORY_OPTIONS: ExpenseCategory[] = ['CLEANING', 'MAINTENANCE', 'LAUNDRY', 'SUPPLIES', 'LANDSCAPING', 'OTHER'];

const fmtCurrency = (n: number, currency = 'EUR') => <Money value={n} from={currency} />;

export const ExpensesTab: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Filters
  const [filterStatus, setFilterStatus] = useState<ExpenseStatus | ''>('');

  // Dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<ProviderExpense | null>(null);
  const [payRef, setPayRef] = useState('');

  // Form
  const [form, setForm] = useState<Partial<CreateProviderExpenseRequest>>({
    taxRate: 0.2,
    category: 'CLEANING',
    expenseDate: new Date().toISOString().substring(0, 10),
  });

  // Data
  const { data: expenses = [], isLoading, isError } = useQuery({
    queryKey: ['provider-expenses', filterStatus || undefined],
    queryFn: () => providerExpensesApi.getAll(filterStatus ? { status: filterStatus } : undefined),
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties-list'],
    queryFn: () => propertiesApi.getAll(),
    staleTime: 120_000,
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['users-providers'],
    queryFn: () => usersApi.getAll(),
    staleTime: 120_000,
    select: (users) => users.filter((u) =>
      ['HOUSEKEEPER', 'TECHNICIAN', 'LAUNDRY', 'EXTERIOR_TECH'].includes(u.role ?? '')
    ),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CreateProviderExpenseRequest) => providerExpensesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-expenses'] });
      setCreateOpen(false);
      setForm({ taxRate: 0.2, category: 'CLEANING', expenseDate: new Date().toISOString().substring(0, 10) });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => providerExpensesApi.approve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['provider-expenses'] }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => providerExpensesApi.cancel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['provider-expenses'] }),
  });

  const payMutation = useMutation({
    mutationFn: ({ id, ref }: { id: number; ref?: string }) => providerExpensesApi.markAsPaid(id, ref),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-expenses'] });
      setPayOpen(false);
      setPayTarget(null);
      setPayRef('');
    },
  });

  const uploadReceiptMutation = useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => providerExpensesApi.uploadReceipt(id, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['provider-expenses'] }),
  });

  const deleteReceiptMutation = useMutation({
    mutationFn: (id: number) => providerExpensesApi.deleteReceipt(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['provider-expenses'] }),
  });

  const receiptInputRef = useRef<HTMLInputElement>(null);
  // Cible de l'upload de justificatif : lue uniquement dans le onChange de
  // l'input file — ref (dispo immediatement, pas de re-render).
  const receiptTargetIdRef = useRef<number | null>(null);

  // Stats
  const stats = useMemo(() => {
    const total = expenses.reduce((sum, e) => sum + (e.amountTtc ?? 0), 0);
    const pending = expenses.filter((e) => e.status === 'DRAFT').length;
    const approved = expenses.filter((e) => e.status === 'APPROVED').length;
    return { total, pending, approved };
  }, [expenses]);

  // Handlers
  const handleCreate = useCallback(() => {
    if (!form.providerId || !form.propertyId || !form.description || !form.amountHt || !form.category || !form.expenseDate) return;
    createMutation.mutate(form as CreateProviderExpenseRequest);
  }, [form, createMutation]);

  const handleReceiptUpload = useCallback((expenseId: number) => {
    receiptTargetIdRef.current = expenseId;
    receiptInputRef.current?.click();
  }, []);

  const handleReceiptFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = receiptTargetIdRef.current;
    if (file && targetId != null) {
      uploadReceiptMutation.mutate({ id: targetId, file });
    }
    // Reset input pour permettre de re-uploader le meme fichier
    e.target.value = '';
    receiptTargetIdRef.current = null;
  }, [uploadReceiptMutation]);

  const handleGeneratePo = useCallback(async (expense: ProviderExpense) => {
    try {
      await documentsApi.generateDocument({
        documentType: 'BON_COMMANDE',
        referenceId: expense.id,
        referenceType: 'PROVIDER_EXPENSE',
        sendEmail: false,
      });
    } catch {
      // Template may not exist yet — silently fail
    }
  }, []);

  const openPayDialog = useCallback((expense: ProviderExpense) => {
    setPayTarget(expense);
    setPayRef('');
    setPayOpen(true);
  }, []);

  const handleMarkPaid = useCallback(() => {
    if (!payTarget) return;
    payMutation.mutate({ id: payTarget.id, ref: payRef.trim() || undefined });
  }, [payTarget, payRef, payMutation]);

  const helpAction = usePageHeaderActions(
    <HelpPopover
      label={t('common.help', 'Aide')}
      title={t('accounting.expenses.help.title', 'Comment fonctionnent les depenses ?')}
      description={t('accounting.expenses.help.description', 'Suivez et gerez les depenses des prestataires (menage, maintenance...) liees a vos logements.')}
      steps={[
        { icon: <StepGenIcon size={14} strokeWidth={1.75} />, title: t('accounting.expenses.help.step1Title', 'Creer'), description: t('accounting.expenses.help.step1Desc', 'Ajoutez une depense avec le prestataire, le logement, le montant et la categorie.'), accent: 'primary' },
        { icon: <StepCategoryIcon size={14} strokeWidth={1.75} />, title: t('accounting.expenses.help.step2Title', 'Approuver'), description: t('accounting.expenses.help.step2Desc', 'Validez les depenses en brouillon. Joignez un justificatif (PDF, photo).'), accent: 'warning' },
        { icon: <StepCalcIcon size={14} strokeWidth={1.75} />, title: t('accounting.expenses.help.step3Title', 'Deduire'), description: t('accounting.expenses.help.step3Desc', 'Les depenses approuvees sont automatiquement deduites des payouts proprietaires.'), accent: 'success' },
      ]}
    />,
  );

  return (
    <>
      {helpAction}

      {/* Hidden file input for receipt upload */}
      <input
        ref={receiptInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        style={{ display: 'none' }}
        onChange={handleReceiptFileChange}
      />

      {/* ── Stats — pattern StatTile : label overline + valeur display tabular-nums ── */}
      <div className="flex gap-2 mb-2">
        <Paper sx={{ ...CARD_SX, p: 1.5, flex: 1 }}>
          <p className={cn(KPI_LABEL_CLASS, 'cn-text-body1')}>
            {t('accounting.expenses.totalExpenses', 'Total depenses')}
          </p>
          <p className={KPI_VALUE_CLASS}>
            {fmtCurrency(stats.total)}
          </p>
        </Paper>
        <Paper sx={{ ...CARD_SX, p: 1.5, flex: 1 }}>
          <p className={cn(KPI_LABEL_CLASS, 'cn-text-body1')}>
            {t('accounting.expenses.pendingCount', 'En attente')}
          </p>
          {/* Couleur issue d'une map importee (valeurs hex) : resolue a l'execution,
              donc en style inline — une classe Tailwind ne peut pas en naitre. */}
          <p className={KPI_VALUE_CLASS} style={{ color: EXPENSE_STATUS_COLORS.DRAFT }}>
            {stats.pending}
          </p>
        </Paper>
        <Paper sx={{ ...CARD_SX, p: 1.5, flex: 1 }}>
          <p className={cn(KPI_LABEL_CLASS, 'cn-text-body1')}>
            {t('accounting.expenses.approvedCount', 'Approuvees')}
          </p>
          <p className={KPI_VALUE_CLASS} style={{ color: EXPENSE_STATUS_COLORS.APPROVED }}>
            {stats.approved}
          </p>
        </Paper>
      </div>

      {/* ── Filters + Actions ── */}
      <Paper sx={{ ...CARD_SX, p: 2, mb: 1.5, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <FilterChipRow
          options={EXPENSE_STATUS_OPTIONS
            .filter((opt) => opt.value !== '')
            .map((opt) => ({
              value: opt.value as ExpenseStatus,
              label: t(opt.labelKey, opt.label),
              color: EXPENSE_STATUS_COLORS[opt.value as ExpenseStatus] ?? 'var(--muted)',
            }))}
          value={filterStatus}
          onChange={(v) => setFilterStatus(v as ExpenseStatus | '')}
          allLabel={t('common.all', 'Tous')}
          size="compact"
        />

        <div className="ms-auto">
          <BuiButton size="sm" onClick={() => setCreateOpen(true)}>
            <AddIcon />
            {t('accounting.expenses.create', 'Nouvelle depense')}
          </BuiButton>
        </div>
      </Paper>

      {/* ── Alerts ── */}
      {createMutation.isSuccess && (
        <BuiAlert variant="success" className="mb-2 text-[0.8125rem]">
          <CircleCheck />
          <AlertDescription>{t('accounting.expenses.createSuccess', 'Depense creee avec succes')}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => createMutation.reset()}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}
      {approveMutation.isSuccess && (
        <BuiAlert variant="success" className="mb-2 text-[0.8125rem]">
          <CircleCheck />
          <AlertDescription>{t('accounting.expenses.approveSuccess', 'Depense approuvee')}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => approveMutation.reset()}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}
      {cancelMutation.isSuccess && (
        <BuiAlert variant="success" className="mb-2 text-[0.8125rem]">
          <CircleCheck />
          <AlertDescription>{t('accounting.expenses.cancelSuccess', 'Depense annulee')}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => cancelMutation.reset()}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}
      {payMutation.isSuccess && (
        <BuiAlert variant="success" className="mb-2 text-[0.8125rem]">
          <CircleCheck />
          <AlertDescription>{t('accounting.expenses.paidSuccess', 'Depense marquee comme payee')}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => payMutation.reset()}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}
      {uploadReceiptMutation.isSuccess && (
        <BuiAlert variant="success" className="mb-2 text-[0.8125rem]">
          <CircleCheck />
          <AlertDescription>{t('accounting.expenses.receiptUploaded', 'Justificatif ajoute')}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => uploadReceiptMutation.reset()}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}
      {uploadReceiptMutation.isError && (
        <BuiAlert variant="destructive" className="mb-2 text-[0.8125rem]">
          <TriangleAlert />
          <AlertDescription>{t('accounting.expenses.receiptUploadError', 'Erreur lors de l\'upload du justificatif')}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => uploadReceiptMutation.reset()}>
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
          <AlertDescription>{t('accounting.expenses.error', 'Erreur lors du chargement des depenses')}</AlertDescription>
        </BuiAlert>
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={<AccountIcon />}
          title={t('accounting.expenses.empty', 'Aucune depense prestataire')}
          variant="plain"
        />
      ) : (
        <div className={CARD_CLASS}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('accounting.expenses.date', 'Date')}</TableHead>
                <TableHead>{t('accounting.expenses.provider', 'Prestataire')}</TableHead>
                <TableHead>{t('accounting.expenses.property', 'Logement')}</TableHead>
                <TableHead>{t('accounting.expenses.description', 'Description')}</TableHead>
                <TableHead className="text-center">{t('accounting.expenses.category', 'Categorie')}</TableHead>
                <TableHead className="text-end">{t('accounting.expenses.amountTtc', 'Montant TTC')}</TableHead>
                <TableHead className="text-center">{t('accounting.expenses.status', 'Statut')}</TableHead>
                <TableHead className="text-end">{t('common.actions', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className={`${CELL_CLASS} text-xs`}>
                    {fmtDate(expense.expenseDate)}
                  </TableCell>
                  <TableCell className={CELL_CLASS}>{expense.providerName ?? '—'}</TableCell>
                  <TableCell className={CELL_CLASS}>{expense.propertyName ?? '—'}</TableCell>
                  <TableCell className={`${CELL_CLASS} max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap`}>
                    {expense.description}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusChip color={EXPENSE_CATEGORY_COLORS[expense.category] ?? '#666'} label={t(`accounting.expenses.categories.${expense.category}`, expense.category)} />
                  </TableCell>
                  <TableCell className={`${CELL_CLASS} text-end font-bold`}>
                    {fmtCurrency(expense.amountTtc, expense.currency)}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusChip color={EXPENSE_STATUS_COLORS[expense.status] ?? 'var(--muted)'} label={t(`accounting.expenses.statuses.${expense.status}`, expense.status)} />
                  </TableCell>
                  <TableCell className="text-end whitespace-nowrap">
                    {expense.status === 'DRAFT' && (
                      <>
                        <Tooltip title={t('accounting.expenses.approve', 'Approuver')}>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => approveMutation.mutate(expense.id)}
                            disabled={approveMutation.isPending}
                          >
                            <ApproveIcon size={'1rem'} strokeWidth={1.75} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('accounting.expenses.cancel', 'Annuler')}>
                          <IconButton
                            size="small"
                            color="default"
                            onClick={() => cancelMutation.mutate(expense.id)}
                            disabled={cancelMutation.isPending}
                          >
                            <CancelIcon size={'1rem'} strokeWidth={1.75} />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                    {(expense.status === 'APPROVED' || expense.status === 'INCLUDED') && (
                      <Tooltip title={t('accounting.expenses.markPaid', 'Marquer paye')}>
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => openPayDialog(expense)}
                          disabled={payMutation.isPending}
                        >
                          <PaidIcon size={'1rem'} strokeWidth={1.75} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {expense.receiptPath ? (
                      <>
                        <Tooltip title={t('accounting.expenses.viewReceipt', 'Voir justificatif')}>
                          <IconButton
                            size="small"
                            color="success"
                            component="a"
                            href={providerExpensesApi.getReceiptDownloadUrl(expense.id)}
                            target="_blank"
                          >
                            <ReceiptIcon size={'1rem'} strokeWidth={1.75} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('accounting.expenses.deleteReceipt', 'Supprimer justificatif')}>
                          <IconButton
                            size="small"
                            color="default"
                            onClick={() => deleteReceiptMutation.mutate(expense.id)}
                            disabled={deleteReceiptMutation.isPending}
                          >
                            <DeleteReceiptIcon size={'1rem'} strokeWidth={1.75} />
                          </IconButton>
                        </Tooltip>
                      </>
                    ) : (
                      <Tooltip title={t('accounting.expenses.uploadReceipt', 'Joindre justificatif')}>
                        <IconButton
                          size="small"
                          color="default"
                          onClick={() => handleReceiptUpload(expense.id)}
                          disabled={uploadReceiptMutation.isPending}
                        >
                          <AttachFileIcon size={'1rem'} strokeWidth={1.75} />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title={t('accounting.expenses.generatePo', 'Bon de commande')}>
                      <IconButton
                        size="small"
                        color="default"
                        onClick={() => handleGeneratePo(expense)}
                      >
                        <PoIcon size={'1rem'} strokeWidth={1.75} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          Create Expense Dialog
          ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {t('accounting.expenses.create', 'Nouvelle depense')}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <div className="flex gap-2">
            <FormControl size="small" fullWidth>
              <InputLabel sx={{ fontSize: '0.8125rem' }}>{t('accounting.expenses.provider', 'Prestataire')}</InputLabel>
              <Select
                value={form.providerId ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, providerId: e.target.value as number }))}
                label={t('accounting.expenses.provider', 'Prestataire')}
                sx={{ fontSize: '0.8125rem' }}
              >
                {providers.map((p) => (
                  <MenuItem key={p.id} value={p.id} sx={{ fontSize: '0.8125rem' }}>
                    {p.firstName} {p.lastName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel sx={{ fontSize: '0.8125rem' }}>{t('accounting.expenses.property', 'Logement')}</InputLabel>
              <Select
                value={form.propertyId ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, propertyId: e.target.value as number }))}
                label={t('accounting.expenses.property', 'Logement')}
                sx={{ fontSize: '0.8125rem' }}
              >
                {properties.map((p: Property) => (
                  <MenuItem key={p.id} value={p.id} sx={{ fontSize: '0.8125rem' }}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>

          <TextField
            label={t('accounting.expenses.description', 'Description')}
            size="small"
            fullWidth
            value={form.description ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            InputProps={{ sx: { fontSize: '0.8125rem' } }}
            InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
          />

          <div className="flex gap-2">
            <TextField
              label={t('accounting.expenses.amountHt', 'Montant HT')}
              type="number"
              size="small"
              fullWidth
              value={form.amountHt ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, amountHt: parseFloat(e.target.value) || 0 }))}
              InputProps={{ sx: { fontSize: '0.8125rem' } }}
              InputLabelProps={{ shrink: true, sx: { fontSize: '0.8125rem' } }}
            />
            <TextField
              label={t('accounting.expenses.taxRate', 'TVA %')}
              type="number"
              size="small"
              sx={{ width: 120 }}
              value={form.taxRate != null ? (form.taxRate * 100).toFixed(0) : ''}
              onChange={(e) => setForm((prev) => ({ ...prev, taxRate: (parseFloat(e.target.value) || 0) / 100 }))}
              inputProps={{ min: 0, max: 100, step: 1 }}
              InputProps={{ sx: { fontSize: '0.8125rem' } }}
              InputLabelProps={{ shrink: true, sx: { fontSize: '0.8125rem' } }}
            />
            <p className="cn-text-body1 self-center text-[0.8125rem] font-semibold min-w-[100px]">
              TTC: {fmtCurrency((form.amountHt ?? 0) * (1 + (form.taxRate ?? 0)))}
            </p>
          </div>

          <div className="flex gap-2">
            <FormControl size="small" fullWidth>
              <InputLabel sx={{ fontSize: '0.8125rem' }}>{t('accounting.expenses.category', 'Categorie')}</InputLabel>
              <Select
                value={form.category ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as ExpenseCategory }))}
                label={t('accounting.expenses.category', 'Categorie')}
                sx={{ fontSize: '0.8125rem' }}
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <MenuItem key={cat} value={cat} sx={{ fontSize: '0.8125rem' }}>
                    {t(`accounting.expenses.categories.${cat}`, cat)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={t('accounting.expenses.date', 'Date')}
              type="date"
              size="small"
              fullWidth
              value={form.expenseDate ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, expenseDate: e.target.value }))}
              InputLabelProps={{ shrink: true, sx: { fontSize: '0.8125rem' } }}
              InputProps={{ sx: { fontSize: '0.8125rem' } }}
            />
          </div>

          <TextField
            label={t('accounting.expenses.invoiceRef', 'Ref. facture')}
            size="small"
            fullWidth
            value={form.invoiceReference ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, invoiceReference: e.target.value }))}
            InputProps={{ sx: { fontSize: '0.8125rem' } }}
            InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
          />

          <TextField
            label={t('accounting.expenses.notes', 'Notes')}
            size="small"
            fullWidth
            multiline
            rows={2}
            value={form.notes ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            InputProps={{ sx: { fontSize: '0.8125rem' } }}
            InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <BuiButton variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
            {t('common.cancel', 'Annuler')}
          </BuiButton>
          <BuiButton
            size="sm"
            onClick={handleCreate}
            disabled={createMutation.isPending || !form.providerId || !form.propertyId || !form.description || !form.amountHt}
          >
            {createMutation.isPending ? <Spinner className="size-4" /> : t('common.save', 'Enregistrer')}
          </BuiButton>
        </DialogActions>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          Mark as Paid Dialog
          ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={payOpen}
        onClose={() => setPayOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {t('accounting.expenses.markPaid', 'Marquer comme paye')}
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          {payTarget && (
            <p className="cn-text-body1 text-[0.8125rem] mb-3 text-muted-foreground">
              {payTarget.description} — {fmtCurrency(payTarget.amountTtc, payTarget.currency)}
            </p>
          )}
          <TextField
            label={t('accounting.expenses.paymentRef', 'Reference de paiement')}
            size="small"
            fullWidth
            value={payRef}
            onChange={(e) => setPayRef(e.target.value)}
            placeholder="VIR-2024-001, CB-xxx..."
            InputProps={{ sx: { fontSize: '0.8125rem' } }}
            InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <BuiButton variant="ghost" size="sm" onClick={() => setPayOpen(false)}>
            {t('common.cancel', 'Annuler')}
          </BuiButton>
          {/* Idem : action principale de la modale, la teinte succes d'origine
              n'apportait rien de plus que l'emphase. */}
          <BuiButton size="sm" onClick={handleMarkPaid} disabled={payMutation.isPending}>
            {payMutation.isPending ? <Spinner className="size-4" /> : t('accounting.expenses.markPaid', 'Confirmer paiement')}
          </BuiButton>
        </DialogActions>
      </Dialog>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  Exports Tab
// ═══════════════════════════════════════════════════════════════════════════

interface ExportCardDef {
  key: string;
  titleKey: string;
  descKey: string;
  icon: React.ReactNode;
  format: 'csv' | 'txt' | 'xml';
  download: (from: string, to: string) => Promise<void>;
  preview: (from: string, to: string) => Promise<string>;
}

const EXPORT_CARDS: ExportCardDef[] = [
  {
    key: 'fec',
    titleKey: 'accounting.exports.fec',
    descKey: 'accounting.exports.fecDesc',
    icon: <span className="inline-flex text-[var(--accent)]"><AccountIcon size={32} strokeWidth={1.75} /></span>,
    format: 'txt',
    download: (from, to) => accountingExportApi.downloadFec(from, to),
    preview: (from, to) => accountingExportApi.previewFec(from, to),
  },
  {
    key: 'reservations',
    titleKey: 'accounting.exports.reservationsCsv',
    descKey: 'accounting.exports.reservationsCsvDesc',
    icon: <span className="inline-flex text-[var(--ok)]"><ListAltIcon size={32} strokeWidth={1.75} /></span>,
    format: 'csv',
    download: (from, to) => accountingExportApi.downloadReservationsCsv(from, to),
    preview: (from, to) => accountingExportApi.previewReservationsCsv(from, to),
  },
  {
    key: 'payouts',
    titleKey: 'accounting.exports.payoutsCsv',
    descKey: 'accounting.exports.payoutsCsvDesc',
    icon: <span className="inline-flex text-[var(--info)]"><AttachMoneyIcon size={32} strokeWidth={1.75} /></span>,
    format: 'csv',
    download: (from, to) => accountingExportApi.downloadPayoutsCsv(from, to),
    preview: (from, to) => accountingExportApi.previewPayoutsCsv(from, to),
  },
  {
    key: 'expenses',
    titleKey: 'accounting.exports.expensesCsv',
    descKey: 'accounting.exports.expensesCsvDesc',
    icon: <span className="inline-flex text-[var(--warn)]"><BuildIcon size={32} strokeWidth={1.75} /></span>,
    format: 'csv',
    download: (from, to) => accountingExportApi.downloadExpensesCsv(from, to),
    preview: (from, to) => accountingExportApi.previewExpensesCsv(from, to),
  },
  {
    key: 'invoices',
    titleKey: 'accounting.exports.invoicesCsv',
    descKey: 'accounting.exports.invoicesCsvDesc',
    icon: <span className="inline-flex text-[var(--muted)]"><ArticleIcon size={32} strokeWidth={1.75} /></span>,
    format: 'csv',
    download: (from, to) => accountingExportApi.downloadInvoicesCsv(from, to),
    preview: (from, to) => accountingExportApi.previewInvoicesCsv(from, to),
  },
];

export const ExportsTab: React.FC = () => {
  const { t } = useTranslation();

  // Default period: first day of current year → today
  const now = new Date();
  const defaultFrom = `${now.getFullYear()}-01-01`;
  const defaultTo = now.toISOString().slice(0, 10);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewFormat, setPreviewFormat] = useState<'csv' | 'txt' | 'xml'>('csv');
  const [previewError, setPreviewError] = useState<string | null>(null);

  const handlePreview = useCallback(async (card: ExportCardDef) => {
    if (!from || !to) return;
    setPreviewTitle(t(card.titleKey));
    setPreviewFormat(card.format);
    setPreviewContent(null);
    setPreviewError(null);
    setPreviewLoading(true);
    setPreviewOpen(true);
    try {
      const content = await card.preview(from, to);
      setPreviewContent(content);
    } catch {
      setPreviewError(t('accounting.exports.error', 'Erreur lors du chargement'));
    } finally {
      setPreviewLoading(false);
    }
  }, [from, to, t]);

  const handleDownload = useCallback(async (card: ExportCardDef) => {
    if (!from || !to) return;
    setLoadingKey(card.key);
    setError(null);
    try {
      await card.download(from, to);
    } catch {
      setError(t('accounting.exports.error', 'Erreur lors du telechargement'));
    } finally {
      setLoadingKey(null);
    }
  }, [from, to, t]);

  const helpAction = usePageHeaderActions(
    <HelpPopover
      label={t('common.help', 'Aide')}
      title={t('accounting.exports.help.title', 'Comment fonctionnent les exports ?')}
      description={t('accounting.exports.help.description', 'Exportez vos donnees comptables dans differents formats pour votre comptable ou vos declarations.')}
      steps={[
        { icon: <StepPeriodIcon size={14} strokeWidth={1.75} />, title: t('accounting.exports.help.step1Title', 'Periode'), description: t('accounting.exports.help.step1Desc', 'Definissez la plage de dates des donnees a exporter.'), accent: 'info' },
        { icon: <StepFormatIcon size={14} strokeWidth={1.75} />, title: t('accounting.exports.help.step2Title', 'Format'), description: t('accounting.exports.help.step2Desc', 'FEC (norme DGFiP), CSV reservations, payouts, depenses ou factures.'), accent: 'secondary' },
        { icon: <StepExportIcon size={14} strokeWidth={1.75} />, title: t('accounting.exports.help.step3Title', 'Telecharger'), description: t('accounting.exports.help.step3Desc', 'Cliquez sur Telecharger pour obtenir le fichier pret a transmettre.'), accent: 'success' },
      ]}
    />,
  );

  return (
    <div>
      {helpAction}

      {/* Period selector */}
      <Paper sx={{ ...CARD_SX, p: 2, mb: 2 }}>
        <p className="cn-text-body1 mb-2 text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--faint)]">
          {t('accounting.exports.period', 'Periode d\'export')}
        </p>
        <div className="flex gap-3 flex-wrap items-center">
          <TextField
            type="date"
            label={t('accounting.exports.from', 'Du')}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 160 }}
          />
          <TextField
            type="date"
            label={t('accounting.exports.to', 'Au')}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 160 }}
          />
        </div>
      </Paper>

      {error && (
        <BuiAlert variant="destructive" className="mb-3">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setError(null)}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}

      {/* Export cards */}
      <div className="grid grid-cols-12 gap-3">
        {EXPORT_CARDS.map((card) => (
          <div className="col-span-12 min-[600px]:col-span-6 min-[900px]:col-span-4" key={card.key}>
            <Card sx={{ ...CARD_SX, height: '100%' }}>
              <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 2 }}>
                <div className="flex items-center gap-2 mb-2">
                  {card.icon}
                  <p className="cn-text-body1 font-semibold text-[13.5px] text-[var(--ink)]">
                    {t(card.titleKey)}
                  </p>
                </div>
                <p className="cn-text-body1 text-[11.5px] text-[var(--muted)] mb-3 flex-1">
                  {t(card.descKey)}
                </p>
                <div className="flex gap-1.5">
                  {/* Paire d'actions a poids egal (previsualiser / telecharger) :
                      outline des deux cotes, aucune ne domine la carte. */}
                  <BuiButton
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={!from || !to || loadingKey !== null}
                    onClick={() => handlePreview(card)}
                  >
                    <VisibilityIcon />
                    {t('common.view')}
                  </BuiButton>
                  <BuiButton
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={!from || !to || loadingKey !== null}
                    onClick={() => handleDownload(card)}
                  >
                    {loadingKey === card.key ? <Spinner className="size-3.5" /> : <DownloadIcon />}
                    {loadingKey === card.key
                      ? t('accounting.exports.downloading', 'Telechargement...')
                      : t('accounting.exports.download', 'Telecharger')}
                  </BuiButton>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      <ExportPreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={previewTitle}
        loading={previewLoading}
        content={previewContent}
        format={previewFormat}
        error={previewError}
      />
    </div>
  );
};
