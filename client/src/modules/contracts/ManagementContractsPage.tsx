import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, Chip, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, MenuItem, FormControlLabel, Switch, Alert, Snackbar,
  CircularProgress, InputAdornment, Stack,
} from '@mui/material';
import {
  Add, Edit, CheckCircle, Pause, Cancel, Close, Save, Check,
  Handshake, Home, Person, Euro, CalendarMonth,
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

// ─── Status palette (PMS soft-filled, identical aux autres pages) ───────────

interface StatusMeta { label: string; color: string }

const STATUS_META: Record<ContractStatus, StatusMeta> = {
  ACTIVE:     { label: 'Actif',     color: '#10b981' },
  DRAFT:      { label: 'Brouillon', color: '#6B7280' },
  SUSPENDED:  { label: 'Suspendu',  color: '#f59e0b' },
  TERMINATED: { label: 'Résilié',   color: '#d32f2f' },
  EXPIRED:    { label: 'Expiré',    color: '#9333ea' },
};

const FILTER_ALL_COLOR = '#6B8A9A';

const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  FULL_MANAGEMENT:  'Gestion complète',
  BOOKING_ONLY:     'Réservations uniquement',
  MAINTENANCE_ONLY: 'Maintenance uniquement',
  CUSTOM:           'Personnalisé',
};

interface PropertyOption { id: number; name: string; ownerId: number; ownerName?: string }

const EMPTY_FORM: CreateManagementContractRequest = {
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
};

// ─── Component ──────────────────────────────────────────────────────────────

