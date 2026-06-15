import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  MenuItem,
  ListSubheader,
  Switch,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Visibility,
  VisibilityOff,
  Science,
  Palette,
  AttachMoney,
  Chat,
  BarChart,
  StarRate,
  AutoAwesome,
  CheckCircle,
  OpenInNew,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import {
  usePlatformModels,
  useTestPlatformModel,
  useSavePlatformModel,
  useDeletePlatformModel,
  useFeatureAssignments,
  useAssignModelToFeature,
  useUnassignFeature,
  useFeatureBudgets,
  useSetFeatureBudget,
  useAiFeatureToggles,
  useSetAiFeatureToggle,
  useAiUsageStats,
  useAiUsageBreakdown,
  useAiKeyStatus,
  useFeatureProviderAssignments,
  useAssignProviderToFeature,
} from '../../hooks/useAi';
import type { AiModelUsage, PlatformAiModel, SavePlatformModelRequest, TestPlatformModelRequest } from '../../services/api/aiApi';

/** Provider connecte (BYOK/partagee) propose dans le selecteur de modele d'une feature. */
interface ConnectedProviderOption {
  provider: string;
  label: string;
  /** Modele effectif (override de la cle org) ou null = modele par defaut du provider. */
  model: string | null;
  /** 'ORGANIZATION' = cle perso, 'PLATFORM' = cle partagee plateforme. */
  source: string;
}
import AiSettingsCard from './AiSettingsCard';

// ─── Provider / Model Catalog ──────────────────────────────────────────────

const PROVIDER_COLORS: Record<string, string> = {
  bedrock: '#FF9900',
  nvidia: '#76B900',
  openai: '#10A37F',
  anthropic: '#D4A574',
};

const PROVIDER_LABELS: Record<string, string> = {
  bedrock: 'Amazon Bedrock',
  nvidia: 'NVIDIA Build',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
};

const PROVIDER_BASE_URLS: Record<string, string> = {
  bedrock: 'https://bedrock-mantle.eu-west-1.api.aws/v1',
  nvidia: 'https://integrate.api.nvidia.com/v1',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
};

// Deep-link vers la page "API keys" du provider pour aider l'admin a recuperer
// sa cle. Utilise dans le dialog Edit model (lien "Ou trouver ma cle ?").
const PROVIDER_API_KEY_URLS: Record<string, { url: string; label: string }> = {
  nvidia:    { url: 'https://build.nvidia.com/explore/discover',           label: 'NVIDIA Build : profil > Get API Key' },
  bedrock:   { url: 'https://console.aws.amazon.com/iam/home#/security_credentials', label: 'AWS IAM : Security credentials > Create access key' },
  openai:    { url: 'https://platform.openai.com/api-keys',                label: 'OpenAI Platform : API keys' },
  anthropic: { url: 'https://console.anthropic.com/settings/keys',         label: 'Anthropic Console : Settings > API Keys' },
};

