import React, { useState, useMemo } from 'react';
import {
  Box, Paper, Typography, Button, TextField, MenuItem,
  CircularProgress, Alert, Snackbar, IconButton, Tooltip,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  Dialog, DialogTitle, DialogContent, DialogActions, Chip,
} from '@mui/material';
import {
  Add, Edit, Delete, Gavel, Info as InfoIcon,
} from '../../icons';
import { useTaxRules, useCreateTaxRule, useUpdateTaxRule, useDeleteTaxRule } from '../../hooks/useTaxRules';
import { useFiscalProfile } from '../../hooks/useFiscalProfile';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { COUNTRY_OPTIONS } from '../../utils/currencyUtils';
import { TAX_CATEGORIES } from '../../services/api/taxRulesApi';
import type { TaxRule, TaxRuleRequest, TaxCategoryType } from '../../services/api/taxRulesApi';

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<TaxCategoryType, string> = {
  ACCOMMODATION: 'Hebergement',
  STANDARD: 'Standard',
  CLEANING: 'Menage',
  FOOD: 'Restauration',
  TOURIST_TAX: 'Taxe de sejour',
};

const EMPTY_FORM: TaxRuleRequest = {
  countryCode: 'FR',
  taxCategory: 'STANDARD',
  taxRate: 0.20,
  taxName: '',
  effectiveFrom: new Date().toISOString().split('T')[0],
  effectiveTo: null,
  description: null,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Backend stores rate as decimal (0.20), UI shows percentage (20) */
function rateToPercent(rate: number): string {
  return (rate * 100).toFixed(2).replace(/\.?0+$/, '');
}

function percentToRate(percent: string): number {
  const val = parseFloat(percent);
  return isNaN(val) ? 0 : val / 100;
}

// ─── Component ───────────────────────────────────────────────────────────────

const TaxRulesSection: React.FC = () => {
  const { t } = useTranslation();
  const { hasAnyRole } = useAuth();
  const { data: fiscalProfile } = useFiscalProfile();
  const isSuperAdmin = hasAnyRole(['SUPER_ADMIN']);

  // Country filter — default to org's country
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const countryCode = selectedCountry || fiscalProfile?.countryCode || 'FR';

  const { data: rules, isLoading, error, refetch } = useTaxRules(countryCode);
  const createMutation = useCreateTaxRule();
  const updateMutation = useUpdateTaxRule();
  const deleteMutation = useDeleteTaxRule();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TaxRule | null>(null);
  const [form, setForm] = useState<TaxRuleRequest>({ ...EMPTY_FORM });
  const [ratePercent, setRatePercent] = useState('20');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<TaxRule | null>(null);

  // Snackbar
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  // Sort rules by category
  const sortedRules = useMemo(() => {
    if (!rules) return [];
    const categoryOrder = TAX_CATEGORIES.reduce<Record<string, number>>((acc, cat, i) => {
      acc[cat] = i;
      return acc;
    }, {});
    return [...rules].sort((a, b) =>
      (categoryOrder[a.taxCategory] ?? 99) - (categoryOrder[b.taxCategory] ?? 99)
    );
  }, [rules]);

  // ── Dialog handlers ──

  const openCreateDialog = () => {
    setEditingRule(null);
    const defaultRate = '20';
    setForm({ ...EMPTY_FORM, countryCode });
    setRatePercent(defaultRate);
    setDialogOpen(true);
  };

  const openEditDialog = (rule: TaxRule) => {
    setEditingRule(rule);
    setForm({
      countryCode: rule.countryCode,
      taxCategory: rule.taxCategory,
      taxRate: rule.taxRate,
      taxName: rule.taxName,
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo,
      description: rule.description,
    });
    setRatePercent(rateToPercent(rule.taxRate));
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingRule(null);
  };

  const handleFormChange = (field: keyof TaxRuleRequest, value: string | null) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleRateChange = (value: string) => {
    setRatePercent(value);
    setForm(prev => ({ ...prev, taxRate: percentToRate(value) }));
  };

  const handleSave = async () => {
    try {
      if (editingRule) {
        await updateMutation.mutateAsync({ id: editingRule.id, data: form });
        setSnackbar({ open: true, message: t('fiscal.taxRules.updated'), severity: 'success' });
      } else {
        await createMutation.mutateAsync(form);
        setSnackbar({ open: true, message: t('fiscal.taxRules.created'), severity: 'success' });
      }
      closeDialog();
    } catch {
      setSnackbar({ open: true, message: t('fiscal.taxRules.error'), severity: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setSnackbar({ open: true, message: t('fiscal.taxRules.deleted'), severity: 'success' });
      setDeleteTarget(null);
    } catch {
      setSnackbar({ open: true, message: t('fiscal.taxRules.error'), severity: 'error' });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Loading ──
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // ── Error ──
  if (error && !rules) {
    return (
      <Alert
        severity="warning"
        icon={<InfoIcon />}
        action={
          <Button color="inherit" size="small" onClick={() => refetch()}>
            {t('fiscal.taxRules.retry')}
          </Button>
        }
        sx={{ mb: 2 }}
      >
        {t('fiscal.taxRules.loadError')}
      </Alert>
    );
  }

  return (
    <Box>
      <Paper sx={{ p: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}><Gavel size={20} strokeWidth={1.75} /></Box>
            <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
              {t('fiscal.taxRules.title')}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {/* Country selector */}
            <TextField
              select
              value={countryCode}
              onChange={(e) => setSelectedCountry(e.target.value)}
              size="small"
              sx={{ minWidth: 160 }}
            >
              {COUNTRY_OPTIONS.map(c => (
                <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>
              ))}
            </TextField>

            {/* Add button (SUPER_ADMIN only) */}
            {isSuperAdmin && (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={openCreateDialog}
                size="small"
              >
                {t('fiscal.taxRules.add')}
              </Button>
            )}
          </Box>
        </Box>

        {/* Rules table */}
        {sortedRules.length === 0 ? (
          <Alert severity="info" sx={{ mt: 1 }}>
            {t('fiscal.taxRules.noRules')}
          </Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('fiscal.taxRules.category')}</TableCell>
                  <TableCell>{t('fiscal.taxRules.taxName')}</TableCell>
                  <TableCell align="right">{t('fiscal.taxRules.rate')}</TableCell>
                  <TableCell>{t('fiscal.taxRules.from')}</TableCell>
                  <TableCell>{t('fiscal.taxRules.to')}</TableCell>
                  <TableCell>{t('fiscal.taxRules.description')}</TableCell>
                  {isSuperAdmin && <TableCell align="center">{t('fiscal.taxRules.actions')}</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedRules.map(rule => (
                  <TableRow key={rule.id} hover>
                    <TableCell>
                      <Chip
                        label={CATEGORY_LABELS[rule.taxCategory as TaxCategoryType] ?? rule.taxCategory}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.75rem' }}
                      />
                    </TableCell>
                    <TableCell>{rule.taxName}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {rateToPercent(rule.taxRate)} %
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>{rule.effectiveFrom}</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                      {rule.effectiveTo ?? '—'}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary', maxWidth: 200 }}>
                      {rule.description ?? '—'}
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                        <Tooltip title={t('fiscal.taxRules.edit')}>
                          <IconButton size="small" onClick={() => openEditDialog(rule)}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('fiscal.taxRules.delete')}>
                          <IconButton size="small" color="error" onClick={() => setDeleteTarget(rule)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingRule ? t('fiscal.taxRules.editTitle') : t('fiscal.taxRules.addTitle')}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            select
            label={t('fiscal.taxRules.category')}
            value={form.taxCategory}
            onChange={(e) => handleFormChange('taxCategory', e.target.value)}
            size="small"
            fullWidth
            required
          >
            {TAX_CATEGORIES.map(cat => (
              <MenuItem key={cat} value={cat}>{CATEGORY_LABELS[cat]}</MenuItem>
            ))}
          </TextField>

          <TextField
            label={t('fiscal.taxRules.taxName')}
            value={form.taxName}
            onChange={(e) => handleFormChange('taxName', e.target.value)}
            size="small"
            fullWidth
            required
            placeholder="Ex: TVA 20%"
          />

          <TextField
            label={t('fiscal.taxRules.ratePercent')}
            value={ratePercent}
            onChange={(e) => handleRateChange(e.target.value)}
            size="small"
            fullWidth
            required
            type="number"
            inputProps={{ min: 0, max: 100, step: 0.01 }}
            helperText={t('fiscal.taxRules.rateHelp')}
          />

          <TextField
            select
            label={t('fiscal.taxRules.countryLabel')}
            value={form.countryCode}
            onChange={(e) => handleFormChange('countryCode', e.target.value)}
            size="small"
            fullWidth
            required
          >
            {COUNTRY_OPTIONS.map(c => (
              <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>
            ))}
          </TextField>

          <TextField
            label={t('fiscal.taxRules.from')}
            value={form.effectiveFrom}
            onChange={(e) => handleFormChange('effectiveFrom', e.target.value)}
            size="small"
            fullWidth
            required
            type="date"
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label={t('fiscal.taxRules.to')}
            value={form.effectiveTo ?? ''}
            onChange={(e) => handleFormChange('effectiveTo', e.target.value || null)}
            size="small"
            fullWidth
            type="date"
            InputLabelProps={{ shrink: true }}
            helperText={t('fiscal.taxRules.toHelp')}
          />

          <TextField
            label={t('fiscal.taxRules.description')}
            value={form.description ?? ''}
            onChange={(e) => handleFormChange('description', e.target.value || null)}
            size="small"
            fullWidth
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} size="small">
            {t('fiscal.taxRules.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={isSaving || !form.taxName || !form.effectiveFrom}
            size="small"
            startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isSaving ? t('fiscal.taxRules.saving') : t('fiscal.taxRules.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs">
        <DialogTitle>{t('fiscal.taxRules.deleteConfirmTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {t('fiscal.taxRules.deleteConfirmMessage', {
              name: deleteTarget?.taxName ?? '',
              category: CATEGORY_LABELS[deleteTarget?.taxCategory as TaxCategoryType] ?? deleteTarget?.taxCategory ?? '',
            })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} size="small">
            {t('fiscal.taxRules.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            size="small"
          >
            {deleteMutation.isPending ? t('fiscal.taxRules.deleting') : t('fiscal.taxRules.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TaxRulesSection;
