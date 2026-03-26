import React, { useCallback } from 'react';
import { Box, Typography, Button, TextField, MenuItem, IconButton, alpha } from '@mui/material';
import {
  Palette, Css, Code, Delete,
  BrushRounded, AutoFixHighRounded,
} from '@mui/icons-material';
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
  isRegeneratingCss: boolean;
  onFormChange: (field: keyof BookingEngineConfigUpdate, value: unknown) => void;
  onDesignTokensChange: (tokens: DesignTokens) => void;
  onTokensExtracted: (tokens: DesignTokens, generatedCss: string) => void;
  onRegenerateCss: () => void;
  onSnackbar: (message: string, severity: 'success' | 'error') => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

const StepAppearance: React.FC<StepAppearanceProps> = ({
  configId,
  form,
  designTokens,
  isDesignAiEnabled,
  isRegeneratingCss,
  onFormChange,
  onDesignTokensChange,
  onTokensExtracted,
  onRegenerateCss,
  onSnackbar,
}) => {
  const { t } = useTranslation();

  const activePresetId = DESIGN_PRESETS.find(
    (p) => form.primaryColor === p.primaryColor && form.fontFamily === p.fontFamily,
  )?.id ?? 'custom';

  const selectedPreset = DESIGN_PRESETS.find((p) => p.id === activePresetId);

  const applyDesignPreset = useCallback((presetId: string) => {
    const preset = DESIGN_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    onFormChange('primaryColor', preset.primaryColor);
    onFormChange('fontFamily', preset.fontFamily);
    onFormChange('accentColor', preset.tokens.accentColor || null);
    onDesignTokensChange(preset.tokens);
    onSnackbar(t('bookingEngine.presets.applied'), 'success');
  }, [onFormChange, onDesignTokensChange, onSnackbar, t]);

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
      {/* Design Preset Selector */}
      <SectionPaper icon={<BrushRounded sx={{ fontSize: 20, color: '#E91E63' }} />} titleKey="bookingEngine.sections.designPresets">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          {/* Preset selector */}
          <TextField
            size="small"
            select
            label={t('bookingEngine.presets.title')}
            value={activePresetId}
            onChange={(e) => applyDesignPreset(e.target.value)}
            sx={{ minWidth: 240, flex: '0 0 auto' }}
          >
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

          {/* Spacer */}
          <Box sx={{ flex: 1 }} />

          {/* Import CSS */}
          <FileImportButton
            label="CSS"
            accept=".css"
            hasValue={!!form.customCss}
            icon={<Css sx={{ fontSize: 14 }} />}
            onImport={(file) => handleFileImport('customCss', file)}
            onClear={() => onFormChange('customCss', null)}
          />

          {/* Import JS */}
          <FileImportButton
            label="JS"
            accept=".js"
            hasValue={!!form.customJs}
            icon={<Code sx={{ fontSize: 14 }} />}
            onImport={(file) => handleFileImport('customJs', file)}
            onClear={() => onFormChange('customJs', null)}
          />
        </Box>
      </SectionPaper>

      {/* AI Design Matcher */}
      {isDesignAiEnabled && (
        <SectionPaper icon={<AutoFixHighRounded sx={{ fontSize: 20, color: '#7C4DFF' }} />} titleKey="bookingEngine.sections.aiDesign">
          <AiDesignMatcher
            configId={configId}
            onTokensExtracted={onTokensExtracted}
            onError={(msg) => onSnackbar(msg, 'error')}
          />
        </SectionPaper>
      )}

      {/* Design Token Editor */}
      {Object.keys(designTokens).length > 0 && (
        <SectionPaper icon={<Palette sx={{ fontSize: 20, color: '#AB47BC' }} />} titleKey="bookingEngine.sections.designTokens">
          <DesignTokenEditor
            tokens={designTokens}
            onChange={onDesignTokensChange}
            onRegenerateCss={onRegenerateCss}
            isRegenerating={isRegeneratingCss}
          />
        </SectionPaper>
      )}
    </Box>
  );
};

// ─── File Import Button (internal helper) ───────────────────────────────────

interface FileImportButtonProps {
  label: string;
  accept: string;
  hasValue: boolean;
  icon: React.ReactNode;
  onImport: (file: File) => void;
  onClear: () => void;
}

const FileImportButton: React.FC<FileImportButtonProps> = ({ label, accept, hasValue, icon, onImport, onClear }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: '0 0 auto' }}>
    <Button
      variant="outlined"
      size="small"
      startIcon={icon}
      component="label"
      color={hasValue ? 'success' : 'inherit'}
      sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 500, px: 1.5, minHeight: 32 }}
    >
      {hasValue ? `${label} ✓` : label}
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
    {hasValue && (
      <IconButton size="small" onClick={onClear} sx={{ p: 0.25 }}>
        <Delete sx={{ fontSize: 14, color: 'text.disabled' }} />
      </IconButton>
    )}
  </Box>
);

StepAppearance.displayName = 'StepAppearance';

export default StepAppearance;
