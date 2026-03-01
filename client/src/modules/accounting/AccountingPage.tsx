import React, { useState, useCallback, useMemo } from 'react';
import {
  Box, Paper, Typography, Button, Chip, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Select, FormControl, InputLabel, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tabs, Tab,
} from '@mui/material';
import {
  Add as AddIcon,
  CheckCircle as ApproveIcon,
  Payment as PaidIcon,
  AccountBalance as AccountIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import { SPACING } from '../../theme/spacing';
import { propertiesApi } from '../../services/api/propertiesApi';
import type { Property } from '../../services/api/propertiesApi';
import {
  usePayouts,
  useGeneratePayout,
  useApprovePayout,
  useMarkAsPaid,
  useCommissions,
  useSaveCommission,
} from '../../hooks/useAccounting';
import type { OwnerPayout, ChannelCommission, PayoutStatus } from '../../services/api/accountingApi';
import { PAYOUT_STATUS_COLORS } from '../../services/api/accountingApi';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '../../utils/currencyUtils';

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: PayoutStatus | ''; label: string }[] = [
  { value: '', label: 'Tous' },
  { value: 'DRAFT', label: 'Brouillon' },
  { value: 'APPROVED', label: 'Approuve' },
  { value: 'PAID', label: 'Paye' },
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

const fmtCurrency = (n: number, currency = 'EUR') => formatCurrency(n, currency);

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '—';

const fmtPercent = (n: number) => `${(n * 100).toFixed(1)}%`;

// ─── Component ──────────────────────────────────────────────────────────────

const AccountingPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);

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
          onChange={(_, v) => setActiveTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}
        >
          <Tab label={t('accounting.tabs.payouts', 'Payouts')} sx={TAB_SX} />
          <Tab label={t('accounting.tabs.commissions', 'Commissions')} sx={TAB_SX} />
        </Tabs>
      </Paper>

      {activeTab === 0 && <PayoutsTab />}
      {activeTab === 1 && <CommissionsTab />}
    </Box>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  Payouts Tab
// ═══════════════════════════════════════════════════════════════════════════

