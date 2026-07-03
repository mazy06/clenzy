import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import {
  yieldRulesApi,
  type YieldConfig,
  type YieldJournalPage,
  type YieldMode,
  type YieldPropertyBounds,
  type YieldRuleV1,
} from '../../services/api/yieldRulesApi';

// ─── Constants ──────────────────────────────────────────────────────────────

const NUM_SX = { fontVariantNumeric: 'tabular-nums' } as const;

const EMPTY_RULE: Omit<YieldRuleV1, 'id'> = {
  propertyId: null,
  name: '',
  comparison: 'BELOW',
  occupancyThresholdPct: 40,
  windowDaysAhead: 30,
  adjustmentPct: 5,
  maxDailyChangePct: 10,
  active: true,
  priority: 0,
};

// ─── Component ──────────────────────────────────────────────────────────────

const YieldRulesPanel: React.FC = () => {
  const { t } = useTranslation();

  const [config, setConfig] = useState<YieldConfig | null>(null);
  const [rules, setRules] = useState<YieldRuleV1[]>([]);
  const [bounds, setBounds] = useState<YieldPropertyBounds[]>([]);
  const [journal, setJournal] = useState<YieldJournalPage | null>(null);
  const [journalPage, setJournalPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rule edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Omit<YieldRuleV1, 'id'>>(EMPTY_RULE);
  const [saving, setSaving] = useState(false);

  // Bounds inline edit
  const [boundsDraft, setBoundsDraft] = useState<Record<number, { floor: string; ceiling: string }>>({});

  const propertyNames = useMemo(() => {
    const map = new Map<number, string>();
    bounds.forEach((b) => map.set(b.propertyId, b.propertyName));
    return map;
  }, [bounds]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfg, ruleList, boundsList, journalPage0] = await Promise.all([
        yieldRulesApi.getConfig(),
        yieldRulesApi.listRules(),
        yieldRulesApi.listPropertyBounds(),
        yieldRulesApi.getJournal({ page: 0 }),
      ]);
      setConfig(cfg);
      setRules(ruleList);
      setBounds(boundsList);
      setJournal(journalPage0);
      setJournalPage(0);
    } catch {
      setError(t('yieldRules.loadError', 'Impossible de charger la configuration yield.'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const loadJournal = useCallback(async (page: number) => {
    try {
      const result = await yieldRulesApi.getJournal({ page });
      setJournal(result);
      setJournalPage(page);
    } catch {
      setError(t('yieldRules.loadError', 'Impossible de charger la configuration yield.'));
    }
  }, [t]);

  // ── Config handlers ──

  const updateConfig = async (next: YieldConfig) => {
    const previous = config;
    setConfig(next); // optimistic
    try {
      setConfig(await yieldRulesApi.updateConfig(next));
    } catch {
      setConfig(previous);
      setError(t('yieldRules.saveError', 'Enregistrement impossible, réessayez.'));
    }
  };

  // ── Rule handlers ──

  const openCreate = () => {
    setEditingId(null);
    setDraft(EMPTY_RULE);
    setDialogOpen(true);
  };

  const openEdit = (rule: YieldRuleV1) => {
    setEditingId(rule.id);
    setDraft({ ...rule });
    setDialogOpen(true);
  };

  const saveRule = async () => {
    setSaving(true);
    setError(null);
    try {
      if (editingId != null) {
        const updated = await yieldRulesApi.updateRule(editingId, draft);
        setRules((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
      } else {
        const created = await yieldRulesApi.createRule(draft);
        setRules((prev) => [...prev, created]);
      }
      setDialogOpen(false);
    } catch {
      setError(t('yieldRules.saveError', 'Enregistrement impossible, réessayez.'));
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (id: number) => {
    try {
      await yieldRulesApi.deleteRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError(t('yieldRules.saveError', 'Enregistrement impossible, réessayez.'));
    }
  };

  // ── Bounds handlers ──

  const boundsValue = (b: YieldPropertyBounds) =>
    boundsDraft[b.propertyId] ?? {
      floor: b.floor != null ? String(b.floor) : '',
      ceiling: b.ceiling != null ? String(b.ceiling) : '',
    };

  const saveBounds = async (propertyId: number) => {
    const value = boundsDraft[propertyId];
    if (!value) return;
    const floor = value.floor.trim() === '' ? null : Number(value.floor);
    const ceiling = value.ceiling.trim() === '' ? null : Number(value.ceiling);
    try {
      const updated = await yieldRulesApi.updatePropertyBounds(propertyId, floor, ceiling);
      setBounds((prev) => prev.map((b) => (b.propertyId === propertyId ? updated : b)));
      setBoundsDraft((prev) => {
        const next = { ...prev };
        delete next[propertyId];
        return next;
      });
    } catch {
      setError(t('yieldRules.boundsError', 'Bornes invalides : plancher < plafond, tous deux positifs (ou aucun).'));
    }
  };

  // ── Render ──

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  const modeHelp: Record<YieldMode, string> = {
    SIMULATION: t('yieldRules.modeHelp.simulation', 'Rapport de ce qui aurait changé — aucune écriture tarifaire.'),
    SUGGEST: t('yieldRules.modeHelp.suggest', 'Suggestions à approuver : les montants sont recalculés à l’application.'),
    AUTO: t('yieldRules.modeHelp.auto', 'Application automatique, bornée par le plancher/plafond de chaque bien.'),
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* ── Config org : kill-switch + mode ── */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <FormControlLabel
            control={
              <Switch
                checked={config?.enabled ?? false}
                onChange={(_, checked) => config && void updateConfig({ ...config, enabled: checked })}
              />
            }
            label={t('yieldRules.killSwitch', 'Yield automatique activé')}
          />
          <ToggleButtonGroup
            size="small"
            exclusive
            value={config?.mode ?? 'SIMULATION'}
            onChange={(_, mode: YieldMode | null) =>
              mode && config && void updateConfig({ ...config, mode })
            }
          >
            <ToggleButton value="SIMULATION">{t('yieldRules.mode.simulation', 'Simulation')}</ToggleButton>
            <ToggleButton value="SUGGEST">{t('yieldRules.mode.suggest', 'Suggestion')}</ToggleButton>
            <ToggleButton value="AUTO">{t('yieldRules.mode.auto', 'Automatique')}</ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="body2" sx={{ color: 'var(--muted)' }}>
            {modeHelp[(config?.mode ?? 'SIMULATION') as YieldMode]}
          </Typography>
        </Box>
      </Paper>

      {/* ── Règles ── */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {t('yieldRules.rulesTitle', 'Règles d’occupation')}
          </Typography>
          <Button size="small" variant="outlined" startIcon={<Plus size={16} />} onClick={openCreate}>
            {t('yieldRules.addRule', 'Ajouter une règle')}
          </Button>
        </Box>
        {rules.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'var(--muted)', py: 2 }}>
            {t(
              'yieldRules.noRules',
              'Aucune règle. Exemple : « si occupation < 40 % à 30 jours, baisser de 5 % ».',
            )}
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('yieldRules.col.name', 'Nom')}</TableCell>
                <TableCell>{t('yieldRules.col.scope', 'Périmètre')}</TableCell>
                <TableCell>{t('yieldRules.col.condition', 'Condition')}</TableCell>
                <TableCell align="right">{t('yieldRules.col.adjustment', 'Ajustement')}</TableCell>
                <TableCell align="right">{t('yieldRules.col.dailyCap', 'Cap / jour')}</TableCell>
                <TableCell>{t('yieldRules.col.status', 'Statut')}</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id} hover>
                  <TableCell>{rule.name}</TableCell>
                  <TableCell>
                    {rule.propertyId != null
                      ? propertyNames.get(rule.propertyId) ?? `#${rule.propertyId}`
                      : t('yieldRules.scopeAll', 'Tous les biens')}
                  </TableCell>
                  <TableCell sx={NUM_SX}>
                    {rule.comparison === 'BELOW'
                      ? t('yieldRules.conditionBelow', 'Occupation < {{pct}} % à {{days}} j', {
                          pct: rule.occupancyThresholdPct,
                          days: rule.windowDaysAhead,
                        })
                      : t('yieldRules.conditionAbove', 'Occupation > {{pct}} % à {{days}} j', {
                          pct: rule.occupancyThresholdPct,
                          days: rule.windowDaysAhead,
                        })}
                  </TableCell>
                  <TableCell align="right" sx={NUM_SX}>
                    {rule.comparison === 'BELOW' ? '−' : '+'}
                    {rule.adjustmentPct} %
                  </TableCell>
                  <TableCell align="right" sx={NUM_SX}>{rule.maxDailyChangePct} %</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={rule.active
                        ? t('yieldRules.active', 'Active')
                        : t('yieldRules.inactive', 'Inactive')}
                      color={rule.active ? 'success' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <IconButton size="small" onClick={() => openEdit(rule)} sx={{ cursor: 'pointer' }}>
                      <Pencil size={15} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => rule.id != null && void deleteRule(rule.id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* ── Bornes par bien ── */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
          {t('yieldRules.boundsTitle', 'Garde-fous par bien')}
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--muted)', mb: 1 }}>
          {t(
            'yieldRules.boundsSubtitle',
            'Plancher et plafond obligatoires : sans les deux, le yield ignore le bien (journalisé NO_BOUNDS).',
          )}
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('yieldRules.col.property', 'Bien')}</TableCell>
              <TableCell align="right">{t('yieldRules.col.floor', 'Plancher (€)')}</TableCell>
              <TableCell align="right">{t('yieldRules.col.ceiling', 'Plafond (€)')}</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {bounds.map((b) => {
              const value = boundsValue(b);
              const dirty = boundsDraft[b.propertyId] != null;
              return (
                <TableRow key={b.propertyId} hover>
                  <TableCell>{b.propertyName}</TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      value={value.floor}
                      onChange={(e) =>
                        setBoundsDraft((prev) => ({
                          ...prev,
                          [b.propertyId]: { ...value, floor: e.target.value },
                        }))
                      }
                      inputProps={{ inputMode: 'decimal', style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }}
                      sx={{ width: 110 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      value={value.ceiling}
                      onChange={(e) =>
                        setBoundsDraft((prev) => ({
                          ...prev,
                          [b.propertyId]: { ...value, ceiling: e.target.value },
                        }))
                      }
                      inputProps={{ inputMode: 'decimal', style: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } }}
                      sx={{ width: 110 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={t('yieldRules.saveBounds', 'Enregistrer les bornes')}>
                      <span>
                        <IconButton
                          size="small"
                          disabled={!dirty}
                          onClick={() => void saveBounds(b.propertyId)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <Save size={15} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>

      {/* ── Journal ── */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          {t('yieldRules.journalTitle', 'Journal des ajustements')}
        </Typography>
        {!journal || journal.content.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'var(--muted)', py: 2 }}>
            {t('yieldRules.journalEmpty', 'Aucun ajustement journalisé pour le moment.')}
          </Typography>
        ) : (
          <>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('yieldRules.col.day', 'Évalué le')}</TableCell>
                    <TableCell>{t('yieldRules.col.property', 'Bien')}</TableCell>
                    <TableCell>{t('yieldRules.col.targetDate', 'Nuit')}</TableCell>
                    <TableCell>{t('yieldRules.col.mode', 'Mode')}</TableCell>
                    <TableCell align="right">{t('yieldRules.col.before', 'Avant')}</TableCell>
                    <TableCell align="right">{t('yieldRules.col.after', 'Après')}</TableCell>
                    <TableCell align="right">{t('yieldRules.col.occupancy', 'Occupation')}</TableCell>
                    <TableCell>{t('yieldRules.col.detail', 'Détail')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {journal.content.map((entry) => (
                    <TableRow key={entry.id} hover>
                      <TableCell sx={NUM_SX}>{entry.adjustmentDay}</TableCell>
                      <TableCell>
                        {propertyNames.get(entry.propertyId) ?? `#${entry.propertyId}`}
                      </TableCell>
                      <TableCell sx={NUM_SX}>{entry.targetDate ?? '—'}</TableCell>
                      <TableCell>
                        {entry.skipReason ? (
                          <Chip size="small" variant="outlined" color="warning" label={entry.skipReason} />
                        ) : (
                          <Chip size="small" variant="outlined" label={entry.mode} />
                        )}
                      </TableCell>
                      <TableCell align="right" sx={NUM_SX}>
                        {entry.priceBefore != null ? entry.priceBefore.toFixed(2) : '—'}
                      </TableCell>
                      <TableCell align="right" sx={NUM_SX}>
                        {entry.priceAfter != null ? entry.priceAfter.toFixed(2) : '—'}
                      </TableCell>
                      <TableCell align="right" sx={NUM_SX}>
                        {entry.occupancyPct != null ? `${entry.occupancyPct} %` : '—'}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 320 }}>
                        <Typography variant="body2" noWrap title={entry.reason ?? ''}>
                          {entry.reason ?? '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            <TablePagination
              component="div"
              count={journal.totalElements}
              page={journalPage}
              onPageChange={(_, page) => void loadJournal(page)}
              rowsPerPage={journal.size}
              rowsPerPageOptions={[journal.size]}
            />
          </>
        )}
      </Paper>

      {/* ── Dialog règle ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingId != null
            ? t('yieldRules.editRule', 'Modifier la règle')
            : t('yieldRules.newRule', 'Nouvelle règle de yield')}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          <TextField
            label={t('yieldRules.field.name', 'Nom')}
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            size="small"
            fullWidth
          />
          <FormControl size="small" fullWidth>
            <InputLabel>{t('yieldRules.field.scope', 'Périmètre')}</InputLabel>
            <Select
              label={t('yieldRules.field.scope', 'Périmètre')}
              value={draft.propertyId ?? ''}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  propertyId: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
            >
              <MenuItem value="">{t('yieldRules.scopeAll', 'Tous les biens')}</MenuItem>
              {bounds.map((b) => (
                <MenuItem key={b.propertyId} value={b.propertyId}>
                  {b.propertyName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>{t('yieldRules.field.comparison', 'Si occupation')}</InputLabel>
              <Select
                label={t('yieldRules.field.comparison', 'Si occupation')}
                value={draft.comparison}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, comparison: e.target.value as YieldRuleV1['comparison'] }))
                }
              >
                <MenuItem value="BELOW">{t('yieldRules.below', 'Inférieure à (→ baisse)')}</MenuItem>
                <MenuItem value="ABOVE">{t('yieldRules.above', 'Supérieure à (→ hausse)')}</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label={t('yieldRules.field.threshold', 'Seuil (%)')}
              type="number"
              size="small"
              value={draft.occupancyThresholdPct}
              onChange={(e) => setDraft((d) => ({ ...d, occupancyThresholdPct: Number(e.target.value) }))}
              inputProps={{ min: 0, max: 100 }}
              sx={{ width: 120 }}
            />
            <TextField
              label={t('yieldRules.field.window', 'Fenêtre (j)')}
              type="number"
              size="small"
              value={draft.windowDaysAhead}
              onChange={(e) => setDraft((d) => ({ ...d, windowDaysAhead: Number(e.target.value) }))}
              inputProps={{ min: 1, max: 365 }}
              sx={{ width: 120 }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              label={t('yieldRules.field.adjustment', 'Ajustement (%)')}
              type="number"
              size="small"
              value={draft.adjustmentPct}
              onChange={(e) => setDraft((d) => ({ ...d, adjustmentPct: Number(e.target.value) }))}
              inputProps={{ min: 0.5, max: 50, step: 0.5 }}
              helperText={
                draft.comparison === 'BELOW'
                  ? t('yieldRules.adjustmentHelpDown', 'Appliqué en baisse')
                  : t('yieldRules.adjustmentHelpUp', 'Appliqué en hausse')
              }
              sx={{ width: 160 }}
            />
            <TextField
              label={t('yieldRules.field.dailyCap', 'Cap / jour (%)')}
              type="number"
              size="small"
              value={draft.maxDailyChangePct}
              onChange={(e) => setDraft((d) => ({ ...d, maxDailyChangePct: Number(e.target.value) }))}
              inputProps={{ min: 1, max: 50, step: 0.5 }}
              sx={{ width: 160 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={draft.active}
                  onChange={(_, checked) => setDraft((d) => ({ ...d, active: checked }))}
                />
              }
              label={t('yieldRules.field.active', 'Active')}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel', 'Annuler')}</Button>
          <Button variant="contained" onClick={() => void saveRule()} disabled={saving || !draft.name.trim()}>
            {t('common.save', 'Enregistrer')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default YieldRulesPanel;
