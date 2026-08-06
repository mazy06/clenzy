import React, { useEffect, useMemo, useState, useCallback } from 'react';
import StatusChip, { type StatusTone } from '../../components/StatusChip';
import { Badge } from '../../components/ui';
import { Spinner } from '../../components/ui';
import { Button } from '../../components/ui';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import { Field, FieldLabel, Textarea } from '../../components/ui';
import { cn } from '../../utils/cn';
import {
  Add, Edit, CheckCircle, Pause, Cancel,
  Handshake, Home, Person, PictureAsPdf, Send,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useNotification } from '../../hooks/useNotification';
import {
  managementContractsApi,
  type ManagementContract,
  type ContractStatus,
} from '../../services/api/managementContractsApi';
import { documentsApi } from '../../services/api/documentsApi';
import apiClient from '../../services/apiClient';
import PageHeader from '../../components/PageHeader';
import FilterChipRow from '../../components/baitly/FilterChipRow';
import EmptyState from '../../components/EmptyState';
import { CONTRACT_TYPE_LABELS, type PropertyOption } from './ManagementContractForm';
import ManagementContractFormModal from './ManagementContractFormModal';

// ─── Palette de statut ──────────────────────────────────────────────────────
// Le RENDU de la puce passe par le ton sémantique de StatusChip (couple
// `-soft` / `-ink` conforme AA). `color` reste une valeur CSS : le chip de
// filtre la mélange à l'exécution (color-mix), donc aucune classe Tailwind ne
// pourrait être émise à la compilation — c'est la teinte vive qui convient.

interface StatusMeta { label: string; tone: StatusTone; color: string }

const STATUS_META: Record<ContractStatus, StatusMeta> = {
  ACTIVE:     { label: 'Actif',     tone: 'ok',      color: 'var(--bui-success)' },
  DRAFT:      { label: 'Brouillon', tone: 'neutral', color: 'var(--bui-muted-foreground)' },
  SUSPENDED:  { label: 'Suspendu',  tone: 'warn',    color: 'var(--bui-warning)' },
  TERMINATED: { label: 'Résilié',   tone: 'err',     color: 'var(--bui-destructive)' },
  EXPIRED:    { label: 'Expiré',    tone: 'err',     color: 'var(--bui-destructive)' },
};

// ─── Component ──────────────────────────────────────────────────────────────

