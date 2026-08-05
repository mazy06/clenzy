import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { TriangleAlert, X, CircleCheck } from 'lucide-react';
import { Spinner, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import { Field, FieldLabel, Input, NativeSelect, Textarea } from '../../components/ui';
import {
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Separator,
  Skeleton,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '../../components/ui';
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
import FilterChipRow from '../../components/baitly/FilterChipRow';
import StatTile from '../../components/baitly/StatTile';
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

// Carte/panneau : hairline Baitly UI, r14 (baseline §2 Cartes), aucune ombre.
const PANEL_CLASS = 'rounded-xl border border-solid border-border bg-card';

// Tableaux : la typo / le padding / le filet viennent des primitifs du kit ;
// il ne reste ici que ce que les cellules ajoutent EN PLUS.
const CELL_CLASS = 'tabular-nums';
// Tableau de detail (modale SEPA) : mise en page cle/valeur, donc plus serree et sans filet.
const DETAIL_CELL_CLASS = 'py-[4.5px] border-b-0 tabular-nums';
const DETAIL_LABEL_CLASS = `${DETAIL_CELL_CLASS} font-semibold text-muted-foreground`;
// Conteneurs de tableau : meme surface que `PANEL_CLASS`, plus le defilement.
const CARD_CLASS = `overflow-x-auto ${PANEL_CLASS}`;

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
      <div className={cn(PANEL_CLASS, 'p-3 mb-[9px] flex gap-3 items-center flex-wrap')}>
        <Field className="w-auto min-w-[180px]">
          <FieldLabel className="text-[0.8125rem]" htmlFor="accounting-filter-owner">
            {t('accounting.filterOwner', 'Proprietaire')}
          </FieldLabel>
          {/* Le select natif ne transporte que des chaines : conversion explicite
              vers l'id numerique (ou '' pour « tous »). */}
          <NativeSelect
            id="accounting-filter-owner"
            className="w-full"
            value={filterOwnerId === '' ? '' : String(filterOwnerId)}
            onChange={(e) => setFilterOwnerId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">{t('common.all', 'Tous')}</option>
            {ownerOptions.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name ?? `${t('accounting.owner', 'Proprietaire')} #${owner.id}`}
              </option>
            ))}
          </NativeSelect>
        </Field>

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
      </div>

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
            <Skeleton key={i} className="h-11 rounded-md" />
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
                    <StatusChip color={PAYOUT_STATUS_COLORS[payout.status] ?? 'var(--bui-muted-foreground)'} label={t(`accounting.payoutStatuses.${payout.status}`, payout.status)} />
                  </TableCell>
                  <TableCell className="text-end whitespace-nowrap">
                    <div className="flex items-center justify-end gap-0.5">
                    {payout.status === 'PENDING' && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <BuiButton
                              variant="ghost"
                              size="icon-sm"
                              className="text-primary"
                              aria-label={t('accounting.approve', 'Approuver')}
                              onClick={() => handleApprove(payout.id)}
                              disabled={approveMutation.isPending}
                            >
                              <ApproveIcon size={'1rem'} strokeWidth={1.75} />
                            </BuiButton>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{t('accounting.approve', 'Approuver')}</TooltipContent>
                      </Tooltip>
                    )}
                    {payout.status === 'APPROVED' && (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <BuiButton
                                variant="ghost"
                                size="icon-sm"
                                className="text-primary"
                                aria-label={t('accounting.executePayout', 'Executer le virement')}
                                onClick={() => executeMutation.mutate(payout.id)}
                                disabled={executeMutation.isPending}
                              >
                                {executeMutation.isPending ? (
                                  <Spinner className="size-3.5" />
                                ) : (
                                  <AccountIcon size={'1rem'} strokeWidth={1.75} />
                                )}
                              </BuiButton>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{t('accounting.executePayout', 'Executer le virement')}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <BuiButton
                                variant="ghost"
                                size="icon-sm"
                                className="text-success"
                                aria-label={t('accounting.markPaid', 'Marquer paye')}
                                onClick={() => openPayDialog(payout)}
                                disabled={markPaidMutation.isPending}
                              >
                                <PaidIcon size={'1rem'} strokeWidth={1.75} />
                              </BuiButton>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{t('accounting.markPaid', 'Marquer paye')}</TooltipContent>
                        </Tooltip>
                      </>
                    )}
                    {payout.status === 'PROCESSING' && (
                      <div className="flex items-center gap-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <BuiButton
                                variant="ghost"
                                size="icon-sm"
                                className="text-success"
                                aria-label={t('accounting.markAsPaid', 'Marquer comme payé')}
                                onClick={() => openPayDialog(payout)}
                                disabled={markPaidMutation.isPending}
                              >
                                <PaidIcon size={'1rem'} strokeWidth={1.75} />
                              </BuiButton>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{t('accounting.markAsPaid', 'Marquer comme payé')}</TooltipContent>
                        </Tooltip>
                        {payout.payoutMethod === 'SEPA_TRANSFER' && (
                          <SepaTransferProcedureTooltip placement="left">
                            {/* Le Tooltip MUI pose une ref sur son enfant : le
                                Button du kit ne la transmet pas. */}
                            <span className="inline-flex">
                              <BuiButton
                                variant="ghost"
                                size="icon-sm"
                                aria-label={t('accounting.downloadSepaXml', 'SEPA XML')}
                                onClick={() => handleDownloadSepaXml([payout.id])}
                                disabled={sepaDownloading}
                              >
                                <DownloadIcon size={'1rem'} strokeWidth={1.75} />
                              </BuiButton>
                            </span>
                          </SepaTransferProcedureTooltip>
                        )}
                      </div>
                    )}
                    {payout.status === 'FAILED' && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <BuiButton
                              variant="ghost"
                              size="icon-sm"
                              className="text-warning"
                              aria-label={payout.failureReason ?? t('accounting.failedPayout', 'Echec du reversement')}
                              onClick={() => retryMutation.mutate(payout.id)}
                              disabled={retryMutation.isPending || payout.retryCount >= 3}
                            >
                              {retryMutation.isPending ? (
                                <Spinner className="size-3.5" />
                              ) : (
                                <BuildIcon size={'1rem'} strokeWidth={1.75} />
                              )}
                            </BuiButton>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{payout.failureReason ?? t('accounting.failedPayout', 'Echec du reversement')}</TooltipContent>
                      </Tooltip>
                    )}
                    {payout.status === 'PAID' && payout.paymentReference && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-[0.6875rem] text-muted-foreground cursor-help">
                            {payout.paymentReference}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{`Ref: ${payout.paymentReference}`}</TooltipContent>
                      </Tooltip>
                    )}
                    {/* Detail button — all statuses except PENDING */}
                    {payout.status !== 'PENDING' && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <BuiButton
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t('accounting.viewDetail', 'Voir le détail')}
                            onClick={() => { setDetailPayout(payout); setDetailOpen(true); }}
                          >
                            <VisibilityIcon size={'1rem'} strokeWidth={1.75} />
                          </BuiButton>
                        </TooltipTrigger>
                        <TooltipContent>{t('accounting.viewDetail', 'Voir le détail')}</TooltipContent>
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
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-[444px]">
          <DialogHeader>
            <DialogTitle>
              {t('accounting.payTitle', 'Marquer comme paye')}
            </DialogTitle>
          </DialogHeader>
          {payTarget && (
            <p className="text-[0.8125rem] text-muted-foreground">
              {t('accounting.paySubtitle', 'Payout')} #{payTarget.id} — {fmtCurrency(payTarget.netAmount)}
            </p>
          )}
          <Field>
            <FieldLabel className="text-[0.8125rem]" htmlFor="payout-payment-ref">
              {t('accounting.form.payRef', 'Reference de paiement')}
            </FieldLabel>
            <Input
              id="payout-payment-ref"
              className="w-full text-[0.8125rem]"
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
              placeholder="VIR-2024-001, CB-xxx..."
            />
          </Field>
          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          Detail SEPA Modal
          ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex flex-row items-center gap-1.5">
              <span className="inline-flex text-primary"><AccountIcon size={'1.25rem'} strokeWidth={1.75} /></span>
              {t('accounting.payoutDetail', 'Détail du reversement')}
            </DialogTitle>
          </DialogHeader>
          {detailPayout && (() => {
            const config = configByOwnerId.get(detailPayout.ownerId);
            return (
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
                      <StatusChip tone="info" label={detailPayout.payoutMethod === 'SEPA_TRANSFER' ? 'Virement SEPA' : detailPayout.payoutMethod === 'STRIPE_CONNECT' ? 'Stripe Connect' : 'Manuel'} />
                    </TableCell>
                  </TableRow>
                  <TableRow><TableCell colSpan={2} className={`${DETAIL_CELL_CLASS} pt-[12px]`}><Separator /></TableCell></TableRow>
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
                    <TableCell className={`${DETAIL_CELL_CLASS} text-destructive-ink`}>- {fmtCurrency(detailPayout.commissionAmount)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className={DETAIL_LABEL_CLASS}>Dépenses</TableCell>
                    <TableCell className={detailPayout.expenses > 0 ? `${DETAIL_CELL_CLASS} text-destructive-ink` : `${DETAIL_CELL_CLASS} text-muted-foreground`}>
                      {detailPayout.expenses > 0 ? `- ${fmtCurrency(detailPayout.expenses)}` : fmtCurrency(0)}
                    </TableCell>
                  </TableRow>
                  <TableRow><TableCell colSpan={2} className={DETAIL_CELL_CLASS}><Separator /></TableCell></TableRow>
                  <TableRow>
                    <TableCell className={`${DETAIL_CELL_CLASS} font-bold text-sm`}>Net à virer</TableCell>
                    <TableCell className={`${DETAIL_CELL_CLASS} font-[family-name:var(--font-display)] font-semibold text-sm text-success-ink`}>{fmtCurrency(detailPayout.netAmount)}</TableCell>
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
                      <StatusChip color={PAYOUT_STATUS_COLORS[detailPayout.status] ?? 'var(--bui-muted-foreground)'} label={detailPayout.status} />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            );
          })()}
          <DialogFooter>
            <BuiButton variant="ghost" size="sm" onClick={() => setDetailOpen(false)}>
              {t('common.close', 'Fermer')}
            </BuiButton>
          </DialogFooter>
        </DialogContent>
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

      {/* ── Stats — primitive StatTile ──
          La teinte de statut porte desormais l'ICONE et non le nombre : une
          valeur chiffree est du texte, et la teinte vive n'y tient pas le 4,5:1. */}
      <div className="flex gap-2 mb-2">
        <StatTile
          className="flex-1"
          icon={<AttachMoneyIcon />}
          label={t('accounting.expenses.totalExpenses', 'Total depenses')}
          value={fmtCurrency(stats.total)}
        />
        <StatTile
          className="flex-1"
          icon={<StepCategoryIcon />}
          label={t('accounting.expenses.pendingCount', 'En attente')}
          value={stats.pending}
          iconClassName="text-warning"
        />
        <StatTile
          className="flex-1"
          icon={<ApproveIcon />}
          label={t('accounting.expenses.approvedCount', 'Approuvees')}
          value={stats.approved}
          iconClassName="text-success"
        />
      </div>

      {/* ── Filters + Actions ── */}
      <div className={cn(PANEL_CLASS, 'p-3 mb-[9px] flex gap-3 items-center flex-wrap')}>
        <FilterChipRow
          options={EXPENSE_STATUS_OPTIONS
            .filter((opt) => opt.value !== '')
            .map((opt) => ({
              value: opt.value as ExpenseStatus,
              label: t(opt.labelKey, opt.label),
              color: EXPENSE_STATUS_COLORS[opt.value as ExpenseStatus] ?? 'var(--bui-muted-foreground)',
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
      </div>

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
            <Skeleton key={i} className="h-11 rounded-md" />
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
                    <StatusChip color={EXPENSE_CATEGORY_COLORS[expense.category] ?? 'var(--bui-muted-foreground)'} label={t(`accounting.expenses.categories.${expense.category}`, expense.category)} />
                  </TableCell>
                  <TableCell className={`${CELL_CLASS} text-end font-bold`}>
                    {fmtCurrency(expense.amountTtc, expense.currency)}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusChip color={EXPENSE_STATUS_COLORS[expense.status] ?? 'var(--bui-muted-foreground)'} label={t(`accounting.expenses.statuses.${expense.status}`, expense.status)} />
                  </TableCell>
                  <TableCell className="text-end whitespace-nowrap">
                    {expense.status === 'DRAFT' && (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <BuiButton
                                variant="ghost"
                                size="icon-sm"
                                className="text-primary"
                                aria-label={t('accounting.expenses.approve', 'Approuver')}
                                onClick={() => approveMutation.mutate(expense.id)}
                                disabled={approveMutation.isPending}
                              >
                                <ApproveIcon size={'1rem'} strokeWidth={1.75} />
                              </BuiButton>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{t('accounting.expenses.approve', 'Approuver')}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <BuiButton
                                variant="ghost"
                                size="icon-sm"
                                aria-label={t('accounting.expenses.cancel', 'Annuler')}
                                onClick={() => cancelMutation.mutate(expense.id)}
                                disabled={cancelMutation.isPending}
                              >
                                <CancelIcon size={'1rem'} strokeWidth={1.75} />
                              </BuiButton>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{t('accounting.expenses.cancel', 'Annuler')}</TooltipContent>
                        </Tooltip>
                      </>
                    )}
                    {(expense.status === 'APPROVED' || expense.status === 'INCLUDED') && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <BuiButton
                              variant="ghost"
                              size="icon-sm"
                              className="text-success"
                              aria-label={t('accounting.expenses.markPaid', 'Marquer paye')}
                              onClick={() => openPayDialog(expense)}
                              disabled={payMutation.isPending}
                            >
                              <PaidIcon size={'1rem'} strokeWidth={1.75} />
                            </BuiButton>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{t('accounting.expenses.markPaid', 'Marquer paye')}</TooltipContent>
                      </Tooltip>
                    )}
                    {expense.receiptPath ? (
                      <>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {/* `asChild` : le lien porte lui-meme le gabarit du
                                bouton (l'IconButton MUI faisait `component="a"`). */}
                            <BuiButton
                              asChild
                              variant="ghost"
                              size="icon-sm"
                              className="text-success"
                            >
                              <a
                                href={providerExpensesApi.getReceiptDownloadUrl(expense.id)}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={t('accounting.expenses.viewReceipt', 'Voir justificatif')}
                              >
                                <ReceiptIcon size={'1rem'} strokeWidth={1.75} />
                              </a>
                            </BuiButton>
                          </TooltipTrigger>
                          <TooltipContent>{t('accounting.expenses.viewReceipt', 'Voir justificatif')}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <BuiButton
                                variant="ghost"
                                size="icon-sm"
                                aria-label={t('accounting.expenses.deleteReceipt', 'Supprimer justificatif')}
                                onClick={() => deleteReceiptMutation.mutate(expense.id)}
                                disabled={deleteReceiptMutation.isPending}
                              >
                                <DeleteReceiptIcon size={'1rem'} strokeWidth={1.75} />
                              </BuiButton>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{t('accounting.expenses.deleteReceipt', 'Supprimer justificatif')}</TooltipContent>
                        </Tooltip>
                      </>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <BuiButton
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t('accounting.expenses.uploadReceipt', 'Joindre justificatif')}
                              onClick={() => handleReceiptUpload(expense.id)}
                              disabled={uploadReceiptMutation.isPending}
                            >
                              <AttachFileIcon size={'1rem'} strokeWidth={1.75} />
                            </BuiButton>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{t('accounting.expenses.uploadReceipt', 'Joindre justificatif')}</TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <BuiButton
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t('accounting.expenses.generatePo', 'Bon de commande')}
                          onClick={() => handleGeneratePo(expense)}
                        >
                          <PoIcon size={'1rem'} strokeWidth={1.75} />
                        </BuiButton>
                      </TooltipTrigger>
                      <TooltipContent>{t('accounting.expenses.generatePo', 'Bon de commande')}</TooltipContent>
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
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>
              {t('accounting.expenses.create', 'Nouvelle depense')}
            </DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Field className="flex-1">
              <FieldLabel className="text-[0.8125rem]" htmlFor="expense-provider">
                {t('accounting.expenses.provider', 'Prestataire')}
              </FieldLabel>
              {/* Option vide = etat « rien de choisi » du Select MUI : sans elle
                  le select natif afficherait le premier prestataire alors que
                  l'etat vaut encore undefined. */}
              <NativeSelect
                id="expense-provider"
                className="w-full"
                value={form.providerId != null ? String(form.providerId) : ''}
                onChange={(e) => setForm((prev) => ({ ...prev, providerId: e.target.value === '' ? undefined : Number(e.target.value) }))}
              >
                <option value="" />
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field className="flex-1">
              <FieldLabel className="text-[0.8125rem]" htmlFor="expense-property">
                {t('accounting.expenses.property', 'Logement')}
              </FieldLabel>
              <NativeSelect
                id="expense-property"
                className="w-full"
                value={form.propertyId != null ? String(form.propertyId) : ''}
                onChange={(e) => setForm((prev) => ({ ...prev, propertyId: e.target.value === '' ? undefined : Number(e.target.value) }))}
              >
                <option value="" />
                {properties.map((p: Property) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>

          <Field>
            <FieldLabel className="text-[0.8125rem]" htmlFor="expense-description">
              {t('accounting.expenses.description', 'Description')}
            </FieldLabel>
            <Input
              id="expense-description"
              className="w-full text-[0.8125rem]"
              value={form.description ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </Field>

          <div className="flex gap-2">
            <Field className="flex-1">
              <FieldLabel className="text-[0.8125rem]" htmlFor="expense-amount-ht">
                {t('accounting.expenses.amountHt', 'Montant HT')}
              </FieldLabel>
              <Input
                id="expense-amount-ht"
                type="number"
                className="w-full text-[0.8125rem]"
                value={form.amountHt ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, amountHt: parseFloat(e.target.value) || 0 }))}
              />
            </Field>
            <Field className="w-[120px] shrink-0">
              <FieldLabel className="text-[0.8125rem]" htmlFor="expense-tax-rate">
                {t('accounting.expenses.taxRate', 'TVA %')}
              </FieldLabel>
              <Input
                id="expense-tax-rate"
                type="number"
                min={0}
                max={100}
                step={1}
                className="w-full text-[0.8125rem]"
                value={form.taxRate != null ? (form.taxRate * 100).toFixed(0) : ''}
                onChange={(e) => setForm((prev) => ({ ...prev, taxRate: (parseFloat(e.target.value) || 0) / 100 }))}
              />
            </Field>
            <p className="self-center text-[0.8125rem] font-semibold min-w-[100px]">
              TTC: {fmtCurrency((form.amountHt ?? 0) * (1 + (form.taxRate ?? 0)))}
            </p>
          </div>

          <div className="flex gap-2">
            <Field className="flex-1">
              <FieldLabel className="text-[0.8125rem]" htmlFor="expense-category">
                {t('accounting.expenses.category', 'Categorie')}
              </FieldLabel>
              <NativeSelect
                id="expense-category"
                className="w-full"
                value={form.category ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as ExpenseCategory }))}
              >
                <option value="" />
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>
                    {t(`accounting.expenses.categories.${cat}`, cat)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field className="flex-1">
              <FieldLabel className="text-[0.8125rem]" htmlFor="expense-date">
                {t('accounting.expenses.date', 'Date')}
              </FieldLabel>
              <Input
                id="expense-date"
                type="date"
                className="w-full text-[0.8125rem]"
                value={form.expenseDate ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, expenseDate: e.target.value }))}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel className="text-[0.8125rem]" htmlFor="expense-invoice-ref">
              {t('accounting.expenses.invoiceRef', 'Ref. facture')}
            </FieldLabel>
            <Input
              id="expense-invoice-ref"
              className="w-full text-[0.8125rem]"
              value={form.invoiceReference ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, invoiceReference: e.target.value }))}
            />
          </Field>

          <Field>
            <FieldLabel className="text-[0.8125rem]" htmlFor="expense-notes">
              {t('accounting.expenses.notes', 'Notes')}
            </FieldLabel>
            <Textarea
              id="expense-notes"
              rows={2}
              className="w-full text-[0.8125rem]"
              value={form.notes ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </Field>
          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════════════════
          Mark as Paid Dialog
          ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-[444px]">
          <DialogHeader>
            <DialogTitle>
              {t('accounting.expenses.markPaid', 'Marquer comme paye')}
            </DialogTitle>
          </DialogHeader>
          {payTarget && (
            <p className="text-[0.8125rem] text-muted-foreground">
              {payTarget.description} — {fmtCurrency(payTarget.amountTtc, payTarget.currency)}
            </p>
          )}
          <Field>
            <FieldLabel className="text-[0.8125rem]" htmlFor="expense-payment-ref">
              {t('accounting.expenses.paymentRef', 'Reference de paiement')}
            </FieldLabel>
            <Input
              id="expense-payment-ref"
              className="w-full text-[0.8125rem]"
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
              placeholder="VIR-2024-001, CB-xxx..."
            />
          </Field>
          <DialogFooter>
            <BuiButton variant="ghost" size="sm" onClick={() => setPayOpen(false)}>
              {t('common.cancel', 'Annuler')}
            </BuiButton>
            {/* Idem : action principale de la modale, la teinte succes d'origine
                n'apportait rien de plus que l'emphase. */}
            <BuiButton size="sm" onClick={handleMarkPaid} disabled={payMutation.isPending}>
              {payMutation.isPending ? <Spinner className="size-4" /> : t('accounting.expenses.markPaid', 'Confirmer paiement')}
            </BuiButton>
          </DialogFooter>
        </DialogContent>
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
    icon: <span className="inline-flex text-primary"><AccountIcon size={32} strokeWidth={1.75} /></span>,
    format: 'txt',
    download: (from, to) => accountingExportApi.downloadFec(from, to),
    preview: (from, to) => accountingExportApi.previewFec(from, to),
  },
  {
    key: 'reservations',
    titleKey: 'accounting.exports.reservationsCsv',
    descKey: 'accounting.exports.reservationsCsvDesc',
    icon: <span className="inline-flex text-success"><ListAltIcon size={32} strokeWidth={1.75} /></span>,
    format: 'csv',
    download: (from, to) => accountingExportApi.downloadReservationsCsv(from, to),
    preview: (from, to) => accountingExportApi.previewReservationsCsv(from, to),
  },
  {
    key: 'payouts',
    titleKey: 'accounting.exports.payoutsCsv',
    descKey: 'accounting.exports.payoutsCsvDesc',
    icon: <span className="inline-flex text-info"><AttachMoneyIcon size={32} strokeWidth={1.75} /></span>,
    format: 'csv',
    download: (from, to) => accountingExportApi.downloadPayoutsCsv(from, to),
    preview: (from, to) => accountingExportApi.previewPayoutsCsv(from, to),
  },
  {
    key: 'expenses',
    titleKey: 'accounting.exports.expensesCsv',
    descKey: 'accounting.exports.expensesCsvDesc',
    icon: <span className="inline-flex text-warning"><BuildIcon size={32} strokeWidth={1.75} /></span>,
    format: 'csv',
    download: (from, to) => accountingExportApi.downloadExpensesCsv(from, to),
    preview: (from, to) => accountingExportApi.previewExpensesCsv(from, to),
  },
  {
    key: 'invoices',
    titleKey: 'accounting.exports.invoicesCsv',
    descKey: 'accounting.exports.invoicesCsvDesc',
    icon: <span className="inline-flex text-muted-foreground"><ArticleIcon size={32} strokeWidth={1.75} /></span>,
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
      <div className={cn(PANEL_CLASS, 'p-3 mb-3')}>
        <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-faint">
          {t('accounting.exports.period', 'Periode d\'export')}
        </p>
        <div className="flex gap-3 flex-wrap items-center">
          <Field className="w-auto min-w-[160px]">
            <FieldLabel htmlFor="export-period-from">{t('accounting.exports.from', 'Du')}</FieldLabel>
            <Input
              id="export-period-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field className="w-auto min-w-[160px]">
            <FieldLabel htmlFor="export-period-to">{t('accounting.exports.to', 'Au')}</FieldLabel>
            <Input
              id="export-period-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
        </div>
      </div>

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
            {/* Le sx d'origine ne faisait que redire le gabarit de la carte du
                kit (surface, hairline, rayon) : supprime. */}
            <Card className="h-full gap-0 py-0">
              <CardContent className="flex flex-col h-full p-3">
                <div className="flex items-center gap-2 mb-2">
                  {card.icon}
                  <p className="text-sm font-semibold text-foreground">
                    {t(card.titleKey)}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mb-3 flex-1">
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
