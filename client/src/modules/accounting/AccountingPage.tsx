import { financeEventArtwork } from '../billing/components/financeEventArtwork';
import FinanceWorkspace from '../billing/components/FinanceWorkspace';
import { FinanceAmountKpis } from '../billing/components/FinanceKpis';
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
import StatTileRow from '../../components/baitly/StatTileRow';
import HelpPopover from '../../components/HelpPopover';
import { usePageHeaderActions } from '../../components/PageHeaderActionsContext';
import EmptyState from '../../components/EmptyState';
import { useTranslation } from '../../hooks/useTranslation';
import { propertiesApi } from '../../services/api/propertiesApi';
import type { Property } from '../../services/api/propertiesApi';
import {
  usePayouts,
  useApprovePayout,
  useExecutePayout,
  useRetryPayout,
} from '../../hooks/useAccounting';
import type { OwnerPayout, PayoutStatus } from '../../services/api/accountingApi';
import { PAYOUT_STATUS_COLORS, accountingApi } from '../../services/api/accountingApi';
import { FinanceBatchPanel } from '../payments/FinanceBatchPanel';
import { executeOwnerBatch, ownerBatchItems } from './batchPayouts';
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
import { useNavigate } from 'react-router-dom';
import { useAllOwnerPayoutConfigs } from '../../hooks/useOwnerPayoutConfig';
import PayoutActionResult from './components/PayoutActionResult';
import { Archive, FileSearch, RefreshCw, Send, ExternalLink, Settings2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Money } from '../../components/Money';
import { useHighlightParam, useHighlightTarget } from '../../hooks/useHighlight';
import { activeIntlLocale } from '../../utils/activeLocale';
import GeneratePayoutForm from './components/GeneratePayoutForm';
import { useAuth } from '../../hooks/useAuth';
import BaitlyExpensePayment from './components/BaitlyExpensePayment';
import { getPayoutWorkflow } from './payoutWorkflow';

// ─── Constants ──────────────────────────────────────────────────────────────

const PAYOUT_STATUS_VALUES: (PayoutStatus | '')[] = [
  '', 'PENDING', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED',
];

// Carte/panneau : hairline Baitly UI, r14 (baseline §2 Cartes), aucune ombre.
const PANEL_CLASS = 'rounded-xl border border-solid border-border bg-card';

// Tableaux : la typo / le padding / le filet viennent des primitifs du kit ;
// il ne reste ici que ce que les cellules ajoutent EN PLUS.
const CELL_CLASS = 'tabular-nums';
// Tableau de détail du reversement : mise en page cle/valeur, donc plus serree et sans filet.
const DETAIL_CELL_CLASS = 'py-[4.5px] border-b-0 tabular-nums';
const DETAIL_LABEL_CLASS = `${DETAIL_CELL_CLASS} font-semibold text-muted-foreground`;
// Conteneurs de tableau : meme surface que `PANEL_CLASS`, plus le defilement.
const CARD_CLASS = `overflow-x-auto ${PANEL_CLASS}`;

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString(activeIntlLocale()) : '—';

const fmtPercent = (n: number) => `${(n * 100).toFixed(1)}%`;

