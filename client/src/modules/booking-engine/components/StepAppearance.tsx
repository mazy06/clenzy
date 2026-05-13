import React, { useCallback, useState } from 'react';
import { Box, Typography, Button, TextField, MenuItem, IconButton, alpha } from '@mui/material';
import {
  Css, Code, Delete, UploadFile,
  BrushRounded, AutoFixHighRounded,
} from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import type { BookingEngineConfigUpdate, DesignTokens } from '../../../services/api/bookingEngineApi';
import AiDesignMatcher from '../AiDesignMatcher';
import DesignTokenEditor from '../DesignTokenEditor';
import SectionPaper from './SectionPaper';
import { DESIGN_PRESETS } from '../constants';

// ─── Types ──────────────────────────────────────────────────────────────────

interface StepAppearanceProps {
  configId: number | null;
  form: BookingEngineConfigUpdate;
  designTokens: DesignTokens;
  isDesignAiEnabled: boolean;
  onFormChange: (field: keyof BookingEngineConfigUpdate, value: unknown) => void;
  onDesignTokensChange: (tokens: DesignTokens) => void;
  onTokensExtracted: (tokens: DesignTokens, generatedCss: string) => void;
  onSnackbar: (message: string, severity: 'success' | 'error') => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

const StepAppearance: React.FC<StepAppearanceProps> = ({
  configId,
  form,
  designTokens,
  isDesignAiEnabled,
  onFormChange,
  onDesignTokensChange,
  onTokensExtracted,
  onSnackbar,
}) => {
  const { t } = useTranslation();

  // Auto-open editors when content exists
  const [showCssEditor, setShowCssEditor] = useState(!!form.customCss);
  const [showJsEditor, setShowJsEditor] = useState(!!form.customJs);

  // AI analysis already done (from DB) or just completed in this session
  const aiAlreadyDone = !!form.aiAnalysisAt;
  const [aiJustCompleted, setAiJustCompleted] = useState(false);

  // Show Templates section: always if AI disabled, or after analysis is done
  const showTemplates = !isDesignAiEnabled || aiAlreadyDone || aiJustCompleted;

  const handleAiComplete = useCallback(() => {
    setAiJustCompleted(true);
    setShowCssEditor(true); // auto-open CSS editor to show generated CSS
  }, []);

  // Build a dynamic preset from AI analysis if available
  const aiDomainName = form.sourceWebsiteUrl
    ? (() => { try { return new URL(form.sourceWebsiteUrl).hostname.replace('www.', ''); } catch { return null; } })()
    : null;
  const hasAiPreset = !!form.aiAnalysisAt && !!aiDomainName && !!designTokens.primaryColor;

  const activePresetId = hasAiPreset
    && form.primaryColor === designTokens.primaryColor
    ? 'ai-generated'
    : DESIGN_PRESETS.find(
        (p) => form.primaryColor === p.primaryColor && form.fontFamily === p.fontFamily,
      )?.id ?? 'custom';

  const selectedPreset = DESIGN_PRESETS.find((p) => p.id === activePresetId);

  const applyDesignPreset = useCallback((presetId: string) => {
    if (presetId === 'ai-generated') {
      // Re-apply AI-extracted tokens
      if (designTokens.primaryColor) onFormChange('primaryColor', designTokens.primaryColor);
      if (designTokens.bodyFontFamily) onFormChange('fontFamily', designTokens.bodyFontFamily);
      if (designTokens.accentColor) onFormChange('accentColor', designTokens.accentColor);
      onDesignTokensChange(designTokens);
      onSnackbar(t('bookingEngine.presets.applied'), 'success');
      return;
    }
    const preset = DESIGN_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    onFormChange('primaryColor', preset.primaryColor);
    onFormChange('fontFamily', preset.fontFamily);
    onFormChange('accentColor', preset.tokens.accentColor || null);
    onDesignTokensChange(preset.tokens);
    onSnackbar(t('bookingEngine.presets.applied'), 'success');
  }, [onFormChange, onDesignTokensChange, onSnackbar, t, designTokens]);

  const handleFileImport = useCallback(
    (field: 'customCss' | 'customJs', file: File) => {
      const reader = new FileReader();
      reader.onload = (ev) => onFormChange(field, (ev.target?.result as string) || null);
      reader.readAsText(file);
    },
    [onFormChange],
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* ── Section 1 : Analyse IA ──────────────────────────────────── */}
      {isDesignAiEnabled && (
        <SectionPaper icon={<AutoFixHighRounded size={20} strokeWidth={1.75} color='#7C4DFF' />} titleKey="bookingEngine.sections.aiDesign">
          <AiDesignMatcher
            configId={configId}
            sourceWebsiteUrl={form.sourceWebsiteUrl ?? ''}
            onSourceWebsiteUrlChange={(url) => onFormChange('sourceWebsiteUrl', url || null)}
            onTokensExtracted={onTokensExtracted}
            onAnalysisComplete={handleAiComplete}
            onError={(msg) => onSnackbar(msg, 'error')}
          />
        </SectionPaper>
      )}

      {/* ── Section 2 : Templates + Tokens de design (fusionnes) ──── */}
      {showTemplates && (
      <SectionPaper icon={<BrushRounded size={20} strokeWidth={1.75} color='#E91E63' />} titleKey="bookingEngine.sections.designPresets">
        {/* Preset selector row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            select
            label={t('bookingEngine.presets.title')}
            value={activePresetId}
            onChange={(e) => applyDesignPreset(e.target.value)}
            sx={{ minWidth: 240, flex: '0 0 auto' }}
          >
            {/* AI-generated preset from website analysis */}
            {hasAiPreset && aiDomainName && (
              <MenuItem value="ai-generated">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                  <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
                    {[designTokens.primaryColor, designTokens.secondaryColor, designTokens.accentColor]
                      .filter((c): c is string => c != null && c !== '')
                      .map((color, i) => (
                        <Box key={i} sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: color, border: '1px solid', borderColor: alpha(color, 0.3) }} />
                      ))}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>{aiDomainName}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>{t('bookingEngine.presets.aiGenerated')}</Typography>
                  </Box>
                </Box>
              </MenuItem>
            )}
            {DESIGN_PRESETS.map((preset) => (
              <MenuItem key={preset.id} value={preset.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                  <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
                    {preset.swatch.map((color, i) => (
                      <Box key={i} sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: color, border: '1px solid', borderColor: alpha(color, 0.3) }} />
                    ))}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>{t(`bookingEngine.presets.${preset.i18nKey}.name`)}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>{t(`bookingEngine.presets.${preset.i18nKey}.description`)}</Typography>
                  </Box>
                </Box>
              </MenuItem>
            ))}
            <MenuItem value="custom">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ display: 'flex', gap: 0.25 }}>
                  {[0, 1, 2].map((i) => <Box key={i} sx={{ width: 12, height: 12, borderRadius: '3px', border: '1px dashed', borderColor: 'grey.400' }} />)}
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>{t('bookingEngine.presets.custom')}</Typography>
              </Box>
            </MenuItem>
          </TextField>

          {/* Swatch preview */}
          {selectedPreset && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: '0 0 auto' }}>
              {selectedPreset.swatch.map((color, i) => (
                <Box key={i} sx={{ width: i === 0 ? 20 : 14, height: 14, borderRadius: 0.5, bgcolor: color, border: '1px solid', borderColor: alpha(color, 0.3) }} />
              ))}
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                {selectedPreset.fontFamily} · {selectedPreset.tokens.borderRadius}
              </Typography>
            </Box>
          )}

          <Box sx={{ flex: 1 }} />

          {/* Toggle CSS editor */}
          <CodeToggleButton
            label="CSS"
            hasValue={!!form.customCss}
            icon={<Css size={14} strokeWidth={1.75} />}
            isOpen={showCssEditor}
            onToggle={() => setShowCssEditor((v) => !v)}
          />

          {/* Toggle JS editor */}
          <CodeToggleButton
            label="JS"
            hasValue={!!form.customJs}
            icon={<Code size={14} strokeWidth={1.75} />}
            isOpen={showJsEditor}
            onToggle={() => setShowJsEditor((v) => !v)}
          />
        </Box>

        {/* CSS Editor */}
        {showCssEditor && (
          <CodeEditorSection
            label="CSS"
            accept=".css"
            value={form.customCss ?? ''}
            onChange={(val) => onFormChange('customCss', val || null)}
            onImport={(file) => handleFileImport('customCss', file)}
            onClear={() => onFormChange('customCss', null)}
            placeholder="/* Ajoutez votre CSS personnalise ici */\n\n.booking-widget {\n  /* ... */\n}"
            t={t}
          />
        )}

        {/* JS Editor */}
        {showJsEditor && (
          <CodeEditorSection
            label="JS"
            accept=".js"
            value={form.customJs ?? ''}
            onChange={(val) => onFormChange('customJs', val || null)}
            onImport={(file) => handleFileImport('customJs', file)}
            onClear={() => onFormChange('customJs', null)}
            placeholder="// Ajoutez votre JavaScript personnalise ici\n\ndocument.addEventListener('DOMContentLoaded', () => {\n  // ...\n});"
            t={t}
          />
        )}

        {/* Design Tokens (integrated) */}
        <Box sx={{ mt: 2 }}>
          <DesignTokenEditor
            tokens={designTokens}
            onChange={onDesignTokensChange}
          />
        </Box>
      </SectionPaper>
      )}
    </Box>
  );
};