const ManagementContractsPage: React.FC = () => {
  const { t } = useTranslation();

  // State
  const [contracts, setContracts] = useState<ManagementContract[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ContractStatus | ''>('');
  const [splitRatios, setSplitRatios] = useState<SplitRatios | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  // Form state — toujours visible. editingContract != null = mode edition.
  const [editingContract, setEditingContract] = useState<ManagementContract | null>(null);
  const [form, setForm] = useState<CreateManagementContractRequest>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Inline terminate state
  const [terminatingId, setTerminatingId] = useState<number | null>(null);
  const [terminateReason, setTerminateReason] = useState('');

  // ─── Data loading ─────────────────────────────────────────────────────────

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

  // ─── Derived data ─────────────────────────────────────────────────────────

  const getPropertyName = (propertyId: number) =>
    properties.find(p => p.id === propertyId)?.name ?? `Propriété #${propertyId}`;

  const getOwnerName = (ownerId: number) => {
    const prop = properties.find(p => p.ownerId === ownerId);
    return prop?.ownerName ?? `Propriétaire #${ownerId}`;
  };

  const showSuccess = (msg: string) => setSnackbar({ open: true, message: msg, severity: 'success' });
  const showError = (msg: string) => setSnackbar({ open: true, message: msg, severity: 'error' });

  // Split en deux groupes : actifs (ACTIVE+SUSPENDED+DRAFT) / inactifs (TERMINATED+EXPIRED).
  const { activeContracts, inactiveContracts } = useMemo(() => {
    const active: ManagementContract[] = [];
    const inactive: ManagementContract[] = [];
    for (const c of contracts) {
      if (c.status === 'TERMINATED' || c.status === 'EXPIRED') inactive.push(c);
      else active.push(c);
    }
    return { activeContracts: active, inactiveContracts: inactive };
  }, [contracts]);

  // ─── Form handlers ────────────────────────────────────────────────────────

  // Init/reset le formulaire de creation quand les proprietes arrivent
  useEffect(() => {
    if (!editingContract && properties.length > 0 && form.propertyId === 0) {
      setForm(prev => ({
        ...prev,
        propertyId: properties[0].id,
        ownerId: properties[0].ownerId,
      }));
    }
  }, [properties, editingContract, form.propertyId]);

  const startEdit = (contract: ManagementContract) => {
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
    setEditingContract(contract);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditingContract(null);
    setForm({
      ...EMPTY_FORM,
      propertyId: properties.length > 0 ? properties[0].id : 0,
      ownerId: properties.length > 0 ? properties[0].ownerId : 0,
    });
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
    setSaving(true);
    try {
      if (editingContract) {
        await managementContractsApi.update(editingContract.id, form);
        showSuccess(t('contracts.updated'));
      } else {
        await managementContractsApi.create(form);
        showSuccess(t('contracts.created'));
      }
      resetForm();
      loadContracts();
    } catch {
      showError(t('contracts.errorSaving'));
    } finally {
      setSaving(false);
    }
  };

  // ─── Status actions ──────────────────────────────────────────────────────

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

  const startTerminate = (id: number) => {
    setTerminatingId(id);
    setTerminateReason('');
  };

  const cancelTerminate = () => {
    setTerminatingId(null);
    setTerminateReason('');
  };

  const confirmTerminate = async () => {
    if (!terminatingId) return;
    try {
      await managementContractsApi.terminate(terminatingId, terminateReason || 'Résilié par le gestionnaire');
      showSuccess(t('contracts.terminated'));
      cancelTerminate();
      loadContracts();
    } catch {
      showError(t('contracts.errorAction'));
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* ─── Header : titre + filtres + CTA ──────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Box
          sx={{
            width: 32, height: 32, borderRadius: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: 'primary.main', color: 'primary.contrastText',
            flexShrink: 0,
          }}
        >
          <Handshake size={16} strokeWidth={1.75} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, lineHeight: 1.2 }}>
            {t('contracts.title')}
          </Typography>
          <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', lineHeight: 1.2 }}>
            {t('contracts.subtitle')}
          </Typography>
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* Filter chips inline */}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <PmsFilterChip
            label={t('contracts.allStatuses')}
            color={FILTER_ALL_COLOR}
            active={statusFilter === ''}
            count={contracts.length}
            onClick={() => setStatusFilter('')}
            size="compact"
          />
          {(Object.keys(STATUS_META) as ContractStatus[]).map(status => {
            const meta = STATUS_META[status];
            const count = contracts.filter(c => c.status === status).length;
            return (
              <PmsFilterChip
                key={status}
                label={meta.label}
                color={meta.color}
                active={statusFilter === status}
                count={count}
                onClick={() => setStatusFilter(statusFilter === status ? '' : status)}
                size="compact"
              />
            );
          })}
        </Box>

        {/* Submit du formulaire — actif seulement quand les champs requis sont valides.
            Pas de background : variant 'outlined' pour rester discret dans le header. */}
        {(() => {
          const formValid = Boolean(form.propertyId) && Boolean(form.startDate) && form.commissionRate > 0;
          const label = editingContract ? 'Enregistrer' : 'Valider';
          return (
            <Button
              variant="outlined"
              size="small"
              color={editingContract ? 'warning' : 'primary'}
              startIcon={saving
                ? <CircularProgress size={12} color="inherit" />
                : (editingContract ? <Save size={14} strokeWidth={1.75} /> : <Check size={14} strokeWidth={1.75} />)
              }
              onClick={handleSave}
              disabled={!formValid || saving}
              sx={{
                textTransform: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                py: 0.5,
                px: 1.5,
                borderRadius: 1,
                // Désactivé : bordure et texte grisés mais lisibles
                '&.Mui-disabled': {
                  color: 'text.disabled',
                  borderColor: 'divider',
                },
              }}
            >
              {saving ? 'Enregistrement…' : label}
            </Button>
          );
        })()}
      </Box>

      {/* ─── Inline create/edit form — toujours visible, 2 lignes max ─ */}
      <Paper
        variant="outlined"
        sx={{
          p: 1.25,
          borderRadius: 1.5,
          borderColor: editingContract ? 'warning.main' : 'primary.main',
          borderLeftWidth: 3,
          borderLeftColor: editingContract ? 'warning.main' : 'primary.main',
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(107,138,154,0.06)' : 'rgba(107,138,154,0.03)',
          // Compact form sizing — fields, labels, helper text scaled down to match the sidebar density.
          '& .MuiInputBase-input': { fontSize: '0.75rem', py: '6px' },
          '& .MuiInputLabel-root': { fontSize: '0.75rem' },
          '& .MuiOutlinedInput-root': { borderRadius: 1 },
          '& .MuiSelect-select': { py: '6px' },
          '& .MuiFormHelperText-root': { fontSize: '0.625rem', mt: 0.25 },
          '& .MuiInputAdornment-root': { '& > *': { fontSize: '0.875rem' } },
          '& .MuiFormControlLabel-label': { fontSize: '0.6875rem' },
          '& .MuiSwitch-root': { transform: 'scale(0.8)' },
        }}
      >
        {/* Bandeau de mode */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
          <Box component="span" sx={{ display: 'inline-flex', color: editingContract ? 'warning.main' : 'primary.main' }}>
            {editingContract ? <Edit size={12} strokeWidth={1.75} /> : <Add size={12} strokeWidth={1.75} />}
          </Box>
          <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: editingContract ? 'warning.main' : 'primary.main' }}>
            {editingContract ? `Modification · ${editingContract.contractNumber}` : 'Nouveau contrat'}
          </Typography>
          <Box sx={{ flex: 1 }} />
          {editingContract && (
            <Tooltip title="Annuler la modification">
              <IconButton size="small" onClick={resetForm} sx={{ p: 0.25 }}>
                <Close size={14} strokeWidth={1.75} />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Ligne 1 — champs principaux */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1.6fr 1.3fr 0.8fr 1fr 1fr 0.8fr 0.8fr' },
          gap: 1.25,
          alignItems: 'flex-start',
          mb: 1.25,
        }}>
          <TextField
            select label={t('contracts.property')} value={form.propertyId || ''}
            onChange={e => handlePropertyChange(Number(e.target.value))}
            size="small" fullWidth
            InputProps={{ startAdornment: <InputAdornment position="start"><Home size={14} strokeWidth={1.75} /></InputAdornment> }}
          >
            {properties.map(p => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}{p.ownerName ? ` (${p.ownerName})` : ''}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select label={t('contracts.type')} value={form.contractType}
            onChange={e => setForm(prev => ({ ...prev, contractType: e.target.value as ContractType }))}
            size="small" fullWidth
          >
            {(Object.entries(CONTRACT_TYPE_LABELS) as [ContractType, string][]).map(([key, label]) => (
              <MenuItem key={key} value={key}>{label}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Commission" type="number"
            value={Math.round(form.commissionRate * 100)}
            onChange={e => setForm(prev => ({ ...prev, commissionRate: Number(e.target.value) / 100 }))}
            size="small" fullWidth
            InputProps={{
              startAdornment: <InputAdornment position="start"><Euro size={12} strokeWidth={1.75} /></InputAdornment>,
              endAdornment: <InputAdornment position="end">%</InputAdornment>,
            }}
            inputProps={{ min: 1, max: 50, step: 1 }}
          />
          <TextField
            label={t('contracts.startDate')} type="date" value={form.startDate}
            onChange={e => setForm(prev => ({ ...prev, startDate: e.target.value }))}
            size="small" fullWidth
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label={t('contracts.endDate')} type="date" value={form.endDate ?? ''}
            onChange={e => setForm(prev => ({ ...prev, endDate: e.target.value || null }))}
            size="small" fullWidth
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Nuits min." type="number"
            value={form.minimumStayNights ?? ''}
            onChange={e => setForm(prev => ({ ...prev, minimumStayNights: e.target.value ? Number(e.target.value) : null }))}
            size="small" fullWidth
            inputProps={{ min: 1 }}
          />
          <TextField
            label="Préavis" type="number"
            value={form.noticePeriodDays ?? 30}
            onChange={e => setForm(prev => ({ ...prev, noticePeriodDays: Number(e.target.value) }))}
            size="small" fullWidth
            InputProps={{ endAdornment: <InputAdornment position="end">j</InputAdornment> }}
          />
        </Box>

        {/* Ligne 2 — options, notes, actions */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
        }}>
          <Box sx={{ display: 'flex', gap: 0.25, flexWrap: 'wrap' }}>
            <FormControlLabel
              control={<Switch size="small" checked={form.autoRenew ?? false} onChange={e => setForm(prev => ({ ...prev, autoRenew: e.target.checked }))} />}
              label={<Typography sx={{ fontSize: '0.75rem' }}>Renouvellement auto</Typography>}
              sx={{ mr: 1 }}
            />
            <FormControlLabel
              control={<Switch size="small" checked={form.cleaningFeeIncluded ?? true} onChange={e => setForm(prev => ({ ...prev, cleaningFeeIncluded: e.target.checked }))} />}
              label={<Typography sx={{ fontSize: '0.75rem' }}>Ménage inclus</Typography>}
              sx={{ mr: 1 }}
            />
            <FormControlLabel
              control={<Switch size="small" checked={form.maintenanceIncluded ?? true} onChange={e => setForm(prev => ({ ...prev, maintenanceIncluded: e.target.checked }))} />}
              label={<Typography sx={{ fontSize: '0.75rem' }}>Maintenance incluse</Typography>}
            />
          </Box>
          <TextField
            label="Notes" value={form.notes ?? ''}
            onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
            size="small"
            placeholder="Optionnel"
            sx={{ flex: 1, minWidth: 200 }}
          />
          {/* Split preview compact */}
          <Tooltip
            title={(() => {
              const commissionPct = form.commissionRate * 100;
              const ownerPct = 100 - commissionPct;
              const platformBase = splitRatios?.platformShare ?? 0.05;
              const conciergeBase = splitRatios?.conciergeShare ?? 0.15;
              const commissionTotal = platformBase + conciergeBase;
              const platformRatio = commissionTotal > 0 ? platformBase / commissionTotal : 0.25;
              const conciergeRatio = commissionTotal > 0 ? conciergeBase / commissionTotal : 0.75;
              return `${t('contracts.ownerGets')}: ${ownerPct.toFixed(0)}% · ${t('contracts.platformGets')}: ${(commissionPct * platformRatio).toFixed(1)}% · ${t('contracts.conciergeGets')}: ${(commissionPct * conciergeRatio).toFixed(1)}%`;
            })()}
          >
            <Chip
              size="small"
              icon={<Euro size={12} strokeWidth={1.75} />}
              label={`${(100 - form.commissionRate * 100).toFixed(0)}% propriétaire`}
              sx={{
                fontSize: '0.6875rem', fontWeight: 600,
                bgcolor: '#6B8A9A20', color: '#6B8A9A',
                border: '1px solid #6B8A9A40',
                '& .MuiChip-icon': { color: '#6B8A9A' },
              }}
            />
          </Tooltip>
          {editingContract && (
            <Button
              onClick={resetForm}
              size="small"
              startIcon={<Close size={14} strokeWidth={1.75} />}
              sx={{ textTransform: 'none' }}
            >
              {t('contracts.cancel')}
            </Button>
          )}
          {/* Submit button is in the page header (top-right) to avoid duplication. */}
        </Box>
      </Paper>

      {/* ─── Body ──────────────────────────────────────────────────── */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : contracts.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{ p: 5, textAlign: 'center', borderStyle: 'dashed', borderRadius: 2 }}
        >
          <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled', mb: 1 }}>
            <Handshake size={36} strokeWidth={1.5} />
          </Box>
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>
            {t('contracts.noContracts')}
          </Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: 'text.disabled', mb: 2 }}>
            Les paiements seront répartis en 2 parts (propriétaire / plateforme).
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'primary.main', fontWeight: 600 }}>
            Remplis le formulaire ci-dessus pour créer ton premier contrat.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {activeContracts.length > 0 && (
            <ContractsTableSection
              title="Contrats en vigueur"
              accentColor="#10b981"
              contracts={activeContracts}
              terminatingId={terminatingId}
              terminateReason={terminateReason}
              setTerminateReason={setTerminateReason}
              getPropertyName={getPropertyName}
              getOwnerName={getOwnerName}
              onActivate={handleActivate}
              onSuspend={handleSuspend}
              onEdit={startEdit}
              onTerminateStart={startTerminate}
              onTerminateCancel={cancelTerminate}
              onTerminateConfirm={confirmTerminate}
            />
          )}
          {inactiveContracts.length > 0 && (
            <ContractsTableSection
              title="Contrats archivés"
              accentColor="#6B7280"
              contracts={inactiveContracts}
              terminatingId={terminatingId}
              terminateReason={terminateReason}
              setTerminateReason={setTerminateReason}
              getPropertyName={getPropertyName}
              getOwnerName={getOwnerName}
              onActivate={handleActivate}
              onSuspend={handleSuspend}
              onEdit={startEdit}
              onTerminateStart={startTerminate}
              onTerminateCancel={cancelTerminate}
              onTerminateConfirm={confirmTerminate}
              muted
            />
          )}
        </Box>
      )}

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