const ManagementContractsPage: React.FC = () => {
  const { t } = useTranslation();
  const { notify } = useNotification();

  // State
  const [contracts, setContracts] = useState<ManagementContract[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ContractStatus | ''>('');

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
      notify.error(t('contracts.errorLoading'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, t, notify]);

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

  const showSuccess = (msg: string) => notify.success(msg);
  const showError = (msg: string) => notify.error(msg);

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
            size="compact"
          />
        )}
        actions={(
          <Tooltip>
            <TooltipTrigger asChild>
              {/* span : TooltipTrigger asChild pose une ref DOM, que le Button du
                  kit (fonction, React 18) ne transmet pas. */}
              <span className="inline-flex">
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="rounded-lg border-primary text-primary hover:bg-primary-soft hover:text-primary"
                  onClick={openCreateModal}
                  aria-label={t('contracts.create', 'Nouveau contrat')}
                >
                  <Add size={20} strokeWidth={1.75} />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{t('contracts.create', 'Nouveau contrat')}</TooltipContent>
          </Tooltip>
        )}
      />

      {/* ─── Body ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-9">
          <Spinner className="size-10" />
        </div>
      ) : contracts.length === 0 ? (
        <EmptyState
          icon={<Handshake />}
          title={t('contracts.noContracts')}
          description="Sans contrat actif, les paiements suivent la répartition par défaut de l'organisation (Paramètres → Paiement → Répartition des revenus)."
          tip="Crée un contrat ici pour appliquer une commission spécifique à un bien (au lieu de la répartition globale)."
          action={(
            <Button
              variant="outline"
              size="sm"
              onClick={openCreateModal}
            >
              <Add size={16} strokeWidth={1.75} />
              {t('contracts.createTitle', 'Créer un contrat de gestion')}
            </Button>
          )}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {activeContracts.length > 0 && (
            <ContractsTableSection
              title="Contrats en vigueur"
              accentColor="var(--bui-success-ink)"
              accentSoft="var(--bui-success-soft)"
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
              accentColor="var(--bui-muted-foreground)"
              accentSoft="var(--bui-muted)"
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
        <p className="text-2xs font-bold uppercase tracking-[.06em] text-faint">
          {title}
        </p>
        <span className="text-2xs font-bold px-[4.5px] py-px rounded-full tabular-nums" style={{ backgroundColor: accentSoft, color: accentColor }}>
          {contracts.length}
        </span>
      </div>
      <div className={cn('overflow-x-auto rounded-lg border border-solid border-border bg-card', muted && 'opacity-85')}>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted">
              <TableHead>{t('contracts.contractNumber')}</TableHead>
              <TableHead>{t('contracts.property')}</TableHead>
              <TableHead>{t('contracts.owner')}</TableHead>
              <TableHead>{t('contracts.type')}</TableHead>
              <TableHead className="text-center">{t('contracts.commission')}</TableHead>
              <TableHead>{t('contracts.period')}</TableHead>
              <TableHead className="text-center">{t('contracts.status')}</TableHead>
              <TableHead className="text-end">{t('contracts.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.map(c => {
              const meta: StatusMeta = STATUS_META[c.status]
                ?? { label: c.status, tone: 'neutral', color: 'var(--bui-muted-foreground)' };
              const isTerminating = terminatingId === c.id;

              if (isTerminating) {
                return (
                  <TableRow key={c.id}>
                    {/* whitespace-normal : le primitif est nowrap par defaut, or cette
                        cellule porte un panneau de texte qui doit se replier. */}
                    <TableCell colSpan={8} className="p-3 bg-destructive-soft whitespace-normal">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 text-destructive">
                          <Cancel size={18} strokeWidth={2} />
                          <h6 className="text-xs font-bold text-destructive-ink">
                            Résilier le contrat {c.contractNumber} ?
                          </h6>
                        </div>
                        <p className="text-[0.8125rem] text-foreground">
                          {t('contracts.terminateWarning')}
                        </p>
                        <Field>
                          <FieldLabel htmlFor={`terminate-reason-${c.id}`}>
                            {t('contracts.terminateReason')}
                          </FieldLabel>
                          <Textarea
                            id={`terminate-reason-${c.id}`}
                            className="w-full bg-card"
                            rows={2}
                            value={terminateReason}
                            onChange={e => setTerminateReason(e.target.value)}
                          />
                        </Field>
                        <div className="flex flex-row justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={onTerminateCancel}
                          >
                            {t('contracts.cancel')}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={onTerminateConfirm}
                          >
                            <Cancel size={14} strokeWidth={1.75} />
                            {t('contracts.confirmTerminate')}
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              }

              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <p className="font-semibold font-mono text-[0.8125rem] text-foreground">
                      {c.contractNumber}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="inline-flex text-faint">
                        <Home size={14} strokeWidth={1.75} />
                      </span>
                      <p className="text-[0.8125rem]">{getPropertyName(c.propertyId)}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="inline-flex text-faint">
                        <Person size={14} strokeWidth={1.75} />
                      </span>
                      <p className="text-[0.8125rem]">{getOwnerName(c.ownerId)}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-[0.8125rem]">{CONTRACT_TYPE_LABELS[c.contractType]}</p>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="bg-primary-soft text-primary tabular-nums">{`${(c.commissionRate * 100).toFixed(0)}%`}</Badge>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {c.startDate}{c.endDate ? ` → ${c.endDate}` : ' → ∞'}
                    </p>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <StatusChip tone={meta.tone} label={meta.label} />
                      {c.status === 'DRAFT' && c.signatureStatus === 'PENDING' && (
                        <p className="text-2xs font-semibold text-warning-ink">
                          {t('contracts.signature.pending', 'En attente de signature')}
                        </p>
                      )}
                      {c.status === 'DRAFT' && c.signatureStatus === 'EXPIRED' && (
                        <p className="text-2xs font-semibold text-destructive-ink">
                          {t('contracts.signature.expired', 'Lien de signature expiré')}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex justify-end gap-0.5">
                      {/* Chaque bouton d'action est enveloppe d'un span : TooltipTrigger
                          asChild pose une ref DOM que le Button du kit ne transmet pas. */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-primary"
                              aria-label="Voir le mandat de gestion"
                              onClick={() => onViewMandate(c.id)}
                            >
                              <PictureAsPdf size={16} strokeWidth={1.75} />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Voir le mandat de gestion</TooltipContent>
                      </Tooltip>
                      {c.status === 'DRAFT' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-warning hover:text-warning hover:bg-warning-soft"
                                aria-label={t('contracts.signature.resend', 'Renvoyer le lien de signature')}
                                onClick={() => onResendSignature(c.id)}
                              >
                                <Send size={16} strokeWidth={1.75} />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{t('contracts.signature.resend', 'Renvoyer le lien de signature')}</TooltipContent>
                        </Tooltip>
                      )}
                      {(c.status === 'DRAFT' || c.status === 'SUSPENDED') && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-success"
                                aria-label={t('contracts.activate')}
                                onClick={() => onActivate(c.id)}
                              >
                                <CheckCircle size={16} strokeWidth={1.75} />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{t('contracts.activate')}</TooltipContent>
                        </Tooltip>
                      )}
                      {c.status === 'ACTIVE' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-warning"
                                aria-label={t('contracts.suspend')}
                                onClick={() => onSuspend(c.id)}
                              >
                                <Pause size={16} strokeWidth={1.75} />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{t('contracts.suspend')}</TooltipContent>
                        </Tooltip>
                      )}
                      {(c.status === 'ACTIVE' || c.status === 'SUSPENDED') && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive"
                                aria-label={t('contracts.terminate')}
                                onClick={() => onTerminateStart(c.id)}
                              >
                                <Cancel size={16} strokeWidth={1.75} />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{t('contracts.terminate')}</TooltipContent>
                        </Tooltip>
                      )}
                      {(c.status === 'DRAFT' || c.status === 'ACTIVE') && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={t('contracts.edit')}
                                onClick={() => onEdit(c)}
                              >
                                <Edit size={16} strokeWidth={1.75} />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>{t('contracts.edit')}</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ManagementContractsPage;
