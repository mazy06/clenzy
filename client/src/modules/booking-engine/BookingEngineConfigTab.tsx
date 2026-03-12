import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import {
  Box, Paper, Typography, Button, TextField, MenuItem,
  Switch, FormControlLabel, Grid, CircularProgress,
  IconButton, Tooltip, InputAdornment, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions, Chip, Snackbar, Alert,
  Stepper, Step, StepButton, alpha,
} from '@mui/material';
import {
  Palette, Settings as SettingsIcon, Security, Gavel, ToggleOn,
  ContentCopy, Refresh, VpnKey, Visibility, VisibilityOff,
  Code, Css, Preview, Widgets,
  NavigateNext, NavigateBefore, TuneRounded, BrushRounded,
  BuildRounded, AutoFixHighRounded,
} from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import {
  useCreateBookingEngineConfig,
  useUpdateBookingEngineConfig,
  useToggleBookingEngine,
  useRegenerateApiKey,
  useGenerateCssFromTokens,
} from '../../hooks/useBookingEngineConfig';
import type { BookingEngineConfig, BookingEngineConfigUpdate, DesignTokens } from '../../services/api/bookingEngineApi';
import ComponentVisibilityConfig from './ComponentVisibilityConfig';
import type { ComponentVisibility } from './ComponentVisibilityConfig';
import { DEFAULT_COMPONENT_VISIBILITY } from './ComponentVisibilityConfig';
import BookingEngineCssEditor from './BookingEngineCssEditor';
import BookingEngineJsEditor from './BookingEngineJsEditor';
import BookingEnginePreview from './BookingEnginePreview';
import AiDesignMatcher from './AiDesignMatcher';
import DesignTokenEditor from './DesignTokenEditor';
import { useIsAiFeatureEnabled } from '../../hooks/useAi';
import { CURRENCY_OPTIONS as CURRENCY_OPTIONS_PMS } from '../../utils/currencyUtils';

// ─── Constants ──────────────────────────────────────────────────────────────

const LANGUAGE_OPTIONS = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
];

/** Currencies managed by the PMS — imported from shared utils. */
const CURRENCY_OPTIONS = CURRENCY_OPTIONS_PMS.map((c) => ({
  value: c.code,
  label: `${c.code} — ${c.label.replace(/ \(.*\)$/, '')}`,
}));