// ─── Code Toggle Button (header) ────────────────────────────────────────────

interface CodeToggleButtonProps {
  label: string;
  hasValue: boolean;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}

const CodeToggleButton: React.FC<CodeToggleButtonProps> = ({ label, hasValue, icon, isOpen, onToggle }) => (
  <Button
    variant={isOpen ? 'contained' : 'outlined'}
    size="small"
    startIcon={icon}
    onClick={onToggle}
    color={hasValue ? 'success' : isOpen ? 'primary' : 'inherit'}
    sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 500, px: 1.5, minHeight: 32, flex: '0 0 auto' }}
  >
    {label}
  </Button>
);

// ─── Code Editor Section (expandable) ───────────────────────────────────────

interface CodeEditorSectionProps {
  label: string;
  accept: string;
  value: string;
  onChange: (value: string) => void;
  onImport: (file: File) => void;
  onClear: () => void;
  placeholder: string;
  t: (key: string) => string;
}

const CodeEditorSection: React.FC<CodeEditorSectionProps> = ({
  label, accept, value, onChange, onImport, onClear, placeholder,
}) => (
  <Box sx={{
    mt: 1.5, p: 1.5,
    border: '1px solid', borderColor: 'divider', borderRadius: 2,
    bgcolor: 'background.default',
  }}>
    {/* Toolbar */}
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label} personnalise
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <Button
          variant="text"
          size="small"
          startIcon={<UploadFile size={14} strokeWidth={1.75} />}
          component="label"
          sx={{ textTransform: 'none', fontSize: '0.7rem', minHeight: 26, px: 1 }}
        >
          Importer
          <input
            type="file"
            accept={accept}
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImport(file);
              e.target.value = '';
            }}
          />
        </Button>
        {value && (
          <IconButton size="small" onClick={onClear} sx={{ p: 0.25 }} title="Supprimer">
            <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled' }}><Delete size={14} strokeWidth={1.75} /></Box>
          </IconButton>
        )}
      </Box>
    </Box>

    {/* Code textarea */}
    <Box
      component="textarea"
      value={value}
      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      placeholder={placeholder}
      spellCheck={false}
      sx={{
        width: '100%',
        minHeight: 160,
        maxHeight: 400,
        resize: 'vertical',
        fontFamily: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
        fontSize: '0.75rem',
        lineHeight: 1.6,
        p: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        color: 'text.primary',
        outline: 'none',
        '&:focus': { borderColor: 'primary.main' },
        '&::placeholder': { color: 'text.disabled', opacity: 0.6 },
      }}
    />
  </Box>
);

StepAppearance.displayName = 'StepAppearance';

export default StepAppearance;