const MODELS_BY_PROVIDER: Record<string, Array<{ id: string; label: string; desc: string }>> = {
  nvidia: [
    // Qwen 2.5 famille en EOL chez NVIDIA Build (depuis 2026-05-12) -> Qwen 3
    { id: 'qwen/qwen3-coder-480b-a35b-instruct', label: 'Qwen 3 Coder 480B', desc: 'Specialise code (CSS/JS), successeur de Qwen 2.5 Coder' },
    { id: 'qwen/qwen3-235b-a22b', label: 'Qwen 3 235B', desc: 'Multilingue, analytique, generaliste' },
    { id: 'deepseek-ai/deepseek-r1', label: 'DeepSeek R1', desc: 'Raisonnement avance (full model)' },
    { id: 'deepseek-ai/deepseek-r1-distill-qwen-32b', label: 'DeepSeek R1 Distill 32B', desc: 'Raisonnement, plus leger' },
    { id: 'meta/llama-3.3-70b-instruct', label: 'Llama 3.3 70B', desc: 'Haute qualite generaliste' },
    { id: 'meta/llama-3.1-8b-instruct', label: 'Llama 3.1 8B', desc: 'Rapide et economique' },
    { id: 'nvidia/llama-3.3-nemotron-super-49b-v1', label: 'Nemotron Super 49B', desc: 'NVIDIA, reasoning-tuned' },
    { id: 'google/gemma-2-9b-it', label: 'Gemma 2 9B', desc: 'Google, compact' },
  ],
  bedrock: [
    { id: 'amazon.nova-micro-v1:0', label: 'Nova Micro', desc: 'Texte, latence minimale' },
    { id: 'amazon.nova-lite-v1:0', label: 'Nova Lite', desc: 'Multimodal, economique' },
    { id: 'amazon.nova-pro-v1:0', label: 'Nova Pro', desc: 'Meilleur equilibre' },
    { id: 'amazon.nova-premier-v1:0', label: 'Nova Premier', desc: 'Raisonnement complexe' },
    { id: 'meta.llama3-1-70b-instruct-v1:0', label: 'Llama 3.1 70B', desc: 'Meta, haute qualite' },
  ],
  openai: [
    { id: 'gpt-4o', label: 'GPT-4o', desc: 'Multimodal, meilleur rapport qualite/prix' },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini', desc: 'Rapide et economique' },
    { id: 'gpt-4-turbo', label: 'GPT-4 Turbo', desc: 'Haute qualite, 128K' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', desc: 'Equilibre qualite/prix' },
    { id: 'claude-haiku-4-20250514', label: 'Claude Haiku 4', desc: 'Tres rapide' },
    { id: 'claude-opus-4-20250514', label: 'Claude Opus 4', desc: 'Meilleure qualite' },
  ],
};

const PROVIDER_IDS = Object.keys(PROVIDER_LABELS);

// ─── Feature Config ────────────────────────────────────────────────────────

// Palette catégorielle par feature IA — hex DÉSATURÉS alignés sur les tokens
// Signature (= valeurs de --ok/--warn/--err/--info + mauve planning + slate).
// En hex littéral (non var()) car consommés via MUI alpha() (qui rejette var()).
const AI_FEATURES = [
  { key: 'ASSISTANT_CHAT', label: 'Assistant IA', desc: 'Orchestrator multi-agent + specialists du chat + briefings', icon: <AutoAwesome />, color: '#6B8A9A' }, // slate
  { key: 'DESIGN', label: 'Design IA', desc: 'Generation CSS/JS du booking engine', icon: <Palette />, color: '#9A7FA3' }, // mauve (= PLANNING_DEPARTURE_VIOLET)
  { key: 'PRICING', label: 'Tarification IA', desc: 'Recommandations de prix', icon: <AttachMoney />, color: '#4A9B8E' }, // = --ok
  { key: 'MESSAGING', label: 'Messagerie IA', desc: 'Detection intention + reponses', icon: <Chat />, color: '#7BA3C2' }, // = --info
  { key: 'ANALYTICS', label: 'Analytics IA', desc: 'Insights performance', icon: <BarChart />, color: '#C28A52' }, // = --warn
  { key: 'SENTIMENT', label: 'Sentiment IA', desc: 'Analyse avis guests', icon: <StarRate />, color: '#C97A7A' }, // = --err
];

// En-tete de groupe dans le selecteur de modele (providers connectes / modeles plateforme).
const subheaderSx = {
  fontSize: '0.6rem',
  fontWeight: 700,
  letterSpacing: 0.5,
  textTransform: 'uppercase' as const,
  color: 'text.secondary',
  lineHeight: 2.2,
  bgcolor: 'transparent',
};

// ─── Model Dialog ──────────────────────────────────────────────────────────

interface ModelDialogProps {
  open: boolean;
  onClose: () => void;
  editModel?: PlatformAiModel | null;
}

function ModelDialog({ open, onClose, editModel }: ModelDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [name, setName] = useState('');
  const [provider, setProvider] = useState('');
  const [modelId, setModelId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<null | 'success' | 'error'>(null);

  const testMutation = useTestPlatformModel();
  const saveMutation = useSavePlatformModel();

  // Reset form when dialog opens/closes or editModel changes
  useEffect(() => {
    if (open) {
      if (editModel) {
        setName(editModel.name);
        setProvider(editModel.provider);
        setModelId(editModel.modelId);
        setBaseUrl(editModel.baseUrl || PROVIDER_BASE_URLS[editModel.provider] || '');
      } else {
        setName('');
        setProvider('');
        setModelId('');
        setBaseUrl('');
      }
      setApiKey('');
      setShowKey(false);
      setTestResult(null);
      testMutation.reset();
      saveMutation.reset();
    }
  }, [open, editModel]);

  // When provider changes, update base URL and reset model
  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    setBaseUrl(PROVIDER_BASE_URLS[newProvider] || '');
    setModelId('');
    setTestResult(null);
  };

  const handleTest = () => {
    if (!apiKey.trim() || !provider || !modelId) return;
    setTestResult(null);
    const data: TestPlatformModelRequest = {
      provider,
      modelId,
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim() || undefined,
    };
    testMutation.mutate(data, {
      onSuccess: (res) => setTestResult(res.success ? 'success' : 'error'),
      onError: () => setTestResult('error'),
    });
  };

  const handleSave = () => {
    if (!name.trim() || !provider || !modelId || !apiKey.trim()) return;
    const data: SavePlatformModelRequest = {
      id: editModel?.id ?? null,
      name: name.trim(),
      provider,
      modelId,
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim() || undefined,
    };
    saveMutation.mutate(data, { onSuccess: () => onClose() });
  };

  const models = MODELS_BY_PROVIDER[provider] || [];
  const accent = PROVIDER_COLORS[provider] || '#9A7FA3';
  const canSave = name.trim() && provider && modelId && apiKey.trim();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" fontWeight={700} fontSize="1.05rem">
          {editModel
            ? t('settings.ai.platform.editModel')
            : t('settings.ai.platform.addModel')}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {/* Name */}
          <TextField
            label={t('settings.ai.platform.name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            size="small"
            placeholder="ex: Design - Qwen Coder"
            sx={{
              '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: accent },
              '& .MuiInputLabel-root.Mui-focused': { color: accent },
            }}
          />

          {/* Provider */}
          <TextField
            label={t('settings.ai.platform.provider')}
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value)}
            fullWidth
            size="small"
            select
            sx={{
              '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: accent },
              '& .MuiInputLabel-root.Mui-focused': { color: accent },
            }}
          >
            {PROVIDER_IDS.map((pid) => (
              <MenuItem key={pid} value={pid}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: PROVIDER_COLORS[pid], flexShrink: 0 }} />
                  <Typography variant="body2" fontWeight={600}>{PROVIDER_LABELS[pid]}</Typography>
                </Box>
              </MenuItem>
            ))}
          </TextField>

          {/* Model */}
          <TextField
            label={t('settings.ai.platform.model')}
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            fullWidth
            size="small"
            select={models.length > 0}
            disabled={!provider}
            sx={{
              '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: accent },
              '& .MuiInputLabel-root.Mui-focused': { color: accent },
            }}
          >
            {models.map((m) => (
              <MenuItem key={m.id} value={m.id}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8125rem' }}>
                    {m.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.675rem' }}>
                    {m.desc}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </TextField>

          {/* API Key */}
          <TextField
            label={t('settings.ai.platform.apiKey')}
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            fullWidth
            size="small"
            placeholder={editModel?.maskedApiKey || 'sk-...'}
            InputProps={{
              endAdornment: (
                <IconButton onClick={() => setShowKey(!showKey)} edge="end" size="small">
                  {showKey ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                </IconButton>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: accent },
              '& .MuiInputLabel-root.Mui-focused': { color: accent },
            }}
          />

          {/* Lien contextuel "Ou trouver ma cle ?" — adapte au provider selectionne */}
          {provider && PROVIDER_API_KEY_URLS[provider] && (
            <Box sx={{ mt: -1, mb: -0.5 }}>
              <Button
                component="a"
                href={PROVIDER_API_KEY_URLS[provider].url}
                target="_blank"
                rel="noopener noreferrer"
                size="small"
                endIcon={<OpenInNew size={12} strokeWidth={1.75} />}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.72rem',
                  fontWeight: 500,
                  color: 'text.secondary',
                  px: 0.75,
                  py: 0.25,
                  minWidth: 0,
                  cursor: 'pointer',
                  '&:hover': { color: accent, backgroundColor: alpha(accent, 0.06) },
                }}
              >
                Où trouver ma clé ? — {PROVIDER_API_KEY_URLS[provider].label}
              </Button>
            </Box>
          )}

          {/* Base URL */}
          <TextField
            label={t('settings.ai.platform.baseUrl')}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            fullWidth
            size="small"
            sx={{
              '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: accent },
              '& .MuiInputLabel-root.Mui-focused': { color: accent },
            }}
          />

          {/* Feedback */}
          {testResult === 'success' && (
            <Alert severity="success" sx={{ py: 0.5 }}>{t('settings.ai.platform.testSuccess')}</Alert>
          )}
          {testResult === 'error' && (
            <Alert severity="error" sx={{ py: 0.5 }}>{t('settings.ai.platform.testError')}</Alert>
          )}
          {saveMutation.isError && (
            <Alert severity="error" sx={{ py: 0.5 }}>{t('settings.ai.platform.saveError')}</Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', borderRadius: 1.5 }}>
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleTest}
          startIcon={testMutation.isPending ? <CircularProgress size={14} /> : <Science />}
          disabled={!apiKey.trim() || !provider || !modelId || testMutation.isPending}
          size="small"
          sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5, color: accent }}
        >
          {t('settings.ai.platform.test')}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={saveMutation.isPending ? <CircularProgress size={14} color="inherit" /> : undefined}
          disabled={!canSave || saveMutation.isPending}
          size="small"
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 1.5,
            bgcolor: accent,
            '&:hover': { bgcolor: alpha(accent, 0.85) },
          }}
        >
          {t('settings.ai.platform.saveActivate')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Model Row ─────────────────────────────────────────────────────────────

interface ModelRowProps {
  model: PlatformAiModel;
  onEdit: (model: PlatformAiModel) => void;
  onDelete: (id: number) => void;
  isDeleting: boolean;
}

function ModelRow({ model, onEdit, onDelete, isDeleting }: ModelRowProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const providerColor = PROVIDER_COLORS[model.provider] || '#888';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        px: 2.5,
        py: 1.25,
        gap: 1.5,
        transition: 'background-color 0.15s ease',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      {/* Color dot */}
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: providerColor, flexShrink: 0 }} />

      {/* Name */}
      <Typography variant="body2" fontWeight={600} sx={{ minWidth: 120, flex: '0 0 auto' }}>
        {model.name}
      </Typography>

      {/* Provider chip */}
      <Chip
        size="small"
        label={PROVIDER_LABELS[model.provider] || model.provider}
        sx={{
          height: 22,
          fontSize: '0.65rem',
          fontWeight: 600,
          bgcolor: alpha(providerColor, isDark ? 0.18 : 0.1),
          color: providerColor,
          flexShrink: 0,
        }}
      />

      {/* Model ID */}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontSize: '0.7rem', fontFamily: 'monospace', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {model.modelId}
      </Typography>

      {/* Assigned features chips */}
      <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
        {model.assignedFeatures.map((feat) => {
          const featureConf = AI_FEATURES.find((f) => f.key === feat);
          return (
            <Chip
              key={feat}
              size="small"
              label={feat}
              sx={{
                height: 20,
                fontSize: '0.6rem',
                fontWeight: 600,
                bgcolor: alpha(featureConf?.color || '#888', isDark ? 0.15 : 0.08),
                color: featureConf?.color || 'text.secondary',
              }}
            />
          );
        })}
      </Box>

      {/* Validated indicator */}
      {model.lastValidatedAt && (
        <Tooltip title={`Valide le ${new Date(model.lastValidatedAt).toLocaleDateString()}`}>
          <Box component="span" sx={{ display: 'inline-flex', color: providerColor, flexShrink: 0 }}><CheckCircle size={16} strokeWidth={1.75} /></Box>
        </Tooltip>
      )}

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
        <IconButton size="small" onClick={() => onEdit(model)}>
          <Edit size={16} strokeWidth={1.75} />
        </IconButton>
        <IconButton size="small" onClick={() => onDelete(model.id)} disabled={isDeleting} color="error">
          {isDeleting ? <CircularProgress size={14} /> : <Delete size={16} strokeWidth={1.75} />}
        </IconButton>
      </Box>
    </Box>
  );
}