const FONT_OPTIONS = [
  { value: '', label: 'Par défaut (système)' },
  { value: 'Inter', label: 'Inter' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Nunito', label: 'Nunito' },
];

const WIZARD_STEPS = [
  { labelKey: 'bookingEngine.steps.general', icon: <TuneRounded /> },
  { labelKey: 'bookingEngine.steps.appearance', icon: <BrushRounded /> },
  { labelKey: 'bookingEngine.steps.settings', icon: <BuildRounded /> },
  { labelKey: 'bookingEngine.steps.customization', icon: <AutoFixHighRounded /> },
] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

interface BookingEngineConfigTabProps {
  config: BookingEngineConfig | null; // null = create mode
  onBack: () => void;
  onSavingChange?: (saving: boolean) => void;
}

export interface BookingEngineConfigTabHandle {
  save: () => Promise<void>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseComponentConfig(raw: string | null): ComponentVisibility {
  if (!raw) return { ...DEFAULT_COMPONENT_VISIBILITY };
  try {
    return { ...DEFAULT_COMPONENT_VISIBILITY, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_COMPONENT_VISIBILITY };
  }
}

// ─── Section helper ─────────────────────────────────────────────────────────

const SectionPaper: React.FC<{ icon: React.ReactNode; titleKey: string; children: React.ReactNode }> = React.memo(
  ({ icon, titleKey, children }) => {
    const { t } = useTranslation();
    return (
      <Paper variant="outlined" sx={{ p: 2.5, height: '100%', borderRadius: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          {icon}
          <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: '0.875rem' }}>
            {t(titleKey)}
          </Typography>
        </Box>
        {children}
      </Paper>
    );
  }
);
SectionPaper.displayName = 'SectionPaper';

// ─── Component ──────────────────────────────────────────────────────────────

const BookingEngineConfigTab = forwardRef<BookingEngineConfigTabHandle, BookingEngineConfigTabProps>(
  ({ config, onBack, onSavingChange }, ref) => {
  const { t } = useTranslation();
  const isCreate = config === null;

  const isDesignAiEnabled = useIsAiFeatureEnabled('DESIGN');
  const createMutation = useCreateBookingEngineConfig();
  const updateMutation = useUpdateBookingEngineConfig();
  const toggleMutation = useToggleBookingEngine();
  const regenerateKeyMutation = useRegenerateApiKey();
  const generateCssMutation = useGenerateCssFromTokens();

  // ─── Wizard state ──────────────────────────────────────────────────
  const [activeStep, setActiveStep] = useState(0);

  // ─── Form state ────────────────────────────────────────────────────
  const [name, setName] = useState(config?.name || '');
  const [form, setForm] = useState<BookingEngineConfigUpdate>({
    name: config?.name || '',
    primaryColor: config?.primaryColor || '#2563eb',
    accentColor: config?.accentColor ?? null,
    logoUrl: config?.logoUrl ?? null,
    fontFamily: config?.fontFamily ?? null,
    defaultLanguage: config?.defaultLanguage || 'fr',
    defaultCurrency: config?.defaultCurrency || 'EUR',
    minAdvanceDays: config?.minAdvanceDays ?? 1,
    maxAdvanceDays: config?.maxAdvanceDays ?? 365,
    cancellationPolicy: config?.cancellationPolicy ?? null,
    termsUrl: config?.termsUrl ?? null,
    privacyUrl: config?.privacyUrl ?? null,
    allowedOrigins: config?.allowedOrigins ?? null,
    collectPaymentOnBooking: config?.collectPaymentOnBooking ?? true,
    autoConfirm: config?.autoConfirm ?? true,
    showCleaningFee: config?.showCleaningFee ?? true,
    showTouristTax: config?.showTouristTax ?? true,
    customCss: config?.customCss ?? null,
    customJs: config?.customJs ?? null,
    componentConfig: config?.componentConfig ?? null,
    designTokens: config?.designTokens ?? null,
    sourceWebsiteUrl: config?.sourceWebsiteUrl ?? null,
    aiAnalysisAt: config?.aiAnalysisAt ?? null,
  });

  // ─── AI Design state ────────────────────────────────────────────────
  const [designTokens, setDesignTokens] = useState<DesignTokens>(() => {
    if (config?.designTokens) {
      try { return JSON.parse(config.designTokens); } catch { /* ignore */ }
    }
    return {};
  });
  const [cssInstructions, setCssInstructions] = useState('');

  const [componentVis, setComponentVis] = useState<ComponentVisibility>(
    parseComponentConfig(config?.componentConfig ?? null)
  );

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  // Sync when config changes (edit mode) or reset when null (create mode)
  useEffect(() => {
    if (config) {
      setName(config.name);
      setForm({
        name: config.name,
        primaryColor: config.primaryColor || '#2563eb',
        accentColor: config.accentColor,
        logoUrl: config.logoUrl,
        fontFamily: config.fontFamily,
        defaultLanguage: config.defaultLanguage || 'fr',
        defaultCurrency: config.defaultCurrency || 'EUR',
        minAdvanceDays: config.minAdvanceDays ?? 1,
        maxAdvanceDays: config.maxAdvanceDays ?? 365,
        cancellationPolicy: config.cancellationPolicy,
        termsUrl: config.termsUrl,
        privacyUrl: config.privacyUrl,
        allowedOrigins: config.allowedOrigins,
        collectPaymentOnBooking: config.collectPaymentOnBooking,
        autoConfirm: config.autoConfirm,
        showCleaningFee: config.showCleaningFee,
        showTouristTax: config.showTouristTax,
        customCss: config.customCss,
        customJs: config.customJs,
        componentConfig: config.componentConfig,
        designTokens: config.designTokens,
        sourceWebsiteUrl: config.sourceWebsiteUrl,
        aiAnalysisAt: config.aiAnalysisAt,
      });
      setComponentVis(parseComponentConfig(config.componentConfig));
      // Parse stored design tokens
      if (config.designTokens) {
        try { setDesignTokens(JSON.parse(config.designTokens)); } catch { setDesignTokens({}); }
      } else {
        setDesignTokens({});
      }
    } else {
      // Reset form for create mode
      setName('');
      setForm({
        name: '',
        primaryColor: '#2563eb',
        accentColor: null,
        logoUrl: null,
        fontFamily: null,
        defaultLanguage: 'fr',
        defaultCurrency: 'EUR',
        minAdvanceDays: 1,
        maxAdvanceDays: 365,
        cancellationPolicy: null,
        termsUrl: null,
        privacyUrl: null,
        allowedOrigins: null,
        collectPaymentOnBooking: true,
        autoConfirm: true,
        showCleaningFee: true,
        showTouristTax: true,
        customCss: null,
        customJs: null,
        componentConfig: null,
        designTokens: null,
        sourceWebsiteUrl: null,
        aiAnalysisAt: null,
      });
      setComponentVis({ ...DEFAULT_COMPONENT_VISIBILITY });
      setDesignTokens({});
    }
    setActiveStep(0);
  }, [config]);

  // ─── Handlers ──────────────────────────────────────────────────────

  const handleChange = useCallback((field: keyof BookingEngineConfigUpdate, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleComponentVisChange = useCallback((vis: ComponentVisibility) => {
    setComponentVis(vis);
    setForm((prev) => ({ ...prev, componentConfig: JSON.stringify(vis) }));
  }, []);

  const handleSave = useCallback(async () => {
    const payload = { ...form, name: name.trim() || 'Default' };
    try {
      if (isCreate) {
        await createMutation.mutateAsync(payload);
        setSnackbar({ open: true, message: t('bookingEngine.messages.created'), severity: 'success' });
        onBack();
      } else {
        await updateMutation.mutateAsync({ id: config!.id, data: payload });
        setSnackbar({ open: true, message: t('bookingEngine.messages.saved'), severity: 'success' });
      }
    } catch {
      setSnackbar({ open: true, message: t('bookingEngine.messages.error'), severity: 'error' });
    }
  }, [form, name, isCreate, config, createMutation, updateMutation, t, onBack]);

  const handleToggle = useCallback(async (enabled: boolean) => {
    if (!config) return;
    try {
      await toggleMutation.mutateAsync({ id: config.id, enabled });
      setSnackbar({
        open: true,
        message: t('bookingEngine.messages.toggled', { status: enabled ? t('bookingEngine.status.active') : t('bookingEngine.status.inactive') }),
        severity: 'success',
      });
    } catch {
      setSnackbar({ open: true, message: t('bookingEngine.messages.error'), severity: 'error' });
    }
  }, [config, toggleMutation, t]);

  const handleRegenerateKey = useCallback(async () => {
    if (!config) return;
    setConfirmRegenerate(false);
    try {
      await regenerateKeyMutation.mutateAsync(config.id);
      setSnackbar({ open: true, message: t('bookingEngine.messages.keyRegenerated'), severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: t('bookingEngine.messages.error'), severity: 'error' });
    }
  }, [config, regenerateKeyMutation, t]);

  const handleCopyKey = useCallback(() => {
    if (config?.apiKey) {
      navigator.clipboard.writeText(config.apiKey);
      setSnackbar({ open: true, message: t('bookingEngine.messages.keyCopied'), severity: 'success' });
    }
  }, [config?.apiKey, t]);

  // ─── AI Design handlers ──────────────────────────────────────────────

  const handleTokensExtracted = useCallback((tokens: DesignTokens, generatedCss: string) => {
    setDesignTokens(tokens);
    setForm((prev) => ({
      ...prev,
      designTokens: JSON.stringify(tokens),
      customCss: generatedCss,
    }));
    setSnackbar({ open: true, message: t('bookingEngine.ai.tokensApplied'), severity: 'success' });
  }, [t]);

  const handleDesignTokensChange = useCallback((tokens: DesignTokens) => {
    setDesignTokens(tokens);
    setForm((prev) => ({ ...prev, designTokens: JSON.stringify(tokens) }));
  }, []);

  const handleRegenerateCssFromTokens = useCallback(() => {
    if (!config?.id) return;
    generateCssMutation.mutate(
      { configId: config.id, designTokens, additionalInstructions: cssInstructions || undefined },
      {
        onSuccess: (data) => {
          setForm((prev) => ({ ...prev, customCss: data.generatedCss }));
          setSnackbar({ open: true, message: t('bookingEngine.ai.cssRegenerated'), severity: 'success' });
        },
        onError: () => {
          setSnackbar({ open: true, message: t('bookingEngine.ai.cssRegenerateError'), severity: 'error' });
        },
      },
    );
  }, [config?.id, designTokens, cssInstructions, generateCssMutation, t]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Expose save to parent via ref
  useImperativeHandle(ref, () => ({ save: handleSave }), [handleSave]);

  // Notify parent of saving state changes
  useEffect(() => {
    onSavingChange?.(isSaving);
  }, [isSaving, onSavingChange]);

  // ─── Navigation helpers ────────────────────────────────────────────

  const handleNext = useCallback(() => {
    setActiveStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length - 1));
  }, []);

  const handleBack = useCallback(() => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  }, []);

  // ─── Step renderers ────────────────────────────────────────────────

  /** Step 1 — Général : Nom + Statut/Clé API */
  const renderStepGeneral = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <SectionPaper icon={<VpnKey sx={{ fontSize: 20, color: 'primary.main' }} />} titleKey="bookingEngine.sections.statusApiKey">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Template name */}
          <TextField
            fullWidth
            size="small"
            label={t('bookingEngine.fields.name')}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              handleChange('name', e.target.value);
            }}
            placeholder={t('bookingEngine.fields.namePlaceholder')}
          />

          {/* Status toggle + API key + regenerate (edit mode only) */}
          {!isCreate && (
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: { md: 'center' } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config?.enabled ?? false}
                      onChange={(e) => handleToggle(e.target.checked)}
                      disabled={toggleMutation.isPending}
                      color="success"
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight={600}>{t('bookingEngine.fields.enabled')}</Typography>
                      <Chip
                        size="small"
                        label={config?.enabled ? t('bookingEngine.status.active') : t('bookingEngine.status.inactive')}
                        color={config?.enabled ? 'success' : 'default'}
                        sx={{ fontSize: '0.7rem', height: 22 }}
                      />
                    </Box>
                  }
                />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <TextField
                  fullWidth
                  size="small"
                  label={t('bookingEngine.fields.apiKey')}
                  value={config?.apiKey ?? ''}
                  type={showApiKey ? 'text' : 'password'}
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title={showApiKey ? t('common.hide') : t('common.show')}>
                          <IconButton size="small" onClick={() => setShowApiKey(!showApiKey)}>
                            {showApiKey ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('bookingEngine.fields.copyKey')}>
                          <IconButton size="small" onClick={handleCopyKey}>
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
              <Button
                variant="outlined"
                color="warning"
                size="small"
                startIcon={regenerateKeyMutation.isPending ? <CircularProgress size={14} /> : <Refresh />}
                onClick={() => setConfirmRegenerate(true)}
                disabled={regenerateKeyMutation.isPending}
                sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                {t('bookingEngine.fields.regenerateKey')}
              </Button>
            </Box>
          )}
        </Box>
      </SectionPaper>
    </Box>
  );

  /** Step 2 — Apparence : AI Design Matcher + Design Tokens + Logo/Font */
  const renderStepAppearance = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* AI Design Matcher (hidden when DESIGN feature is disabled) */}
      {isDesignAiEnabled && (
        <SectionPaper icon={<AutoFixHighRounded sx={{ fontSize: 20, color: '#7C4DFF' }} />} titleKey="bookingEngine.sections.aiDesign">
          <AiDesignMatcher
            configId={config?.id ?? null}
            onTokensExtracted={handleTokensExtracted}
            onError={(msg) => setSnackbar({ open: true, message: msg, severity: 'error' })}
          />
        </SectionPaper>
      )}

      {/* Design Token Editor (visible if tokens have been extracted or config has stored tokens) */}
      {Object.keys(designTokens).length > 0 && (
        <SectionPaper icon={<Palette sx={{ fontSize: 20, color: '#AB47BC' }} />} titleKey="bookingEngine.sections.designTokens">
          <DesignTokenEditor
            tokens={designTokens}
            onChange={handleDesignTokensChange}
            onRegenerateCss={handleRegenerateCssFromTokens}
            isRegenerating={generateCssMutation.isPending}
          />
        </SectionPaper>
      )}

      {/* Classic theming: Logo + Font */}
      <SectionPaper icon={<Palette sx={{ fontSize: 20, color: '#AB47BC' }} />} titleKey="bookingEngine.sections.theming">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* Colors side-by-side */}
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block', fontWeight: 600 }}>
                {t('bookingEngine.fields.primaryColor')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <input
                  type="color"
                  value={form.primaryColor || '#2563eb'}
                  onChange={(e) => handleChange('primaryColor', e.target.value)}
                  style={{ width: 40, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 0 }}
                />
                <TextField
                  size="small"
                  value={form.primaryColor || ''}
                  onChange={(e) => handleChange('primaryColor', e.target.value)}
                  sx={{ flex: 1 }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block', fontWeight: 600 }}>
                {t('bookingEngine.fields.accentColor')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <input
                  type="color"
                  value={form.accentColor || '#ffffff'}
                  onChange={(e) => handleChange('accentColor', e.target.value)}
                  style={{ width: 40, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 0 }}
                />
                <TextField
                  size="small"
                  value={form.accentColor || ''}
                  onChange={(e) => handleChange('accentColor', e.target.value || null)}
                  placeholder="#"
                  sx={{ flex: 1 }}
                />
              </Box>
            </Grid>
          </Grid>

          {/* Logo + Font side-by-side */}
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label={t('bookingEngine.fields.logoUrl')}
                value={form.logoUrl || ''}
                onChange={(e) => handleChange('logoUrl', e.target.value || null)}
                placeholder="https://..."
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                select
                label={t('bookingEngine.fields.fontFamily')}
                value={form.fontFamily || ''}
                onChange={(e) => handleChange('fontFamily', e.target.value || null)}
              >
                {FONT_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </Box>
      </SectionPaper>
    </Box>
  );

  /** Step 3 — Réglages : Comportement, Conditions, Sécurité, Options, Visibilité */
  const renderStepSettings = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
    <Grid container spacing={2.5}>
      {/* Behavior */}
      <Grid item xs={12} sm={6}>
        <SectionPaper icon={<SettingsIcon sx={{ fontSize: 20, color: '#4A9B8E' }} />} titleKey="bookingEngine.sections.behavior">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <TextField
              fullWidth
              size="small"
              select
              label={t('bookingEngine.fields.defaultLanguage')}
              value={form.defaultLanguage}
              onChange={(e) => handleChange('defaultLanguage', e.target.value)}
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              size="small"
              select
              label={t('bookingEngine.fields.defaultCurrency')}
              value={form.defaultCurrency}
              onChange={(e) => handleChange('defaultCurrency', e.target.value)}
            >
              {CURRENCY_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </TextField>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label={t('bookingEngine.fields.minAdvanceDays')}
                value={form.minAdvanceDays}
                onChange={(e) => handleChange('minAdvanceDays', Math.max(0, parseInt(e.target.value) || 0))}
                inputProps={{ min: 0 }}
              />
              <TextField
                fullWidth
                size="small"
                type="number"
                label={t('bookingEngine.fields.maxAdvanceDays')}
                value={form.maxAdvanceDays}
                onChange={(e) => handleChange('maxAdvanceDays', Math.max(1, parseInt(e.target.value) || 365))}
                inputProps={{ min: 1 }}
              />
            </Box>
          </Box>
        </SectionPaper>
      </Grid>

      {/* Policies */}
      <Grid item xs={12} sm={6}>
        <SectionPaper icon={<Gavel sx={{ fontSize: 20, color: '#D4A574' }} />} titleKey="bookingEngine.sections.policies">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <TextField
              fullWidth
              size="small"
              multiline
              minRows={2}
              maxRows={4}
              label={t('bookingEngine.fields.cancellationPolicy')}
              value={form.cancellationPolicy || ''}
              onChange={(e) => handleChange('cancellationPolicy', e.target.value || null)}
            />
            <TextField
              fullWidth
              size="small"
              label={t('bookingEngine.fields.termsUrl')}
              value={form.termsUrl || ''}
              onChange={(e) => handleChange('termsUrl', e.target.value || null)}
              placeholder="https://..."
            />
            <TextField
              fullWidth
              size="small"
              label={t('bookingEngine.fields.privacyUrl')}
              value={form.privacyUrl || ''}
              onChange={(e) => handleChange('privacyUrl', e.target.value || null)}
              placeholder="https://..."
            />
          </Box>
        </SectionPaper>
      </Grid>

      {/* Security */}
      <Grid item xs={12} sm={6}>
        <SectionPaper icon={<Security sx={{ fontSize: 20, color: '#FF5A5F' }} />} titleKey="bookingEngine.sections.security">
          <TextField
            fullWidth
            size="small"
            multiline
            minRows={3}
            maxRows={6}
            label={t('bookingEngine.fields.allowedOrigins')}
            value={form.allowedOrigins || ''}
            onChange={(e) => handleChange('allowedOrigins', e.target.value || null)}
            helperText={t('bookingEngine.fields.allowedOriginsHelper')}
            placeholder="https://monsite.com"
          />
        </SectionPaper>
      </Grid>

      {/* Display Options */}
      <Grid item xs={12} sm={6}>
        <SectionPaper icon={<ToggleOn sx={{ fontSize: 20, color: '#4FC3F7' }} />} titleKey="bookingEngine.sections.displayOptions">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            {([
              { field: 'collectPaymentOnBooking' as const, labelKey: 'bookingEngine.fields.collectPaymentOnBooking' },
              { field: 'autoConfirm' as const, labelKey: 'bookingEngine.fields.autoConfirm' },
              { field: 'showCleaningFee' as const, labelKey: 'bookingEngine.fields.showCleaningFee' },
              { field: 'showTouristTax' as const, labelKey: 'bookingEngine.fields.showTouristTax' },
            ] as const).map(({ field, labelKey }) => (
              <FormControlLabel
                key={field}
                control={
                  <Switch
                    checked={form[field]}
                    onChange={(e) => handleChange(field, e.target.checked)}
                    size="small"
                  />
                }
                label={<Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>{t(labelKey)}</Typography>}
              />
            ))}
          </Box>
        </SectionPaper>
      </Grid>
    </Grid>

    {/* Component Visibility */}
    <SectionPaper icon={<Widgets sx={{ fontSize: 20, color: '#7E57C2' }} />} titleKey="bookingEngine.sections.componentVisibility">
      <ComponentVisibilityConfig value={componentVis} onChange={handleComponentVisChange} />
    </SectionPaper>
    </Box>
  );

  /** Step 4 — Personnalisation : CSS/JS, Aperçu */
  const renderStepCustomization = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* AI CSS Regeneration */}
      {config?.id && Object.keys(designTokens).length > 0 && (
        <SectionPaper icon={<AutoFixHighRounded sx={{ fontSize: 20, color: '#7C4DFF' }} />} titleKey="bookingEngine.sections.aiCssRegenerate">
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, alignItems: { sm: 'flex-end' } }}>
            <TextField
              fullWidth
              size="small"
              label={t('bookingEngine.ai.additionalInstructions')}
              placeholder={t('bookingEngine.ai.instructionsPlaceholder')}
              value={cssInstructions}
              onChange={(e) => setCssInstructions(e.target.value)}
              multiline
              minRows={1}
              maxRows={3}
            />
            <Button
              variant="contained"
              startIcon={generateCssMutation.isPending ? <CircularProgress size={16} /> : <AutoFixHighRounded />}
              onClick={handleRegenerateCssFromTokens}
              disabled={generateCssMutation.isPending}
              sx={{ whiteSpace: 'nowrap', minWidth: 200, height: 40 }}
            >
              {t('bookingEngine.ai.regenerateCss')}
            </Button>
          </Box>
        </SectionPaper>
      )}

      {/* CSS + JS side-by-side */}
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={6}>
          <SectionPaper icon={<Css sx={{ fontSize: 20, color: '#1E88E5' }} />} titleKey="bookingEngine.sections.customCss">
            <BookingEngineCssEditor
              value={form.customCss || ''}
              onChange={(v) => handleChange('customCss', v || null)}
            />
          </SectionPaper>
        </Grid>
        <Grid item xs={12} md={6}>
          <SectionPaper icon={<Code sx={{ fontSize: 20, color: '#FFA726' }} />} titleKey="bookingEngine.sections.customJs">
            <BookingEngineJsEditor
              value={form.customJs || ''}
              onChange={(v) => handleChange('customJs', v || null)}
            />
          </SectionPaper>
        </Grid>
      </Grid>

      {/* Preview */}
      <SectionPaper icon={<Preview sx={{ fontSize: 20, color: '#26A69A' }} />} titleKey="bookingEngine.sections.preview">
        <BookingEnginePreview
          primaryColor={form.primaryColor || '#2563eb'}
          accentColor={form.accentColor}
          fontFamily={form.fontFamily}
          logoUrl={form.logoUrl}
          customCss={form.customCss}
          componentConfig={componentVis}
          designTokens={Object.keys(designTokens).length > 0 ? designTokens : undefined}
        />
      </SectionPaper>
    </Box>
  );

  // Step content mapping
  const stepRenderers = [renderStepGeneral, renderStepAppearance, renderStepSettings, renderStepCustomization];

  return (
    <Box>
      {/* ── Stepper ─────────────────────────────────────────────────── */}
      <Stepper
        activeStep={activeStep}
        nonLinear
        alternativeLabel
        sx={{
          mb: 3,
          '& .MuiStepConnector-line': {
            borderTopWidth: 2,
          },
          '& .MuiStepConnector-root.Mui-active .MuiStepConnector-line, & .MuiStepConnector-root.Mui-completed .MuiStepConnector-line': {
            borderColor: 'primary.main',
          },
        }}
      >
        {WIZARD_STEPS.map((step, index) => (
          <Step key={step.labelKey} completed={false}>
            <StepButton
              onClick={() => setActiveStep(index)}
              icon={
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: index === activeStep
                      ? 'primary.main'
                      : (theme) => alpha(theme.palette.text.primary, 0.08),
                    color: index === activeStep ? 'white' : 'text.secondary',
                    transition: 'all 0.2s ease',
                    '& .MuiSvgIcon-root': { fontSize: 18 },
                  }}
                >
                  {step.icon}
                </Box>
              }
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: index === activeStep ? 700 : 500,
                  color: index === activeStep ? 'primary.main' : 'text.secondary',
                  fontSize: '0.8125rem',
                }}
              >
                {t(step.labelKey)}
              </Typography>
            </StepButton>
          </Step>
        ))}
      </Stepper>

      {/* ── Active step content ─────────────────────────────────────── */}
      <Box sx={{ minHeight: 300 }}>
        {stepRenderers[activeStep]()}
      </Box>

      {/* ── Navigation buttons ──────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mt: 3,
          pt: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Button
          variant="outlined"
          startIcon={<NavigateBefore />}
          onClick={handleBack}
          disabled={activeStep === 0}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          {t('common.previous')}
        </Button>

        {/* Step indicator */}
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
          {activeStep + 1} / {WIZARD_STEPS.length}
        </Typography>

        <Button
          variant="contained"
          endIcon={<NavigateNext />}
          onClick={handleNext}
          disabled={activeStep === WIZARD_STEPS.length - 1}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          {t('common.next')}
        </Button>
      </Box>

      {/* Confirm regenerate dialog */}
      <Dialog open={confirmRegenerate} onClose={() => setConfirmRegenerate(false)} maxWidth="xs">
        <DialogTitle>{t('bookingEngine.fields.regenerateKey')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('bookingEngine.fields.regenerateConfirm')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRegenerate(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleRegenerateKey} color="warning" variant="contained">{t('common.confirm')}</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
});

BookingEngineConfigTab.displayName = 'BookingEngineConfigTab';

export default BookingEngineConfigTab;
