import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, Chip, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, FormControlLabel, Switch, Alert, Snackbar,
  CircularProgress, InputAdornment,
} from '@mui/material';
import {
  Add, Edit, CheckCircle, Pause, Cancel, Refresh,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import {
  managementContractsApi,
  type ManagementContract,
  type CreateManagementContractRequest,
  type ContractStatus,
  type ContractType,
} from '../../services/api/managementContractsApi';
import { splitConfigApi } from '../../services/api/splitConfigApi';
import type { SplitRatios } from '../../types/payment';
import apiClient from '../../services/apiClient';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ContractStatus, { color: 'success' | 'warning' | 'error' | 'default' | 'info'; label: string }> = {
  ACTIVE:     { color: 'success', label: 'Actif' },
  DRAFT:      { color: 'default', label: 'Brouillon' },
  SUSPENDED:  { color: 'warning', label: 'Suspendu' },
  TERMINATED: { color: 'error',   label: 'Résilié' },
  EXPIRED:    { color: 'error',   label: 'Expiré' },
};

const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  FULL_MANAGEMENT:  'Gestion complète',
  BOOKING_ONLY:     'Réservations uniquement',
  MAINTENANCE_ONLY: 'Maintenance uniquement',
  CUSTOM:           'Personnalisé',
};

interface PropertyOption { id: number; name: string; ownerId: number; ownerName?: string }

// ─── Component ───────────────────────────────────────────────────────────────

