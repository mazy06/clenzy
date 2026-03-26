import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import type { TransitionProps } from '@mui/material/transitions';
import {
  Box, Typography, Snackbar, Alert, Dialog, Slide, alpha,
} from '@mui/material';

const SlideUpTransition = forwardRef(function SlideUpTransition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});
import {
  BrushRounded, BuildRounded, LocalOffer, IntegrationInstructions,
} from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import {
  useCreateBookingEngineConfig,
  useUpdateBookingEngineConfig,
  useToggleBookingEngine,
  useRegenerateApiKey,
  useGenerateCssFromTokens,
} from '../../hooks/useBookingEngineConfig';
import type { BookingEngineConfig, DesignTokens } from '../../services/api/bookingEngineApi';
import BookingEnginePreview from './BookingEnginePreview';
import PreviewInspector from './PreviewInspector';
import { useIsAiFeatureEnabled } from '../../hooks/useAi';
// organizationsApi removed — was dead code (result discarded)
import { useBookingEngineAvailability } from '../../hooks/useBookingEngineAvailability';
import { useServiceCategories } from '../../hooks/useBookingServiceOptions';
import { useBookingEngineForm } from './hooks/useBookingEngineForm';
import { usePreviewProperties } from './hooks/usePreviewProperties';
import StepAppearance from './components/StepAppearance';
import StepSettings from './components/StepSettings';
import StepIntegration from './components/StepIntegration';
import StepOptions from './components/StepOptions';

// ─── Constants ──────────────────────────────────────────────────────────────

const WIZARD_STEPS = [
  { labelKey: 'bookingEngine.steps.appearance', icon: <BrushRounded /> },
  { labelKey: 'bookingEngine.steps.settings', icon: <BuildRounded /> },
  { labelKey: 'bookingEngine.steps.options', icon: <LocalOffer /> },
  { labelKey: 'bookingEngine.steps.integration', icon: <IntegrationInstructions /> },
] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

interface BookingEngineConfigTabProps {
  config: BookingEngineConfig | null; // null = create mode
  onBack: () => void;
  onSavingChange?: (saving: boolean) => void;
}

