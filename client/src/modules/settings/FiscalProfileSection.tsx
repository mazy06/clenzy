import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Button, TextField, MenuItem,
  Switch, FormControlLabel, Grid, CircularProgress, Alert, Snackbar,
  Chip,
} from '@mui/material';
import {
  Save, AccountBalance, Info as InfoIcon, CheckCircle,
} from '@mui/icons-material';
import { useFiscalProfile, useUpdateFiscalProfile } from '../../hooks/useFiscalProfile';
import { CURRENCY_OPTIONS, COUNTRY_OPTIONS } from '../../utils/currencyUtils';
import { useTranslation } from '../../hooks/useTranslation';
import type { FiscalProfileUpdate, FiscalRegime } from '../../services/api/fiscalProfileApi';

// ─── Constants ──────────────────────────────────────────────────────────────

const REGIME_OPTIONS: { value: FiscalRegime; labelKey: string }[] = [
  { value: 'STANDARD', labelKey: 'fiscal.profile.regimeStandard' },
  { value: 'MICRO_ENTERPRISE', labelKey: 'fiscal.profile.regimeMicro' },
  { value: 'SIMPLIFIED', labelKey: 'fiscal.profile.regimeSimplified' },
];

const VAT_FREQUENCY_OPTIONS = [
  { value: 'MONTHLY', labelKey: 'fiscal.profile.freqMonthly' },
  { value: 'QUARTERLY', labelKey: 'fiscal.profile.freqQuarterly' },
  { value: 'ANNUAL', labelKey: 'fiscal.profile.freqAnnual' },
];

const LANGUAGE_OPTIONS = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
];

// ─── Component ──────────────────────────────────────────────────────────────

