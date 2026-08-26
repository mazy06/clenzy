import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription, Button as BuiButton } from '../../components/ui';
import { Spinner } from '../../components/ui';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import {
  Field,
  FieldLabel,
  FieldDescription,
  Input,
  Textarea,
  NativeSelect,
  NativeSelectOption,
} from '../../components/ui';
import { Add, OpenInNew, Refresh, ReportProblem, Warning } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { MANAGER_ROLES } from '../../constants/roles';
import { propertiesApi } from '../../services/api/propertiesApi';
import type { Property } from '../../services/api/propertiesApi';
import { extractApiList } from '../../types';
import StatusChip, { type StatusTone } from '../../components/StatusChip';
import FilterChipRow, { type FilterChipOption } from '../../components/baitly/FilterChipRow';
import EmptyState from '../../components/EmptyState';
import { issuesApi, type Issue, type IssueSeverity, type IssueStatus } from '../../services/api/issuesApi';
import { formatCurrency } from '../../utils/currencyUtils';
import compactHeaderActions from '../../components/compactHeaderActions';

// ─── Anomalies terrain (Moteur Ménage 3C / P10) ──────────────────────────────
// Liste org-scopée des signalements terrain + panneau de qualification :
// Qualifier (catégorie / sévérité / coût) → Convertir en maintenance / Rejeter.

const STATUS_TONES: Record<IssueStatus, StatusTone> = {
  OPEN: 'warn',
  QUALIFIED: 'info',
  CONVERTED: 'ok',
  DISMISSED: 'neutral',
};

const SEVERITY_TONES: Record<IssueSeverity, StatusTone> = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'warn',
  CRITICAL: 'err',
};

const SEVERITIES: IssueSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
// Miroir des catégories du mobile (AnomalyReportScreen) — mêmes valeurs backend.
const ISSUE_CATEGORIES = ['DAMAGE', 'MISSING_ITEM', 'HYGIENE', 'EQUIPMENT', 'SAFETY', 'OTHER'] as const;
const STATUSES: IssueStatus[] = ['OPEN', 'QUALIFIED', 'CONVERTED', 'DISMISSED'];

interface IssuesListProps {
  embedded?: boolean;
  actionsContainer?: HTMLElement | null;
  filtersContainer?: HTMLElement | null;
}