// ─── Usage Breakdown Tooltip ───────────────────────────────────────────────

/**
 * Tooltip qui detaille la consommation tokens + cout USD par (provider, model).
 * Resout l'agregation aveugle de l'ancien compteur unique : 100k tokens Sonnet
 * et 100k tokens Haiku ont des couts tres differents — il faut les distinguer.
 *
 * Wrapping permissif : si breakdown est vide, on rend juste le child sans tooltip
 * pour eviter un popover vide qui suggererait une erreur.
 */
function UsageBreakdownTooltip({
  breakdown,
  totalCost,
  feature,
  children,
}: {
  breakdown: AiModelUsage[];
  totalCost: number;
  feature: typeof AI_FEATURES[number];
  children: React.ReactElement;
}) {
  if (breakdown.length === 0) {
    return children;
  }
  return (
    <Tooltip
      arrow
      placement="left"
      enterDelay={200}
      enterNextDelay={150}
      componentsProps={{
        tooltip: {
          sx: {
            bgcolor: 'background.paper',
            color: 'text.primary',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: 'var(--shadow-pop)',
            p: 0,
            maxWidth: 360,
            fontFamily: 'inherit',
          },
        },
        arrow: { sx: { color: 'background.paper', '&::before': { border: '1px solid', borderColor: 'divider' } } },
      }}
      title={
        <Box sx={{ p: 1.5, minWidth: 280 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: feature.color, letterSpacing: 0.4 }}>
              {feature.label.toUpperCase()}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              ${totalCost.toFixed(4)} USD
            </Typography>
          </Box>
          {/* Rows: 1 par (provider, model) */}
          {breakdown.map((m) => {
            const totalTokens = m.tokensIn + m.tokensOut;
            return (
              <Box key={`${m.provider}-${m.model}`} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: PROVIDER_COLORS[m.provider] || '#888', flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.model}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontSize: '0.65rem', fontVariantNumeric: 'tabular-nums' }}>
                    {Math.round(totalTokens / 1000)}k tok ({Math.round(m.tokensIn / 1000)}k in + {Math.round(m.tokensOut / 1000)}k out) · {m.callCount} call{m.callCount > 1 ? 's' : ''}
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.72rem', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  ${m.costUsd.toFixed(4)}
                </Typography>
              </Box>
            );
          })}
        </Box>
      }
    >
      {children}
    </Tooltip>
  );
}

