import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Box, Paper, Typography, Button, Chip, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Select, FormControl, InputLabel, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tabs, Tab, Card, CardContent, Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  CheckCircle as ApproveIcon,
  Payment as PaidIcon,
  AccountBalance as AccountIcon,
  Save as SaveIcon,
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
import PageHeader from '../../components/PageHeader';
import HelpBanner from '../../components/HelpBanner';
import { useTranslation } from '../../hooks/useTranslation';
import { useSearchParams } from 'react-router-dom';
import { SPACING } from '../../theme/spacing';
import { propertiesApi } from '../../services/api/propertiesApi';
import type { Property } from '../../services/api/propertiesApi';
import {
  usePayouts,
  useApprovePayout,
  useMarkAsPaid,
  useExecutePayout,
  useRetryPayout,
  useCommissions,
  useSaveCommission,
} from '../../hooks/useAccounting';
import type { OwnerPayout, OwnerPayoutConfig, ChannelCommission, PayoutStatus } from '../../services/api/accountingApi';
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
import FiscalReportSection from '../reports/FiscalReportSection';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrency } from '../../hooks/useCurrency';

// ─── Constants ──────────────────────────────────────────────────────────────

const PAYOUT_STATUS_VALUES: (PayoutStatus | '')[] = [
  '', 'PENDING', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED',
];

const CARD_SX = {
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
  borderRadius: 1.5,
} as const;

const CELL_SX = { fontSize: '0.8125rem', py: 1.25 } as const;
const HEAD_CELL_SX = { fontSize: '0.75rem', fontWeight: 700, py: 1, color: 'text.secondary' } as const;

const TAB_SX = { textTransform: 'none', fontSize: '0.8125rem', fontWeight: 600, minHeight: 40 } as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '—';

const fmtPercent = (n: number) => `${(n * 100).toFixed(1)}%`;

// ─── Component ──────────────────────────────────────────────────────────────

const AccountingPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = parseInt(searchParams.get('tab') || '0', 10);
  const [activeTab, setActiveTab] = useState(isNaN(tabParam) ? 0 : tabParam);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setSearchParams(newValue === 0 ? {} : { tab: String(newValue) }, { replace: true });
  };

  return (
    <Box sx={{ p: SPACING.PAGE_PADDING }}>
      <PageHeader
        title={t('accounting.title', 'Comptabilite')}
        subtitle={t('accounting.subtitle', 'Payouts proprietaires et commissions channels')}
        showBackButton={false}
        backPath="/dashboard"
      />

      <Paper sx={{ ...CARD_SX, mb: 1.5 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}
        >
          <Tab label={t('accounting.tabs.payouts', 'Payouts')} sx={TAB_SX} />
          <Tab label={t('accounting.tabs.commissions', 'Commissions')} sx={TAB_SX} />
          <Tab label={t('accounting.tabs.expenses', 'Depenses')} sx={TAB_SX} />
          <Tab label={t('accounting.tabs.fiscalReport', 'Rapport fiscal')} sx={TAB_SX} />
          <Tab label={t('accounting.tabs.exports', 'Exports')} sx={TAB_SX} />
        </Tabs>
      </Paper>

      {activeTab === 0 && <PayoutsTab />}
      {activeTab === 1 && <CommissionsTab />}
      {activeTab === 2 && <ExpensesTab />}
      {activeTab === 3 && <FiscalReportSection />}
      {activeTab === 4 && <ExportsTab />}
    </Box>
  );
};

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

  return (
    <>
      <HelpBanner
        storageKey="clenzy_payouts_help_dismissed"
        title={t('accounting.payouts.help.title', 'Comment fonctionnent les payouts ?')}
        description={t('accounting.payouts.help.description', 'Les payouts vous permettent de calculer et suivre les reversements dus a chaque proprietaire.')}
        dismissLabel={t('accounting.payouts.help.dismiss', 'Ne plus afficher')}
        steps={[
          { icon: <StepGenIcon size={16} strokeWidth={1.75} />, title: t('accounting.payouts.help.step1Title', 'Generer'), description: t('accounting.payouts.help.step1Desc', 'Selectionnez un proprietaire et une periode pour calculer le reversement.') },
          { icon: <StepCalcIcon size={16} strokeWidth={1.75} />, title: t('accounting.payouts.help.step2Title', 'Verifier'), description: t('accounting.payouts.help.step2Desc', 'Le systeme calcule : revenus - commission - depenses = montant net.') },
          { icon: <StepValidIcon size={16} strokeWidth={1.75} />, title: t('accounting.payouts.help.step3Title', 'Valider & Payer'), description: t('accounting.payouts.help.step3Desc', 'Approuvez le payout puis marquez-le comme paye apres le virement.') },
        ]}
      />

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

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {PAYOUT_STATUS_VALUES.map((val) => (
            <Chip
              key={val}
              label={val === '' ? t('common.all', 'Tous') : t(`accounting.payoutStatuses.${val}`, val)}
              size="small"
              variant={filterStatus === val ? 'filled' : 'outlined'}
              onClick={() => setFilterStatus(val as PayoutStatus | '')}
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                ...(filterStatus === val && val !== ''
                  ? { backgroundColor: PAYOUT_STATUS_COLORS[val as PayoutStatus], color: '#fff' }
                  : {}),
              }}
            />
          ))}
        </Box>

        {sepaError && (
          <Alert severity="error" sx={{ fontSize: '0.8125rem' }} onClose={() => setSepaError(null)}>
            {sepaError}
          </Alert>
        )}

        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          {processingSepaPayouts.length > 0 && (
            <Button
              size="small"
              variant="outlined"
              startIcon={sepaDownloading ? <CircularProgress size={14} /> : <DownloadIcon />}
              onClick={() => handleDownloadSepaXml(processingSepaPayouts.map((p) => p.id))}
              disabled={sepaDownloading}
              sx={{ textTransform: 'none', fontSize: '0.75rem' }}
            >
              {t('accounting.downloadSepaXml', 'SEPA XML')} ({processingSepaPayouts.length})
            </Button>
          )}
        </Box>
      </Paper>

      {/* ── Alerts ── */}
      {approveMutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 1.5, fontSize: '0.8125rem' }} onClose={() => approveMutation.reset()}>
          {t('accounting.approveSuccess', 'Payout approuve')}
        </Alert>
      )}
      {executeMutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 1.5, fontSize: '0.8125rem' }} onClose={() => executeMutation.reset()}>
          {t('accounting.executeSuccess', 'Virement execute avec succes')}
        </Alert>
      )}
      {executeMutation.isError && (
        <Alert severity="error" sx={{ mb: 1.5, fontSize: '0.8125rem' }} onClose={() => executeMutation.reset()}>
          {(executeMutation.error as { message?: string })?.message
            || t('accounting.executeError', 'Erreur lors de l\'execution du virement')}
        </Alert>
      )}
      {retryMutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 1.5, fontSize: '0.8125rem' }} onClose={() => retryMutation.reset()}>
          {t('accounting.retrySuccess', 'Relance effectuee avec succes')}
        </Alert>
      )}
      {retryMutation.isError && (
        <Alert severity="error" sx={{ mb: 1.5, fontSize: '0.8125rem' }} onClose={() => retryMutation.reset()}>
          {t('accounting.retryError', 'Erreur lors de la relance du virement')}
        </Alert>
      )}
      {markPaidMutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 1.5, fontSize: '0.8125rem' }} onClose={() => markPaidMutation.reset()}>
          {t('accounting.paidSuccess', 'Payout marque comme paye')}
        </Alert>
      )}

      {/* ── Table ── */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      ) : isError ? (
        <Alert severity="error" sx={{ fontSize: '0.8125rem' }}>
          {t('accounting.error', 'Erreur lors du chargement des payouts')}
        </Alert>
      ) : payouts.length === 0 ? (
        <Paper sx={{ ...CARD_SX, p: 4, textAlign: 'center' }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled', mb: 1 }}><AccountIcon size={48} strokeWidth={1.75} /></Box>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>
            {t('accounting.payouts.emptyTitle', 'Aucun payout trouve')}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 2, maxWidth: 400, mx: 'auto' }}>
            {t(
              'accounting.payouts.emptyDescription',
              'Generez votre premier payout pour calculer le reversement du a un proprietaire.',
            )}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', maxWidth: 400, mx: 'auto' }}>
            {t('accounting.payouts.emptyAutoHint', 'Les payouts sont generes automatiquement selon la planification configuree dans les parametres.')}
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={CARD_SX}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={HEAD_CELL_SX}>{t('accounting.col.owner', 'Proprietaire')}</TableCell>
                <TableCell sx={HEAD_CELL_SX}>{t('accounting.col.period', 'Periode')}</TableCell>
                <TableCell sx={HEAD_CELL_SX} align="right">{t('accounting.col.gross', 'Revenu brut')}</TableCell>
                <TableCell sx={HEAD_CELL_SX} align="right">{t('accounting.col.commission', 'Commission')}</TableCell>
                <TableCell sx={HEAD_CELL_SX} align="right">{t('accounting.col.expenses', 'Depenses')}</TableCell>
                <TableCell sx={HEAD_CELL_SX} align="right">{t('accounting.col.net', 'Net')}</TableCell>
                <TableCell sx={HEAD_CELL_SX} align="center">{t('accounting.col.status', 'Status')}</TableCell>
                <TableCell sx={HEAD_CELL_SX} align="right">{t('common.actions', 'Actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payouts.map((payout) => (
                <TableRow key={payout.id} hover>
                  <TableCell sx={CELL_SX}>
                    {payout.ownerName ?? `${t('accounting.owner', 'Proprietaire')} #${payout.ownerId}`}
                  </TableCell>
                  <TableCell sx={{ ...CELL_SX, fontSize: '0.75rem' }}>
                    {fmtDate(payout.periodStart)} → {fmtDate(payout.periodEnd)}
                  </TableCell>
                  <TableCell sx={CELL_SX} align="right">{fmtCurrency(payout.grossRevenue)}</TableCell>
                  <TableCell sx={CELL_SX} align="right">
                    {fmtCurrency(payout.commissionAmount)}{' '}
                    <Typography component="span" sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                      ({fmtPercent(payout.commissionRate)})
                    </Typography>
                  </TableCell>
                  <TableCell sx={CELL_SX} align="right">{fmtCurrency(payout.expenses)}</TableCell>
                  <TableCell sx={{ ...CELL_SX, fontWeight: 700 }} align="right">
                    {fmtCurrency(payout.netAmount)}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={t(`accounting.payoutStatuses.${payout.status}`, payout.status)}
                      size="small"
                      sx={{
                        fontSize: '0.625rem',
                        height: 20,
                        fontWeight: 700,
                        backgroundColor: PAYOUT_STATUS_COLORS[payout.status] ?? '#9e9e9e',
                        color: '#fff',
                      }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.25 }}>
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
                              <CircularProgress size={14} />
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
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
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
                          <Tooltip title={t('accounting.downloadSepaXml', 'SEPA XML')}>
                            <IconButton
                              size="small"
                              onClick={() => handleDownloadSepaXml([payout.id])}
                              disabled={sepaDownloading}
                            >
                              <DownloadIcon size={'1rem'} strokeWidth={1.75} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
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
                            <CircularProgress size={14} />
                          ) : (
                            <BuildIcon size={'1rem'} strokeWidth={1.75} />
                          )}
                        </IconButton>
                      </Tooltip>
                    )}
                    {payout.status === 'PAID' && payout.paymentReference && (
                      <Tooltip title={`Ref: ${payout.paymentReference}`}>
                        <Typography
                          component="span"
                          sx={{ fontSize: '0.6875rem', color: 'text.secondary', cursor: 'help' }}
                        >
                          {payout.paymentReference}
                        </Typography>
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
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          Mark as Paid Dialog
          ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={payOpen}
        onClose={() => setPayOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontSize: '0.9375rem', fontWeight: 700 }}>
          {t('accounting.payTitle', 'Marquer comme paye')}
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          {payTarget && (
            <Typography sx={{ fontSize: '0.8125rem', mb: 2, color: 'text.secondary' }}>
              {t('accounting.paySubtitle', 'Payout')} #{payTarget.id} — {fmtCurrency(payTarget.netAmount)}
            </Typography>
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
          <Button onClick={() => setPayOpen(false)} size="small" sx={{ textTransform: 'none', fontSize: '0.8125rem' }}>
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button
            variant="contained"
            size="small"
            color="success"
            onClick={handleMarkPaid}
            disabled={markPaidMutation.isPending || !payRef.trim()}
            sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
          >
            {markPaidMutation.isPending ? <CircularProgress size={16} /> : t('accounting.confirmPaid', 'Confirmer paiement')}
          </Button>
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
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontSize: '0.9375rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}><AccountIcon size={'1.25rem'} strokeWidth={1.75} /></Box>
          {t('accounting.payoutDetail', 'Détail du reversement')}
        </DialogTitle>
        {detailPayout && (() => {
          const config = configByOwnerId.get(detailPayout.ownerId);
          return (
            <DialogContent sx={{ pt: '8px !important' }}>
              <Table size="small" sx={{ '& td, & th': { fontSize: '0.8125rem', py: 0.75, border: 'none' } }}>
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', width: 160 }}>Bénéficiaire</TableCell>
                    <TableCell>{config?.bankAccountHolder || detailPayout.ownerName || '—'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>IBAN</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', letterSpacing: 1 }}>{config?.maskedIban || '—'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>BIC</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{config?.bic || '—'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Méthode</TableCell>
                    <TableCell>
                      <Chip
                        label={detailPayout.payoutMethod === 'SEPA_TRANSFER' ? 'Virement SEPA' : detailPayout.payoutMethod === 'STRIPE_CONNECT' ? 'Stripe Connect' : 'Manuel'}
                        size="small"
                        sx={{ fontSize: '0.6875rem', height: 22 }}
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow><TableCell colSpan={2} sx={{ pt: '12px !important' }}><Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} /></TableCell></TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Période</TableCell>
                    <TableCell>{detailPayout.periodStart} → {detailPayout.periodEnd}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Revenu brut</TableCell>
                    <TableCell>{fmtCurrency(detailPayout.grossRevenue)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Commission ({(detailPayout.commissionRate * 100).toFixed(1)}%)</TableCell>
                    <TableCell sx={{ color: 'error.main' }}>- {fmtCurrency(detailPayout.commissionAmount)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Dépenses</TableCell>
                    <TableCell sx={{ color: detailPayout.expenses > 0 ? 'error.main' : 'text.secondary' }}>
                      {detailPayout.expenses > 0 ? `- ${fmtCurrency(detailPayout.expenses)}` : fmtCurrency(0)}
                    </TableCell>
                  </TableRow>
                  <TableRow><TableCell colSpan={2}><Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }} /></TableCell></TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Net à virer</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.875rem', color: 'success.main' }}>{fmtCurrency(detailPayout.netAmount)}</TableCell>
                  </TableRow>
                  {detailPayout.paymentReference && (
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Réf. paiement</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{detailPayout.paymentReference}</TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary' }}>Statut</TableCell>
                    <TableCell>
                      <Chip
                        label={detailPayout.status}
                        size="small"
                        sx={{ fontSize: '0.6875rem', height: 22, bgcolor: PAYOUT_STATUS_COLORS[detailPayout.status], color: '#fff' }}
                      />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </DialogContent>
          );
        })()}
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDetailOpen(false)} size="small" sx={{ textTransform: 'none', fontSize: '0.8125rem' }}>
            {t('common.close', 'Fermer')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  Commissions Tab
// ═══════════════════════════════════════════════════════════════════════════

export const CommissionsTab: React.FC = () => {
  const { t } = useTranslation();
  const { data: commissions = [], isLoading, isError } = useCommissions();
  const saveMutation = useSaveCommission();

  const [editRates, setEditRates] = useState<Record<string, string>>({});
  const [savedChannel, setSavedChannel] = useState<string | null>(null);

  // Init edit rates from data
  React.useEffect(() => {
    if (commissions.length > 0 && Object.keys(editRates).length === 0) {
      const rates: Record<string, string> = {};
      for (const c of commissions) {
        rates[c.channelName] = String(c.commissionRate);
      }
      setEditRates(rates);
    }
  }, [commissions, editRates]);

  const handleSave = useCallback(
    async (commission: ChannelCommission) => {
      const newRate = parseFloat(editRates[commission.channelName] ?? '0');
      if (isNaN(newRate) || newRate < 0 || newRate > 100) return;
      await saveMutation.mutateAsync({
        channel: commission.channelName,
        data: { ...commission, commissionRate: newRate },
      });
      setSavedChannel(commission.channelName);
      setTimeout(() => setSavedChannel(null), 2000);
    },
    [editRates, saveMutation],
  );

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert severity="error" sx={{ fontSize: '0.8125rem' }}>
        {t('accounting.commissionError', 'Erreur lors du chargement des commissions')}
      </Alert>
    );
  }

  if (commissions.length === 0) {
    return (
      <Paper sx={{ ...CARD_SX, p: 4, textAlign: 'center' }}>
        <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled', mb: 1 }}><AccountIcon size={48} strokeWidth={1.75} /></Box>
        <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
          {t('accounting.emptyCommissions', 'Aucune commission configuree')}
        </Typography>
      </Paper>
    );
  }

  return (
    <>
    <HelpBanner
      storageKey="clenzy_commissions_help_dismissed"
      title={t('accounting.commissions.help.title', 'Comment fonctionnent les commissions ?')}
      description={t('accounting.commissions.help.description', 'Les commissions representent le pourcentage preleve par chaque canal de reservation (Airbnb, Booking...) sur vos revenus.')}
      dismissLabel={t('accounting.commissions.help.dismiss', 'Ne plus afficher')}
      steps={[
        { icon: <StepRevenueIcon size={16} strokeWidth={1.75} />, title: t('accounting.commissions.help.step1Title', 'Canaux'), description: t('accounting.commissions.help.step1Desc', 'Chaque plateforme (Airbnb, Booking...) applique un taux de commission different.') },
        { icon: <StepPercentIcon size={16} strokeWidth={1.75} />, title: t('accounting.commissions.help.step2Title', 'Configurer'), description: t('accounting.commissions.help.step2Desc', 'Ajustez le taux de commission pour chaque canal selon votre contrat.') },
        { icon: <StepCalcIcon size={16} strokeWidth={1.75} />, title: t('accounting.commissions.help.step3Title', 'Impact'), description: t('accounting.commissions.help.step3Desc', 'Les commissions sont deduites automatiquement lors du calcul des payouts proprietaires.') },
      ]}
    />
    <TableContainer component={Paper} sx={CARD_SX}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={HEAD_CELL_SX}>{t('accounting.col.channel', 'Channel')}</TableCell>
            <TableCell sx={HEAD_CELL_SX} align="center">{t('accounting.col.rate', 'Taux (%)')}</TableCell>
            <TableCell sx={HEAD_CELL_SX} align="right">{t('common.actions', 'Actions')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {commissions.map((c) => {
            const channelColors: Record<string, string> = { AIRBNB: '#FF5A5F', BOOKING: '#003580' };
            return (
              <TableRow key={c.channelName} hover>
                <TableCell sx={CELL_SX}>
                  <Chip
                    label={c.channelName}
                    size="small"
                    sx={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      backgroundColor: channelColors[c.channelName] ?? '#666',
                      color: '#fff',
                      height: 22,
                    }}
                  />
                </TableCell>
                <TableCell align="center" sx={CELL_SX}>
                  <TextField
                    type="number"
                    size="small"
                    value={editRates[c.channelName] ?? c.commissionRate}
                    onChange={(e) =>
                      setEditRates((prev) => ({ ...prev, [c.channelName]: e.target.value }))
                    }
                    inputProps={{ min: 0, max: 100, step: 0.5, style: { textAlign: 'center' } }}
                    sx={{ width: 100 }}
                    InputProps={{ sx: { fontSize: '0.8125rem' } }}
                  />
                </TableCell>
                <TableCell align="right" sx={CELL_SX}>
                  {savedChannel === c.channelName ? (
                    <Chip label={t('common.saved', 'Sauvegarde')} size="small" color="success" sx={{ fontSize: '0.6875rem', height: 22 }} />
                  ) : (
                    <Tooltip title={t('common.save', 'Enregistrer')}>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleSave(c)}
                        disabled={saveMutation.isPending}
                      >
                        <SaveIcon size={'1rem'} strokeWidth={1.75} />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
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

export const ExpensesTab: React.FC = () => {
  const { t } = useTranslation();
  const { convertAndFormat } = useCurrency();
  const fmtCurrency = (n: number, currency = 'EUR') => convertAndFormat(n, currency);
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
  const [receiptTargetId, setReceiptTargetId] = useState<number | null>(null);

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
    setReceiptTargetId(expenseId);
    receiptInputRef.current?.click();
  }, []);

  const handleReceiptFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && receiptTargetId != null) {
      uploadReceiptMutation.mutate({ id: receiptTargetId, file });
    }
    // Reset input pour permettre de re-uploader le meme fichier
    e.target.value = '';
    setReceiptTargetId(null);
  }, [receiptTargetId, uploadReceiptMutation]);

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

  return (
    <>
      <HelpBanner
        storageKey="clenzy_expenses_help_dismissed"
        title={t('accounting.expenses.help.title', 'Comment fonctionnent les depenses ?')}
        description={t('accounting.expenses.help.description', 'Suivez et gerez les depenses des prestataires (menage, maintenance...) liees a vos logements.')}
        dismissLabel={t('accounting.expenses.help.dismiss', 'Ne plus afficher')}
        steps={[
          { icon: <StepGenIcon size={16} strokeWidth={1.75} />, title: t('accounting.expenses.help.step1Title', 'Creer'), description: t('accounting.expenses.help.step1Desc', 'Ajoutez une depense avec le prestataire, le logement, le montant et la categorie.') },
          { icon: <StepCategoryIcon size={16} strokeWidth={1.75} />, title: t('accounting.expenses.help.step2Title', 'Approuver'), description: t('accounting.expenses.help.step2Desc', 'Validez les depenses en brouillon. Joignez un justificatif (PDF, photo).') },
          { icon: <StepCalcIcon size={16} strokeWidth={1.75} />, title: t('accounting.expenses.help.step3Title', 'Deduire'), description: t('accounting.expenses.help.step3Desc', 'Les depenses approuvees sont automatiquement deduites des payouts proprietaires.') },
        ]}
      />

      {/* Hidden file input for receipt upload */}
      <input
        ref={receiptInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        style={{ display: 'none' }}
        onChange={handleReceiptFileChange}
      />

      {/* ── Stats ── */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
        <Paper sx={{ ...CARD_SX, p: 2, flex: 1, textAlign: 'center' }}>
          <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', mb: 0.5 }}>
            {t('accounting.expenses.totalExpenses', 'Total depenses')}
          </Typography>
          <Typography sx={{ fontSize: '1.125rem', fontWeight: 700 }}>
            {fmtCurrency(stats.total)}
          </Typography>
        </Paper>
        <Paper sx={{ ...CARD_SX, p: 2, flex: 1, textAlign: 'center' }}>
          <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', mb: 0.5 }}>
            {t('accounting.expenses.pendingCount', 'En attente')}
          </Typography>
          <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: EXPENSE_STATUS_COLORS.DRAFT }}>
            {stats.pending}
          </Typography>
        </Paper>
        <Paper sx={{ ...CARD_SX, p: 2, flex: 1, textAlign: 'center' }}>
          <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', mb: 0.5 }}>
            {t('accounting.expenses.approvedCount', 'Approuvees')}
          </Typography>
          <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: EXPENSE_STATUS_COLORS.APPROVED }}>
            {stats.approved}
          </Typography>
        </Paper>
      </Box>

      {/* ── Filters + Actions ── */}
      <Paper sx={{ ...CARD_SX, p: 2, mb: 1.5, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {EXPENSE_STATUS_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              label={t(opt.labelKey, opt.label)}
              size="small"
              variant={filterStatus === opt.value ? 'filled' : 'outlined'}
              onClick={() => setFilterStatus(opt.value as ExpenseStatus | '')}
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                ...(filterStatus === opt.value && opt.value !== ''
                  ? { backgroundColor: EXPENSE_STATUS_COLORS[opt.value as ExpenseStatus], color: '#fff' }
                  : {}),
              }}
            />
          ))}
        </Box>

        <Box sx={{ ml: 'auto' }}>
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
          >
            {t('accounting.expenses.create', 'Nouvelle depense')}
          </Button>
        </Box>
      </Paper>

      {/* ── Alerts ── */}
      {createMutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 1.5, fontSize: '0.8125rem' }} onClose={() => createMutation.reset()}>
          {t('accounting.expenses.createSuccess', 'Depense creee avec succes')}
        </Alert>
      )}
      {approveMutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 1.5, fontSize: '0.8125rem' }} onClose={() => approveMutation.reset()}>
          {t('accounting.expenses.approveSuccess', 'Depense approuvee')}
        </Alert>
      )}
      {cancelMutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 1.5, fontSize: '0.8125rem' }} onClose={() => cancelMutation.reset()}>
          {t('accounting.expenses.cancelSuccess', 'Depense annulee')}
        </Alert>
      )}
      {payMutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 1.5, fontSize: '0.8125rem' }} onClose={() => payMutation.reset()}>
          {t('accounting.expenses.paidSuccess', 'Depense marquee comme payee')}
        </Alert>
      )}
      {uploadReceiptMutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 1.5, fontSize: '0.8125rem' }} onClose={() => uploadReceiptMutation.reset()}>
          {t('accounting.expenses.receiptUploaded', 'Justificatif ajoute')}
        </Alert>
      )}
      {uploadReceiptMutation.isError && (
        <Alert severity="error" sx={{ mb: 1.5, fontSize: '0.8125rem' }} onClose={() => uploadReceiptMutation.reset()}>
          {t('accounting.expenses.receiptUploadError', 'Erreur lors de l\'upload du justificatif')}
        </Alert>
      )}

      {/* ── Table ── */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      ) : isError ? (
        <Alert severity="error" sx={{ fontSize: '0.8125rem' }}>
          {t('accounting.expenses.error', 'Erreur lors du chargement des depenses')}
        </Alert>
      ) : expenses.length === 0 ? (
        <Paper sx={{ ...CARD_SX, p: 4, textAlign: 'center' }}>
          <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled', mb: 1 }}><AccountIcon size={48} strokeWidth={1.75} /></Box>
          <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
            {t('accounting.expenses.empty', 'Aucune depense prestataire')}
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={CARD_SX}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={HEAD_CELL_SX}>{t('accounting.expenses.date', 'Date')}</TableCell>
                <TableCell sx={HEAD_CELL_SX}>{t('accounting.expenses.provider', 'Prestataire')}</TableCell>
                <TableCell sx={HEAD_CELL_SX}>{t('accounting.expenses.property', 'Logement')}</TableCell>
                <TableCell sx={HEAD_CELL_SX}>{t('accounting.expenses.description', 'Description')}</TableCell>
                <TableCell sx={HEAD_CELL_SX} align="center">{t('accounting.expenses.category', 'Categorie')}</TableCell>
                <TableCell sx={HEAD_CELL_SX} align="right">{t('accounting.expenses.amountTtc', 'Montant TTC')}</TableCell>
                <TableCell sx={HEAD_CELL_SX} align="center">{t('accounting.expenses.status', 'Statut')}</TableCell>
                <TableCell sx={HEAD_CELL_SX} align="right">{t('common.actions', 'Actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id} hover>
                  <TableCell sx={{ ...CELL_SX, fontSize: '0.75rem' }}>
                    {fmtDate(expense.expenseDate)}
                  </TableCell>
                  <TableCell sx={CELL_SX}>{expense.providerName ?? '—'}</TableCell>
                  <TableCell sx={CELL_SX}>{expense.propertyName ?? '—'}</TableCell>
                  <TableCell sx={{ ...CELL_SX, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {expense.description}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={t(`accounting.expenses.categories.${expense.category}`, expense.category)}
                      size="small"
                      sx={{
                        fontSize: '0.625rem',
                        height: 20,
                        fontWeight: 700,
                        backgroundColor: EXPENSE_CATEGORY_COLORS[expense.category] ?? '#666',
                        color: '#fff',
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ ...CELL_SX, fontWeight: 700 }} align="right">
                    {fmtCurrency(expense.amountTtc, expense.currency)}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={t(`accounting.expenses.statuses.${expense.status}`, expense.status)}
                      size="small"
                      sx={{
                        fontSize: '0.625rem',
                        height: 20,
                        fontWeight: 700,
                        backgroundColor: EXPENSE_STATUS_COLORS[expense.status] ?? '#9e9e9e',
                        color: '#fff',
                      }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
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
        </TableContainer>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          Create Expense Dialog
          ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontSize: '0.9375rem', fontWeight: 700 }}>
          {t('accounting.expenses.create', 'Nouvelle depense')}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
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
          </Box>

          <TextField
            label={t('accounting.expenses.description', 'Description')}
            size="small"
            fullWidth
            value={form.description ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            InputProps={{ sx: { fontSize: '0.8125rem' } }}
            InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
          />

          <Box sx={{ display: 'flex', gap: 1.5 }}>
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
            <Typography sx={{ alignSelf: 'center', fontSize: '0.8125rem', fontWeight: 600, minWidth: 100 }}>
              TTC: {fmtCurrency((form.amountHt ?? 0) * (1 + (form.taxRate ?? 0)))}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5 }}>
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
          </Box>

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
          <Button onClick={() => setCreateOpen(false)} size="small" sx={{ textTransform: 'none', fontSize: '0.8125rem' }}>
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleCreate}
            disabled={createMutation.isPending || !form.providerId || !form.propertyId || !form.description || !form.amountHt}
            sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
          >
            {createMutation.isPending ? <CircularProgress size={16} /> : t('common.save', 'Enregistrer')}
          </Button>
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
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontSize: '0.9375rem', fontWeight: 700 }}>
          {t('accounting.expenses.markPaid', 'Marquer comme paye')}
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          {payTarget && (
            <Typography sx={{ fontSize: '0.8125rem', mb: 2, color: 'text.secondary' }}>
              {payTarget.description} — {fmtCurrency(payTarget.amountTtc, payTarget.currency)}
            </Typography>
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
          <Button onClick={() => setPayOpen(false)} size="small" sx={{ textTransform: 'none', fontSize: '0.8125rem' }}>
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button
            variant="contained"
            size="small"
            color="success"
            onClick={handleMarkPaid}
            disabled={payMutation.isPending}
            sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
          >
            {payMutation.isPending ? <CircularProgress size={16} /> : t('accounting.expenses.markPaid', 'Confirmer paiement')}
          </Button>
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
    icon: <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}><AccountIcon size={32} strokeWidth={1.75} /></Box>,
    format: 'txt',
    download: (from, to) => accountingExportApi.downloadFec(from, to),
    preview: (from, to) => accountingExportApi.previewFec(from, to),
  },
  {
    key: 'reservations',
    titleKey: 'accounting.exports.reservationsCsv',
    descKey: 'accounting.exports.reservationsCsvDesc',
    icon: <Box component="span" sx={{ display: 'inline-flex', color: 'success.main' }}><ListAltIcon size={32} strokeWidth={1.75} /></Box>,
    format: 'csv',
    download: (from, to) => accountingExportApi.downloadReservationsCsv(from, to),
    preview: (from, to) => accountingExportApi.previewReservationsCsv(from, to),
  },
  {
    key: 'payouts',
    titleKey: 'accounting.exports.payoutsCsv',
    descKey: 'accounting.exports.payoutsCsvDesc',
    icon: <Box component="span" sx={{ display: 'inline-flex', color: 'info.main' }}><AttachMoneyIcon size={32} strokeWidth={1.75} /></Box>,
    format: 'csv',
    download: (from, to) => accountingExportApi.downloadPayoutsCsv(from, to),
    preview: (from, to) => accountingExportApi.previewPayoutsCsv(from, to),
  },
  {
    key: 'expenses',
    titleKey: 'accounting.exports.expensesCsv',
    descKey: 'accounting.exports.expensesCsvDesc',
    icon: <Box component="span" sx={{ display: 'inline-flex', color: 'warning.main' }}><BuildIcon size={32} strokeWidth={1.75} /></Box>,
    format: 'csv',
    download: (from, to) => accountingExportApi.downloadExpensesCsv(from, to),
    preview: (from, to) => accountingExportApi.previewExpensesCsv(from, to),
  },
  {
    key: 'invoices',
    titleKey: 'accounting.exports.invoicesCsv',
    descKey: 'accounting.exports.invoicesCsvDesc',
    icon: <Box component="span" sx={{ display: 'inline-flex', color: 'secondary.main' }}><ArticleIcon size={32} strokeWidth={1.75} /></Box>,
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

  return (
    <Box>
      <HelpBanner
        storageKey="clenzy_exports_help_dismissed"
        title={t('accounting.exports.help.title', 'Comment fonctionnent les exports ?')}
        description={t('accounting.exports.help.description', 'Exportez vos donnees comptables dans differents formats pour votre comptable ou vos declarations.')}
        dismissLabel={t('accounting.exports.help.dismiss', 'Ne plus afficher')}
        steps={[
          { icon: <StepPeriodIcon size={16} strokeWidth={1.75} />, title: t('accounting.exports.help.step1Title', 'Periode'), description: t('accounting.exports.help.step1Desc', 'Definissez la plage de dates des donnees a exporter.') },
          { icon: <StepFormatIcon size={16} strokeWidth={1.75} />, title: t('accounting.exports.help.step2Title', 'Format'), description: t('accounting.exports.help.step2Desc', 'FEC (norme DGFiP), CSV reservations, payouts, depenses ou factures.') },
          { icon: <StepExportIcon size={16} strokeWidth={1.75} />, title: t('accounting.exports.help.step3Title', 'Telecharger'), description: t('accounting.exports.help.step3Desc', 'Cliquez sur Telecharger pour obtenir le fichier pret a transmettre.') },
        ]}
      />

      {/* Period selector */}
      <Paper sx={{ ...CARD_SX, p: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, fontSize: '0.875rem' }}>
          {t('accounting.exports.period', 'Periode d\'export')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
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
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Export cards */}
      <Grid container spacing={2}>
        {EXPORT_CARDS.map((card) => (
          <Grid item xs={12} sm={6} md={4} key={card.key}>
            <Card
              sx={{
                ...CARD_SX,
                height: '100%',
                '&:hover': { borderColor: 'primary.main', boxShadow: 1 },
                transition: 'all 0.2s ease-in-out',
              }}
            >
              <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  {card.icon}
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                    {t(card.titleKey)}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', mb: 2, flex: 1 }}>
                  {t(card.descKey)}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<VisibilityIcon />}
                    disabled={!from || !to || loadingKey !== null}
                    onClick={() => handlePreview(card)}
                    sx={{ textTransform: 'none', fontSize: '0.8125rem', flex: 1 }}
                  >
                    {t('common.view')}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={loadingKey === card.key ? <CircularProgress size={16} /> : <DownloadIcon />}
                    disabled={!from || !to || loadingKey !== null}
                    onClick={() => handleDownload(card)}
                    sx={{ textTransform: 'none', fontSize: '0.8125rem', flex: 1 }}
                  >
                    {loadingKey === card.key
                      ? t('accounting.exports.downloading', 'Telechargement...')
                      : t('accounting.exports.download', 'Telecharger')}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <ExportPreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={previewTitle}
        loading={previewLoading}
        content={previewContent}
        format={previewFormat}
        error={previewError}
      />
    </Box>
  );
};

export default AccountingPage;