// ─── PMS-style filter chip ──────────────────────────────────────────────────

interface PmsFilterChipProps {
  label: string;
  color: string;
  active: boolean;
  count: number;
  onClick: () => void;
  size?: 'default' | 'compact';
}

const PmsFilterChip: React.FC<PmsFilterChipProps> = ({ label, color, active, count, onClick, size = 'default' }) => {
  const compact = size === 'compact';
  return (
    <Chip
      label={
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>
          {label}
          <Box
            component="span"
            sx={{
              fontSize: compact ? '0.5625rem' : '0.625rem',
              fontWeight: 700,
              px: 0.5,
              py: 0.05,
              borderRadius: 0.75,
              bgcolor: active ? 'rgba(255,255,255,0.25)' : `${color}28`,
              color: active ? '#fff' : color,
            }}
          >
            {count}
          </Box>
        </Box>
      }
      onClick={onClick}
      size="small"
      sx={{
        height: compact ? 22 : 26,
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: compact ? '0.6875rem' : '0.75rem',
        fontWeight: 600,
        transition: 'all 0.15s ease',
        backgroundColor: active ? color : `${color}18`,
        color: active ? '#fff' : color,
        border: `1px solid ${active ? color : `${color}40`}`,
        '& .MuiChip-label': { px: compact ? 0.6 : 0.75 },
        '&:hover': {
          backgroundColor: active ? color : `${color}28`,
        },
      }}
    />
  );
};