const FiscalProfileSection: React.FC = () => {
  const { t } = useTranslation();
  const { data: profile, isLoading, error, refetch } = useFiscalProfile();
  const updateMutation = useUpdateFiscalProfile();

  // Track whether this is a first-time setup (no profile existed before)
  const isFirstSetup = !!(profile && !profile.taxIdNumber && !profile.legalEntityName);

  const [form, setForm] = useState<FiscalProfileUpdate>({
    countryCode: 'FR',
    defaultCurrency: 'EUR',
    fiscalRegime: 'STANDARD',
    vatRegistered: true,
    taxIdNumber: '',
    vatNumber: '',
    vatDeclarationFrequency: 'QUARTERLY',
    invoiceLanguage: 'fr',
    invoicePrefix: 'FA',
    legalMentions: '',
    legalEntityName: '',
    legalAddress: '',
  });

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  // Sync form with fetched data
  useEffect(() => {
    if (profile) {
      setForm({
        countryCode: profile.countryCode ?? 'FR',
        defaultCurrency: profile.defaultCurrency ?? 'EUR',
        fiscalRegime: profile.fiscalRegime ?? 'STANDARD',
        vatRegistered: profile.vatRegistered ?? true,
        taxIdNumber: profile.taxIdNumber ?? '',
        vatNumber: profile.vatNumber ?? '',
        vatDeclarationFrequency: profile.vatDeclarationFrequency ?? 'QUARTERLY',
        invoiceLanguage: profile.invoiceLanguage ?? 'fr',
        invoicePrefix: profile.invoicePrefix ?? 'FA',
        legalMentions: profile.legalMentions ?? '',
        legalEntityName: profile.legalEntityName ?? '',
        legalAddress: profile.legalAddress ?? '',
      });
    }
  }, [profile]);

  const handleChange = (field: keyof FiscalProfileUpdate, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync(form);
      setSnackbar({ open: true, message: t('fiscal.profile.saved'), severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: t('fiscal.profile.error'), severity: 'error' });
    }
  };

  // ── Loading state ──
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // ── Error state — show a helpful retry notice, NOT a blocking error ──
  if (error && !profile) {
    return (
      <Box>
        <Alert
          severity="warning"
          icon={<InfoIcon />}
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Réessayer
            </Button>
          }
          sx={{ mb: 2 }}
        >
          {t('fiscal.profile.loadError')}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* First-time setup banner */}
      {isFirstSetup && (
        <Alert
          severity="info"
          icon={<InfoIcon />}
          sx={{ mb: 2, '& .MuiAlert-message': { width: '100%' } }}
        >
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
            {t('fiscal.profile.setupTitle')}
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
            {t('fiscal.profile.setupDescription')}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontSize: '0.7rem' }}>
            {t('fiscal.profile.setupNotice')}
          </Typography>
        </Alert>
      )}

      <Grid container spacing={2}>
        {/* ── Section 1 : Informations fiscales ── */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <AccountBalance sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
                {t('fiscal.profile.sectionFiscalInfo')}
              </Typography>
              {!isFirstSetup && profile?.vatRegistered && (
                <Chip
                  icon={<CheckCircle />}
                  label="TVA"
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{ ml: 'auto', height: 22, fontSize: '0.7rem' }}
                />
              )}
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label={t('fiscal.profile.country')}
                  value={form.countryCode}
                  onChange={(e) => handleChange('countryCode', e.target.value)}
                  size="small"
                  required
                >
                  {COUNTRY_OPTIONS.map(c => (
                    <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label={t('fiscal.profile.currency')}
                  value={form.defaultCurrency}
                  onChange={(e) => handleChange('defaultCurrency', e.target.value)}
                  size="small"
                  required
                >
                  {CURRENCY_OPTIONS.map(c => (
                    <MenuItem key={c.code} value={c.code}>{c.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label={t('fiscal.profile.regime')}
                  value={form.fiscalRegime}
                  onChange={(e) => handleChange('fiscalRegime', e.target.value)}
                  size="small"
                >
                  {REGIME_OPTIONS.map(r => (
                    <MenuItem key={r.value} value={r.value}>{t(r.labelKey)}</MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={t('fiscal.profile.taxId')}
                  value={form.taxIdNumber}
                  onChange={(e) => handleChange('taxIdNumber', e.target.value)}
                  size="small"
                  placeholder="FR12345678901"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={t('fiscal.profile.vatNumber')}
                  value={form.vatNumber}
                  onChange={(e) => handleChange('vatNumber', e.target.value)}
                  size="small"
                  placeholder="FR 12 345678901"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label={t('fiscal.profile.vatFrequency')}
                  value={form.vatDeclarationFrequency || 'QUARTERLY'}
                  onChange={(e) => handleChange('vatDeclarationFrequency', e.target.value)}
                  size="small"
                >
                  {VAT_FREQUENCY_OPTIONS.map(f => (
                    <MenuItem key={f.value} value={f.value}>{t(f.labelKey)}</MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.vatRegistered}
                      onChange={(e) => handleChange('vatRegistered', e.target.checked)}
                    />
                  }
                  label={<Typography variant="body2">{t('fiscal.profile.vatRegistered')}</Typography>}
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* ── Section 2 : Informations legales ── */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <AccountBalance sx={{ color: 'secondary.main', fontSize: 20 }} />
              <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
                {t('fiscal.profile.sectionLegalInfo')}
              </Typography>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('fiscal.profile.legalName')}
                  value={form.legalEntityName}
                  onChange={(e) => handleChange('legalEntityName', e.target.value)}
                  size="small"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('fiscal.profile.legalAddress')}
                  value={form.legalAddress}
                  onChange={(e) => handleChange('legalAddress', e.target.value)}
                  size="small"
                  multiline
                  rows={2}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('fiscal.profile.legalMentions')}
                  value={form.legalMentions}
                  onChange={(e) => handleChange('legalMentions', e.target.value)}
                  size="small"
                  multiline
                  rows={2}
                  placeholder="Mentions legales obligatoires sur les factures"
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* ── Section 3 : Facturation ── */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <AccountBalance sx={{ color: 'info.main', fontSize: 20 }} />
              <Typography variant="subtitle1" fontWeight={600} sx={{ fontSize: '0.95rem' }}>
                {t('fiscal.profile.sectionInvoicing')}
              </Typography>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  select
                  label={t('fiscal.profile.invoiceLanguage')}
                  value={form.invoiceLanguage || 'fr'}
                  onChange={(e) => handleChange('invoiceLanguage', e.target.value)}
                  size="small"
                >
                  {LANGUAGE_OPTIONS.map(l => (
                    <MenuItem key={l.value} value={l.value}>{l.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label={t('fiscal.profile.invoicePrefix')}
                  value={form.invoicePrefix}
                  onChange={(e) => handleChange('invoicePrefix', e.target.value)}
                  size="small"
                  placeholder="FA"
                  helperText="Ex: FA-2026-0001"
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      {/* Save button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        <Button
          variant="contained"
          startIcon={updateMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <Save />}
          onClick={handleSave}
          disabled={updateMutation.isPending}
          size="small"
        >
          {updateMutation.isPending ? t('fiscal.profile.saving') : t('fiscal.profile.save')}
        </Button>
      </Box>

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

export default FiscalProfileSection;
