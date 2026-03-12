import React from 'react';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  Button,
  Grid,
  MenuItem,
  TextField,
  Typography,
  CircularProgress,
} from '@mui/material';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import PaletteRounded from '@mui/icons-material/PaletteRounded';
import TextFieldsRounded from '@mui/icons-material/TextFieldsRounded';
import SpaceBarRounded from '@mui/icons-material/SpaceBarRounded';
import FilterDramaRounded from '@mui/icons-material/FilterDramaRounded';
import SmartButtonRounded from '@mui/icons-material/SmartButtonRounded';
import AutoFixHighRounded from '@mui/icons-material/AutoFixHighRounded';
import { useTranslation } from '../../hooks/useTranslation';
import type { DesignTokens } from '../../services/api/bookingEngineApi';

interface DesignTokenEditorProps {
  tokens: DesignTokens;
  onChange: (tokens: DesignTokens) => void;
  onRegenerateCss: () => void;
  isRegenerating: boolean;
}

/**
 * Visual editor for design tokens extracted by AI or set manually.
 * Organized in 5 accordion sections: Colors, Typography, Spacing, Shadows, Buttons.
 */
export default function DesignTokenEditor({
  tokens,
  onChange,
  onRegenerateCss,
  isRegenerating,
}: DesignTokenEditorProps) {
  const { t } = useTranslation();

  const updateToken = <K extends keyof DesignTokens>(key: K, value: string) => {
    onChange({ ...tokens, [key]: value || null });
  };

  // ─── Color field helper ──────────────────────────────────────────────
  const colorField = (key: keyof DesignTokens, labelKey: string) => (
    <Grid item xs={12} sm={6} md={4}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          component="input"
          type="color"
          value={(tokens[key] as string) || '#000000'}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateToken(key, e.target.value)}
          sx={{
            width: 36,
            height: 36,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            cursor: 'pointer',
            p: 0,
            '&::-webkit-color-swatch-wrapper': { p: 0 },
            '&::-webkit-color-swatch': { border: 'none', borderRadius: 1 },
          }}
        />
        <TextField
          label={t(labelKey)}
          value={(tokens[key] as string) || ''}
          onChange={(e) => updateToken(key, e.target.value)}
          size="small"
          fullWidth
          placeholder="#000000"
          inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
        />
      </Box>
    </Grid>
  );

  // ─── Text field helper ───────────────────────────────────────────────
  const textField = (key: keyof DesignTokens, labelKey: string, placeholder?: string) => (
    <Grid item xs={12} sm={6}>
      <TextField
        label={t(labelKey)}
        value={(tokens[key] as string) || ''}
        onChange={(e) => updateToken(key, e.target.value)}
        size="small"
        fullWidth
        placeholder={placeholder}
      />
    </Grid>
  );

  // ─── Select field helper ─────────────────────────────────────────────
  const selectField = (
    key: keyof DesignTokens,
    labelKey: string,
    options: { value: string; label: string }[],
  ) => (
    <Grid item xs={12} sm={6}>
      <TextField
        select
        label={t(labelKey)}
        value={(tokens[key] as string) || ''}
        onChange={(e) => updateToken(key, e.target.value)}
        size="small"
        fullWidth
      >
        <MenuItem value="">
          <em>{t('bookingEngine.designTokens.none')}</em>
        </MenuItem>
        {options.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </TextField>
    </Grid>
  );

  return (
    <Box>
      {/* ─── Section 1: Colors ──────────────────────────────────────── */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreRounded />}>
          <PaletteRounded sx={{ mr: 1, color: 'primary.main' }} />
          <Typography fontWeight={600}>{t('bookingEngine.designTokens.colors')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            {colorField('primaryColor', 'bookingEngine.designTokens.primaryColor')}
            {colorField('secondaryColor', 'bookingEngine.designTokens.secondaryColor')}
            {colorField('accentColor', 'bookingEngine.designTokens.accentColor')}
            {colorField('backgroundColor', 'bookingEngine.designTokens.backgroundColor')}
            {colorField('surfaceColor', 'bookingEngine.designTokens.surfaceColor')}
            {colorField('textColor', 'bookingEngine.designTokens.textColor')}
            {colorField('textSecondaryColor', 'bookingEngine.designTokens.textSecondaryColor')}
            {colorField('borderColor', 'bookingEngine.designTokens.borderColor')}
            {colorField('dividerColor', 'bookingEngine.designTokens.dividerColor')}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* ─── Section 2: Typography ──────────────────────────────────── */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreRounded />}>
          <TextFieldsRounded sx={{ mr: 1, color: 'primary.main' }} />
          <Typography fontWeight={600}>{t('bookingEngine.designTokens.typography')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            {textField('headingFontFamily', 'bookingEngine.designTokens.headingFontFamily', 'Inter, sans-serif')}
            {textField('bodyFontFamily', 'bookingEngine.designTokens.bodyFontFamily', 'Inter, sans-serif')}
            {textField('baseFontSize', 'bookingEngine.designTokens.baseFontSize', '16px')}
            {selectField('headingFontWeight', 'bookingEngine.designTokens.headingFontWeight', [
              { value: '400', label: 'Regular (400)' },
              { value: '500', label: 'Medium (500)' },
              { value: '600', label: 'Semi-bold (600)' },
              { value: '700', label: 'Bold (700)' },
              { value: '800', label: 'Extra-bold (800)' },
            ])}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* ─── Section 3: Spacing & Borders ──────────────────────────── */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreRounded />}>
          <SpaceBarRounded sx={{ mr: 1, color: 'primary.main' }} />
          <Typography fontWeight={600}>{t('bookingEngine.designTokens.spacing')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            {textField('borderRadius', 'bookingEngine.designTokens.borderRadius', '8px')}
            {textField('buttonBorderRadius', 'bookingEngine.designTokens.buttonBorderRadius', '6px')}
            {textField('cardBorderRadius', 'bookingEngine.designTokens.cardBorderRadius', '12px')}
            {textField('spacing', 'bookingEngine.designTokens.spacingUnit', '8px')}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* ─── Section 4: Shadows ─────────────────────────────────────── */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreRounded />}>
          <FilterDramaRounded sx={{ mr: 1, color: 'primary.main' }} />
          <Typography fontWeight={600}>{t('bookingEngine.designTokens.shadows')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            {selectField('boxShadow', 'bookingEngine.designTokens.boxShadow', [
              { value: 'none', label: t('bookingEngine.designTokens.shadowNone') },
              { value: '0 1px 3px rgba(0,0,0,0.08)', label: t('bookingEngine.designTokens.shadowSubtle') },
              { value: '0 2px 8px rgba(0,0,0,0.12)', label: t('bookingEngine.designTokens.shadowMedium') },
              { value: '0 4px 16px rgba(0,0,0,0.16)', label: t('bookingEngine.designTokens.shadowStrong') },
            ])}
            {selectField('cardShadow', 'bookingEngine.designTokens.cardShadow', [
              { value: 'none', label: t('bookingEngine.designTokens.shadowNone') },
              { value: '0 1px 4px rgba(0,0,0,0.06)', label: t('bookingEngine.designTokens.shadowSubtle') },
              { value: '0 2px 12px rgba(0,0,0,0.1)', label: t('bookingEngine.designTokens.shadowMedium') },
              { value: '0 6px 24px rgba(0,0,0,0.15)', label: t('bookingEngine.designTokens.shadowStrong') },
            ])}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* ─── Section 5: Buttons ─────────────────────────────────────── */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreRounded />}>
          <SmartButtonRounded sx={{ mr: 1, color: 'primary.main' }} />
          <Typography fontWeight={600}>{t('bookingEngine.designTokens.buttons')}</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            {selectField('buttonStyle', 'bookingEngine.designTokens.buttonStyle', [
              { value: 'filled', label: t('bookingEngine.designTokens.buttonFilled') },
              { value: 'outlined', label: t('bookingEngine.designTokens.buttonOutlined') },
              { value: 'rounded', label: t('bookingEngine.designTokens.buttonRounded') },
            ])}
            {selectField('buttonTextTransform', 'bookingEngine.designTokens.buttonTextTransform', [
              { value: 'none', label: t('bookingEngine.designTokens.textTransformNone') },
              { value: 'uppercase', label: t('bookingEngine.designTokens.textTransformUppercase') },
              { value: 'capitalize', label: t('bookingEngine.designTokens.textTransformCapitalize') },
            ])}
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* ─── Regenerate CSS button ──────────────────────────────────── */}
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          startIcon={isRegenerating ? <CircularProgress size={16} /> : <AutoFixHighRounded />}
          onClick={onRegenerateCss}
          disabled={isRegenerating}
        >
          {t('bookingEngine.designTokens.regenerateCss')}
        </Button>
      </Box>
    </Box>
  );
}
