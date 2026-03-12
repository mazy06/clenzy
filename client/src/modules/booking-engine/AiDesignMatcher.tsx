import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  LinearProgress,
  Alert,
  Typography,
  Chip,
  Stack,
} from '@mui/material';
import AutoFixHighRounded from '@mui/icons-material/AutoFixHighRounded';
import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded';
import { useTranslation } from '../../hooks/useTranslation';
import { useAnalyzeWebsiteDesign } from '../../hooks/useBookingEngineConfig';
import type { DesignTokens } from '../../services/api/bookingEngineApi';

interface AiDesignMatcherProps {
  configId: number | null;
  onTokensExtracted: (tokens: DesignTokens, generatedCss: string) => void;
  onError?: (message: string) => void;
}

/**
 * Component that lets the user enter a website URL to analyze its design
 * and extract design tokens via AI. Shown in Step 2 (Appearance) of the wizard.
 */
export default function AiDesignMatcher({ configId, onTokensExtracted, onError }: AiDesignMatcherProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [success, setSuccess] = useState(false);
  const [extractedColors, setExtractedColors] = useState<string[]>([]);

  const analyzeMutation = useAnalyzeWebsiteDesign();

  const handleAnalyze = () => {
    if (!configId || !url.trim()) return;

    setSuccess(false);
    setExtractedColors([]);

    analyzeMutation.mutate(
      { configId, websiteUrl: url.trim() },
      {
        onSuccess: (data) => {
          setSuccess(true);

          // Extract color swatches for mini preview
          const tokens = data.designTokens;
          const colors = [
            tokens.primaryColor,
            tokens.secondaryColor,
            tokens.accentColor,
            tokens.backgroundColor,
            tokens.textColor,
          ].filter((c): c is string => c != null && c !== '');
          setExtractedColors(colors);

          onTokensExtracted(tokens, data.generatedCss);
        },
        onError: (err) => {
          const message = err instanceof Error ? err.message : t('bookingEngine.ai.analyzeError');
          onError?.(message);
        },
      },
    );
  };

  const isDisabled = configId === null;
  const isLoading = analyzeMutation.isPending;

  return (
    <Box sx={{ mb: 3 }}>
      {/* URL input + button */}
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <TextField
          label={t('bookingEngine.ai.websiteUrl')}
          placeholder="https://www.example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          size="small"
          fullWidth
          disabled={isDisabled || isLoading}
          helperText={isDisabled ? t('bookingEngine.ai.saveFirst') : undefined}
          inputProps={{ type: 'url' }}
        />
        <Button
          variant="contained"
          startIcon={<AutoFixHighRounded />}
          onClick={handleAnalyze}
          disabled={isDisabled || isLoading || !url.trim()}
          sx={{ whiteSpace: 'nowrap', minWidth: 180, height: 40 }}
        >
          {t('bookingEngine.ai.analyzeDesign')}
        </Button>
      </Stack>

      {/* Loading state */}
      {isLoading && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t('bookingEngine.ai.analyzing')}
          </Typography>
        </Box>
      )}

      {/* Success state */}
      {success && !isLoading && (
        <Alert
          severity="success"
          icon={<CheckCircleOutlineRounded />}
          sx={{ mt: 2 }}
        >
          <Typography variant="body2" fontWeight={600} sx={{ mb: extractedColors.length > 0 ? 1 : 0 }}>
            {t('bookingEngine.ai.analyzeSuccess')}
          </Typography>
          {extractedColors.length > 0 && (
            <Stack direction="row" spacing={0.5} flexWrap="wrap">
              {extractedColors.map((color, idx) => (
                <Chip
                  key={idx}
                  size="small"
                  label={color}
                  sx={{
                    backgroundColor: color,
                    color: isLightColor(color) ? '#000' : '#fff',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                  }}
                />
              ))}
            </Stack>
          )}
        </Alert>
      )}

      {/* Error state */}
      {analyzeMutation.isError && !isLoading && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {t('bookingEngine.ai.analyzeError')}
        </Alert>
      )}
    </Box>
  );
}

/**
 * Simple heuristic to determine if a hex color is light (for text contrast).
 */
function isLightColor(hex: string): boolean {
  try {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    // Perceived brightness
    return (r * 299 + g * 587 + b * 114) / 1000 > 128;
  } catch {
    return false;
  }
}
