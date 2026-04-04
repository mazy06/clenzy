import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Switch,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import {
  CheckCircle,
  Error as ErrorIcon,
  Delete,
  Visibility,
  VisibilityOff,
  Science,
  LinkOff,
  Palette,
  AttachMoney,
  Chat,
  BarChart,
  StarRate,
} from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { useAiKeyStatus, useTestAiKey, useSaveAiKey, useDeleteAiKey, useAiFeatureToggles, useSetAiFeatureToggle } from '../../hooks/useAi';
import type { AiApiKeyStatus, SaveAiApiKeyRequest } from '../../services/api/aiApi';
import PlatformAiConfigSection from './PlatformAiConfigSection';

// ─── Provider Brand Config ──────────────────────────────────────────────────

interface ProviderBrand {
  id: 'openai' | 'anthropic';
  label: string;
  accent: string;        // primary brand color
  accentLight: string;   // lighter tint for backgrounds
  accentDark: string;    // darker shade for dark mode text
  model: string;         // default model display
  placeholder: string;   // API key placeholder
  modelPlaceholder: string;
}

const PROVIDERS: Record<string, ProviderBrand> = {
  openai: {
    id: 'openai',
    label: 'OpenAI',
    accent: '#10A37F',
    accentLight: '#10A37F',
    accentDark: '#34D399',
    model: 'GPT-4o',
    placeholder: 'sk-...',
    modelPlaceholder: 'gpt-4o',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Claude',
    accent: '#DA7756',
    accentLight: '#DA7756',
    accentDark: '#F0A080',
    model: 'Claude Sonnet',
    placeholder: 'sk-ant-...',
    modelPlaceholder: 'claude-sonnet-4-20250514',
  },
};

// ─── SVG Logo Icons ─────────────────────────────────────────────────────────

function OpenAILogo({ size = 28, color }: { size?: number; color?: string }) {
  const theme = useTheme();
  const fill = color ?? (theme.palette.mode === 'dark' ? '#FFFFFF' : '#000000');
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={fill} xmlns="http://www.w3.org/2000/svg">
      <path d="M14.949 6.547a3.94 3.94 0 0 0-.348-3.273 4.11 4.11 0 0 0-4.4-1.934A4.1 4.1 0 0 0 8.423.2 4.15 4.15 0 0 0 6.305.086a4.1 4.1 0 0 0-1.891.948 4.04 4.04 0 0 0-1.158 1.753 4.1 4.1 0 0 0-1.563.679A4 4 0 0 0 .554 4.72a3.99 3.99 0 0 0 .502 4.731 3.94 3.94 0 0 0 .346 3.274 4.11 4.11 0 0 0 4.402 1.933c.382.425.852.764 1.377.995.526.231 1.095.35 1.67.346 1.78.002 3.358-1.132 3.901-2.804a4.1 4.1 0 0 0 1.563-.68 4 4 0 0 0 1.14-1.253 3.99 3.99 0 0 0-.506-4.716m-6.097 8.406a3.05 3.05 0 0 1-1.945-.694l.096-.054 3.23-1.838a.53.53 0 0 0 .265-.455v-4.49l1.366.778q.02.011.025.035v3.722c-.003 1.653-1.361 2.992-3.037 2.996m-6.53-2.75a2.95 2.95 0 0 1-.36-2.01l.095.057L5.29 12.09a.53.53 0 0 0 .527 0l3.949-2.246v1.555a.05.05 0 0 1-.022.041L6.473 13.3c-1.454.826-3.311.335-4.15-1.098m-.85-6.94A3.02 3.02 0 0 1 3.07 3.949v3.785a.51.51 0 0 0 .262.451l3.93 2.237-1.366.779a.05.05 0 0 1-.048 0L2.585 9.342a2.98 2.98 0 0 1-1.113-4.094zm11.216 2.571L8.747 5.576l1.362-.776a.05.05 0 0 1 .048 0l3.265 1.86a3 3 0 0 1 1.173 1.207 2.96 2.96 0 0 1-.27 3.2 3.05 3.05 0 0 1-1.36.997V8.279a.52.52 0 0 0-.276-.445m1.36-2.015-.097-.057-3.226-1.855a.53.53 0 0 0-.53 0L6.249 6.153V4.598a.04.04 0 0 1 .019-.04L9.533 2.7a3.07 3.07 0 0 1 3.257.139c.474.325.843.778 1.066 1.303.223.526.289 1.103.191 1.664zM5.503 8.575 4.139 7.8a.05.05 0 0 1-.026-.037V4.049c0-.57.166-1.127.476-1.607s.752-.864 1.275-1.105a3.08 3.08 0 0 1 3.234.41l-.096.054-3.23 1.838a.53.53 0 0 0-.265.455zm.742-1.577 1.758-1 1.762 1v2l-1.755 1-1.762-1z" />
    </svg>
  );
}