function PayoutIconAction({ label, children, ...props }: Omit<React.ComponentProps<typeof BuiButton>, 'size' | 'variant' | 'aria-label'> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <BuiButton {...props} type="button" variant="ghost" size="icon-sm" aria-label={label}>
            {children}
          </BuiButton>
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Payouts Tab
// ═══════════════════════════════════════════════════════════════════════════

export const PayoutsTab: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const payoutStatusLabel = (payout: OwnerPayout) => payout.status === 'PAID'
    ? payout.payoutMethod === 'STRIPE_CONNECT' ? t('accounting.psp.sentState', 'Transféré au PSP')
      : t('accounting.workflow.recordedStatus', 'Payé (historique)')
    : t(`accounting.payoutStatuses.${payout.status}`, payout.status);
  // Un ordre de virement affiche sa devise réelle, jamais une conversion d'affichage.
  const fmtCurrency = (n: number, currency = 'EUR') =>
    new Intl.NumberFormat(activeIntlLocale(), { style: 'currency', currency }).format(n);

  // Filters
  const [filterOwnerId, setFilterOwnerId] = useState<number | ''>('');
  const [filterStatus, setFilterStatus] = useState<PayoutStatus | ''>('');
  const [generateOpen, setGenerateOpen] = useState(false);

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPayout, setDetailPayout] = useState<OwnerPayout | null>(null);

  // Même cache que les paramètres : un changement de PSP est immédiatement repris.
  const { data: payoutConfigs = [] } = useAllOwnerPayoutConfigs();
  const configByOwnerId = useMemo(() => {
    const map = new Map<number, (typeof payoutConfigs)[number]>();
    for (const c of payoutConfigs) map.set(c.ownerId, c);
    return map;
  }, [payoutConfigs]);

  // Data
  const ownerId = filterOwnerId === '' ? undefined : filterOwnerId;
  const status = filterStatus === '' ? undefined : filterStatus;
  const { data: payouts = [], isLoading, isError, refetch: refetchPayouts } = usePayouts(ownerId, status);

  // Deep-link notification (?highlight=<payoutId>) — surligne la ligne ciblee.
  const highlightId = useHighlightParam();
  useHighlightTarget(highlightId, !isLoading && payouts.length > 0);

  // Mutations
  const approveMutation = useApprovePayout();
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
    (id: number) => {
      executeMutation.reset();
      retryMutation.reset();
      approveMutation.mutate(id);
    },
    [approveMutation, executeMutation, retryMutation],
  );

  const helpAction = usePageHeaderActions(
    <>
    <BuiButton size="sm" variant="outline" aria-expanded={generateOpen} aria-controls="payout-generate-panel" onClick={() => setGenerateOpen(open => !open)}>
      <AddIcon />{t('accounting.generateFlow.new', 'Nouveau reversement')}
    </BuiButton>
    <HelpPopover
      label={t('common.help', 'Aide')}
      title={t('accounting.payouts.help.title', 'Comment fonctionnent les payouts ?')}
      description={t('accounting.payouts.help.description', 'Les payouts vous permettent de calculer et suivre les reversements dus a chaque proprietaire.')}
      steps={[
        { icon: <StepGenIcon size={14} strokeWidth={1.75} />, title: t('accounting.payouts.help.step1Title', 'Generer'), description: t('accounting.payouts.help.step1Desc', 'Selectionnez un proprietaire et une periode pour calculer le reversement.'), accent: 'primary' },
        { icon: <StepCalcIcon size={14} strokeWidth={1.75} />, title: t('accounting.payouts.help.step2Title', 'Vérifier'), description: t('accounting.payouts.help.step2Desc', 'Séjours terminés avec encaissements confirmés : revenus − frais OTA − commission − dépenses = montant net.'), accent: 'info' },
        { icon: <StepValidIcon size={14} strokeWidth={1.75} />, title: t('accounting.payouts.help.step3Title', 'Approuver et verser'), description: t('accounting.payouts.help.step3Desc', 'Approuvez le montant, lancez le versement via le PSP puis suivez sa confirmation automatique.'), accent: 'success' },
      ]}
    />
    </>,
  );

  return (
    <>
      {helpAction}
      {!isError && <FinanceAmountKpis kind="payouts" records={payouts.map(row => ({ status: row.status, amount: row.netAmount, currency: row.currency || 'EUR' }))} loading={isLoading} />}

      {[true, false].map(approve => <FinanceBatchPanel key={String(approve)}
        title={t(approve ? 'financeBatch.ownerApprovals' : 'financeBatch.ownerTransfers')}
        actionLabel={t(approve ? 'financeBatch.approve' : 'financeBatch.transfer')}
        disabled={isLoading || isError || approveMutation.isPending || executeMutation.isPending || retryMutation.isPending}
        items={ownerBatchItems(payouts, configByOwnerId, approve)}
        onExecute={async items => {
          const results = await executeOwnerBatch(items, approve);
          await refetchPayouts(); return results;
        }} />)}

      {generateOpen && <div id="payout-generate-panel"><GeneratePayoutForm
        onClose={() => setGenerateOpen(false)}
        onGenerated={payout => {
          setFilterOwnerId('');
          setFilterStatus('');
          setGenerateOpen(false);
          setDetailPayout(payout);
          setDetailOpen(true);
        }}
      /></div>}

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
              label: v === 'PAID' ? t('accounting.workflow.paidFilter', 'Transféré / payé') : t(`accounting.payoutStatuses.${v}`, v),
              color: PAYOUT_STATUS_COLORS[v],
            }))}
          value={filterStatus}
          onChange={(v) => setFilterStatus(v as PayoutStatus | '')}
          allLabel={t('common.all', 'Tous')}
          size="compact"
        />

      </div>

      <p className="mb-3 px-1 text-xs text-muted-foreground">
        {t('accounting.workflow.guide', 'Calcul du montant → Approbation → Versement via le PSP. Approuver ne déclenche aucun paiement.')}
      </p>

      {/* ── Alerts ── */}
      {approveMutation.isError && (
        <BuiAlert variant="destructive" className="mb-2 text-[0.8125rem]">
          <TriangleAlert />
          <AlertDescription>{approveMutation.error?.message
            || t('accounting.approveError', 'Impossible d’approuver ce reversement.')}</AlertDescription>
        </BuiAlert>
      )}
      {approveMutation.isSuccess && (
        <BuiAlert variant="success" className="mb-2 text-[0.8125rem]">
          <CircleCheck />
          <AlertDescription>{t('accounting.workflow.approvedMessage', 'Montant approuvé. Aucun versement n’a été lancé.')}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => approveMutation.reset()}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}
      {executeMutation.isSuccess && executeMutation.data && <PayoutActionResult status={executeMutation.data.status} reason={executeMutation.data.failureReason} onClose={() => executeMutation.reset()} />}
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
      {retryMutation.isSuccess && retryMutation.data && <PayoutActionResult status={retryMutation.data.status} reason={retryMutation.data.failureReason} onClose={() => retryMutation.reset()} />}
      {retryMutation.isError && (
        <BuiAlert variant="destructive" className="mb-2 text-[0.8125rem]">
          <TriangleAlert />
          <AlertDescription>{retryMutation.error?.message
            || t('accounting.retryError', 'Erreur lors de la relance du virement')}</AlertDescription>
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
        <FinanceWorkspace artwork="transfer" selectedId={detailOpen ? detailPayout?.id : undefined} onSelect={id => { setDetailPayout(payouts.find(p => p.id === id) ?? null); setDetailOpen(id !== null); }} items={payouts.map((payout) => {
                const workflow = getPayoutWorkflow(payout, configByOwnerId.get(payout.ownerId));
                return (
                { id: payout.id, eventImage: financeEventArtwork('', 'OWNER_PAYOUT'), title: <>
                    {payout.ownerName ?? `${t('accounting.owner', 'Proprietaire')} #${payout.ownerId}`}
                  </>, amount: <>
                    {fmtCurrency(payout.netAmount, payout.currency)}
                  </>, status: <>
                    <StatusChip color={PAYOUT_STATUS_COLORS[payout.status] ?? 'var(--bui-muted-foreground)'} label={payoutStatusLabel(payout)} />
                    <p className="mt-1 text-[0.6875rem] text-muted-foreground">
                      {t(`accounting.workflow.hints.${workflow.hint}`)}
                    </p>
                  </>, subtitle: <>
                    {fmtDate(payout.periodStart)} → {fmtDate(payout.periodEnd)}
                  </>,  actions: <>
                    <div className="flex items-center justify-end gap-0.5">
                      {(() => {
                        const detailLabel = workflow.blocker === 'legacy'
                          ? t('accounting.psp.legacy', 'Ancienne méthode · consultation')
                          : workflow.blocker === 'funding' ? t('accounting.psp.checkFunding', 'Vérifier les encaissements')
                          : workflow.blocker ? t('accounting.workflow.checkBlocker', 'Comprendre le blocage')
                          : t('accounting.viewDetail', 'Voir le détail');

                        return (
                          <>
                            {workflow.canApprove && (
                              <PayoutIconAction label={t('accounting.approve', 'Approuver')}
                                className="text-primary" onClick={() => handleApprove(payout.id)}
                                disabled={approveMutation.isPending}>
                                <ApproveIcon size={16} strokeWidth={1.75} />
                              </PayoutIconAction>
                            )}
                            {workflow.blocker === 'beneficiary' && hasRole('SUPER_ADMIN') && (
                              <PayoutIconAction label={t('accounting.psp.configure', 'Configurer le PSP')}
                                onClick={() => navigate('/settings?tab=payouts')}>
                                <Settings2 size={16} strokeWidth={1.75} />
                              </PayoutIconAction>
                            )}
                            {(workflow.canSend || workflow.canRetry) && (
                              <PayoutIconAction
                                label={workflow.canRetry ? t('accounting.psp.retry', 'Réessayer le versement') : t('accounting.psp.send', 'Verser via Stripe')}
                                className="text-primary"
                                disabled={executeMutation.isPending || retryMutation.isPending}
                                onClick={() => {
                                  executeMutation.reset(); retryMutation.reset(); approveMutation.reset();
                                  (workflow.canRetry ? retryMutation : executeMutation).mutate(payout.id);
                                }}>
                                {workflow.canRetry ? <RefreshCw size={16} strokeWidth={1.75} /> : <Send size={16} strokeWidth={1.75} />}
                              </PayoutIconAction>
                            )}
                            {workflow.canTrack && (
                              <PayoutIconAction label={t('accounting.psp.track', 'Suivre')}
                                onClick={() => navigate('/billing?tab=payout-tracking')}>
                                <ExternalLink size={16} strokeWidth={1.75} />
                              </PayoutIconAction>
                            )}
                            {/* Un blocage ouvre son explication, sans déclencher de versement. */}
                            <PayoutIconAction label={detailLabel}
                              className={workflow.blocker ? 'text-warning-ink' : undefined}
                              onClick={() => { setDetailPayout(payout); setDetailOpen(true); }}>
                              {workflow.blocker === 'legacy' ? <Archive size={16} strokeWidth={1.75} />
                                : workflow.blocker === 'funding' ? <FileSearch size={16} strokeWidth={1.75} />
                                : workflow.blocker ? <TriangleAlert size={16} strokeWidth={1.75} />
                                : <VisibilityIcon size={16} strokeWidth={1.75} />}
                            </PayoutIconAction>
                          </>
                        );
                      })()}
                    </div>
                  </>, fields: [{label: <>{t('accounting.col.period', 'Periode')}</>, value: <>
                    {fmtDate(payout.periodStart)} → {fmtDate(payout.periodEnd)}
                  </>},{label: <>{t('accounting.col.gross', 'Revenu brut')}</>, value: <>{fmtCurrency(payout.grossRevenue, payout.currency)}</>},{label: <>{t('accounting.col.commission', 'Commission')}</>, value: <>
                    {fmtCurrency(payout.commissionAmount, payout.currency)}{' '}
                    <span className="text-[0.6875rem] text-muted-foreground">
                      ({fmtPercent(payout.commissionRate)})
                    </span>
                  </>},{label: <>{t('accounting.col.expenses', 'Depenses')}</>, value: <>{fmtCurrency(payout.expenses, payout.currency)}</>},{label: <>{t('accounting.col.net', 'Net')}</>, value: <>
                    {fmtCurrency(payout.netAmount, payout.currency)}
                  </>},
                  {label: t('accounting.otaFees', 'Frais OTA'), value: fmtCurrency(payout.otaFees ?? 0, payout.currency)},
                  {label: t('common.method'), value: payout.payoutMethod === 'STRIPE_CONNECT' ? 'Stripe Connect' : payout.payoutMethod ? t('accounting.psp.legacy') : t('accounting.workflow.methodNotRecorded')},
                  {label: t('common.reference'), value: payout.stripeTransferId || payout.paymentReference || '—'},
                  ], detail: <div className="rounded-xl bg-muted p-4 text-sm"><p>{t(`accounting.workflow.details.${workflow.hint}`)}</p><p className="mt-3 text-muted-foreground">{t('accounting.psp.bankHint')}</p>{payout.failureReason && <p className="mt-3 text-warning-ink">{payout.failureReason}</p>}</div>, }
                );
              })}  />
      )}

      {/* Détail du calcul et résultat du PSP. */}

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
  const { user } = useAuth();
  const highlightExpense = useHighlightParam();
  const [selectedExpense, setSelectedExpense] = useState<string | number | null>(highlightExpense);
  useEffect(() => { setSelectedExpense(highlightExpense); }, [highlightExpense]);

  // Filters
  const [filterStatus, setFilterStatus] = useState<ExpenseStatus | ''>('');

  // Dialog
  const [createOpen, setCreateOpen] = useState(false);

  // Form
  const [form, setForm] = useState<Partial<CreateProviderExpenseRequest>>({
    taxRate: 0.2,
    category: 'CLEANING',
    expenseDate: new Date().toISOString().substring(0, 10),
  });

  // Data
  const { data: expenses = [], isLoading, isError } = useQuery({
    queryKey: ['provider-expenses', user?.id, user?.organizationId, filterStatus || undefined],
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

  const purchaseOrderMutation = useMutation({
    mutationFn: async (expense: ProviderExpense) => {
      const document = await documentsApi.generateDocument({
        documentType: 'BON_COMMANDE',
        referenceId: expense.id,
        referenceType: 'PROVIDER_EXPENSE',
        sendEmail: false,
      });
      await documentsApi.downloadGeneration(document.id, document.fileName || 'bon-de-commande.pdf');
    },
  });

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

      {purchaseOrderMutation.isError && <BuiAlert variant="destructive" role="alert">
        <TriangleAlert />
        <AlertDescription>{t('accounting.expenses.purchaseOrderError', 'Impossible de générer ou télécharger le bon de commande. Réessayez ou vérifiez le modèle dans Documents.')}</AlertDescription>
      </BuiAlert>}

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
      {!isError && <FinanceAmountKpis kind="expenses" records={expenses.map(row => ({ status: row.status, amount: row.amountTtc, currency: row.currency }))} loading={isLoading} />}

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
        <FinanceWorkspace artwork="pending" selectedId={selectedExpense} onSelect={setSelectedExpense} items={expenses.map((expense) => (
                { id: expense.id, eventImage: financeEventArtwork(expense.description), identity: { interventionId: expense.interventionId, propertyId: expense.propertyId, propertyName: expense.propertyName, propertyPhoto: properties.find(p => p.id === expense.propertyId)?.coverPhotoUrl, actorName: expense.providerName, actorPhoto: providers.find(p => p.id === expense.providerId)?.profilePictureUrl }, title: <>
                    {expense.description}
                  </>, amount: <>
                    {fmtCurrency(expense.amountTtc, expense.currency)}
                  </>, status: <>
                    <StatusChip color={EXPENSE_STATUS_COLORS[expense.status] ?? 'var(--bui-muted-foreground)'} label={t(`accounting.expenses.statuses.${expense.status}`, expense.status)} />
                  </>, subtitle: <>
                    {fmtDate(expense.expenseDate)}
                  </>, meta: <>{expense.providerName ?? '—'}</>, actions: <>
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
                          onClick={() => purchaseOrderMutation.mutate(expense)}
                          disabled={purchaseOrderMutation.isPending}
                        >
                          <PoIcon size={'1rem'} strokeWidth={1.75} />
                        </BuiButton>
                      </TooltipTrigger>
                      <TooltipContent>{t('accounting.expenses.generatePo', 'Bon de commande')}</TooltipContent>
                    </Tooltip>
                  </>, fields: [{label: <>{t('accounting.expenses.date', 'Date')}</>, value: <>
                    {fmtDate(expense.expenseDate)}
                  </>},{label: <>{t('accounting.expenses.provider', 'Prestataire')}</>, value: <>{expense.providerName ?? '—'}</>},{label: <>{t('accounting.expenses.property', 'Logement')}</>, value: <>{expense.propertyName ?? '—'}</>},{label: <>{t('accounting.expenses.category', 'Categorie')}</>, value: <>
                    <StatusChip color={EXPENSE_CATEGORY_COLORS[expense.category] ?? 'var(--bui-muted-foreground)'} label={t(`accounting.expenses.categories.${expense.category}`, expense.category)} />
                  </>},{label: <>{t('accounting.expenses.amountTtc', 'Montant TTC')}</>, value: <>
                    {fmtCurrency(expense.amountTtc, expense.currency)}
                  </>}], detail: <BaitlyExpensePayment key={expense.id} expense={expense} />, }
              ))}  />
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
      <FinanceWorkspace items={EXPORT_CARDS.map(card => ({ id: card.key, title: t(card.titleKey), status: <StatusChip label={card.format.toUpperCase()} tone="neutral" />, fields: [
  { label: t('common.description', 'Description'), value: t(card.descKey) },
  { label: t('common.period'), value: from + ' → ' + to },
], actions: <>
  <PayoutIconAction label={t('common.view')} disabled={!from || !to || from > to || loadingKey !== null} onClick={() => void handlePreview(card)}><VisibilityIcon size={17} /></PayoutIconAction>
  <PayoutIconAction label={t('accounting.exports.download')} disabled={!from || !to || from > to || loadingKey !== null} onClick={() => void handleDownload(card)}>{loadingKey === card.key ? <Spinner className="size-4" /> : <DownloadIcon size={17} />}</PayoutIconAction>
</> }))} />

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