// ─── Table section (used twice: actifs / archives) ──────────────────────────

interface ContractsTableSectionProps {
  title: string;
  accentColor: string;
  contracts: ManagementContract[];
  terminatingId: number | null;
  terminateReason: string;
  setTerminateReason: (v: string) => void;
  getPropertyName: (id: number) => string;
  getOwnerName: (id: number) => string;
  onActivate: (id: number) => void;
  onSuspend: (id: number) => void;
  onEdit: (c: ManagementContract) => void;
  onTerminateStart: (id: number) => void;
  onTerminateCancel: () => void;
  onTerminateConfirm: () => void;
  muted?: boolean;
}

const ContractsTableSection: React.FC<ContractsTableSectionProps> = ({
  title, accentColor, contracts,
  terminatingId, terminateReason, setTerminateReason,
  getPropertyName, getOwnerName,
  onActivate, onSuspend, onEdit,
  onTerminateStart, onTerminateCancel, onTerminateConfirm,
  muted,
}) => {
  const { t } = useTranslation();

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box sx={{ width: 3, height: 16, borderRadius: 1, bgcolor: accentColor }} />
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'text.secondary' }}>
          {title}
        </Typography>
        <Box
          component="span"
          sx={{
            fontSize: '0.625rem',
            fontWeight: 700,
            px: 0.75,
            py: 0.1,
            borderRadius: 0.75,
            bgcolor: `${accentColor}18`,
            color: accentColor,
          }}
        >
          {contracts.length}
        </Box>
      </Box>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, opacity: muted ? 0.85 : 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell sx={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'text.secondary' }}>{t('contracts.contractNumber')}</TableCell>
              <TableCell sx={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'text.secondary' }}>{t('contracts.property')}</TableCell>
              <TableCell sx={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'text.secondary' }}>{t('contracts.owner')}</TableCell>
              <TableCell sx={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'text.secondary' }}>{t('contracts.type')}</TableCell>
              <TableCell align="center" sx={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'text.secondary' }}>{t('contracts.commission')}</TableCell>
              <TableCell sx={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'text.secondary' }}>{t('contracts.period')}</TableCell>
              <TableCell align="center" sx={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'text.secondary' }}>{t('contracts.status')}</TableCell>
              <TableCell align="right" sx={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'text.secondary' }}>{t('contracts.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {contracts.map(c => {
              const meta = STATUS_META[c.status] ?? { label: c.status, color: '#6B7280' };
              const isTerminating = terminatingId === c.id;

              if (isTerminating) {
                return (
                  <TableRow key={c.id}>
                    <TableCell colSpan={8} sx={{ p: 2, bgcolor: 'error.main', color: 'error.contrastText' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Cancel size={18} strokeWidth={2} />
                          <Typography variant="subtitle2" fontWeight={700}>
                            Résilier le contrat {c.contractNumber} ?
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                          {t('contracts.terminateWarning')}
                        </Typography>
                        <TextField
                          label={t('contracts.terminateReason')}
                          value={terminateReason}
                          onChange={e => setTerminateReason(e.target.value)}
                          multiline
                          rows={2}
                          fullWidth
                          size="small"
                          sx={{
                            bgcolor: 'background.paper',
                            borderRadius: 1,
                            '& .MuiInputBase-input': { fontSize: '0.8125rem' },
                          }}
                        />
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={onTerminateCancel}
                            sx={{
                              textTransform: 'none',
                              color: 'common.white',
                              borderColor: 'rgba(255,255,255,0.6)',
                              '&:hover': { borderColor: 'common.white', bgcolor: 'rgba(255,255,255,0.1)' },
                            }}
                          >
                            {t('contracts.cancel')}
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={onTerminateConfirm}
                            startIcon={<Cancel size={14} strokeWidth={1.75} />}
                            sx={{
                              textTransform: 'none', fontWeight: 600,
                              bgcolor: 'common.white', color: 'error.main',
                              '&:hover': { bgcolor: 'rgba(255,255,255,0.9)' },
                            }}
                          >
                            {t('contracts.confirmTerminate')}
                          </Button>
                        </Stack>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              }

              return (
                <TableRow key={c.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                      {c.contractNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled' }}>
                        <Home size={14} strokeWidth={1.75} />
                      </Box>
                      <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>{getPropertyName(c.propertyId)}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled' }}>
                        <Person size={14} strokeWidth={1.75} />
                      </Box>
                      <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>{getOwnerName(c.ownerId)}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>{CONTRACT_TYPE_LABELS[c.contractType]}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={`${(c.commissionRate * 100).toFixed(0)}%`}
                      size="small"
                      sx={{
                        bgcolor: '#6B8A9A20',
                        color: '#6B8A9A',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        height: 22,
                        borderRadius: '6px',
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      {c.startDate}{c.endDate ? ` → ${c.endDate}` : ' → ∞'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={meta.label}
                      size="small"
                      sx={{
                        bgcolor: `${meta.color}18`,
                        color: meta.color,
                        border: `1px solid ${meta.color}40`,
                        fontWeight: 600,
                        fontSize: '0.6875rem',
                        height: 22,
                        borderRadius: '6px',
                        '& .MuiChip-label': { px: 0.75 },
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.25 }}>
                      {(c.status === 'DRAFT' || c.status === 'SUSPENDED') && (
                        <Tooltip title={t('contracts.activate')}>
                          <IconButton size="small" color="success" onClick={() => onActivate(c.id)}>
                            <CheckCircle size={16} strokeWidth={1.75} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {c.status === 'ACTIVE' && (
                        <Tooltip title={t('contracts.suspend')}>
                          <IconButton size="small" color="warning" onClick={() => onSuspend(c.id)}>
                            <Pause size={16} strokeWidth={1.75} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {(c.status === 'ACTIVE' || c.status === 'SUSPENDED') && (
                        <Tooltip title={t('contracts.terminate')}>
                          <IconButton size="small" color="error" onClick={() => onTerminateStart(c.id)}>
                            <Cancel size={16} strokeWidth={1.75} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {(c.status === 'DRAFT' || c.status === 'ACTIVE') && (
                        <Tooltip title={t('contracts.edit')}>
                          <IconButton size="small" onClick={() => onEdit(c)}>
                            <Edit size={16} strokeWidth={1.75} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ManagementContractsPage;