function ClaudeLogo({ size = 28, color }: { size?: number; color?: string }) {
  const fill = color ?? '#DA7756';
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill={fill} xmlns="http://www.w3.org/2000/svg">
      <path d="m3.127 10.604 3.135-1.76.053-.153-.053-.085H6.11l-.525-.032-1.791-.048-1.554-.065-1.505-.08-.38-.081L0 7.832l.036-.234.32-.214.455.04 1.009.069 1.513.105 1.097.064 1.626.17h.259l.036-.105-.089-.065-.068-.064-1.566-1.062-1.695-1.121-.887-.646-.48-.327-.243-.306-.104-.67.435-.48.585.04.15.04.593.456 1.267.981 1.654 1.218.242.202.097-.068.012-.049-.109-.181-.9-1.626-.96-1.655-.428-.686-.113-.411a2 2 0 0 1-.068-.484l.496-.674L4.446 0l.662.089.279.242.411.94.666 1.48 1.033 2.014.302.597.162.553.06.17h.105v-.097l.085-1.134.157-1.392.154-1.792.052-.504.25-.605.497-.327.387.186.319.456-.045.294-.19 1.23-.37 1.93-.243 1.29h.142l.161-.16.654-.868 1.097-1.372.484-.545.565-.601.363-.287h.686l.505.751-.226.775-.707.895-.585.759-.839 1.13-.524.904.048.072.125-.012 1.897-.403 1.024-.186 1.223-.21.553.258.06.263-.218.536-1.307.323-1.533.307-2.284.54-.028.02.032.04 1.029.098.44.024h1.077l2.005.15.525.346.315.424-.053.323-.807.411-3.631-.863-.872-.218h-.12v.073l.726.71 1.331 1.202 1.667 1.55.084.383-.214.302-.226-.032-1.464-1.101-.565-.497-1.28-1.077h-.084v.113l.295.432 1.557 2.34.08.718-.112.234-.404.141-.444-.08-.911-1.28-.94-1.44-.759-1.291-.093.053-.448 4.821-.21.246-.484.186-.403-.307-.214-.496.214-.98.258-1.28.21-1.016.19-1.263.112-.42-.008-.028-.092.012-.953 1.307-1.448 1.957-1.146 1.227-.274.109-.477-.247.045-.44.266-.39 1.586-2.018.956-1.25.617-.723-.004-.105h-.036l-4.212 2.736-.75.096-.324-.302.04-.496.154-.162 1.267-.871z" />
    </svg>
  );
}

// ─── Provider Card ──────────────────────────────────────────────────────────

interface ProviderCardProps {
  status: AiApiKeyStatus;
  brand: ProviderBrand;
  onConfigure: () => void;
  onDisconnect: () => void;
  isDisconnecting: boolean;
}