const ManagementContractsPage: React.FC = () => {
  const { t } = useTranslation();

  // State
  const [contracts, setContracts] = useState<ManagementContract[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<ManagementContract | null>(null);
  const [terminateDialogOpen, setTerminateDialogOpen] = useState(false);
  const [terminatingId, setTerminatingId] = useState<number | null>(null);
  const [terminateReason, setTerminateReason] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContractStatus | ''>('');
  const [splitRatios, setSplitRatios] = useState<SplitRatios | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  // Form state
  const [form, setForm] = useState<CreateManagementContractRequest>({
    propertyId: 0,
    ownerId: 0,
    contractType: 'FULL_MANAGEMENT',
    startDate: new Date().toISOString().split('T')[0],
    endDate: null,
    commissionRate: 0.20,
    minimumStayNights: null,
    autoRenew: false,
    noticePeriodDays: 30,
    cleaningFeeIncluded: true,
    maintenanceIncluded: true,
    notes: '',
  });

  // ─── Data Loading ──────────────────────────────────────────────────────────

  const loadContracts = useCallback(async () => {
    try {
      setLoading(true);
      const params = statusFilter ? { status: statusFilter as ContractStatus } : undefined;
      const data = await managementContractsApi.getAll(params);
      setContracts(data);
    } catch {
      setSnackbar({ open: true, message: t('contracts.errorLoading'), severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, t]);

  const loadProperties = useCallback(async () => {
    try {
      const resp = await apiClient.get<{ content?: PropertyOption[]; [key: string]: unknown }>('/properties?size=1000');
      const list = Array.isArray(resp) ? resp : (resp.content ?? []);
      setProperties(list as PropertyOption[]);
    } catch {
      // Properties might fail if user has no properties permission — not critical
    }
  }, []);

  const loadSplitRatios = useCallback(async () => {
    try {
      const ratios = await splitConfigApi.getCurrentRatios();
      setSplitRatios(ratios);
    } catch {
      // Fallback handled in preview computation
    }
  }, []);

  useEffect(() => { loadContracts(); }, [loadContracts]);
  useEffect(() => { loadProperties(); }, [loadProperties]);
  useEffect(() => { loadSplitRatios(); }, [loadSplitRatios]);

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const getPropertyName = (propertyId: number) =>
    properties.find(p => p.id === propertyId)?.name ?? `Propriété #${propertyId}`;

  const getOwnerName = (ownerId: number) => {
    const prop = properties.find(p => p.ownerId === ownerId);
    return prop?.ownerName ?? `Propriétaire #${ownerId}`;
  };

  const showSuccess = (msg: string) => setSnackbar({ open: true, message: msg, severity: 'success' });
  const showError = (msg: string) => setSnackbar({ open: true, message: msg, severity: 'error' });

  // ─── Dialog Handlers ───────────────────────────────────────────────────────

  const openCreateDialog = () => {
    setEditingContract(null);
    setForm({
      propertyId: properties.length > 0 ? properties[0].id : 0,
      ownerId: properties.length > 0 ? properties[0].ownerId : 0,
      contractType: 'FULL_MANAGEMENT',
      startDate: new Date().toISOString().split('T')[0],
      endDate: null,
      commissionRate: 0.20,
      minimumStayNights: null,
      autoRenew: false,
      noticePeriodDays: 30,
      cleaningFeeIncluded: true,
      maintenanceIncluded: true,
      notes: '',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (contract: ManagementContract) => {
    setEditingContract(contract);
    setForm({
      propertyId: contract.propertyId,
      ownerId: contract.ownerId,
      contractType: contract.contractType,
      startDate: contract.startDate,
      endDate: contract.endDate,
      commissionRate: contract.commissionRate,
      minimumStayNights: contract.minimumStayNights,
      autoRenew: contract.autoRenew,
      noticePeriodDays: contract.noticePeriodDays,
      cleaningFeeIncluded: contract.cleaningFeeIncluded,
      maintenanceIncluded: contract.maintenanceIncluded,
      notes: contract.notes ?? '',
    });
    setDialogOpen(true);
  };

  const handlePropertyChange = (propertyId: number) => {
    const prop = properties.find(p => p.id === propertyId);
    setForm(prev => ({
      ...prev,
      propertyId,
      ownerId: prop?.ownerId ?? prev.ownerId,
    }));
  };

  const handleSave = async () => {
    try {
      if (editingContract) {
        await managementContractsApi.update(editingContract.id, form);
        showSuccess(t('contracts.updated'));
      } else {
        await managementContractsApi.create(form);
        showSuccess(t('contracts.created'));
      }
      setDialogOpen(false);
      loadContracts();
    } catch {
      showError(t('contracts.errorSaving'));
    }
  };

  // ─── Status Actions ────────────────────────────────────────────────────────

  const handleActivate = async (id: number) => {
    try {
      await managementContractsApi.activate(id);
      showSuccess(t('contracts.activated'));
      loadContracts();
    } catch {
      showError(t('contracts.errorAction'));
    }
  };

  const handleSuspend = async (id: number) => {
    try {
      await managementContractsApi.suspend(id);
      showSuccess(t('contracts.suspended'));
      loadContracts();
    } catch {
      showError(t('contracts.errorAction'));
    }
  };

  const openTerminateDialog = (id: number) => {
    setTerminatingId(id);
    setTerminateReason('');
    setTerminateDialogOpen(true);
  };

  const handleTerminate = async () => {
    if (!terminatingId) return;
    try {
      await managementContractsApi.terminate(terminatingId, terminateReason || 'Résilié par le gestionnaire');
      showSuccess(t('contracts.terminated'));
      setTerminateDialogOpen(false);
      loadContracts();
    } catch {
      showError(t('contracts.errorAction'));
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{t('contracts.title')}</Typography>
          <Typography variant="body2" color="text.secondary">{t('contracts.subtitle')}</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={openCreateDialog}>
          {t('contracts.create')}
        </Button>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Chip
          label={t('contracts.allStatuses')}
          variant={statusFilter === '' ? 'filled' : 'outlined'}
          onClick={() => setStatusFilter('')}
          color={statusFilter === '' ? 'primary' : 'default'}
        />
        {(Object.keys(STATUS_CONFIG) as ContractStatus[]).map(status => (
          <Chip
            key={status}
            label={STATUS_CONFIG[status].label}
            variant={statusFilter === status ? 'filled' : 'outlined'}
            color={statusFilter === status ? STATUS_CONFIG[status].color : 'default'}
            onClick={() => setStatusFilter(status)}
          />
        ))}
      </Box>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : contracts.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">{t('contracts.noContracts')}</Typography>
          <Button sx={{ mt: 2 }} variant="outlined" startIcon={<Add />} onClick={openCreateDialog}>
            {t('contracts.createFirst')}
          </Button>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell><strong>{t('contracts.contractNumber')}</strong></TableCell>
                <TableCell><strong>{t('contracts.property')}</strong></TableCell>
                <TableCell><strong>{t('contracts.owner')}</strong></TableCell>
                <TableCell><strong>{t('contracts.type')}</strong></TableCell>
                <TableCell align="center"><strong>{t('contracts.commission')}</strong></TableCell>
                <TableCell><strong>{t('contracts.period')}</strong></TableCell>
                <TableCell align="center"><strong>{t('contracts.status')}</strong></TableCell>
                <TableCell align="right"><strong>{t('contracts.actions')}</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contracts.map(c => (
                <TableRow key={c.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace' }}>
                      {c.contractNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>{getPropertyName(c.propertyId)}</TableCell>
                  <TableCell>{getOwnerName(c.ownerId)}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{CONTRACT_TYPE_LABELS[c.contractType]}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={`${(c.commissionRate * 100).toFixed(0)}%`}
                      size="small"
                      sx={{
                        bgcolor: '#6B8A9A20',
                        color: '#6B8A9A',
                        fontWeight: 700,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {c.startDate}{c.endDate ? ` → ${c.endDate}` : ' → ∞'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={STATUS_CONFIG[c.status]?.label ?? c.status}
                      color={STATUS_CONFIG[c.status]?.color ?? 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                      {(c.status === 'DRAFT' || c.status === 'SUSPENDED') && (
                        <Tooltip title={t('contracts.activate')}>
                          <IconButton size="small" color="success" onClick={() => handleActivate(c.id)}>
                            <CheckCircle fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {c.status === 'ACTIVE' && (
                        <Tooltip title={t('contracts.suspend')}>
                          <IconButton size="small" color="warning" onClick={() => handleSuspend(c.id)}>
                            <Pause fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {(c.status === 'ACTIVE' || c.status === 'SUSPENDED') && (
                        <Tooltip title={t('contracts.terminate')}>
                          <IconButton size="small" color="error" onClick={() => openTerminateDialog(c.id)}>
                            <Cancel fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {(c.status === 'DRAFT' || c.status === 'ACTIVE') && (
                        <Tooltip title={t('contracts.edit')}>
                          <IconButton size="small" onClick={() => openEditDialog(c)}>
                            <Edit fontSize="small" />
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

      {/* ── Create/Edit Dialog ─────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingContract ? t('contracts.editTitle') : t('contracts.createTitle')}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          {/* Property */}
          <TextField
            select
            label={t('contracts.property')}
            value={form.propertyId || ''}
            onChange={e => handlePropertyChange(Number(e.target.value))}
            fullWidth
            size="small"
          >
            {properties.map(p => (
              <MenuItem key={p.id} value={p.id}>
                {p.name} {p.ownerName ? `(${p.ownerName})` : ''}
              </MenuItem>
            ))}
          </TextField>

          {/* Contract type */}
          <TextField
            select
            label={t('contracts.type')}
            value={form.contractType}
            onChange={e => setForm(prev => ({ ...prev, contractType: e.target.value as ContractType }))}
            fullWidth
            size="small"
          >
            {(Object.entries(CONTRACT_TYPE_LABELS) as [ContractType, string][]).map(([key, label]) => (
              <MenuItem key={key} value={key}>{label}</MenuItem>
            ))}
          </TextField>

          {/* Commission rate */}
          <TextField
            label={t('contracts.commissionRate')}
            type="number"
            value={Math.round(form.commissionRate * 100)}
            onChange={e => setForm(prev => ({ ...prev, commissionRate: Number(e.target.value) / 100 }))}
            fullWidth
            size="small"
            InputProps={{
              endAdornment: <InputAdornment position="end">%</InputAdornment>,
            }}
            inputProps={{ min: 1, max: 50, step: 1 }}
            helperText={t('contracts.commissionHelper')}
          />

          {/* Dates */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label={t('contracts.startDate')}
              type="date"
              value={form.startDate}
              onChange={e => setForm(prev => ({ ...prev, startDate: e.target.value }))}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={t('contracts.endDate')}
              type="date"
              value={form.endDate ?? ''}
              onChange={e => setForm(prev => ({ ...prev, endDate: e.target.value || null }))}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              helperText={t('contracts.endDateHelper')}
            />
          </Box>

          {/* Options */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label={t('contracts.minStayNights')}
              type="number"
              value={form.minimumStayNights ?? ''}
              onChange={e => setForm(prev => ({ ...prev, minimumStayNights: e.target.value ? Number(e.target.value) : null }))}
              fullWidth
              size="small"
              inputProps={{ min: 1 }}
            />
            <TextField
              label={t('contracts.noticePeriodDays')}
              type="number"
              value={form.noticePeriodDays ?? 30}
              onChange={e => setForm(prev => ({ ...prev, noticePeriodDays: Number(e.target.value) }))}
              fullWidth
              size="small"
              InputProps={{
                endAdornment: <InputAdornment position="end">{t('contracts.days')}</InputAdornment>,
              }}
            />
          </Box>

          {/* Toggles */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <FormControlLabel
              control={<Switch checked={form.autoRenew ?? false} onChange={e => setForm(prev => ({ ...prev, autoRenew: e.target.checked }))} />}
              label={t('contracts.autoRenew')}
            />
            <FormControlLabel
              control={<Switch checked={form.cleaningFeeIncluded ?? true} onChange={e => setForm(prev => ({ ...prev, cleaningFeeIncluded: e.target.checked }))} />}
              label={t('contracts.cleaningIncluded')}
            />
            <FormControlLabel
              control={<Switch checked={form.maintenanceIncluded ?? true} onChange={e => setForm(prev => ({ ...prev, maintenanceIncluded: e.target.checked }))} />}
              label={t('contracts.maintenanceIncluded')}
            />
          </Box>

          {/* Notes */}
          <TextField
            label={t('contracts.notes')}
            value={form.notes ?? ''}
            onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
            multiline
            rows={2}
            fullWidth
            size="small"
          />

          {/* Commission breakdown preview — uses actual split ratios from org config */}
          <Alert severity="info" sx={{ mt: 1 }}>
            <Typography variant="body2" fontWeight={600}>{t('contracts.splitPreview')}</Typography>
            <Typography variant="body2">
              {(() => {
                const commissionPct = form.commissionRate * 100;
                const ownerPct = 100 - commissionPct;
                // Derive platform/concierge split from org SplitRatios
                const platformBase = splitRatios?.platformShare ?? 0.05;
                const conciergeBase = splitRatios?.conciergeShare ?? 0.15;
                const commissionTotal = platformBase + conciergeBase;
                // Ratio of commission going to platform vs concierge
                const platformRatio = commissionTotal > 0 ? platformBase / commissionTotal : 0.25;
                const conciergeRatio = commissionTotal > 0 ? conciergeBase / commissionTotal : 0.75;
                const platformPct = commissionPct * platformRatio;
                const conciergePct = commissionPct * conciergeRatio;
                return `${t('contracts.ownerGets')}: ${ownerPct.toFixed(0)}% | ${t('contracts.platformGets')}: ${platformPct.toFixed(1)}% | ${t('contracts.conciergeGets')}: ${conciergePct.toFixed(1)}%`;
              })()}
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>{t('contracts.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!form.propertyId || !form.startDate || form.commissionRate <= 0}
          >
            {editingContract ? t('contracts.save') : t('contracts.create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Terminate Dialog ───────────────────────────────────────────────── */}
      <Dialog open={terminateDialogOpen} onClose={() => setTerminateDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('contracts.terminateTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('contracts.terminateWarning')}
          </Typography>
          <TextField
            label={t('contracts.terminateReason')}
            value={terminateReason}
            onChange={e => setTerminateReason(e.target.value)}
            multiline
            rows={3}
            fullWidth
            size="small"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setTerminateDialogOpen(false)}>{t('contracts.cancel')}</Button>
          <Button variant="contained" color="error" onClick={handleTerminate}>
            {t('contracts.confirmTerminate')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ManagementContractsPage;
