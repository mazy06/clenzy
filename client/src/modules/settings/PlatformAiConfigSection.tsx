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
  CheckCircle,
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
} from '../../hooks/useAi';
import type { PlatformAiModel, SavePlatformModelRequest, TestPlatformModelRequest } from '../../services/api/aiApi';

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

const MODELS_BY_PROVIDER: Record<string, Array<{ id: string; label: string; desc: string }>> = {
  nvidia: [
    { id: 'qwen/qwen2.5-coder-32b-instruct', label: 'Qwen 2.5 Coder 32B', desc: 'Specialise code (CSS/JS)' },
    { id: 'deepseek-ai/deepseek-r1-distill-qwen-32b', label: 'DeepSeek R1 32B', desc: 'Raisonnement avance' },
    { id: 'meta/llama-3.1-70b-instruct', label: 'Llama 3.1 70B', desc: 'Haute qualite generaliste' },
    { id: 'meta/llama-3.1-8b-instruct', label: 'Llama 3.1 8B', desc: 'Rapide et economique' },
    { id: 'mistralai/mixtral-8x7b-instruct-v0.1', label: 'Mixtral 8x7B', desc: 'Bon rapport qualite/prix' },
    { id: 'qwen/qwen2.5-72b-instruct', label: 'Qwen 2.5 72B', desc: 'Multilingue, analytique' },
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

const AI_FEATURES = [
  { key: 'DESIGN', label: 'Design IA', desc: 'Generation CSS/JS du booking engine', icon: <Palette />, color: '#7C3AED' },
  { key: 'PRICING', label: 'Tarification IA', desc: 'Recommandations de prix', icon: <AttachMoney />, color: '#059669' },
  { key: 'MESSAGING', label: 'Messagerie IA', desc: 'Detection intention + reponses', icon: <Chat />, color: '#2563EB' },
  { key: 'ANALYTICS', label: 'Analytics IA', desc: 'Insights performance', icon: <BarChart />, color: '#D97706' },
  { key: 'SENTIMENT', label: 'Sentiment IA', desc: 'Analyse avis guests', icon: <StarRate />, color: '#DC2626' },
];

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
  const accent = PROVIDER_COLORS[provider] || '#8B5CF6';
  const canSave = name.trim() && provider && modelId && apiKey.trim();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}
    >
      <Box sx={{ height: 3, bgcolor: accent }} />
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

// ─── Feature Assignment Row ────────────────────────────────────────────────

interface FeatureRowProps {
  feature: typeof AI_FEATURES[number];
  models: PlatformAiModel[];
  assignedModel: PlatformAiModel | undefined;
  budget: number;
  used: number;
  enabled: boolean;
  onAssign: (feature: string, modelId: number) => void;
  onUnassign: (feature: string) => void;
  onBudgetChange: (feature: string, limit: number) => void;
  onToggle: (feature: string, enabled: boolean) => void;
  isAssigning: boolean;
}

function FeatureRow({ feature, models, assignedModel, budget, used, enabled, onAssign, onUnassign, onBudgetChange, onToggle, isAssigning }: FeatureRowProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const handleChange = (value: string) => {
    if (value === '__none__') {
      onUnassign(feature.key);
    } else {
      const modelId = parseInt(value, 10);
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

      {/* Model selector */}
      <TextField
        select
        size="small"
        value={assignedModel?.id?.toString() || '__none__'}
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
        {models.map((m) => (
          <MenuItem key={m.id} value={m.id.toString()}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: PROVIDER_COLORS[m.provider] || '#888', flexShrink: 0 }} />
              <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>{m.name}</Typography>
            </Box>
          </MenuItem>
        ))}
      </TextField>

      {/* Token budget with progress */}
      {(() => {
        const pct = budget > 0 ? Math.min((used / budget) * 100, 100) : 0;
        const isOver = used >= budget;
        const barColor = isOver ? '#DC2626' : pct > 75 ? '#D97706' : feature.color;
        return (
          <Box sx={{ position: 'relative', width: 170, flexShrink: 0 }}>
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
                  bgcolor: alpha(barColor, 0.15),
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
                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', ml: 0.5, fontSize: '0.65rem' }}>
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
  const { data: budgets } = useFeatureBudgets();
  const { data: featureToggles } = useAiFeatureToggles();
  const { data: usageStats } = useAiUsageStats();
  const deleteMutation = useDeletePlatformModel();
  const assignMutation = useAssignModelToFeature();
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

  const accentColor = '#8B5CF6';

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
      {/* ── Header ── */}
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
          <Typography
            variant="subtitle1"
            fontWeight={700}
            sx={{ color: isDark ? alpha(accentColor, 0.9) : accentColor }}
          >
            {t('settings.ai.platform.title')}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.8rem' }}>
          {t('settings.ai.platform.subtitle')}
        </Typography>
      </Box>

      {/* ── Section 1: Configured Models ── */}
      <Box sx={{ px: 2.5, pt: 2, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: '0.85rem' }}>
            {t('settings.ai.platform.models')}
          </Typography>
          <Button
            size="small"
            startIcon={<Add />}
            onClick={handleOpenAdd}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 1.5,
              color: accentColor,
              fontSize: '0.8rem',
            }}
          >
            {t('settings.ai.platform.addModel')}
          </Button>
        </Box>
      </Box>

      {modelList.length === 0 ? (
        <Box sx={{ px: 2.5, pb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', fontStyle: 'italic' }}>
            {t('settings.ai.platform.noModel')}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ pb: 1 }}>
          {modelList.map((model, index) => (
            <React.Fragment key={model.id}>
              {index > 0 && <Divider sx={{ mx: 2.5 }} />}
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

      <Divider />

      {/* ── Section 2: Feature Assignments ── */}
      <Box sx={{ px: 2.5, pt: 2, pb: 1 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: '0.85rem' }}>
          {t('settings.ai.platform.featureMapping')}
        </Typography>
      </Box>

      <Box sx={{ pb: 1.5 }}>
        {AI_FEATURES.map((feat, index) => (
          <React.Fragment key={feat.key}>
            {index > 0 && <Divider sx={{ mx: 2.5 }} />}
            <FeatureRow
              feature={feat}
              models={modelList}
              assignedModel={featureMap[feat.key]}
              budget={budgets?.[feat.key] ?? 100000}
              used={usageStats?.usageByFeature?.[feat.key] ?? 0}
              enabled={featureToggles?.find(ft => ft.feature === feat.key)?.enabled ?? true}
              onAssign={handleAssign}
              onUnassign={handleUnassign}
              onBudgetChange={(f, limit) => setBudgetMutation.mutate({ feature: f, limit })}
              onToggle={(f, enabled) => toggleMutation.mutate({ feature: f, enabled })}
              isAssigning={
                (assignMutation.isPending && assignMutation.variables?.feature === feat.key) ||
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
    </Paper>
  );
}