function ProviderCard({ status, brand, onConfigure, onDisconnect, isDisconnecting }: ProviderCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isOrgKey = status.source === 'ORGANIZATION' && status.configured;
  const accent = isDark ? brand.accentDark : brand.accent;

  const Logo = brand.id === 'openai' ? OpenAILogo : ClaudeLogo;

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        height: '100%',
        border: '1px solid',
        borderColor: isOrgKey ? alpha(accent, 0.4) : 'divider',
        borderRadius: 2.5,
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          borderColor: alpha(accent, 0.6),
          boxShadow: `0 0 0 1px ${alpha(accent, 0.1)}`,
        },
      }}
    >
      {/* ── Top accent bar ── */}
      <Box
        sx={{
          height: 3,
          background: isOrgKey
            ? accent
            : `linear-gradient(90deg, ${alpha(accent, 0.3)}, ${alpha(accent, 0.08)})`,
        }}
      />

      <Box sx={{ p: 2.5 }}>
        {/* ── Header: logo + name + status chip ── */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: 1.5,
                bgcolor: alpha(accent, isDark ? 0.12 : 0.08),
                flexShrink: 0,
              }}
            >
              <Logo size={22} color={accent} />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
                {brand.label}
              </Typography>
              <Typography variant="caption" color="text.secondary" fontSize="0.7rem">
                {brand.model}
              </Typography>
            </Box>
          </Box>

          <Chip
            size="small"
            icon={isOrgKey ? <CheckCircle sx={{ fontSize: 14 }} /> : undefined}
            label={isOrgKey ? t('bookingEngine.ai.settings.personalKey') : t('bookingEngine.ai.settings.sharedKey')}
            sx={{
              fontWeight: 600,
              fontSize: '0.7rem',
              height: 24,
              ...(isOrgKey
                ? {
                    bgcolor: alpha(accent, isDark ? 0.18 : 0.1),
                    color: accent,
                    '& .MuiChip-icon': { color: accent },
                  }
                : {
                    bgcolor: 'action.hover',
                    color: 'text.secondary',
                  }),
            }}
          />
        </Box>

        {/* ── Key details (when org key connected) ── */}
        {isOrgKey && (
          <Box
            sx={{
              mb: 2,
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: alpha(accent, isDark ? 0.06 : 0.03),
              border: '1px solid',
              borderColor: alpha(accent, 0.12),
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={500} fontSize="0.7rem">
                {t('bookingEngine.ai.settings.keyLabel')}
              </Typography>
              <Typography
                variant="caption"
                fontFamily="monospace"
                fontWeight={600}
                fontSize="0.72rem"
                sx={{ color: accent }}
              >
                {status.maskedApiKey}
              </Typography>
            </Box>
            {status.modelOverride && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={500} fontSize="0.7rem">
                  {t('bookingEngine.ai.settings.modelLabel')}
                </Typography>
                <Typography variant="caption" fontWeight={600} fontSize="0.72rem">
                  {status.modelOverride}
                </Typography>
              </Box>
            )}
            <Chip
              size="small"
              icon={status.valid
                ? <CheckCircle sx={{ fontSize: 13 }} />
                : <ErrorIcon sx={{ fontSize: 13 }} />
              }
              label={status.valid
                ? t('bookingEngine.ai.settings.validated')
                : t('bookingEngine.ai.settings.notValidated')
              }
              sx={{
                height: 22,
                fontSize: '0.65rem',
                fontWeight: 600,
                ...(status.valid
                  ? {
                      bgcolor: alpha(accent, isDark ? 0.15 : 0.08),
                      color: accent,
                      '& .MuiChip-icon': { color: accent },
                    }
                  : {
                      bgcolor: alpha(theme.palette.error.main, 0.08),
                      color: 'error.main',
                      '& .MuiChip-icon': { color: 'error.main' },
                    }),
              }}
            />
          </Box>
        )}

        {/* ── Shared key description ── */}
        {!isOrgKey && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.8rem', lineHeight: 1.5 }}>
            {t('bookingEngine.ai.settings.sharedKeyDescription')}
          </Typography>
        )}

        {/* ── Action buttons ── */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant={isOrgKey ? 'outlined' : 'contained'}
            size="small"
            onClick={onConfigure}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 1.5,
              ...(isOrgKey
                ? {
                    borderColor: alpha(accent, 0.5),
                    color: accent,
                    '&:hover': {
                      borderColor: accent,
                      bgcolor: alpha(accent, 0.06),
                    },
                  }
                : {
                    bgcolor: accent,
                    '&:hover': { bgcolor: alpha(accent, 0.85) },
                  }),
            }}
          >
            {isOrgKey ? t('bookingEngine.ai.settings.modify') : t('bookingEngine.ai.settings.connect')}
          </Button>
          {isOrgKey && (
            <Button
              variant="outlined"
              size="small"
              startIcon={isDisconnecting ? <CircularProgress size={14} /> : <LinkOff sx={{ fontSize: 16 }} />}
              onClick={onDisconnect}
              disabled={isDisconnecting}
              sx={{
                textTransform: 'none',
                borderRadius: 1.5,
                borderColor: alpha(theme.palette.error.main, 0.4),
                color: 'error.main',
                '&:hover': {
                  borderColor: 'error.main',
                  bgcolor: alpha(theme.palette.error.main, 0.06),
                },
              }}
            >
              {t('bookingEngine.ai.settings.disconnect')}
            </Button>
          )}
        </Box>
      </Box>
    </Paper>
  );
}

