import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Chip,
  CircularProgress,
  Alert,
  Collapse,
} from '@mui/material';
import {
  Psychology,
  AutoFixHigh,
  Send as SendIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useAiDetectIntent, useAiSuggestResponse } from '../../hooks/useAi';
import type { AiIntentDetection, AiSuggestedResponse } from '../../services/api/aiApi';

// ─── Constants ──────────────────────────────────────────────────────────────

const CARD_SX = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1.5,
  p: 1.5,
  transition: 'border-color 0.15s ease',
  '&:hover': { borderColor: 'text.secondary' },
} as const;

const HEADER_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  mb: 1.5,
} as const;

const RESULT_SX = {
  p: 1,
  borderRadius: 1,
  bgcolor: 'action.hover',
  mt: 1,
} as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

function isAiNotConfiguredError(error: unknown): boolean {
  const apiErr = error as { details?: Record<string, unknown> } | undefined;
  const errorCode = apiErr?.details?.errorCode;
  return errorCode === 'AI_NOT_CONFIGURED' || errorCode === 'AI_FEATURE_DISABLED';
}

// ─── Component ──────────────────────────────────────────────────────────────

const AiMessagingControls: React.FC = React.memo(() => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // ── Local state ─────────────────────────────────────────────────────
  const [message, setMessage] = useState('');
  const [context, setContext] = useState('');
  const [language, setLanguage] = useState('');
  const [intentResult, setIntentResult] = useState<AiIntentDetection | null>(null);
  const [responseResult, setResponseResult] = useState<AiSuggestedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiNotConfigured, setAiNotConfigured] = useState(false);

  // ── Mutations ───────────────────────────────────────────────────────
  const detectIntent = useAiDetectIntent();
  const suggestResponse = useAiSuggestResponse();

  // ── Handlers ────────────────────────────────────────────────────────
  const handleDetectIntent = useCallback(async () => {
    if (!message.trim()) return;
    setError(null);
    setAiNotConfigured(false);
    setIntentResult(null);
    try {
      const result = await detectIntent.mutateAsync(message);
      setIntentResult(result);
    } catch (err) {
      if (isAiNotConfiguredError(err)) {
        setAiNotConfigured(true);
      } else {
        setError(t('common.error'));
      }
    }
  }, [message, detectIntent, t]);

  const handleSuggestResponse = useCallback(async () => {
    if (!message.trim()) return;
    setError(null);
    setAiNotConfigured(false);
    setResponseResult(null);
    try {
      const result = await suggestResponse.mutateAsync({
        message,
        context: context || undefined,
        language: language || undefined,
      });
      setResponseResult(result);
    } catch (err) {
      if (isAiNotConfiguredError(err)) {
        setAiNotConfigured(true);
      } else {
        setError(t('common.error'));
      }
    }
  }, [message, context, language, suggestResponse, t]);

  const isLoading = detectIntent.isPending || suggestResponse.isPending;

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <Paper sx={CARD_SX}>
      <Box sx={HEADER_SX}>
        <Psychology sx={{ fontSize: 18, color: 'primary.main' }} />
        <Typography variant="subtitle2" fontWeight={700} fontSize="0.8rem">
          {t('bookingEngine.ai.guidance.messaging.title')}
        </Typography>
      </Box>

      {/* AI Not Configured Guidance */}
      <Collapse in={aiNotConfigured}>
        <Alert severity="info" sx={{ mb: 1, fontSize: '0.75rem' }} onClose={() => setAiNotConfigured(false)}>
          <Typography variant="body2" fontSize="0.75rem" sx={{ mb: 1 }}>
            {t('bookingEngine.ai.guidance.messaging.text')}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<SettingsIcon sx={{ fontSize: 14 }} />}
            onClick={() => navigate('/settings')}
            sx={{ textTransform: 'none', fontSize: '0.7rem' }}
          >
            {t('bookingEngine.ai.guidance.messaging.button')}
          </Button>
        </Alert>
      </Collapse>

      {/* Error */}
      <Collapse in={!!error}>
        <Alert severity="error" sx={{ mb: 1, fontSize: '0.75rem' }} onClose={() => setError(null)}>
          {error}
        </Alert>
      </Collapse>

      {/* Input area */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <TextField
          size="small"
          multiline
          minRows={2}
          maxRows={4}
          placeholder={t('bookingEngine.ai.guidance.messaging.placeholder')}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={isLoading}
          sx={{ '& .MuiInputBase-input': { fontSize: '0.8rem' } }}
        />

        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            placeholder={t('bookingEngine.ai.guidance.messaging.contextPlaceholder')}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            disabled={isLoading}
            sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
          />
          <TextField
            size="small"
            placeholder={t('bookingEngine.ai.guidance.messaging.languagePlaceholder')}
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={isLoading}
            sx={{ width: 130, '& .MuiInputBase-input': { fontSize: '0.75rem' } }}
          />
        </Box>

        {/* Action buttons */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={
              detectIntent.isPending ? (
                <CircularProgress size={14} />
              ) : (
                <Psychology sx={{ fontSize: 16 }} />
              )
            }
            onClick={handleDetectIntent}
            disabled={isLoading || !message.trim()}
            sx={{ fontSize: '0.7rem', textTransform: 'none', flex: 1 }}
          >
            {t('bookingEngine.ai.messaging.detectIntent')}
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={
              suggestResponse.isPending ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <AutoFixHigh sx={{ fontSize: 16 }} />
              )
            }
            onClick={handleSuggestResponse}
            disabled={isLoading || !message.trim()}
            sx={{ fontSize: '0.7rem', textTransform: 'none', flex: 1 }}
          >
            {t('bookingEngine.ai.messaging.suggestResponse')}
          </Button>
        </Box>
      </Box>

      {/* Intent Detection Result */}
      <Collapse in={!!intentResult}>
        {intentResult && (
          <Box sx={RESULT_SX}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <Typography variant="caption" fontWeight={600} fontSize="0.7rem">
                {t('bookingEngine.ai.messaging.intent')}:
              </Typography>
              <Chip
                label={intentResult.intent}
                size="small"
                color="primary"
                sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600 }}
              />
              <Chip
                label={`${(intentResult.confidence * 100).toFixed(0)}%`}
                size="small"
                variant="outlined"
                sx={{ height: 18, fontSize: '0.6rem' }}
              />
              {intentResult.urgent && (
                <Chip
                  label={t('bookingEngine.ai.messaging.urgent')}
                  size="small"
                  color="error"
                  sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600 }}
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {intentResult.language && (
                <Chip
                  label={`${t('bookingEngine.ai.messaging.language')}: ${intentResult.language}`}
                  size="small"
                  variant="outlined"
                  sx={{ height: 16, fontSize: '0.6rem' }}
                />
              )}
              {intentResult.entities.map((entity, i) => (
                <Chip
                  key={i}
                  label={entity}
                  size="small"
                  variant="outlined"
                  sx={{ height: 16, fontSize: '0.6rem' }}
                />
              ))}
            </Box>
          </Box>
        )}
      </Collapse>

      {/* Suggested Response Result */}
      <Collapse in={!!responseResult}>
        {responseResult && (
          <Box sx={RESULT_SX}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <Typography variant="caption" fontWeight={600} fontSize="0.7rem">
                {t('bookingEngine.ai.messaging.tone')}:
              </Typography>
              <Chip
                label={responseResult.tone}
                size="small"
                color="info"
                sx={{ height: 18, fontSize: '0.6rem' }}
              />
              {responseResult.language && (
                <Chip
                  label={responseResult.language}
                  size="small"
                  variant="outlined"
                  sx={{ height: 18, fontSize: '0.6rem' }}
                />
              )}
            </Box>
            <Typography
              variant="body2"
              fontSize="0.75rem"
              sx={{
                mt: 0.5,
                p: 1,
                bgcolor: 'background.paper',
                borderRadius: 0.75,
                border: '1px solid',
                borderColor: 'divider',
                lineHeight: 1.4,
              }}
            >
              {responseResult.response}
            </Typography>
            {responseResult.alternatives.length > 0 && (
              <Box sx={{ mt: 0.75 }}>
                <Typography variant="caption" fontWeight={600} fontSize="0.65rem" color="text.secondary">
                  {t('bookingEngine.ai.messaging.alternatives')}:
                </Typography>
                {responseResult.alternatives.map((alt, i) => (
                  <Typography
                    key={i}
                    variant="caption"
                    fontSize="0.7rem"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.25, lineHeight: 1.3 }}
                  >
                    {i + 1}. {alt}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        )}
      </Collapse>
    </Paper>
  );
});

AiMessagingControls.displayName = 'AiMessagingControls';

export default AiMessagingControls;
