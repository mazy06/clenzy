import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Box, Paper, Button, Chip, IconButton, Tooltip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Alert, Snackbar, CircularProgress, Stack } from '@mui/material';
import {
  Add, Edit, CheckCircle, Pause, Cancel,
  Handshake, Home, Person, PictureAsPdf, Send,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import {
  managementContractsApi,
  type ManagementContract,
  type ContractStatus,
} from '../../services/api/managementContractsApi';
import { documentsApi } from '../../services/api/documentsApi';
import apiClient from '../../services/apiClient';
import PageHeader from '../../components/PageHeader';
import FilterChipRow from '../../components/FilterChipRow';
import EmptyState from '../../components/EmptyState';
import { CONTRACT_TYPE_LABELS, type PropertyOption } from './ManagementContractForm';
import ManagementContractFormModal from './ManagementContractFormModal';

// ─── Status palette (tokens Signature : chips -soft sémantiques) ────────────

interface StatusMeta { label: string; color: string; soft: string }

const STATUS_META: Record<ContractStatus, StatusMeta> = {
  ACTIVE:     { label: 'Actif',     color: 'var(--ok)',    soft: 'var(--ok-soft)' },
  DRAFT:      { label: 'Brouillon', color: 'var(--muted)', soft: 'var(--hover)' },
  SUSPENDED:  { label: 'Suspendu',  color: 'var(--warn)',  soft: 'var(--warn-soft)' },
  TERMINATED: { label: 'Résilié',   color: 'var(--err)',   soft: 'var(--err-soft)' },
  EXPIRED:    { label: 'Expiré',    color: 'var(--err)',   soft: 'var(--err-soft)' },
};

const FILTER_ALL_COLOR = 'var(--accent)';

// ─── Component ──────────────────────────────────────────────────────────────

const ManagementContractsPage: React.FC = () => {
  const { t } = useTranslation();

  // State
  const [contracts, setContracts] = useState<ManagementContract[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ContractStatus | ''>('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  // Modal de création/édition. editingContract != null = mode édition.
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<ManagementContract | null>(null);

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

  useEffect(() => { loadContracts(); }, [loadContracts]);
  useEffect(() => { loadProperties(); }, [loadProperties]);

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

  // ─── Modal handlers ──────────────────────────────────────────────────────

  const openCreateModal = () => {
    setEditingContract(null);
    setFormModalOpen(true);
  };

  const startEdit = (contract: ManagementContract) => {
    setEditingContract(contract);
    setFormModalOpen(true);
  };

  const closeFormModal = () => {
    setFormModalOpen(false);
    setEditingContract(null);
  };

  const handleSaved = () => {
    showSuccess(editingContract ? t('contracts.updated') : t('contracts.created'));
    loadContracts();
  };

  // ─── Lien de signature ───────────────────────────────────────────────────

  const handleResendSignature = async (id: number) => {
    try {
      await managementContractsApi.resendSignature(id);
      showSuccess(t('contracts.signature.resent', 'Lien de signature renvoyé au propriétaire'));
      loadContracts();
    } catch {
      showError(t('contracts.signature.resendError', "Impossible de renvoyer le lien — vérifiez que le propriétaire a un email."));
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

  // ─── Mandat de gestion ──────────────────────────────────────────────────
  // Ouvre le mandat PDF : version SIGNÉE (avec page certificat) si elle existe,
  // sinon l'original. Si aucun mandat n'a encore été généré (404), déclenche la
  // génération à la volée via POST /documents/generate.

  const handleViewMandate = async (contractId: number) => {
    try {
      await managementContractsApi.viewMandate(contractId);
      return;
    } catch {
      // 404 (aucune génération) ou autre erreur : on tente la génération à la volée.
    }
    try {
      const generated = await documentsApi.generateDocument({
        documentType: 'MANDAT_GESTION',
        referenceId: contractId,
        referenceType: 'MANAGEMENT_CONTRACT',
        sendEmail: false,
      });
      if (generated?.id) {
        showSuccess('Mandat généré');
        await documentsApi.viewGeneration(generated.id);
      } else {
        showError("Impossible de générer le mandat — aucun template actif pour MANDAT_GESTION.");
      }
    } catch (err) {
      showError("Impossible d'ouvrir le mandat. Vérifie qu'un template MANDAT_GESTION actif existe.");
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  // Options de filtre derivees du STATUS_META — passe au FilterChipRow partage
  const filterOptions = (Object.keys(STATUS_META) as ContractStatus[]).map(status => ({
    value: status,
    label: STATUS_META[status].label,
    color: STATUS_META[status].color,
    count: contracts.filter(c => c.status === status).length,
  }));

  return (
    <div className="flex flex-col gap-2">
      {/* ─── Header standardise (PageHeader) ──────────────────────────── */}
      <PageHeader
        title={t('contracts.title')}
        subtitle={t('contracts.subtitle')}
        iconBadge={<Handshake />}
        showBackButton={false}
        filters={(
          <FilterChipRow
            options={filterOptions}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as ContractStatus | '')}
            allLabel={t('contracts.allStatuses')}
            allCount={contracts.length}
            allColor={FILTER_ALL_COLOR}
            size="compact"
          />
        )}
        actions={(
          <Tooltip title={t('contracts.create', 'Nouveau contrat')}>
            <IconButton
              size="small"
              onClick={openCreateModal}
              sx={{
                p: 0.5,
                borderRadius: '9px',
                border: '1px solid var(--accent)',
                color: 'var(--accent)',
                '&:hover': { bgcolor: 'var(--accent-soft)', color: 'var(--accent)' },
              }}
            >
              <Add size={20} strokeWidth={1.75} />
            </IconButton>
          </Tooltip>
        )}
      />

      {/* ─── Body ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-9">
          <CircularProgress />
        </div>
      ) : contracts.length === 0 ? (
        <EmptyState
          icon={<Handshake />}
          title={t('contracts.noContracts')}
          description="Sans contrat actif, les paiements suivent la répartition par défaut de l'organisation (Paramètres → Paiement → Répartition des revenus)."
          tip="Crée un contrat ici pour appliquer une commission spécifique à un bien (au lieu de la répartition globale)."
          action={(
            <Button
              variant="outlined"
              size="small"
              startIcon={<Add size={16} strokeWidth={1.75} />}
              onClick={openCreateModal}
              sx={{ textTransform: 'none' }}
            >
              {t('contracts.createTitle', 'Créer un contrat de gestion')}
            </Button>
          )}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {activeContracts.length > 0 && (
            <ContractsTableSection
              title="Contrats en vigueur"
              accentColor="var(--ok)"
              accentSoft="var(--ok-soft)"
              contracts={activeContracts}
              terminatingId={terminatingId}
              terminateReason={terminateReason}
              setTerminateReason={setTerminateReason}
              getPropertyName={getPropertyName}
              getOwnerName={getOwnerName}
              onActivate={handleActivate}
              onSuspend={handleSuspend}
              onEdit={startEdit}
              onViewMandate={handleViewMandate}
              onResendSignature={handleResendSignature}
              onTerminateStart={startTerminate}
              onTerminateCancel={cancelTerminate}
              onTerminateConfirm={confirmTerminate}
            />
          )}
          {inactiveContracts.length > 0 && (
            <ContractsTableSection
              title="Contrats archivés"
              accentColor="var(--muted)"
              accentSoft="var(--hover)"
              contracts={inactiveContracts}
              terminatingId={terminatingId}
              terminateReason={terminateReason}
              setTerminateReason={setTerminateReason}
              getPropertyName={getPropertyName}
              getOwnerName={getOwnerName}
              onActivate={handleActivate}
              onSuspend={handleSuspend}
              onEdit={startEdit}
              onViewMandate={handleViewMandate}
              onResendSignature={handleResendSignature}
              onTerminateStart={startTerminate}
              onTerminateCancel={cancelTerminate}
              onTerminateConfirm={confirmTerminate}
              muted
            />
          )}
        </div>
      )}

      {/* Modal de création / édition */}
      <ManagementContractFormModal
        open={formModalOpen}
        onClose={closeFormModal}
        onSaved={handleSaved}
        contract={editingContract}
      />

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
    </div>
  );
};

// ─── Table section (used twice: actifs / archives) ──────────────────────────

interface ContractsTableSectionProps {
  title: string;
  accentColor: string;
  accentSoft: string;
  contracts: ManagementContract[];
  terminatingId: number | null;
  terminateReason: string;
  setTerminateReason: (v: string) => void;
  getPropertyName: (id: number) => string;
  getOwnerName: (id: number) => string;
  onActivate: (id: number) => void;
  onSuspend: (id: number) => void;
  onEdit: (c: ManagementContract) => void;
  onViewMandate: (id: number) => void;
  /** Renvoie le lien de signature au propriétaire (contrats DRAFT). */
  onResendSignature: (id: number) => void;
  onTerminateStart: (id: number) => void;
  onTerminateCancel: () => void;
  onTerminateConfirm: () => void;
  muted?: boolean;
}

const ContractsTableSection: React.FC<ContractsTableSectionProps> = ({
  title, accentColor, accentSoft, contracts,
  terminatingId, terminateReason, setTerminateReason,
  getPropertyName, getOwnerName,
  onActivate, onSuspend, onEdit, onViewMandate, onResendSignature,
  onTerminateStart, onTerminateCancel, onTerminateConfirm,
  muted,
}) => {
  const { t } = useTranslation();

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <p className="cn-text-body1 text-[10.5px] font-bold uppercase tracking-[.06em] text-[var(--faint)]">
          {title}
        </p>
        <Box
          component="span"
          sx={{
            fontSize: '10.5px',
            fontWeight: 700,
            px: 0.75,
            py: '1px',
            borderRadius: '999px',
            bgcolor: accentSoft,
            color: accentColor,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {contracts.length}
        </Box>
      </div>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 'var(--radius-lg)', borderColor: 'var(--line)', opacity: muted ? 0.85 : 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'var(--surface-2)' }}>
              <TableCell>{t('contracts.contractNumber')}</TableCell>
              <TableCell>{t('contracts.property')}</TableCell>
              <TableCell>{t('contracts.owner')}</TableCell>
              <TableCell>{t('contracts.type')}</TableCell>
              <TableCell align="center">{t('contracts.commission')}</TableCell>
              <TableCell>{t('contracts.period')}</TableCell>
              <TableCell align="center">{t('contracts.status')}</TableCell>
              <TableCell align="right">{t('contracts.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {contracts.map(c => {
              const meta = STATUS_META[c.status] ?? { label: c.status, color: 'var(--muted)', soft: 'var(--hover)' };
              const isTerminating = terminatingId === c.id;

              if (isTerminating) {
                return (
                  <TableRow key={c.id}>
                    <TableCell colSpan={8} sx={{ p: 2, bgcolor: 'var(--err-soft)' }}>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 text-[var(--err)]">
                          <Cancel size={18} strokeWidth={2} />
                          <h6 className="cn-text-subtitle2 font-bold text-[var(--err)]">
                            Résilier le contrat {c.contractNumber} ?
                          </h6>
                        </div>
                        <p className="cn-text-body2 text-[0.8125rem] text-[var(--body)]">
                          {t('contracts.terminateWarning')}
                        </p>
                        <TextField
                          label={t('contracts.terminateReason')}
                          value={terminateReason}
                          onChange={e => setTerminateReason(e.target.value)}
                          multiline
                          rows={2}
                          fullWidth
                          size="small"
                          sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'var(--card)' } }}
                        />
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={onTerminateCancel}
                          >
                            {t('contracts.cancel')}
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            color="error"
                            onClick={onTerminateConfirm}
                            startIcon={<Cancel size={14} strokeWidth={1.75} />}
                          >
                            {t('contracts.confirmTerminate')}
                          </Button>
                        </Stack>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              }

              return (
                <TableRow key={c.id} hover>
                  <TableCell>
                    <p className="cn-text-body2 font-semibold font-mono text-[0.8125rem] text-[var(--ink)]">
                      {c.contractNumber}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="inline-flex text-[var(--faint)]">
                        <Home size={14} strokeWidth={1.75} />
                      </span>
                      <p className="cn-text-body2 text-[0.8125rem]">{getPropertyName(c.propertyId)}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="inline-flex text-[var(--faint)]">
                        <Person size={14} strokeWidth={1.75} />
                      </span>
                      <p className="cn-text-body2 text-[0.8125rem]">{getOwnerName(c.ownerId)}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="cn-text-body2 text-[0.8125rem]">{CONTRACT_TYPE_LABELS[c.contractType]}</p>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={`${(c.commissionRate * 100).toFixed(0)}%`}
                      size="small"
                      sx={{
                        bgcolor: 'var(--accent-soft)',
                        color: 'var(--accent)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <p className="cn-text-body2 text-[0.75rem] text-[var(--muted)] tabular-nums">
                      {c.startDate}{c.endDate ? ` → ${c.endDate}` : ' → ∞'}
                    </p>
                  </TableCell>
                  <TableCell align="center">
                    <div className="flex flex-col items-center gap-0.5">
                      <Chip
                        label={meta.label}
                        size="small"
                        sx={{ bgcolor: meta.soft, color: meta.color }}
                      />
                      {c.status === 'DRAFT' && c.signatureStatus === 'PENDING' && (
                        <p className="cn-text-body1 text-[0.625rem] font-semibold text-[var(--warn)]">
                          {t('contracts.signature.pending', 'En attente de signature')}
                        </p>
                      )}
                      {c.status === 'DRAFT' && c.signatureStatus === 'EXPIRED' && (
                        <p className="cn-text-body1 text-[0.625rem] font-semibold text-[var(--err)]">
                          {t('contracts.signature.expired', 'Lien de signature expiré')}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex justify-end gap-0.5">
                      <Tooltip title="Voir le mandat de gestion">
                        <IconButton size="small" color="primary" onClick={() => onViewMandate(c.id)}>
                          <PictureAsPdf size={16} strokeWidth={1.75} />
                        </IconButton>
                      </Tooltip>
                      {c.status === 'DRAFT' && (
                        <Tooltip title={t('contracts.signature.resend', 'Renvoyer le lien de signature')}>
                          <IconButton size="small" sx={{ color: 'var(--warn)', '&:hover': { color: 'var(--warn)', bgcolor: 'var(--warn-soft)' } }} onClick={() => onResendSignature(c.id)}>
                            <Send size={16} strokeWidth={1.75} />
                          </IconButton>
                        </Tooltip>
                      )}
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
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};

export default ManagementContractsPage;