// ─── Configure Dialog ───────────────────────────────────────────────────────

interface ConfigureDialogProps {
  open: boolean;
  onClose: () => void;
  provider: 'openai' | 'anthropic' | null;
}

function ConfigureDialog({ open, onClose, provider }: ConfigureDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [apiKey, setApiKey] = useState('');
  const [modelOverride, setModelOverride] = useState('');
  const [showKey, setShowKey] = useState(false);
  const testMutation = useTestAiKey();
  const saveMutation = useSaveAiKey();

  const brand = provider ? PROVIDERS[provider] : null;
  const accent = brand ? (isDark ? brand.accentDark : brand.accent) : theme.palette.primary.main;
  const Logo = provider === 'openai' ? OpenAILogo : ClaudeLogo;

  const handleClose = () => {
    setApiKey('');
    setModelOverride('');
    setShowKey(false);
    testMutation.reset();
    saveMutation.reset();
    onClose();
  };

  const handleTest = () => {
    if (!provider || !apiKey.trim()) return;
    testMutation.mutate({ provider, apiKey: apiKey.trim(), modelOverride: modelOverride.trim() || undefined });
  };

  const handleSave = () => {
    if (!provider || !apiKey.trim()) return;
    saveMutation.mutate(
      { provider, apiKey: apiKey.trim(), modelOverride: modelOverride.trim() || undefined },
      { onSuccess: () => handleClose() },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
        },
      }}
    >
      {/* ── Branded dialog header ── */}
      <Box sx={{ height: 3, bgcolor: accent }} />
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 1.5,
            bgcolor: alpha(accent, isDark ? 0.12 : 0.08),
          }}
        >
          <Logo size={20} color={accent} />
        </Box>
        <Typography variant="h6" fontWeight={700} fontSize="1.05rem">
          {t('bookingEngine.ai.settings.configureProvider', { provider: brand?.label ?? '' })}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label={t('bookingEngine.ai.settings.apiKeyLabel')}
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            fullWidth
            required
            placeholder={brand?.placeholder}
            InputProps={{
              endAdornment: (
                <IconButton onClick={() => setShowKey(!showKey)} edge="end" size="small">
                  {showKey ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: accent,
              },
              '& .MuiInputLabel-root.Mui-focused': { color: accent },
            }}
          />

          <TextField
            label={t('bookingEngine.ai.settings.modelOverrideLabel')}
            value={modelOverride}
            onChange={(e) => setModelOverride(e.target.value)}
            fullWidth
            placeholder={brand?.modelPlaceholder}
            helperText={t('bookingEngine.ai.settings.modelOverrideHelper')}
            sx={{
              '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: accent,
              },
              '& .MuiInputLabel-root.Mui-focused': { color: accent },
            }}
          />

          {testMutation.data && (
            <Alert
              severity={
                testMutation.data.success
                  ? 'success'
                  : testMutation.data.keyValid
                    ? 'warning'
                    : 'error'
              }
            >
              {testMutation.data.message}
            </Alert>
          )}

          {saveMutation.isError && (
            <Alert severity="error">
              {t('bookingEngine.ai.settings.saveError')}
            </Alert>
          )}

          <Alert
            severity="info"
            variant="outlined"
            sx={{
              borderColor: alpha(accent, 0.3),
              '& .MuiAlert-icon': { color: accent },
            }}
          >
            {t('bookingEngine.ai.settings.byokInfo', { provider: brand?.label ?? '' })}
          </Alert>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} sx={{ textTransform: 'none', borderRadius: 1.5 }}>
          {t('bookingEngine.ai.settings.cancel')}
        </Button>
        <Button
          onClick={handleTest}
          startIcon={testMutation.isPending ? <CircularProgress size={16} /> : <Science />}
          disabled={!apiKey.trim() || testMutation.isPending}
          sx={{
            textTransform: 'none',
            borderRadius: 1.5,
            color: accent,
          }}
        >
          {t('bookingEngine.ai.settings.test')}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={saveMutation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
          disabled={!apiKey.trim() || saveMutation.isPending}
          sx={{
            textTransform: 'none',
            borderRadius: 1.5,
            bgcolor: accent,
            '&:hover': { bgcolor: alpha(accent, 0.85) },
          }}
        >
          {t('bookingEngine.ai.settings.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Feature Toggles Config ──────────────────────────────────────────────────

interface FeatureConfig {
  key: string;
  feature: string;
  icon: React.ReactNode;
  color: string;
}

const AI_FEATURES: FeatureConfig[] = [
  { key: 'design', feature: 'DESIGN', icon: <Palette />, color: '#7C3AED' },
  { key: 'pricing', feature: 'PRICING', icon: <AttachMoney />, color: '#059669' },
  { key: 'messaging', feature: 'MESSAGING', icon: <Chat />, color: '#2563EB' },
  { key: 'analytics', feature: 'ANALYTICS', icon: <BarChart />, color: '#D97706' },
  { key: 'sentiment', feature: 'SENTIMENT', icon: <StarRate />, color: '#DC2626' },
];

// ─── Feature Toggles Section ─────────────────────────────────────────────────

function FeatureTogglesSection() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { hasAnyRole } = useAuth();
  const canEdit = hasAnyRole(['SUPER_ADMIN', 'SUPER_MANAGER']);
  const { data: toggles, isLoading } = useAiFeatureToggles();
  const toggleMutation = useSetAiFeatureToggle();

  const getEnabled = (feature: string): boolean => {
    if (!toggles) return true;
    const toggle = toggles.find(t => t.feature === feature);
    return toggle?.enabled ?? true;
  };

  const handleToggle = (feature: string, currentEnabled: boolean) => {
    toggleMutation.mutate({ feature, enabled: !currentEnabled });
  };

  const accentColor = '#4F46E5';

  return (
    <Paper
      elevation={0}
      sx={{
        mb: 3,
        border: '1px solid',
        borderColor: alpha(accentColor, isDark ? 0.25 : 0.15),
        borderRadius: 2.5,
        overflow: 'hidden',
      }}
    >
      {/* ── Section header ── */}
      <Box
        sx={{
          px: 2.5,
          py: 2,
          background: isDark
            ? `linear-gradient(135deg, ${alpha(accentColor, 0.12)}, ${alpha(accentColor, 0.04)})`
            : `linear-gradient(135deg, ${alpha(accentColor, 0.06)}, ${alpha(accentColor, 0.02)})`,
          borderBottom: '1px solid',
          borderColor: alpha(accentColor, isDark ? 0.15 : 0.1),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: accentColor,
              boxShadow: `0 0 6px ${alpha(accentColor, 0.4)}`,
            }}
          />
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: isDark ? alpha(accentColor, 0.9) : accentColor }}>
            {t('bookingEngine.ai.features.title')}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.8rem' }}>
          {t('bookingEngine.ai.features.subtitle')}
        </Typography>
      </Box>

      {/* ── Feature rows ── */}
      {isLoading ? (
        <Box display="flex" justifyContent="center" py={3}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        AI_FEATURES.map((feat, index) => {
          const enabled = getEnabled(feat.feature);
          const isMutating = toggleMutation.isPending && toggleMutation.variables?.feature === feat.feature;

          return (
            <React.Fragment key={feat.feature}>
              {index > 0 && <Divider sx={{ mx: 2.5 }} />}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  px: 2.5,
                  py: 1.5,
                  transition: 'background-color 0.15s ease',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                {/* Icon */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 36,
                    height: 36,
                    borderRadius: 1.5,
                    bgcolor: alpha(feat.color, isDark ? 0.15 : 0.08),
                    color: feat.color,
                    mr: 1.5,
                    flexShrink: 0,
                    '& .MuiSvgIcon-root': { fontSize: 20 },
                  }}
                >
                  {feat.icon}
                </Box>

                {/* Name + description */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3 }}>
                    {t(`bookingEngine.ai.features.${feat.key}.name`)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                    {t(`bookingEngine.ai.features.${feat.key}.description`)}
                  </Typography>
                </Box>

                {/* Menu chip */}
                <Chip
                  size="small"
                  label={t(`bookingEngine.ai.features.${feat.key}.menu`)}
                  sx={{
                    mx: 1.5,
                    height: 22,
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    bgcolor: alpha(feat.color, isDark ? 0.1 : 0.06),
                    color: isDark ? alpha(feat.color, 0.85) : feat.color,
                    flexShrink: 0,
                  }}
                />

                {/* Toggle switch */}
                <Switch
                  checked={enabled}
                  onChange={() => handleToggle(feat.feature, enabled)}
                  disabled={isMutating || !canEdit}
                  size="small"
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: accentColor,
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      bgcolor: accentColor,
                    },
                  }}
                />
              </Box>
            </React.Fragment>
          );
        })
      )}
    </Paper>
  );
}