export default function IssuesList({ embedded = false, actionsContainer, filtersContainer }: IssuesListProps) {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const { hasAnyRole } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const canManage = hasAnyRole([...MANAGER_ROLES]);

  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<IssueStatus | ''>('');

  // Dialog de création (signalement web)
  const [createOpen, setCreateOpen] = useState(false);
  const [createPropertyId, setCreatePropertyId] = useState<number | ''>('');
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createCategory, setCreateCategory] = useState('');
  const [createSeverity, setCreateSeverity] = useState<IssueSeverity>('MEDIUM');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);

  // Panneau détail / qualification
  const [selected, setSelected] = useState<Issue | null>(null);
  const [editCategory, setEditCategory] = useState('');
  const [editSeverity, setEditSeverity] = useState<IssueSeverity>('MEDIUM');
  const [editCost, setEditCost] = useState('');
  const [dismissReason, setDismissReason] = useState('');
  const [confirmConvert, setConfirmConvert] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusLabel = useCallback(
    (status: IssueStatus) => t(`issues.status.${status.toLowerCase()}`, status),
    [t]
  );
  const severityLabel = useCallback(
    (severity: IssueSeverity) => t(`issues.severity.${severity.toLowerCase()}`, severity),
    [t]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await issuesApi.list(statusFilter ? { status: statusFilter } : undefined);
      setIssues(data);
    } catch {
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Deep-link depuis les notifications : ?tab=issues&highlight=<id>
  useEffect(() => {
    const highlight = searchParams.get('highlight');
    if (!highlight || issues.length === 0) return;
    const target = issues.find((issue) => issue.id === Number(highlight));
    if (target) {
      openDetail(target);
      const next = new URLSearchParams(searchParams);
      next.delete('highlight');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues]);

  const openCreate = async () => {
    setCreatePropertyId('');
    setCreateTitle('');
    setCreateDescription('');
    setCreateCategory('');
    setCreateSeverity('MEDIUM');
    setCreateError(null);
    setCreateOpen(true);
    if (properties.length === 0) {
      try {
        setProperties(extractApiList<Property>(await propertiesApi.getAll({ size: 500 })));
      } catch {
        setProperties([]);
      }
    }
  };

  const handleCreate = async () => {
    if (createPropertyId === '' || createTitle.trim() === '') return;
    setCreating(true);
    setCreateError(null);
    try {
      await issuesApi.create({
        propertyId: createPropertyId as number,
        title: createTitle.trim(),
        description: createDescription.trim() || undefined,
        category: createCategory || undefined,
        severity: createSeverity,
      });
      setCreateOpen(false);
      notify.success(t('issues.create.success', 'Anomalie signalée'));
      await load();
    } catch {
      setCreateError(t('issues.create.error', 'Création impossible — vérifiez les champs.'));
    } finally {
      setCreating(false);
    }
  };

  const openDetail = (issue: Issue) => {
    setSelected(issue);
    setEditCategory(issue.category ?? '');
    setEditSeverity(issue.severity);
    setEditCost(issue.suggestedCost != null ? String(issue.suggestedCost) : '');
    setDismissReason('');
    setConfirmConvert(false);
    setError(null);
  };

  const applyUpdated = (updated: Issue) => {
    setIssues((prev) => prev.map((issue) => (issue.id === updated.id ? updated : issue)));
    setSelected(updated);
  };

  const runAction = async (action: () => Promise<Issue>) => {
    setSaving(true);
    setError(null);
    try {
      applyUpdated(await action());
      setConfirmConvert(false);
    } catch {
      setError(t('issues.actionError', 'Action impossible — vérifiez le statut de l’anomalie.'));
    } finally {
      setSaving(false);
    }
  };

  const handleQualify = () =>
    runAction(() =>
      issuesApi.qualify(selected!.id, {
        category: editCategory.trim() || null,
        severity: editSeverity,
        suggestedCost: editCost.trim() === '' ? null : Number(editCost),
      })
    );

  const handleConvert = () => runAction(() => issuesApi.convert(selected!.id));
  const handleDismiss = () => runAction(() => issuesApi.dismiss(selected!.id, dismissReason.trim() || undefined));

  const filterOptions: FilterChipOption<IssueStatus>[] = useMemo(
    () =>
      STATUSES.map((status) => ({
        value: status,
        label: statusLabel(status),
        color: 'var(--bui-muted-foreground)',
        count: statusFilter === '' ? issues.filter((issue) => issue.status === status).length : undefined,
      })),
    [issues, statusFilter, statusLabel]
  );

  const isActionable = selected != null && (selected.status === 'OPEN' || selected.status === 'QUALIFIED');

  const actionButtons = (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <BuiButton
              variant="ghost"
              size="icon-sm"
              aria-label={t('common.refresh', 'Rafraîchir')}
              onClick={load}
            >
              <Refresh size={16} strokeWidth={1.75} />
            </BuiButton>
          </span>
        </TooltipTrigger>
        <TooltipContent>{t('common.refresh', 'Rafraîchir')}</TooltipContent>
      </Tooltip>
      <BuiButton size="sm" onClick={openCreate}>
        <Add />
        {t('issues.create.button', 'Signaler une anomalie')}
      </BuiButton>
    </>
  );

  const filterBar = (
    <FilterChipRow
      options={filterOptions}
      value={statusFilter}
      onChange={setStatusFilter}
      allLabel={t('issues.filters.all', 'Toutes')}
      size="compact"
    />
  );

  const content = loading ? (
    <div className="flex justify-center py-9">
      <Spinner className="size-7" />
    </div>
  ) : issues.length === 0 ? (
    <EmptyState
      icon={<ReportProblem />}
      title={t('issues.empty.title', 'Aucune anomalie signalée')}
      description={t(
        'issues.empty.description',
        'Les signalements du terrain (ménage, maintenance) apparaîtront ici pour qualification.'
      )}
      variant="transparent"
    />
  ) : (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('issues.columns.date', 'Date')}</TableHead>
            <TableHead>{t('issues.columns.property', 'Logement')}</TableHead>
            <TableHead>{t('issues.columns.title', 'Anomalie')}</TableHead>
            <TableHead>{t('issues.columns.severity', 'Sévérité')}</TableHead>
            <TableHead className="text-end">{t('issues.columns.suggestedCost', 'Coût suggéré')}</TableHead>
            <TableHead>{t('issues.columns.status', 'Statut')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((issue) => (
            <TableRow
              key={issue.id}
              onClick={() => openDetail(issue)}
              className="cursor-pointer"
            >
              <TableCell className="whitespace-nowrap tabular-nums">
                {issue.createdAt ? new Date(issue.createdAt).toLocaleDateString() : '—'}
              </TableCell>
              <TableCell>{issue.propertyName ?? '—'}</TableCell>
              <TableCell>
                <p className="text-xs font-medium">{issue.title}</p>
                {issue.reportedByName && (
                  <span className="text-xs text-muted-foreground">
                    {t('issues.reportedBy', 'Signalée par')} {issue.reportedByName}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <StatusChip tone={SEVERITY_TONES[issue.severity]} label={severityLabel(issue.severity)} dot />
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {issue.suggestedCost != null ? formatCurrency(issue.suggestedCost) : '—'}
              </TableCell>
              <TableCell>
                <StatusChip tone={STATUS_TONES[issue.status]} label={statusLabel(issue.status)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-auto">
      {embedded && actionsContainer && createPortal(compactHeaderActions(actionButtons), actionsContainer)}
      {embedded && filtersContainer && createPortal(filterBar, filtersContainer)}
      {!embedded && (
        <div className="flex flex-row items-center justify-between mb-[9px]">
          {filterBar}
          {actionButtons}
        </div>
      )}

      {content}

      {/* ── Dialog de création (signalement depuis le web) ── */}
      <Dialog open={createOpen} onOpenChange={(next) => { if (!next && !creating) setCreateOpen(false); }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{t('issues.create.title', 'Signaler une anomalie')}</DialogTitle>
          </DialogHeader>
          {/* Les filets haut/bas remplacent le `dividers` de la modale MUI. */}
          <div className="flex flex-col gap-3 border-y border-solid border-border py-3">
            <Field>
              <FieldLabel htmlFor="issue-create-property">{t('issues.create.property', 'Logement')}</FieldLabel>
              <NativeSelect
                id="issue-create-property"
                className="w-full"
                required
                value={createPropertyId === '' ? '' : String(createPropertyId)}
                onChange={(e) => setCreatePropertyId(Number(e.target.value))}
              >
                <NativeSelectOption value="" disabled>
                  {t('issues.create.selectProperty', 'Sélectionner un logement')}
                </NativeSelectOption>
                {properties.map((property) => (
                  <NativeSelectOption key={property.id} value={property.id}>{property.name}</NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="issue-create-title">{t('issues.columns.title', 'Anomalie')}</FieldLabel>
              <Input
                id="issue-create-title"
                className="w-full"
                required
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="issue-create-description">
                {t('issues.create.description', 'Description (optionnelle)')}
              </FieldLabel>
              {/* min-h-[2lh] : le primitif pose `field-sizing: content`, qui
                  neutralise `rows`. */}
              <Textarea
                id="issue-create-description"
                className="w-full min-h-[2lh]"
                rows={2}
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
              />
            </Field>
            <div className="flex flex-col min-[600px]:flex-row gap-[9px]">
              <Field>
                <FieldLabel htmlFor="issue-create-category">{t('issues.fields.category', 'Catégorie')}</FieldLabel>
                <NativeSelect
                  id="issue-create-category"
                  className="w-full"
                  value={createCategory}
                  onChange={(e) => setCreateCategory(e.target.value)}
                >
                  <NativeSelectOption value="">{t('issues.create.noCategory', 'Sans catégorie')}</NativeSelectOption>
                  {ISSUE_CATEGORIES.map((category) => (
                    <NativeSelectOption key={category} value={category}>
                      {t(`issues.categories.${category.toLowerCase()}`, category)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field className="min-w-[150px]">
                <FieldLabel htmlFor="issue-create-severity">{t('issues.fields.severity', 'Sévérité')}</FieldLabel>
                <NativeSelect
                  id="issue-create-severity"
                  className="w-full"
                  value={createSeverity}
                  onChange={(e) => setCreateSeverity(e.target.value as IssueSeverity)}
                >
                  {SEVERITIES.map((severity) => (
                    <NativeSelectOption key={severity} value={severity}>{severityLabel(severity)}</NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            {createError && (
              <Alert variant="destructive">
                <Warning />
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <BuiButton variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              {t('common.cancel', 'Annuler')}
            </BuiButton>
            <BuiButton
              onClick={handleCreate}
              disabled={creating || createPropertyId === '' || createTitle.trim() === ''}
            >
              {t('issues.create.submit', 'Signaler')}
            </BuiButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Panneau détail / qualification ── */}
      <Dialog open={selected != null} onOpenChange={(next) => { if (!next) setSelected(null); }}>
        <DialogContent className="sm:max-w-[600px]">
        {selected && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-row items-center gap-1.5 flex-wrap">
                <span className="flex-1 min-w-0">
                  {selected.title}
                </span>
                <StatusChip tone={STATUS_TONES[selected.status]} label={statusLabel(selected.status)} />
              </DialogTitle>
            </DialogHeader>
            {/* Les filets haut/bas remplacent le `dividers` de la modale MUI. */}
            <div className="flex flex-col gap-3 border-y border-solid border-border py-3">
                <div>
                  <span className="text-xs text-muted-foreground">
                    {selected.propertyName ?? '—'}
                    {' · '}
                    {selected.createdAt ? new Date(selected.createdAt).toLocaleString() : ''}
                    {selected.reportedByName ? ` · ${t('issues.reportedBy', 'Signalée par')} ${selected.reportedByName}` : ''}
                  </span>
                  {selected.description && (
                    <p className="text-xs mt-1 whitespace-pre-wrap">
                      {selected.description}
                    </p>
                  )}
                  {selected.dismissReason && (
                    <p className="text-xs mt-1 text-muted-foreground">
                      {t('issues.dismissedReason', 'Motif du rejet')} : {selected.dismissReason}
                    </p>
                  )}
                </div>

                {selected.status === 'CONVERTED' && selected.convertedServiceRequestId != null && (
                  <BuiButton
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/service-requests/${selected.convertedServiceRequestId}`)}
                    className="self-start"
                  >
                    <OpenInNew />
                    {t('issues.openServiceRequest', 'Voir la demande de maintenance')}
                  </BuiButton>
                )}

                {canManage && isActionable && (
                  <div className="flex flex-col gap-[9px]">
                    <h6 className="text-xs font-medium">
                      {t('issues.qualifySection', 'Qualification')}
                    </h6>
                    <div className="flex flex-col min-[600px]:flex-row gap-[9px]">
                      <Field>
                        <FieldLabel htmlFor="issue-edit-category">{t('issues.fields.category', 'Catégorie')}</FieldLabel>
                        <Input
                          id="issue-edit-category"
                          className="w-full"
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                        />
                        <FieldDescription>
                          {t('issues.fields.categoryHelp', 'Alignée sur le catalogue travaux → chiffrage automatique')}
                        </FieldDescription>
                      </Field>
                      <Field className="min-w-[140px]">
                        <FieldLabel htmlFor="issue-edit-severity">{t('issues.fields.severity', 'Sévérité')}</FieldLabel>
                        <NativeSelect
                          id="issue-edit-severity"
                          className="w-full"
                          value={editSeverity}
                          onChange={(e) => setEditSeverity(e.target.value as IssueSeverity)}
                        >
                          {SEVERITIES.map((severity) => (
                            <NativeSelectOption key={severity} value={severity}>{severityLabel(severity)}</NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </Field>
                      <Field className="min-w-[120px]">
                        <FieldLabel htmlFor="issue-edit-cost">{t('issues.fields.suggestedCost', 'Coût (€)')}</FieldLabel>
                        <Input
                          id="issue-edit-cost"
                          className="w-full"
                          type="number"
                          min={0}
                          step="0.01"
                          value={editCost}
                          onChange={(e) => setEditCost(e.target.value.replace(',', '.'))}
                        />
                      </Field>
                    </div>
                  </div>
                )}

                {canManage && isActionable && confirmConvert && (
                  <Alert variant="warning">
                    <Warning />
                    <AlertDescription>
                      {t('issues.convertConfirm', 'Créer une demande de maintenance pré-chiffrée à')}{' '}
                      <span className="font-semibold tabular-nums">
                        {selected.suggestedCost != null
                          ? formatCurrency(selected.suggestedCost)
                          : t('issues.noCost', 'chiffrage manuel')}
                      </span>
                      {' — '}{t('issues.convertConfirmSuffix', 'confirmer ?')}
                    </AlertDescription>
                  </Alert>
                )}

                {canManage && isActionable && !confirmConvert && (
                  <Field>
                    <FieldLabel htmlFor="issue-dismiss-reason">
                      {t('issues.fields.dismissReason', 'Motif de rejet (optionnel)')}
                    </FieldLabel>
                    <Input
                      id="issue-dismiss-reason"
                      className="w-full"
                      value={dismissReason}
                      onChange={(e) => setDismissReason(e.target.value)}
                    />
                  </Field>
                )}

                {error && (
                  <Alert variant="destructive">
                    <Warning />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
            </div>
            <DialogFooter className="gap-1.5">
              <BuiButton variant="ghost" onClick={() => setSelected(null)} disabled={saving}>
                {t('common.close', 'Fermer')}
              </BuiButton>
              {canManage && isActionable && (
                <>
                  {/* « Rejeter » reste tertiaire (ghost) : c'est l'issue de secours,
                      pas une suppression — la conversion est l'action attendue. */}
                  <BuiButton variant="ghost" onClick={handleDismiss} disabled={saving}>
                    {t('issues.actions.dismiss', 'Rejeter')}
                  </BuiButton>
                  <BuiButton variant="outline" onClick={handleQualify} disabled={saving}>
                    {t('issues.actions.qualify', 'Qualifier')}
                  </BuiButton>
                  {confirmConvert ? (
                    <BuiButton onClick={handleConvert} disabled={saving}>
                      {t('issues.actions.confirmConvert', 'Confirmer la conversion')}
                    </BuiButton>
                  ) : (
                    <BuiButton onClick={() => setConfirmConvert(true)} disabled={saving}>
                      {t('issues.actions.convert', 'Convertir en maintenance')}
                    </BuiButton>
                  )}
                </>
              )}
            </DialogFooter>
          </>
        )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