export interface BookingEngineConfigTabHandle {
  save: () => Promise<void>;
  openPreview: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

const BookingEngineConfigTab = forwardRef<BookingEngineConfigTabHandle, BookingEngineConfigTabProps>(
  ({ config, onBack, onSavingChange }, ref) => {
  const { t } = useTranslation();
  const isCreate = config === null;
  const isDesignAiEnabled = useIsAiFeatureEnabled('DESIGN');

  // ─── Mutations ──────────────────────────────────────────────────────
  const createMutation = useCreateBookingEngineConfig();
  const updateMutation = useUpdateBookingEngineConfig();
  const toggleMutation = useToggleBookingEngine();
  const regenerateKeyMutation = useRegenerateApiKey();
  const generateCssMutation = useGenerateCssFromTokens();

  // ─── Form state (extracted hook) ────────────────────────────────────
  const {
    name, setName, form, handleChange,
    designTokens, setDesignTokens,
    componentVis, handleComponentVisChange,
  } = useBookingEngineForm(config);

  // ─── Wizard state ───────────────────────────────────────────────────
  const [activeStep, setActiveStep] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Reset step when config changes
  useEffect(() => { setActiveStep(0); }, [config]);

  // ─── Preview data (extracted hook) ──────────────────────────────────
  const { previewProperties, reviewStats } = usePreviewProperties();
  const { data: serviceCategories = [] } = useServiceCategories();

  // ─── Availability calendar state ───────────────────────────────────
  const [calendarBaseMonth, setCalendarBaseMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [previewGuests, setPreviewGuests] = useState<number | undefined>(undefined);

  const {
    dayMap: availabilityDays,
    propertyTypes: availabilityPropertyTypes,
    isLoading: availabilityLoading,
  } = useBookingEngineAvailability({
    baseMonth: calendarBaseMonth,
    selectedTypes,
    guests: previewGuests,
    enabled: previewOpen,
  });

  // ─── Snackbar ──────────────────────────────────────────────────────
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  const showSnackbar = useCallback((message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  // ─── Handlers ─────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const payload = { ...form, name: name.trim() || 'Default' };
    try {
      if (isCreate) {
        await createMutation.mutateAsync(payload);
        showSnackbar(t('bookingEngine.messages.created'), 'success');
        onBack();
      } else {
        await updateMutation.mutateAsync({ id: config!.id, data: payload });
        showSnackbar(t('bookingEngine.messages.saved'), 'success');
      }
    } catch {
      showSnackbar(t('bookingEngine.messages.error'), 'error');
    }
  }, [form, name, isCreate, config, createMutation, updateMutation, t, onBack, showSnackbar]);

  const handleToggle = useCallback(async (enabled: boolean) => {
    if (!config) return;
    try {
      await toggleMutation.mutateAsync({ id: config.id, enabled });
      showSnackbar(
        t('bookingEngine.messages.toggled', { status: enabled ? t('bookingEngine.status.active') : t('bookingEngine.status.inactive') }),
        'success',
      );
    } catch {
      showSnackbar(t('bookingEngine.messages.error'), 'error');
    }
  }, [config, toggleMutation, t, showSnackbar]);

  const handleRegenerateKey = useCallback(async () => {
    if (!config) return;
    try {
      await regenerateKeyMutation.mutateAsync(config.id);
      showSnackbar(t('bookingEngine.messages.keyRegenerated'), 'success');
    } catch {
      showSnackbar(t('bookingEngine.messages.error'), 'error');
    }
  }, [config, regenerateKeyMutation, t, showSnackbar]);

  const handleCopyKey = useCallback(() => {
    if (config?.apiKey) {
      navigator.clipboard.writeText(config.apiKey);
      showSnackbar(t('bookingEngine.messages.keyCopied'), 'success');
    }
  }, [config?.apiKey, t, showSnackbar]);

  // ─── AI Design handlers ────────────────────────────────────────────
  const handleTokensExtracted = useCallback((tokens: DesignTokens, generatedCss: string) => {
    setDesignTokens(tokens);
    handleChange('designTokens', JSON.stringify(tokens));
    handleChange('customCss', generatedCss);
    showSnackbar(t('bookingEngine.ai.tokensApplied'), 'success');
  }, [t, showSnackbar, setDesignTokens, handleChange]);

  const handleDesignTokensChange = useCallback((tokens: DesignTokens) => {
    setDesignTokens(tokens);
    handleChange('designTokens', JSON.stringify(tokens));
  }, [setDesignTokens, handleChange]);

  const handleRegenerateCss = useCallback(() => {
    if (!config?.id) return;
    generateCssMutation.mutate(
      { configId: config.id, designTokens, additionalInstructions: undefined },
      {
        onSuccess: (data) => {
          handleChange('customCss', data.generatedCss);
          showSnackbar(t('bookingEngine.ai.cssRegenerated'), 'success');
        },
        onError: () => {
          showSnackbar(t('bookingEngine.ai.cssRegenerateError'), 'error');
        },
      },
    );
  }, [config?.id, designTokens, generateCssMutation, t, showSnackbar, handleChange]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ─── Imperative handle ─────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    save: handleSave,
    openPreview: () => setPreviewOpen(true),
  }), [handleSave]);

  // Notify parent of saving state changes
  useEffect(() => {
    onSavingChange?.(isSaving);
  }, [isSaving, onSavingChange]);

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <Box>
      {/* Tab Navigation */}
      <Box sx={{
        display: 'flex', gap: 0.5, mb: 2.5, borderBottom: '1px solid', borderColor: 'divider', pb: 0,
      }}>
        {WIZARD_STEPS.map((step, index) => (
          <Box
            key={step.labelKey}
            onClick={() => setActiveStep(index)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.75,
              px: 2, py: 1, cursor: 'pointer',
              borderBottom: '2px solid',
              borderColor: index === activeStep ? 'primary.main' : 'transparent',
              color: index === activeStep ? 'primary.main' : 'text.secondary',
              transition: 'all 0.15s ease',
              '&:hover': { color: 'primary.main', bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04) },
              '& .MuiSvgIcon-root': { fontSize: 16 },
            }}
          >
            {step.icon}
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: index === activeStep ? 700 : 500 }}>
              {t(step.labelKey)}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Active step content */}
      <Box sx={{ minHeight: 300 }}>
        {activeStep === 0 && (
          <StepAppearance
            configId={config?.id ?? null}
            form={form}
            designTokens={designTokens}
            isDesignAiEnabled={isDesignAiEnabled}
            isRegeneratingCss={generateCssMutation.isPending}
            onFormChange={handleChange}
            onDesignTokensChange={handleDesignTokensChange}
            onTokensExtracted={handleTokensExtracted}
            onRegenerateCss={handleRegenerateCss}
            onSnackbar={showSnackbar}
          />
        )}
        {activeStep === 1 && (
          <StepSettings
            form={form}
            componentVis={componentVis}
            onFormChange={handleChange}
            onComponentVisChange={handleComponentVisChange}
          />
        )}
        {activeStep === 2 && (
          <StepOptions configId={config?.id ?? null} />
        )}
        {activeStep === 3 && (
          <StepIntegration
            config={config}
            isCreate={isCreate}
            name={name}
            toggleEnabled={config?.enabled ?? false}
            isTogglingPending={toggleMutation.isPending}
            isRegeneratingKey={regenerateKeyMutation.isPending}
            onNameChange={setName}
            onFormChange={handleChange}
            onToggle={handleToggle}
            onRegenerateKey={handleRegenerateKey}
            onCopyKey={handleCopyKey}
            onOpenPreview={() => setPreviewOpen(true)}
            onSnackbar={showSnackbar}
          />
        )}
      </Box>

      {/* Fullscreen preview dialog */}
      <Dialog
        fullScreen
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        TransitionComponent={SlideUpTransition}
        PaperProps={{ sx: { bgcolor: '#0f1117', overflow: 'hidden' } }}
      >
        <PreviewInspector
          onClose={() => setPreviewOpen(false)}
          onCssChange={(css) => handleChange('customCss', css || null)}
          initialCss={form.customCss || ''}
          initialWidgetPosition={{
            widgetPosition: (form.widgetPosition as 'bottom' | 'top' | 'inline') || 'bottom',
            inlineTargetId: form.inlineTargetId || 'hebergements',
            inlinePlacement: (form.inlinePlacement as 'before' | 'after') || 'after',
          }}
          onWidgetPositionChange={(cfg) => {
            handleChange('widgetPosition', cfg.widgetPosition);
            handleChange('inlineTargetId', cfg.inlineTargetId);
            handleChange('inlinePlacement', cfg.inlinePlacement);
          }}
        >
          <BookingEnginePreview
            primaryColor={form.primaryColor || '#B2974A'}
            accentColor={form.accentColor}
            fontFamily={form.fontFamily}
            logoUrl={form.logoUrl}
            customCss={form.customCss}
            componentConfig={componentVis}
            designTokens={Object.keys(designTokens).length > 0 ? designTokens : undefined}
            properties={previewProperties}
            availabilityDays={availabilityDays}
            propertyTypes={availabilityPropertyTypes}
            availabilityLoading={availabilityLoading}
            onMonthChange={(year: number, month: number) => setCalendarBaseMonth({ year, month })}
            onTypesChange={setSelectedTypes}
            onGuestsChange={(adults: number, children: number) => setPreviewGuests(adults + children)}
            organizationId={config?.organizationId ?? null}
            defaultCurrency={form.defaultCurrency || 'EUR'}
            minAdvanceDays={form.minAdvanceDays ?? 1}
            maxAdvanceDays={form.maxAdvanceDays ?? 365}
            termsUrl={form.termsUrl}
            privacyUrl={form.privacyUrl}
            cancellationPolicy={form.cancellationPolicy}
            collectPaymentOnBooking={form.collectPaymentOnBooking ?? true}
            autoConfirm={form.autoConfirm ?? true}
            showCleaningFee={form.showCleaningFee ?? true}
            showTouristTax={form.showTouristTax ?? true}
            defaultLanguage={form.defaultLanguage || 'fr'}
            reviewStats={reviewStats}
            serviceCategories={serviceCategories}
          />
        </PreviewInspector>
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