// ─── Feature Assignment Row ────────────────────────────────────────────────

interface FeatureRowProps {
  feature: typeof AI_FEATURES[number];
  models: PlatformAiModel[];
  /** Providers connectes (BYOK/partagee) proposables comme modele de la feature. */
  connectedProviders: ConnectedProviderOption[];
  assignedModel: PlatformAiModel | undefined;
  /** Provider connecte assigne a la feature (alternative a un modele plateforme). */
  assignedProvider: string | undefined;
  budget: number;
  used: number;
  /** Decomposition par (provider, model) avec cout USD. Vide = pas d'usage ce mois. */
  usageBreakdown: AiModelUsage[];
  enabled: boolean;
  onAssign: (feature: string, modelId: number) => void;
  onAssignProvider: (feature: string, provider: string) => void;
  onUnassign: (feature: string) => void;
  onBudgetChange: (feature: string, limit: number) => void;
  onToggle: (feature: string, enabled: boolean) => void;
  isAssigning: boolean;
}

const PROVIDER_VALUE_PREFIX = 'provider:';
const MODEL_VALUE_PREFIX = 'model:';

function FeatureRow({ feature, models, connectedProviders, assignedModel, assignedProvider, budget, used, usageBreakdown, enabled, onAssign, onAssignProvider, onUnassign, onBudgetChange, onToggle, isAssigning }: FeatureRowProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Valeur encodee : 'provider:<p>' | 'model:<id>' | '__none__' (le selecteur melange
  // providers connectes ET modeles plateforme, mutuellement exclusifs cote backend).
  const selectValue = assignedProvider
    ? `${PROVIDER_VALUE_PREFIX}${assignedProvider}`
    : assignedModel
      ? `${MODEL_VALUE_PREFIX}${assignedModel.id}`
      : '__none__';

  // Garantit que le provider assigne reste affichable meme s'il n'est plus "connecte"
  // (clé retiree apres assignation) — evite une valeur Select hors-plage.
  const providerOptions: ConnectedProviderOption[] =
    assignedProvider && !connectedProviders.some((p) => p.provider === assignedProvider)
      ? [...connectedProviders, { provider: assignedProvider, label: PROVIDER_LABELS[assignedProvider] || assignedProvider, model: null, source: 'PLATFORM' }]
      : connectedProviders;

  const handleChange = (value: string) => {
    if (value === '__none__') {
      onUnassign(feature.key);
    } else if (value.startsWith(PROVIDER_VALUE_PREFIX)) {
      onAssignProvider(feature.key, value.slice(PROVIDER_VALUE_PREFIX.length));
    } else if (value.startsWith(MODEL_VALUE_PREFIX)) {
      const modelId = parseInt(value.slice(MODEL_VALUE_PREFIX.length), 10);
      if (!isNaN(modelId)) {
        onAssign(feature.key, modelId);
      }
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        px: 2.5,
        py: 1.25,
        gap: 1.5,
        transition: 'background-color 0.15s ease',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      {/* Feature icon */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 34,
          height: 34,
          borderRadius: 1.5,
          bgcolor: alpha(feature.color, isDark ? 0.15 : 0.08),
          color: feature.color,
          flexShrink: 0,
          '& .MuiSvgIcon-root': { fontSize: 18 },
        }}
      >
        {feature.icon}
      </Box>

      {/* Toggle */}
      <Switch
        checked={enabled}
        onChange={() => onToggle(feature.key, !enabled)}
        size="small"
        sx={{
          flexShrink: 0,
          '& .MuiSwitch-switchBase.Mui-checked': { color: feature.color },
          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: feature.color },
        }}
      />

      {/* Feature name + desc */}
      <Box sx={{ flex: 1, minWidth: 0, opacity: enabled ? 1 : 0.5 }}>
        <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3 }}>
          {feature.label}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
          {feature.desc}
        </Typography>
      </Box>

      {/* Model / connected-provider selector */}
      <TextField
        select
        size="small"
        value={selectValue}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isAssigning}
        sx={{
          minWidth: 220,
          flexShrink: 0,
          '& .MuiOutlinedInput-root': { fontSize: '0.8125rem' },
          '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: feature.color,
          },
        }}
      >
        <MenuItem value="__none__">
          <Typography variant="body2" color="text.secondary" fontStyle="italic" sx={{ fontSize: '0.8125rem' }}>
            {t('settings.ai.platform.noModel')}
          </Typography>
        </MenuItem>

        {/* Providers connectes (OpenAI/Anthropic) — utilises en priorite par l'agent */}
        {providerOptions.length > 0 && (
          <ListSubheader sx={subheaderSx}>{t('settings.ai.platform.connectedProviders')}</ListSubheader>
        )}
        {providerOptions.map((p) => (
          <MenuItem key={`${PROVIDER_VALUE_PREFIX}${p.provider}`} value={`${PROVIDER_VALUE_PREFIX}${p.provider}`}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, width: '100%' }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: PROVIDER_COLORS[p.provider] || '#888', flexShrink: 0 }} />
              <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>{p.label}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', ml: 'auto', pl: 1, flexShrink: 0 }}>
                {p.source === 'ORGANIZATION' ? t('settings.ai.platform.providerOwnKey') : t('settings.ai.platform.providerSharedKey')}
                {p.model ? ` · ${p.model}` : ''}
              </Typography>
            </Box>
          </MenuItem>
        ))}

        {/* Modeles plateforme configures par le SUPER_ADMIN */}
        {models.length > 0 && (
          <ListSubheader sx={subheaderSx}>{t('settings.ai.platform.platformModels')}</ListSubheader>
        )}
        {models.map((m) => (
          <MenuItem key={`${MODEL_VALUE_PREFIX}${m.id}`} value={`${MODEL_VALUE_PREFIX}${m.id}`}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: PROVIDER_COLORS[m.provider] || '#888', flexShrink: 0 }} />
              <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>{m.name}</Typography>
            </Box>
          </MenuItem>
        ))}
      </TextField>

      {/* Token budget with progress + tooltip breakdown per (provider, model) */}
      {(() => {
        const pct = budget > 0 ? Math.min((used / budget) * 100, 100) : 0;
        const isOver = used >= budget;
        const barColor = isOver ? 'var(--err)' : pct > 75 ? 'var(--warn)' : feature.color;
        const totalCost = usageBreakdown.reduce((sum, m) => sum + (m.costUsd ?? 0), 0);
        return (
          <UsageBreakdownTooltip breakdown={usageBreakdown} totalCost={totalCost} feature={feature}>
            <Box sx={{ position: 'relative', width: 170, flexShrink: 0, cursor: usageBreakdown.length > 0 ? 'help' : 'default' }}>
              {/* Progress bar background */}
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 1,
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${pct}%`,
                    bgcolor: `color-mix(in srgb, ${barColor} 15%, transparent)`,
                    transition: 'width 0.3s ease, background-color 0.3s ease',
                  }}
                />
              </Box>
              {/* Input on top */}
              <TextField
                size="small"
                type="number"
                value={budget}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 0) onBudgetChange(feature.key, val);
                }}
                InputProps={{
                  endAdornment: (
                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', ml: 0.5, fontSize: '0.65rem', fontVariantNumeric: 'tabular-nums' }}>
                      {Math.round(used / 1000)}k / {Math.round(budget / 1000)}k
                    </Typography>
                  ),
                }}
                sx={{
                  width: '100%',
                  '& .MuiOutlinedInput-root': {
                    fontSize: '0.75rem',
                    bgcolor: 'transparent',
                    '& fieldset': { border: 'none' },
                  },
                  '& .MuiInputBase-input': { position: 'relative', zIndex: 1 },
                }}
              />
            </Box>
          </UsageBreakdownTooltip>
        );
      })()}

      {/* Loading indicator */}
      {isAssigning && <CircularProgress size={16} sx={{ flexShrink: 0 }} />}
    </Box>
  );
}

// ─── Main Section ──────────────────────────────────────────────────────────

export default function PlatformAiConfigSection() {
  const { t } = useTranslation();
  const { hasPermissionAsync } = useAuth();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [canManage, setCanManage] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editModel, setEditModel] = useState<PlatformAiModel | null>(null);

  const { data: models, isLoading: modelsLoading, error: modelsError } = usePlatformModels();
  const { data: assignments, isLoading: assignmentsLoading } = useFeatureAssignments();
  const { data: providerAssignments } = useFeatureProviderAssignments();
  const { data: keyStatus } = useAiKeyStatus();
  const { data: budgets } = useFeatureBudgets();
  const { data: featureToggles } = useAiFeatureToggles();
  const { data: usageStats } = useAiUsageStats();
  const { data: usageBreakdown } = useAiUsageBreakdown();
  const deleteMutation = useDeletePlatformModel();
  const assignMutation = useAssignModelToFeature();
  const assignProviderMutation = useAssignProviderToFeature();
  const unassignMutation = useUnassignFeature();
  const setBudgetMutation = useSetFeatureBudget();
  const toggleMutation = useSetAiFeatureToggle();

  useEffect(() => {
    hasPermissionAsync('ai:manage').then(setCanManage);
  }, [hasPermissionAsync]);

  if (!canManage) return null;

  const isLoading = modelsLoading || assignmentsLoading;

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (modelsError) {
    return <Alert severity="error">{t('settings.ai.platform.loadError')}</Alert>;
  }

  const modelList = models || [];
  const featureMap = assignments || {};
  const providerMap = providerAssignments || {};

  // Providers connectes (cle org BYOK validee OU cle partagee plateforme dispo)
  // proposables comme modele de n'importe quelle feature. L'agent IA les utilise
  // en priorite (cf. AiKeyResolver) — on les rend donc selectionnables explicitement.
  const connectedProviders: ConnectedProviderOption[] = (keyStatus || [])
    .filter((k) => k.valid)
    .map((k) => ({
      provider: k.provider,
      label: PROVIDER_LABELS[k.provider] || k.provider,
      model: k.modelOverride || null,
      source: k.source,
    }));

  const handleOpenAdd = () => {
    setEditModel(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (model: PlatformAiModel) => {
    setEditModel(model);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditModel(null);
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  const handleAssign = (feature: string, modelId: number) => {
    assignMutation.mutate({ feature, modelId });
  };

  const handleUnassign = (feature: string) => {
    unassignMutation.mutate(feature);
  };

  return (
    <AiSettingsCard
      title={t('settings.ai.platform.title')}
      subtitle={t('settings.ai.platform.subtitle')}
      action={
        <Button
          size="small"
          startIcon={<Add />}
          onClick={handleOpenAdd}
          variant="outlined"
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 1.5,
            fontSize: '0.8125rem',
          }}
        >
          {t('settings.ai.platform.addModel')}
        </Button>
      }
    >
      {/* ── Section 1: Configured Models ── */}
      <Box sx={{ mb: 1 }}>
        <Typography
          variant="overline"
          sx={{
            fontWeight: 700,
            color: 'text.secondary',
            letterSpacing: 0.6,
            fontSize: '0.7rem',
          }}
        >
          {t('settings.ai.platform.models')}
        </Typography>
      </Box>

      {modelList.length === 0 ? (
        <Box sx={{ pb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', fontStyle: 'italic' }}>
            {t('settings.ai.platform.noModel')}
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            mx: { xs: -2, md: -3 },
            mb: 2,
            borderTop: '1px solid',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          {modelList.map((model, index) => (
            <React.Fragment key={model.id}>
              {index > 0 && <Divider sx={{ mx: { xs: 2, md: 3 } }} />}
              <ModelRow
                model={model}
                onEdit={handleOpenEdit}
                onDelete={handleDelete}
                isDeleting={deleteMutation.isPending && deleteMutation.variables === model.id}
              />
            </React.Fragment>
          ))}
        </Box>
      )}

      {/* ── Section 2: Feature Assignments ── */}
      <Box sx={{ mt: 3, mb: 1 }}>
        <Typography
          variant="overline"
          sx={{
            fontWeight: 700,
            color: 'text.secondary',
            letterSpacing: 0.6,
            fontSize: '0.7rem',
          }}
        >
          {t('settings.ai.platform.featureMapping')}
        </Typography>
      </Box>

      <Box
        sx={{
          mx: { xs: -2, md: -3 },
          borderTop: '1px solid',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        {AI_FEATURES.map((feat, index) => (
          <React.Fragment key={feat.key}>
            {index > 0 && <Divider sx={{ mx: { xs: 2, md: 3 } }} />}
            <FeatureRow
              feature={feat}
              models={modelList}
              connectedProviders={connectedProviders}
              assignedModel={featureMap[feat.key]}
              assignedProvider={providerMap[feat.key]}
              budget={budgets?.[feat.key] ?? 100000}
              used={usageStats?.usageByFeature?.[feat.key] ?? 0}
              usageBreakdown={usageBreakdown?.breakdownByFeature?.[feat.key] ?? []}
              enabled={featureToggles?.find(ft => ft.feature === feat.key)?.enabled ?? true}
              onAssign={handleAssign}
              onAssignProvider={(f, p) => assignProviderMutation.mutate({ feature: f, provider: p })}
              onUnassign={handleUnassign}
              onBudgetChange={(f, limit) => setBudgetMutation.mutate({ feature: f, limit })}
              onToggle={(f, enabled) => toggleMutation.mutate({ feature: f, enabled })}
              isAssigning={
                (assignMutation.isPending && assignMutation.variables?.feature === feat.key) ||
                (assignProviderMutation.isPending && assignProviderMutation.variables?.feature === feat.key) ||
                (unassignMutation.isPending && unassignMutation.variables === feat.key)
              }
            />
          </React.Fragment>
        ))}
      </Box>

      {/* ── Add/Edit Dialog ── */}
      <ModelDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        editModel={editModel}
      />
    </AiSettingsCard>
  );
}