const PayoutsTab: React.FC = () => {
  const { t } = useTranslation();

  // Filters
  const [filterOwnerId, setFilterOwnerId] = useState<number | ''>('');
  const [filterStatus, setFilterStatus] = useState<PayoutStatus | ''>('');

  // Dialogs
  const [generateOpen, setGenerateOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<OwnerPayout | null>(null);
  const [payRef, setPayRef] = useState('');

  // Generate form
  const [genOwnerId, setGenOwnerId] = useState<number | ''>('');
  const [genFrom, setGenFrom] = useState('');
  const [genTo, setGenTo] = useState('');

  // Data
  const ownerId = filterOwnerId === '' ? undefined : filterOwnerId;
  const status = filterStatus === '' ? undefined : filterStatus;
  const { data: payouts = [], isLoading, isError } = usePayouts(ownerId, status);
  const { data: properties = [] } = useQuery({
    queryKey: ['properties-list'],
    queryFn: () => propertiesApi.getAll(),
    staleTime: 120_000,
  });

  // Mutations
  const generateMutation = useGeneratePayout();
  const approveMutation = useApprovePayout();
  const markPaidMutation = useMarkAsPaid();

  // Owner list from payouts (unique ownerIds)
  const ownerIds = useMemo(() => {
    const ids = new Set(payouts.map((p) => p.ownerId));
    return Array.from(ids).sort((a, b) => a - b);
  }, [payouts]);

  // Handlers
  const handleGenerate = useCallback(async () => {
    if (genOwnerId === '' || !genFrom || !genTo) return;
    await generateMutation.mutateAsync({ ownerId: genOwnerId as number, from: genFrom, to: genTo });
    setGenerateOpen(false);
    setGenOwnerId('');
    setGenFrom('');
    setGenTo('');
  }, [genOwnerId, genFrom, genTo, generateMutation]);

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

  return (
    <>
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
            {ownerIds.map((id) => (
              <MenuItem key={id} value={id} sx={{ fontSize: '0.8125rem' }}>
                {t('accounting.owner', 'Proprietaire')} #{id}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {STATUS_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              size="small"
              variant={filterStatus === opt.value ? 'filled' : 'outlined'}
              onClick={() => setFilterStatus(opt.value as PayoutStatus | '')}
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                ...(filterStatus === opt.value && opt.value !== ''
                  ? { backgroundColor: PAYOUT_STATUS_COLORS[opt.value as PayoutStatus], color: '#fff' }
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
            onClick={() => setGenerateOpen(true)}
            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
          >
            {t('accounting.generatePayout', 'Generer un payout')}
          </Button>
        </Box>
      </Paper>

      {/* ── Alerts ── */}
      {generateMutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 1.5, fontSize: '0.8125rem' }} onClose={() => generateMutation.reset()}>
          {t('accounting.generateSuccess', 'Payout genere avec succes')}
        </Alert>
      )}
      {approveMutation.isSuccess && (
        <Alert severity="success" sx={{ mb: 1.5, fontSize: '0.8125rem' }} onClose={() => approveMutation.reset()}>
          {t('accounting.approveSuccess', 'Payout approuve')}
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
          <AccountIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
            {t('accounting.emptyPayouts', 'Aucun payout trouve')}
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
                    {t('accounting.owner', 'Proprietaire')} #{payout.ownerId}
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
                      label={payout.status}
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
                  <TableCell align="right">
                    {payout.status === 'DRAFT' && (
                      <Tooltip title={t('accounting.approve', 'Approuver')}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleApprove(payout.id)}
                          disabled={approveMutation.isPending}
                        >
                          <ApproveIcon sx={{ fontSize: '1rem' }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {payout.status === 'APPROVED' && (
                      <Tooltip title={t('accounting.markPaid', 'Marquer paye')}>
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => openPayDialog(payout)}
                          disabled={markPaidMutation.isPending}
                        >
                          <PaidIcon sx={{ fontSize: '1rem' }} />
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          Generate Payout Dialog
          ═══════════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontSize: '0.9375rem', fontWeight: 700 }}>
          {t('accounting.generateTitle', 'Generer un payout')}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <FormControl size="small" fullWidth>
            <InputLabel sx={{ fontSize: '0.8125rem' }}>{t('accounting.form.owner', 'Proprietaire')}</InputLabel>
            <Select
              value={genOwnerId}
              onChange={(e) => setGenOwnerId(e.target.value as number | '')}
              label={t('accounting.form.owner', 'Proprietaire')}
              sx={{ fontSize: '0.8125rem' }}
            >
              {properties.map((p: Property) => (
                <MenuItem key={p.id} value={p.id} sx={{ fontSize: '0.8125rem' }}>
                  {p.name} (#{p.id})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              label={t('accounting.form.from', 'Du')}
              type="date"
              size="small"
              fullWidth
              value={genFrom}
              onChange={(e) => setGenFrom(e.target.value)}
              InputLabelProps={{ shrink: true, sx: { fontSize: '0.8125rem' } }}
              InputProps={{ sx: { fontSize: '0.8125rem' } }}
            />
            <TextField
              label={t('accounting.form.to', 'Au')}
              type="date"
              size="small"
              fullWidth
              value={genTo}
              onChange={(e) => setGenTo(e.target.value)}
              InputLabelProps={{ shrink: true, sx: { fontSize: '0.8125rem' } }}
              InputProps={{ sx: { fontSize: '0.8125rem' } }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setGenerateOpen(false)} size="small" sx={{ textTransform: 'none', fontSize: '0.8125rem' }}>
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleGenerate}
            disabled={generateMutation.isPending || genOwnerId === '' || !genFrom || !genTo}
            sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
          >
            {generateMutation.isPending ? <CircularProgress size={16} /> : t('accounting.generate', 'Generer')}
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
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
//  Commissions Tab
// ═══════════════════════════════════════════════════════════════════════════

const CommissionsTab: React.FC = () => {
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
        <AccountIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
        <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
          {t('accounting.emptyCommissions', 'Aucune commission configuree')}
        </Typography>
      </Paper>
    );
  }

  return (
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
                        <SaveIcon sx={{ fontSize: '1rem' }} />
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
  );
};

export default AccountingPage;