// ─── Main Section ───────────────────────────────────────────────────────────

export default function AiSettingsSection() {
  const { t } = useTranslation();
  const { hasAnyRole: mainHasAnyRole } = useAuth();
  const { data: statuses, isLoading, error } = useAiKeyStatus();
  const deleteMutation = useDeleteAiKey();
  const [dialogProvider, setDialogProvider] = useState<'openai' | 'anthropic' | null>(null);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        {t('bookingEngine.ai.settings.loadError')}
      </Alert>
    );
  }

  const openaiStatus = statuses?.find(s => s.provider === 'openai');
  const anthropicStatus = statuses?.find(s => s.provider === 'anthropic');

  const defaultStatus: AiApiKeyStatus = {
    provider: '',
    configured: false,
    maskedApiKey: null,
    modelOverride: null,
    valid: false,
    lastValidatedAt: null,
    source: 'PLATFORM',
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          {t('bookingEngine.ai.settings.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 640 }}>
          {t('bookingEngine.ai.settings.subtitle')}
        </Typography>
      </Box>

      {/* ── Platform Config + Feature Toggles (SUPER_ADMIN: combined section) ── */}
      {/* ── For non-admins: standalone toggles (read-only) ── */}
      <PlatformAiConfigSection />
      {!mainHasAnyRole(['SUPER_ADMIN']) && <FeatureTogglesSection />}

      {/* ── BYOK (Connecter sa propre clé) ── */}
      <Box sx={{ mt: 1, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700}>
          {t('bookingEngine.ai.settings.byokTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 640 }}>
          {t('bookingEngine.ai.settings.byokSubtitle')}
        </Typography>
      </Box>

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={6}>
          <ProviderCard
            status={openaiStatus || { ...defaultStatus, provider: 'openai' }}
            brand={PROVIDERS.openai}
            onConfigure={() => setDialogProvider('openai')}
            onDisconnect={() => deleteMutation.mutate('openai')}
            isDisconnecting={deleteMutation.isPending && deleteMutation.variables === 'openai'}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <ProviderCard
            status={anthropicStatus || { ...defaultStatus, provider: 'anthropic' }}
            brand={PROVIDERS.anthropic}
            onConfigure={() => setDialogProvider('anthropic')}
            onDisconnect={() => deleteMutation.mutate('anthropic')}
            isDisconnecting={deleteMutation.isPending && deleteMutation.variables === 'anthropic'}
          />
        </Grid>
      </Grid>

      <ConfigureDialog
        open={dialogProvider !== null}
        onClose={() => setDialogProvider(null)}
        provider={dialogProvider}
      />
    </Box>
  );
}
