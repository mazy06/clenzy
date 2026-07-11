import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Snackbar,
  Alert,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Add, OpenInNew, Refresh, ReportProblem } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { MANAGER_ROLES } from '../../constants/roles';
import { propertiesApi } from '../../services/api';
import type { Property } from '../../services/api/propertiesApi';
import { extractApiList } from '../../types';
import StatusChip, { type StatusTone } from '../../components/StatusChip';
import FilterChipRow, { type FilterChipOption } from '../../components/FilterChipRow';
import EmptyState from '../../components/EmptyState';
import { issuesApi, type Issue, type IssueSeverity, type IssueStatus } from '../../services/api/issuesApi';
import { formatCurrency } from '../../utils/currencyUtils';

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
  const [createdToast, setCreatedToast] = useState(false);
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
      setCreatedToast(true);
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
        color: 'var(--muted)',
        count: statusFilter === '' ? issues.filter((issue) => issue.status === status).length : undefined,
      })),
    [issues, statusFilter, statusLabel]
  );

  const isActionable = selected != null && (selected.status === 'OPEN' || selected.status === 'QUALIFIED');

  const actionButtons = (
    <>
      <Tooltip title={t('common.refresh', 'Rafraîchir')}>
        <IconButton onClick={load} size="small" sx={{ cursor: 'pointer' }}>
          <Refresh fontSize="small" />
        </IconButton>
      </Tooltip>
      <Button
        variant="contained"
        size="small"
        startIcon={<Add />}
        onClick={openCreate}
      >
        {t('issues.create.button', 'Signaler une anomalie')}
      </Button>
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
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
      <CircularProgress size={28} />
    </Box>
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
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('issues.columns.date', 'Date')}</TableCell>
            <TableCell>{t('issues.columns.property', 'Logement')}</TableCell>
            <TableCell>{t('issues.columns.title', 'Anomalie')}</TableCell>
            <TableCell>{t('issues.columns.severity', 'Sévérité')}</TableCell>
            <TableCell align="right">{t('issues.columns.suggestedCost', 'Coût suggéré')}</TableCell>
            <TableCell>{t('issues.columns.status', 'Statut')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {issues.map((issue) => (
            <TableRow
              key={issue.id}
              hover
              onClick={() => openDetail(issue)}
              sx={{ cursor: 'pointer' }}
            >
              <TableCell sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                {issue.createdAt ? new Date(issue.createdAt).toLocaleDateString() : '—'}
              </TableCell>
              <TableCell>{issue.propertyName ?? '—'}</TableCell>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{issue.title}</Typography>
                {issue.reportedByName && (
                  <Typography variant="caption" sx={{ color: 'var(--muted)' }}>
                    {t('issues.reportedBy', 'Signalée par')} {issue.reportedByName}
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <StatusChip tone={SEVERITY_TONES[issue.severity]} label={severityLabel(issue.severity)} dot />
              </TableCell>
              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {issue.suggestedCost != null ? formatCurrency(issue.suggestedCost) : '—'}
              </TableCell>
              <TableCell>
                <StatusChip tone={STATUS_TONES[issue.status]} label={statusLabel(issue.status)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      {embedded && actionsContainer && createPortal(actionButtons, actionsContainer)}
      {embedded && filtersContainer && createPortal(filterBar, filtersContainer)}
      {!embedded && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          {filterBar}
          {actionButtons}
        </Stack>
      )}

      {content}

      {/* ── Dialog de création (signalement depuis le web) ── */}
      <Dialog open={createOpen} onClose={() => !creating && setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('issues.create.title', 'Signaler une anomalie')}</DialogTitle>
        <DialogContent dividers>
          <Stack gap={2} sx={{ pt: 0.5 }}>
            <TextField
              select
              required
              label={t('issues.create.property', 'Logement')}
              value={createPropertyId === '' ? '' : createPropertyId}
              onChange={(e) => setCreatePropertyId(Number(e.target.value))}
              size="small"
              fullWidth
              SelectProps={{ displayEmpty: true }}
              InputLabelProps={{ shrink: true }}
            >
              <MenuItem value="" disabled>{t('issues.create.selectProperty', 'Sélectionner un logement')}</MenuItem>
              {properties.map((property) => (
                <MenuItem key={property.id} value={property.id}>{property.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              required
              label={t('issues.columns.title', 'Anomalie')}
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              size="small"
              fullWidth
            />
            <TextField
              label={t('issues.create.description', 'Description (optionnelle)')}
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              size="small"
              fullWidth
              multiline
              minRows={2}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
              <TextField
                select
                label={t('issues.fields.category', 'Catégorie')}
                value={createCategory}
                onChange={(e) => setCreateCategory(e.target.value)}
                size="small"
                fullWidth
              >
                <MenuItem value="">{t('issues.create.noCategory', 'Sans catégorie')}</MenuItem>
                {ISSUE_CATEGORIES.map((category) => (
                  <MenuItem key={category} value={category}>
                    {t(`issues.categories.${category.toLowerCase()}`, category)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={t('issues.fields.severity', 'Sévérité')}
                value={createSeverity}
                onChange={(e) => setCreateSeverity(e.target.value as IssueSeverity)}
                size="small"
                sx={{ minWidth: 150 }}
              >
                {SEVERITIES.map((severity) => (
                  <MenuItem key={severity} value={severity}>{severityLabel(severity)}</MenuItem>
                ))}
              </TextField>
            </Stack>
            {createError && (
              <Typography variant="body2" sx={{ color: 'var(--err)' }}>{createError}</Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setCreateOpen(false)} disabled={creating}>
            {t('common.cancel', 'Annuler')}
          </Button>
          <Button
            onClick={handleCreate}
            variant="contained"
            disabled={creating || createPropertyId === '' || createTitle.trim() === ''}
          >
            {t('issues.create.submit', 'Signaler')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={createdToast}
        autoHideDuration={4000}
        onClose={() => setCreatedToast(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setCreatedToast(false)}>
          {t('issues.create.success', 'Anomalie signalée')}
        </Alert>
      </Snackbar>

      {/* ── Panneau détail / qualification ── */}
      <Dialog open={selected != null} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
        {selected && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                <Typography component="span" variant="h6" sx={{ flex: 1, minWidth: 0 }}>
                  {selected.title}
                </Typography>
                <StatusChip tone={STATUS_TONES[selected.status]} label={statusLabel(selected.status)} />
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Stack gap={2}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'var(--muted)' }}>
                    {selected.propertyName ?? '—'}
                    {' · '}
                    {selected.createdAt ? new Date(selected.createdAt).toLocaleString() : ''}
                    {selected.reportedByName ? ` · ${t('issues.reportedBy', 'Signalée par')} ${selected.reportedByName}` : ''}
                  </Typography>
                  {selected.description && (
                    <Typography variant="body2" sx={{ mt: 0.75, whiteSpace: 'pre-wrap' }}>
                      {selected.description}
                    </Typography>
                  )}
                  {selected.dismissReason && (
                    <Typography variant="body2" sx={{ mt: 0.75, color: 'var(--muted)' }}>
                      {t('issues.dismissedReason', 'Motif du rejet')} : {selected.dismissReason}
                    </Typography>
                  )}
                </Box>

                {selected.status === 'CONVERTED' && selected.convertedServiceRequestId != null && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<OpenInNew />}
                    onClick={() => navigate(`/service-requests/${selected.convertedServiceRequestId}`)}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    {t('issues.openServiceRequest', 'Voir la demande de maintenance')}
                  </Button>
                )}

                {canManage && isActionable && (
                  <Stack gap={1.5}>
                    <Typography variant="subtitle2">
                      {t('issues.qualifySection', 'Qualification')}
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5}>
                      <TextField
                        label={t('issues.fields.category', 'Catégorie')}
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        size="small"
                        fullWidth
                        helperText={t('issues.fields.categoryHelp', 'Alignée sur le catalogue travaux → chiffrage automatique')}
                      />
                      <TextField
                        select
                        label={t('issues.fields.severity', 'Sévérité')}
                        value={editSeverity}
                        onChange={(e) => setEditSeverity(e.target.value as IssueSeverity)}
                        size="small"
                        sx={{ minWidth: 140 }}
                      >
                        {SEVERITIES.map((severity) => (
                          <MenuItem key={severity} value={severity}>{severityLabel(severity)}</MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        label={t('issues.fields.suggestedCost', 'Coût (€)')}
                        value={editCost}
                        onChange={(e) => setEditCost(e.target.value.replace(',', '.'))}
                        size="small"
                        type="number"
                        inputProps={{ min: 0, step: '0.01' }}
                        sx={{ minWidth: 120 }}
                      />
                    </Stack>
                  </Stack>
                )}

                {canManage && isActionable && confirmConvert && (
                  <Typography variant="body2" sx={{ color: 'var(--warn)' }}>
                    {t('issues.convertConfirm', 'Créer une demande de maintenance pré-chiffrée à')}{' '}
                    <Box component="span" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {selected.suggestedCost != null
                        ? formatCurrency(selected.suggestedCost)
                        : t('issues.noCost', 'chiffrage manuel')}
                    </Box>
                    {' — '}{t('issues.convertConfirmSuffix', 'confirmer ?')}
                  </Typography>
                )}

                {canManage && isActionable && !confirmConvert && (
                  <TextField
                    label={t('issues.fields.dismissReason', 'Motif de rejet (optionnel)')}
                    value={dismissReason}
                    onChange={(e) => setDismissReason(e.target.value)}
                    size="small"
                    fullWidth
                  />
                )}

                {error && (
                  <Typography variant="body2" sx={{ color: 'var(--err)' }}>{error}</Typography>
                )}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
              <Button onClick={() => setSelected(null)} disabled={saving}>
                {t('common.close', 'Fermer')}
              </Button>
              {canManage && isActionable && (
                <>
                  <Button onClick={handleDismiss} disabled={saving} color="inherit">
                    {t('issues.actions.dismiss', 'Rejeter')}
                  </Button>
                  <Button onClick={handleQualify} disabled={saving} variant="outlined">
                    {t('issues.actions.qualify', 'Qualifier')}
                  </Button>
                  {confirmConvert ? (
                    <Button onClick={handleConvert} disabled={saving} variant="contained">
                      {t('issues.actions.confirmConvert', 'Confirmer la conversion')}
                    </Button>
                  ) : (
                    <Button onClick={() => setConfirmConvert(true)} disabled={saving} variant="contained">
                      {t('issues.actions.convert', 'Convertir en maintenance')}
                    </Button>
                  )}
                </>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
