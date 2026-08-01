import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { CircleCheck, TriangleAlert, X } from 'lucide-react';
import { Spinner } from '../../components/ui';
import {
  Field,
  FieldLabel,
  Input,
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
  NativeSelect,
  NativeSelectOption,
  NativeSelectOptGroup,
} from '../../components/ui';
import { Autocomplete, TextField, CircularProgress, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Divider, Switch, Tooltip, useTheme, alpha } from '@mui/material';
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
  Article,
  AutoFixHigh,
  Hub,
  CheckCircle,
  OpenInNew,
  Refresh,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import {
  usePlatformModels,
  useTestPlatformModel,
  useSavePlatformModel,
  useDeletePlatformModel,
  useRecheckPlatformModel,
  useProviderCatalog,
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
import type { AiCatalogModel, AiModelUsage, PlatformAiModel, SavePlatformModelRequest, TestPlatformModelRequest } from '../../services/api/aiApi';
import { aiCreditsApi, type GrantInitialResult } from '../../services/api/aiCreditsApi';

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
  voyage: '#5B8DEF',
};

const PROVIDER_LABELS: Record<string, string> = {
  bedrock: 'Amazon Bedrock',
  nvidia: 'NVIDIA Build',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  voyage: 'Voyage AI',
};

// Catégorie de modèle du catalogue live (dérivée de l'ID côté backend) → label + couleur.
const CATALOG_CATEGORY_LABELS: Record<string, string> = {
  chat: 'Chat', reasoning: 'Raisonnement', code: 'Code', vision: 'Vision',
  ocr: 'OCR', embedding: 'Embeddings', rerank: 'Rerank', audio: 'Audio',
  image: 'Image', safety: 'Sécurité', other: 'Autre',
};
const CATALOG_CATEGORY_COLORS: Record<string, string> = {
  chat: '#4A9B8E', reasoning: '#7BA3C2', code: '#6B8A9A', vision: '#9D82F0',
  ocr: '#C28A52', embedding: '#8A8F9E', rerank: '#8A8F9E', audio: '#D6457E',
  image: '#D4A574', safety: '#C97A7A', other: '#9AA1B0',
};

const PROVIDER_BASE_URLS: Record<string, string> = {
  bedrock: 'https://bedrock-mantle.eu-west-1.api.aws/v1',
  nvidia: 'https://integrate.api.nvidia.com/v1',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  voyage: 'https://api.voyageai.com',
};

// Deep-link vers la page "API keys" du provider pour aider l'admin a recuperer
// sa cle. Utilise dans le dialog Edit model (lien "Ou trouver ma cle ?").
const PROVIDER_API_KEY_URLS: Record<string, { url: string; label: string }> = {
  nvidia:    { url: 'https://build.nvidia.com/explore/discover',           label: 'NVIDIA Build : profil > Get API Key' },
  bedrock:   { url: 'https://console.aws.amazon.com/iam/home#/security_credentials', label: 'AWS IAM : Security credentials > Create access key' },
  openai:    { url: 'https://platform.openai.com/api-keys',                label: 'OpenAI Platform : API keys' },
  anthropic: { url: 'https://console.anthropic.com/settings/keys',         label: 'Anthropic Console : Settings > API Keys' },
  voyage:    { url: 'https://dashboard.voyageai.com/api-keys',             label: 'Voyage AI : Dashboard > API Keys' },
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
  // Voyage AI : embeddings (et rerank) — feature EMBEDDINGS uniquement, 1024d.
  voyage: [
    { id: 'voyage-3-large', label: 'Voyage 3 Large', desc: 'Embeddings 1024d, meilleure qualite (RAG)' },
    { id: 'voyage-3', label: 'Voyage 3', desc: 'Embeddings 1024d, equilibre cout/qualite' },
    { id: 'voyage-3-lite', label: 'Voyage 3 Lite', desc: 'Embeddings 1024d, economique' },
  ],
};

// Modeles d'embeddings OpenAI (feature EMBEDDINGS) — proposes en plus des modeles chat.
MODELS_BY_PROVIDER.openai = [
  ...MODELS_BY_PROVIDER.openai,
  { id: 'text-embedding-3-large', label: 'Text Embedding 3 Large', desc: 'Embeddings (tronque a 1024d)' },
  { id: 'text-embedding-3-small', label: 'Text Embedding 3 Small', desc: 'Embeddings economiques (1024d)' },
];

const PROVIDER_IDS = Object.keys(PROVIDER_LABELS);

// ─── Feature Config ────────────────────────────────────────────────────────

// Palette catégorielle par feature IA — hex DÉSATURÉS alignés sur les tokens
// Signature (= valeurs de --ok/--warn/--err/--info + mauve planning + slate).
// En hex littéral (non var()) car consommés via MUI alpha() (qui rejette var()).
const AI_FEATURES = [
  { key: 'ASSISTANT_CHAT', label: 'Assistant IA', desc: 'Orchestrator multi-agent + specialists du chat + briefings', icon: <AutoAwesome />, color: '#6B8A9A' }, // slate
  { key: 'ASSISTANT_SMALL', label: 'Assistant IA — tier éco', desc: "Modèle économique des rôles utilitaires (classification, résumés). Non assigné = tiering inactif ; ne s'applique que si le provider correspond au modèle résolu", icon: <AutoAwesome />, color: '#7BA3C2' }, // info
  { key: 'ASSISTANT_STRONG', label: 'Assistant IA — tier fort', desc: "Modèle haut de gamme des rôles d'analyse (Insights). Mêmes règles que le tier éco", icon: <AutoAwesome />, color: '#5A7684' }, // slate foncé
  { key: 'DESIGN', label: 'Design IA', desc: 'Generation CSS/JS du booking engine', icon: <Palette />, color: '#9A7FA3' }, // mauve (= PLANNING_DEPARTURE_VIOLET)
  { key: 'PRICING', label: 'Tarification IA', desc: 'Recommandations de prix', icon: <AttachMoney />, color: '#4A9B8E' }, // = --ok
  { key: 'MESSAGING', label: 'Messagerie IA', desc: 'Detection intention + reponses', icon: <Chat />, color: '#7BA3C2' }, // = --info
  { key: 'ANALYTICS', label: 'Analytics IA', desc: 'Insights performance', icon: <BarChart />, color: '#C28A52' }, // = --warn
  { key: 'SENTIMENT', label: 'Sentiment IA', desc: 'Analyse avis guests', icon: <StarRate />, color: '#C97A7A' }, // = --err
  { key: 'CONTENT', label: 'Contenu IA', desc: 'Descriptions de biens + SEO multilingue', icon: <Article />, color: '#6FA38A' }, // sage
  { key: 'STUDIO_ASSIST', label: 'Assistant Studio IA', desc: "Aide à la création : analyse de site, import d'annonce, livret d'accueil", icon: <AutoFixHigh />, color: '#8A7FB0' }, // periwinkle
  { key: 'EMBEDDINGS', label: 'Embeddings RAG', desc: 'Recherche sémantique de la base de connaissances (Voyage / OpenAI, 1024d)', icon: <Hub />, color: '#6E8AAD' }, // steel
];

// Gabarit de ligne partage par ModelRow et FeatureRow (memes metriques).
const ROW_CLASS =
  'flex items-center px-[15px] py-[7.5px] gap-[9px] transition-colors duration-150 hover:bg-[var(--hover)]';

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
  const [catalog, setCatalog] = useState<AiCatalogModel[]>([]);
  // Flag « nom édité manuellement » jamais lu au render : ref (pas de re-render).
  const nameTouchedRef = useRef(false);

  const testMutation = useTestPlatformModel();
  const saveMutation = useSavePlatformModel();
  const catalogMutation = useProviderCatalog();
  const { data: keyStatus } = useAiKeyStatus();
  const { data: platformModels } = usePlatformModels();

  // Reset form when dialog opens/closes or editModel changes
  useEffect(() => {
    if (open) {
      if (editModel) {
        setName(editModel.name);
        setProvider(editModel.provider);
        setModelId(editModel.modelId);
        setBaseUrl(editModel.baseUrl || PROVIDER_BASE_URLS[editModel.provider] || '');
        nameTouchedRef.current = true;
      } else {
        setName('');
        setProvider('');
        setModelId('');
        setBaseUrl('');
        nameTouchedRef.current = false;
      }
      setApiKey('');
      setShowKey(false);
      setTestResult(null);
      setCatalog([]);
      testMutation.reset();
      saveMutation.reset();
    }
    // mutation.reset est une reference stable en react-query v5 : l'effet reste
    // effectivement "reset a l'ouverture" (open/editModel).
  }, [open, editModel, testMutation.reset, saveMutation.reset]);

  // When provider changes, update base URL and reset model
  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    setBaseUrl(PROVIDER_BASE_URLS[newProvider] || '');
    setModelId('');
    setTestResult(null);
    setCatalog([]);
    if (!nameTouchedRef.current) setName('');
  };

  const handleTest = () => {
    // Clé optionnelle si réutilisable (édition / clé déjà configurée) : le
    // serveur réutilise alors la clé stockée pour le provider.
    if ((!apiKey.trim() && !keyOptional) || !provider || !modelId) return;
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
    // Clé vide acceptée si réutilisable (édition / clé déjà configurée) →
    // le serveur conserve/réutilise la clé existante (cf. saveModel backend).
    if (!name.trim() || !provider || !modelId || (!apiKey.trim() && !keyOptional)) return;
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

  // Clé réutilisable pour ce provider : connexion org BYOK (onglet Connection)
  // ou modèle plateforme déjà configuré. Si dispo, on ne redemande pas la clé —
  // le serveur la réutilise (le secret ne transite jamais vers le client, on
  // n'affiche qu'un aperçu masqué).
  const orgConnKey = keyStatus?.find(
    (k) => k.provider === provider && k.configured && k.source === 'ORGANIZATION' && !!k.maskedApiKey,
  );
  const existingPlatformKey = (platformModels || []).find(
    (m) => m.provider === provider && m.id !== editModel?.id && !!m.maskedApiKey,
  );
  const reusableMasked = orgConnKey?.maskedApiKey ?? existingPlatformKey?.maskedApiKey ?? null;
  const keyOptional = !!reusableMasked || !!editModel;

  const canSave = name.trim() && provider && modelId && (apiKey.trim() || keyOptional);

  // Nom auto depuis le modèle choisi : label du preset, sinon ID humanisé.
  const autoNameFromModel = (mid: string): string => {
    if (!mid) return '';
    const preset = models.find((m) => m.id === mid);
    if (preset) return preset.label;
    const seg = mid.includes('/') ? mid.split('/').slice(-1)[0] : mid;
    return seg
      .replace(/[-_.]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(' ');
  };
  // Sélection d'un modèle (preset ou catalogue) : pré-remplit le nom si non édité.
  const applyModelSelection = (mid: string) => {
    setModelId(mid);
    if (!nameTouchedRef.current && mid) setName(autoNameFromModel(mid));
  };

  // "Où trouver ma clé" : page du modèle NVIDIA (panneau Get API Key) si un modèle
  // est sélectionné, sinon la page clés générique du provider.
  const keyHelpUrl = (): string => {
    if (provider === 'nvidia' && modelId) {
      return `https://build.nvidia.com/${modelId.replace(/\./g, '_')}`;
    }
    return PROVIDER_API_KEY_URLS[provider]?.url || '';
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ pb: 1 }}>
        <h6 className="cn-text-h6 font-bold text-[1.05rem]">
          {editModel
            ? t('settings.ai.platform.editModel')
            : t('settings.ai.platform.addModel')}
        </h6>
      </DialogTitle>

      <DialogContent>
        <div className="flex flex-col gap-3 mt-1.5">
          {/* Name — la teinte provider au focus est abandonnee : le kit porte
              son propre anneau de focus, un accent inline ne s'y greffe pas. */}
          <Field>
            <FieldLabel htmlFor="platform-ai-model-name">{t('settings.ai.platform.name')}</FieldLabel>
            <Input
              id="platform-ai-model-name"
              value={name}
              onChange={(e) => { setName(e.target.value); nameTouchedRef.current = true; }}
              placeholder="ex: Design - Qwen Coder"
            />
          </Field>

          {/* Provider — l'option vide desactivee reproduit l'etat « rien de
              choisi » que MUI affichait tout seul ; sans elle, le select natif
              montrerait le premier provider alors que l'etat est encore vide. */}
          <Field>
            <FieldLabel htmlFor="platform-ai-model-provider">{t('settings.ai.platform.provider')}</FieldLabel>
            <NativeSelect
              id="platform-ai-model-provider"
              className="w-full"
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
            >
              <NativeSelectOption value="" disabled>
                {t('settings.ai.platform.selectProvider', 'Choisir un provider')}
              </NativeSelectOption>
              {PROVIDER_IDS.map((pid) => (
                <NativeSelectOption key={pid} value={pid}>
                  {PROVIDER_LABELS[pid]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>

          {/* Model — sélecteur UNIQUE : catalogue live du provider si chargé,
              sinon presets curés (pas de doublon). Le catalogue live n'est dispo
              que pour les providers qui l'exposent (NVIDIA aujourd'hui). */}
          <div className="flex flex-col gap-1">
            {catalog.length > 0 ? (
              <Autocomplete
                options={
                  modelId && !catalog.some((m) => m.id === modelId)
                    ? [{ id: modelId, category: 'other' }, ...catalog]
                    : catalog
                }
                value={catalog.find((m) => m.id === modelId) ?? (modelId ? { id: modelId, category: 'other' } : null)}
                onChange={(_, v) => applyModelSelection(v?.id ?? '')}
                getOptionLabel={(o) => o.id}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                size="small"
                fullWidth
                renderOption={(props, option) => {
                  const { key, ...rest } = props as { key?: React.Key } & React.HTMLAttributes<HTMLLIElement>;
                  const color = CATALOG_CATEGORY_COLORS[option.category] || '#9AA1B0';
                  return (
                    <li key={key} {...rest} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {option.id}
                      </span>
                      <StatusChip
                        size="sm"
                        tokens={{ color, bg: alpha(color, 0.14) }}
                        label={CATALOG_CATEGORY_LABELS[option.category] || option.category}
                        className="text-[0.6rem] shrink-0"
                      />
                    </li>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={`${t('settings.ai.platform.model')} (${catalog.length})`}
                  />
                )}
              />
            ) : (
              <Field>
                <FieldLabel htmlFor="platform-ai-model-id">{t('settings.ai.platform.model')}</FieldLabel>
                {models.length > 0 ? (
                  <NativeSelect
                    id="platform-ai-model-id"
                    className="w-full"
                    value={modelId}
                    onChange={(e) => applyModelSelection(e.target.value)}
                    disabled={!provider}
                  >
                    <NativeSelectOption value="" disabled>
                      {t('settings.ai.platform.selectModel', 'Choisir un modèle')}
                    </NativeSelectOption>
                    {models.map((m) => (
                      <NativeSelectOption key={m.id} value={m.id}>
                        {`${m.label} · ${m.desc}`}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                ) : (
                  <Input
                    id="platform-ai-model-id"
                    value={modelId}
                    onChange={(e) => applyModelSelection(e.target.value)}
                    disabled={!provider}
                  />
                )}
              </Field>
            )}

            {/* Charge le catalogue live → le sélecteur ci-dessus bascule dessus. */}
            {/* Action auxiliaire d'un champ, pas l'action de la modale : outline.
                La teinte du provider n'est connue qu'a l'execution -> style inline. */}
            <BuiButton
              size="sm"
              variant="outline"
              disabled={!provider || catalogMutation.isPending}
              onClick={() => catalogMutation.mutate(
                { provider, apiKey: apiKey.trim() || undefined, baseUrl: baseUrl.trim() || undefined },
                { onSuccess: (ids) => setCatalog(ids) },
              )}
              className="self-start"
              style={{ borderColor: accent, color: accent }}
            >
              {catalogMutation.isPending
                ? <Spinner className="size-3.5" />
                : <Refresh size={16} strokeWidth={1.75} />}
              {catalog.length > 0
                ? t('settings.ai.platform.reloadCatalog', 'Recharger le catalogue du provider')
                : t('settings.ai.platform.loadCatalog', 'Charger le catalogue du provider')}
            </BuiButton>
            {catalogMutation.isError && (
              <span className="cn-text-caption text-destructive">
                {(catalogMutation.error as Error)?.message
                  || t('settings.ai.platform.catalogError', 'Échec du chargement du catalogue.')}
              </span>
            )}
            {catalog.length > 0 && (
              <span className="cn-text-caption text-muted-foreground leading-[1.45]">
                {t('settings.ai.platform.catalogLegend',
                  'Chat / Raisonnement → Assistant, Messagerie, Tarification, Analytics · Code → Design, Studio · Audio, OCR, Embeddings, Image, Rerank ne conviennent pas aux agents conversationnels.')}
              </span>
            )}
          </div>

          {/* API Key */}
          <Field>
            <FieldLabel htmlFor="platform-ai-model-key">{t('settings.ai.platform.apiKey')}</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="platform-ai-model-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={editModel?.maskedApiKey || reusableMasked || 'sk-...'}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label={showKey
                    ? t('settings.ai.platform.hideKey', 'Masquer la clé')
                    : t('settings.ai.platform.showKey', 'Afficher la clé')}
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey
                    ? <VisibilityOff size={16} strokeWidth={1.75} />
                    : <Visibility size={16} strokeWidth={1.75} />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>

          {keyOptional && !apiKey.trim() && (
            <span className="cn-text-caption text-[var(--muted)] mt-[-7.5px] mb-[-3px]">
              {reusableMasked
                ? t('settings.ai.platform.keyReuse', 'Laisse vide pour réutiliser la clé déjà configurée pour ce provider.')
                : t('settings.ai.platform.keyKeep', 'Laisse vide pour conserver la clé actuelle.')}
            </span>
          )}

          {/* Lien contextuel "Ou trouver ma cle ?" — adapte au provider selectionne */}
          {provider && PROVIDER_API_KEY_URLS[provider] && (
            <div className="-mt-1.5 -mb-[3px]">
              {/* Aide contextuelle discrete : action tertiaire -> ghost.
                  Le survol teinte provider laisse place au survol du kit. */}
              <BuiButton asChild variant="ghost" size="xs" className="text-[0.72rem] font-medium text-[var(--muted)]">
                <a href={keyHelpUrl()} target="_blank" rel="noopener noreferrer">
                  {provider === 'nvidia' && modelId
                    ? 'Où trouver ma clé ? — Page du modèle : Get API Key'
                    : `Où trouver ma clé ? — ${PROVIDER_API_KEY_URLS[provider].label}`}
                  <OpenInNew size={12} strokeWidth={1.75} />
                </a>
              </BuiButton>
            </div>
          )}

          {/* Base URL */}
          <Field>
            <FieldLabel htmlFor="platform-ai-model-base-url">{t('settings.ai.platform.baseUrl')}</FieldLabel>
            <Input
              id="platform-ai-model-base-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </Field>

          {/* Feedback */}
          {testResult === 'success' && (
            <BuiAlert variant="success" className="py-0.5">
              <CircleCheck />
              <AlertDescription>{t('settings.ai.platform.testSuccess')}</AlertDescription>
            </BuiAlert>
          )}
          {testResult === 'error' && (
            <BuiAlert variant="destructive" className="py-0.5">
              <TriangleAlert />
              <AlertDescription>{t('settings.ai.platform.testError')}</AlertDescription>
            </BuiAlert>
          )}
          {saveMutation.isError && (
            <BuiAlert variant="destructive" className="py-0.5">
              <TriangleAlert />
              <AlertDescription>{t('settings.ai.platform.saveError')}</AlertDescription>
            </BuiAlert>
          )}
        </div>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <BuiButton variant="ghost" size="sm" onClick={onClose}>
          {t('common.cancel')}
        </BuiButton>
        {/* « Tester » est un preambule au vrai but de la modale : action secondaire. */}
        <BuiButton
          variant="ghost"
          size="sm"
          onClick={handleTest}
          disabled={(!apiKey.trim() && !keyOptional) || !provider || !modelId || testMutation.isPending}
          style={{ color: accent }}
        >
          {testMutation.isPending ? <Spinner className="size-3.5" /> : <Science />}
          {t('settings.ai.platform.test')}
        </BuiButton>
        {/* Action principale de la modale. La teinte provider est abandonnee ici :
            un fond pose en inline ecraserait aussi l'etat de survol du kit. */}
        <BuiButton
          size="sm"
          onClick={handleSave}
          disabled={!canSave || saveMutation.isPending}
        >
          {saveMutation.isPending && <Spinner className="size-3.5" />}
          {t('settings.ai.platform.saveActivate')}
        </BuiButton>
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
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const providerColor = PROVIDER_COLORS[model.provider] || '#888';
  const recheck = useRecheckPlatformModel();

  // Disponibilité live (probe proactif) — distincte du checkmark "lastValidatedAt" (test manuel).
  const av = model.availabilityStatus;
  const avColor = av === 'AVAILABLE' ? '#4A9B8E' : av === 'UNAVAILABLE' ? '#C97A7A' : '#9AA1B0';
  const avLabel = av === 'AVAILABLE'
    ? t('settings.ai.platform.availabilityAvailable', 'Disponible')
    : av === 'UNAVAILABLE'
      ? t('settings.ai.platform.availabilityUnavailable', 'Indisponible')
      : t('settings.ai.platform.availabilityUnknown', 'Non vérifié');
  const avCheckedAt = model.lastAvailabilityCheckAt
    ? new Date(model.lastAvailabilityCheckAt).toLocaleString()
    : '—';
  const avTip = `${avLabel} · ${t('settings.ai.platform.lastCheck', 'Dernier contrôle')} : ${avCheckedAt}`
    + (model.availabilityError ? `\n${model.availabilityError}` : '');

  return (
    <div className={ROW_CLASS}>
      {/* Color dot */}
      <div className="w-[8px] h-[8px] rounded-[50%] shrink-0" style={{ backgroundColor: providerColor }} />

      {/* Name */}
      <p className="cn-text-body2 font-semibold min-w-[120px] flex-[0_0_auto]">
        {model.name}
      </p>

      {/* Provider chip */}
      <StatusChip tokens={{ color: providerColor, bg: alpha(providerColor, isDark ? 0.18 : 0.1) }} label={PROVIDER_LABELS[model.provider] || model.provider} className="text-[0.65rem] shrink-0" />

      {/* Model ID */}
      <span className="cn-text-caption text-muted-foreground text-[0.7rem] font-mono flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
        {model.modelId}
      </span>

      {/* Assigned features chips */}
      <div className="flex gap-0.5 shrink-0">
        {model.assignedFeatures.map((feat) => {
          const featureConf = AI_FEATURES.find((f) => f.key === feat);
          return (
            // Repli en TOKEN, pas en chemin de theme MUI : ces couleurs partent
            // desormais en style inline, ou `text.secondary` ne veut rien dire.
            <StatusChip tokens={{ color: featureConf?.color || 'var(--muted)', bg: alpha(featureConf?.color || '#888', isDark ? 0.15 : 0.08) }} label={feat} className="h-[20px] text-[0.6rem]" key={feat} />
          );
        })}
      </div>

      {/* Availability (live) — vert / rouge / gris + tooltip (dernier contrôle + erreur) */}
      <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{avTip}</span>}>
        {/* Tooltip pose une ref sur son enfant, que StatusChip ne transmet pas
            (React 18, composant fonction) : sans ce span, l'infobulle ne s'ancre pas. */}
        <span className="inline-flex">
          <StatusChip tokens={{ color: avColor, bg: alpha(avColor, isDark ? 0.18 : 0.12) }} label={avLabel} className="text-[0.65rem] shrink-0" />
        </span>
      </Tooltip>

      {/* Validated indicator */}
      {model.lastValidatedAt && (
        <Tooltip title={`Valide le ${new Date(model.lastValidatedAt).toLocaleDateString()}`}>
          <span className="inline-flex shrink-0" style={{ color: providerColor }}><CheckCircle size={16} strokeWidth={1.75} /></span>
        </Tooltip>
      )}

      {/* Actions */}
      <div className="flex gap-0.5 shrink-0">
        <Tooltip title={t('settings.ai.platform.recheck', 'Revérifier la disponibilité')}>
          <span>
            <IconButton size="small" onClick={() => recheck.mutate(model.id)} disabled={recheck.isPending}>
              {recheck.isPending ? <Spinner className="size-3.5" /> : <Refresh size={16} strokeWidth={1.75} />}
            </IconButton>
          </span>
        </Tooltip>
        <IconButton size="small" onClick={() => onEdit(model)}>
          <Edit size={16} strokeWidth={1.75} />
        </IconButton>
        <IconButton size="small" onClick={() => onDelete(model.id)} disabled={isDeleting} color="error">
          {isDeleting ? <Spinner className="size-3.5" /> : <Delete size={16} strokeWidth={1.75} />}
        </IconButton>
      </div>
    </div>
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
        <div className="p-2 min-w-[280px]">
          {/* Header */}
          <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-[var(--line)]">
            <span className="cn-text-caption font-bold tracking-[0.4px]" style={{ color: feature.color }}>
              {feature.label.toUpperCase()}
            </span>
            <span className="cn-text-caption font-bold tabular-nums">
              ${totalCost.toFixed(4)} USD
            </span>
          </div>
          {/* Rows: 1 par (provider, model) */}
          {breakdown.map((m) => {
            const totalTokens = m.tokensIn + m.tokensOut;
            return (
              <div className="flex items-center gap-1.5 py-0.5" key={`${m.provider}-${m.model}`}>
                <div className="w-[6px] h-[6px] rounded-[50%] shrink-0" style={{ backgroundColor: PROVIDER_COLORS[m.provider] || '#888' }} />
                <div className="flex-1 min-w-0">
                  <span className="cn-text-caption block font-semibold text-[0.72rem] overflow-hidden text-ellipsis whitespace-nowrap">
                    {m.model}
                  </span>
                  <span className="cn-text-caption block text-muted-foreground text-[0.65rem] tabular-nums">
                    {Math.round(totalTokens / 1000)}k tok ({Math.round(m.tokensIn / 1000)}k in + {Math.round(m.tokensOut / 1000)}k out) · {m.callCount} call{m.callCount > 1 ? 's' : ''}
                  </span>
                </div>
                <span className="cn-text-caption font-semibold text-[0.72rem] tabular-nums shrink-0">
                  ${m.costUsd.toFixed(4)}
                </span>
              </div>
            );
          })}
        </div>
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

  // Budget editable : etat local + commit au blur / Entree. Sans ca, l'input
  // controle sur la valeur serveur sauvegardait a CHAQUE frappe et ecrasait la
  // saisie (impossible de taper un nombre proprement).
  const [budgetInput, setBudgetInput] = useState(String(budget));
  useEffect(() => {
    setBudgetInput(String(budget));
  }, [budget]);
  const commitBudget = () => {
    const val = parseInt(budgetInput, 10);
    if (!isNaN(val) && val >= 0 && val !== budget) {
      onBudgetChange(feature.key, val);
    } else {
      setBudgetInput(String(budget));
    }
  };

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
    <div className={ROW_CLASS}>
      {/* Feature icon */}
      {/* Couleur derivee de la feature a l'execution : inline, pas de classe. */}
      <div
        className="flex items-center justify-center w-[34px] h-[34px] rounded-[12px] shrink-0 [&_.MuiSvgIcon-root]:text-[18px]"
        style={{ backgroundColor: alpha(feature.color, isDark ? 0.15 : 0.08), color: feature.color }}
      >
        {feature.icon}
      </div>

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
      <div className={cn('flex-1 min-w-0', enabled ? 'opacity-100' : 'opacity-50')}>
        <p className="cn-text-body2 font-semibold leading-[1.3]">
          {feature.label}
        </p>
        <span className="cn-text-caption text-muted-foreground text-[0.7rem]">
          {feature.desc}
        </span>
      </div>

      {/* Model / connected-provider selector — les deux familles sont separees
          par des optgroup, seul regroupement qu'un select natif sait rendre.
          La pastille de couleur du provider disparait avec la liste riche. */}
      <NativeSelect
        id={`ai-feature-model-${feature.key}`}
        aria-label={t('settings.ai.platform.model')}
        className="min-w-[220px] shrink-0"
        value={selectValue}
        onChange={(e) => handleChange(e.target.value)}
        disabled={isAssigning}
      >
        <NativeSelectOption value="__none__">
          {t('settings.ai.platform.noModel')}
        </NativeSelectOption>

        {providerOptions.length > 0 && (
          <NativeSelectOptGroup label={t('settings.ai.platform.connectedProviders')}>
            {providerOptions.map((p) => (
              <NativeSelectOption key={`${PROVIDER_VALUE_PREFIX}${p.provider}`} value={`${PROVIDER_VALUE_PREFIX}${p.provider}`}>
                {`${p.label} · ${p.source === 'ORGANIZATION' ? t('settings.ai.platform.providerOwnKey') : t('settings.ai.platform.providerSharedKey')}${p.model ? ` · ${p.model}` : ''}`}
              </NativeSelectOption>
            ))}
          </NativeSelectOptGroup>
        )}

        {models.length > 0 && (
          <NativeSelectOptGroup label={t('settings.ai.platform.platformModels')}>
            {models.map((m) => (
              <NativeSelectOption key={`${MODEL_VALUE_PREFIX}${m.id}`} value={`${MODEL_VALUE_PREFIX}${m.id}`}>
                {m.name}
              </NativeSelectOption>
            ))}
          </NativeSelectOptGroup>
        )}
      </NativeSelect>

      {/* Token budget with progress + tooltip breakdown per (provider, model) */}
      {(() => {
        const pct = budget > 0 ? Math.min((used / budget) * 100, 100) : 0;
        const isOver = used >= budget;
        const barColor = isOver ? 'var(--err)' : pct > 75 ? 'var(--warn)' : feature.color;
        const totalCost = usageBreakdown.reduce((sum, m) => sum + (m.costUsd ?? 0), 0);
        return (
          <UsageBreakdownTooltip breakdown={usageBreakdown} totalCost={totalCost} feature={feature}>
            <div className={cn('relative w-[170px] shrink-0', usageBreakdown.length > 0 ? 'cursor-help' : 'cursor-default')}>
              {/* Progress bar background */}
              <div className="absolute inset-[0px] rounded-[1px] overflow-hidden border border-[var(--line)]">
                <div className="absolute start-0 top-0 bottom-0" style={{ width: `${pct}%`, backgroundColor: `color-mix(in srgb, ${barColor} 15%, transparent)`, transition: 'width 0.3s ease, background-color 0.3s ease' }} />
              </div>
              {/* Input on top — le champ du kit porte desormais une bordure
                  permanente : l'affordance « editable » n'a plus besoin du
                  survol, et le fond reste transparent donc la jauge se voit. */}
              <InputGroup>
                <InputGroupInput
                  id={`ai-feature-budget-${feature.key}`}
                  type="number"
                  aria-label={t('bookingEngine.ai.platform.budgetHint', 'Budget mensuel de tokens (modifiable)')}
                  title={t('bookingEngine.ai.platform.budgetHint', 'Budget mensuel de tokens (modifiable)')}
                  className="text-[0.75rem] tabular-nums"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  onBlur={commitBudget}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commitBudget();
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                />
                <InputGroupAddon align="inline-end">
                  <span className="cn-text-caption text-muted-foreground whitespace-nowrap text-[0.65rem] tabular-nums">
                    {Math.round(used / 1000)}k / {Math.round(budget / 1000)}k
                  </span>
                </InputGroupAddon>
              </InputGroup>
            </div>
          </UsageBreakdownTooltip>
        );
      })()}

      {/* Loading indicator */}
      {isAssigning && <CircularProgress size={16} sx={{ flexShrink: 0 }} />}
    </div>
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  // Erreur d'assignation feature (ex. règle même-provider des tiers assistant)
  const [assignError, setAssignError] = useState<string | null>(null);
  // Amorçage crédits (dotation initiale des orgs existantes)
  const [granting, setGranting] = useState(false);
  const [grantResult, setGrantResult] = useState<GrantInitialResult | null>(null);
  const [grantError, setGrantError] = useState<string | null>(null);

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
      <div className="flex justify-center py-6">
        <Spinner className="size-10" />
      </div>
    );
  }

  if (modelsError) {
    return <BuiAlert variant="destructive">
      <TriangleAlert />
      <AlertDescription>{t('settings.ai.platform.loadError')}</AlertDescription>
    </BuiAlert>;
  }

  const modelList = models || [];
  const featureMap = assignments || {};
  const providerMap = providerAssignments || {};

  // Providers connectes (cle org BYOK validee OU cle partagee plateforme dispo)
  // proposables comme modele de n'importe quelle feature. L'agent IA les utilise
  // en priorite (cf. AiKeyResolver) — on les rend donc selectionnables explicitement.
  const connectedProviders: ConnectedProviderOption[] = (keyStatus || []).flatMap((k) =>
    k.valid
      ? [
          {
            provider: k.provider,
            label: PROVIDER_LABELS[k.provider] || k.provider,
            model: k.modelOverride || null,
            source: k.source,
          },
        ]
      : [],
  );

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
    deleteMutation.reset();
    setConfirmDeleteId(id);
  };

  const confirmDeleteModel = () => {
    if (confirmDeleteId == null) return;
    deleteMutation.mutate(confirmDeleteId, {
      onSuccess: () => setConfirmDeleteId(null),
    });
  };

  const handleAssign = (feature: string, modelId: number) => {
    setAssignError(null);
    assignMutation.mutate({ feature, modelId }, {
      onError: (e: unknown) =>
        setAssignError((e as { message?: string })?.message || t('settings.ai.platform.assignError', 'Assignation refusée')),
    });
  };

  const handleAssignProvider = (feature: string, provider: string) => {
    setAssignError(null);
    assignProviderMutation.mutate({ feature, provider }, {
      onError: (e: unknown) =>
        setAssignError((e as { message?: string })?.message || t('settings.ai.platform.assignError', 'Assignation refusée')),
    });
  };

  const handleUnassign = (feature: string) => {
    unassignMutation.mutate(feature);
  };

  const handleGrantInitial = () => {
    setGranting(true);
    setGrantError(null);
    setGrantResult(null);
    aiCreditsApi
      .grantInitialAll()
      .then(setGrantResult)
      .catch((e: unknown) =>
        setGrantError(
          (e as { message?: string })?.message ||
            t('settings.ai.platform.grantInitialError', 'Échec de la dotation.'),
        ),
      )
      .finally(() => setGranting(false));
  };

  return (
    <AiSettingsCard
      title={t('settings.ai.platform.title')}
      subtitle={t('settings.ai.platform.subtitle')}
      action={
        <BuiButton size="sm" variant="outline" onClick={handleOpenAdd}>
          <Add />
          {t('settings.ai.platform.addModel')}
        </BuiButton>
      }
    >
      {/* ── Section 1: Configured Models ── */}
      <div className="mb-1.5">
        <span className="cn-text-overline font-bold text-[var(--muted)] tracking-[0.6px] text-[0.7rem]">
          {t('settings.ai.platform.models')}
        </span>
      </div>

      {modelList.length === 0 ? (
        <div className="pb-3">
          <p className="cn-text-body2 text-muted-foreground text-[0.8125rem] italic">
            {t('settings.ai.platform.noModel')}
          </p>
        </div>
      ) : (
        <div className="-mx-3 min-[900px]:-mx-[18px] mb-3 border-t border-b border-[var(--line)]">
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
        </div>
      )}

      {/* ── Section 2: Feature Assignments ── */}
      <div className="mt-4 mb-1.5">
        <span className="cn-text-overline font-bold text-[var(--muted)] tracking-[0.6px] text-[0.7rem]">
          {t('settings.ai.platform.featureMapping')}
        </span>
      </div>

      {assignError && (
        <BuiAlert variant="warning" className="mb-1.5">
          <TriangleAlert />
          <AlertDescription>{assignError}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setAssignError(null)}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}

      <div className="-mx-3 min-[900px]:-mx-[18px] border-t border-b border-[var(--line)]">
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
              onAssignProvider={handleAssignProvider}
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
      </div>

      {/* ── Section 3: Amorçage des crédits IA ── */}
      <div className="mt-4 mb-1.5">
        <span className="cn-text-overline font-bold text-[var(--muted)] tracking-[0.6px] text-[0.7rem]">
          {t('settings.ai.platform.creditsBootstrap', 'Amorçage des crédits')}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 justify-between py-2">
        <p className="cn-text-body2 text-muted-foreground text-[0.8125rem] max-w-[560px] leading-[1.5]">
          {t(
            'settings.ai.platform.creditsBootstrapHelp',
            'Dote toutes les organisations existantes de leur poche de crédits initiale. Action idempotente : une organisation déjà pourvue est ignorée. Les abonnés sont ensuite auto-provisionnés à l’usage et rechargés chaque mois.',
          )}
        </p>
        <BuiButton
          size="sm"
          variant="outline"
          onClick={handleGrantInitial}
          disabled={granting}
          className="shrink-0"
        >
          {granting ? <Spinner className="size-3.5" /> : <AttachMoney />}
          {t('settings.ai.platform.grantInitial', 'Doter les organisations')}
        </BuiButton>
      </div>

      {grantResult && (
        <BuiAlert variant="success" className="mt-1.5">
          <CircleCheck />
          <AlertDescription>{t('settings.ai.platform.grantInitialDone', {
            defaultValue: '{{granted}} organisation(s) dotée(s), {{skipped}} déjà pourvue(s).',
            granted: grantResult.granted,
            skipped: grantResult.skipped,
          })}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setGrantResult(null)}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}
      {grantError && (
        <BuiAlert variant="destructive" className="mt-1.5">
          <TriangleAlert />
          <AlertDescription>{grantError}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setGrantError(null)}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}

      {/* ── Add/Edit Dialog ── */}
      <ModelDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        editModel={editModel}
      />

      {/* Confirmation de suppression — action destructive, affiche aussi l'erreur */}
      <Dialog open={confirmDeleteId != null} onClose={() => setConfirmDeleteId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <h6 className="cn-text-h6 font-bold text-[1.05rem]">
            {t('settings.ai.platform.deleteConfirmTitle', 'Supprimer ce modèle ?')}
          </h6>
        </DialogTitle>
        <DialogContent>
          <p className="cn-text-body2 text-muted-foreground">
            {t('settings.ai.platform.deleteConfirmBody', {
              defaultValue: 'Le modèle « {{name}} » sera supprimé. Les features qui l’utilisent repasseront au modèle par défaut.',
              name: modelList.find((m) => m.id === confirmDeleteId)?.name ?? '',
            })}
          </p>
          {deleteMutation.isError && (
            <BuiAlert variant="destructive" className="mt-2 py-0.5">
              <TriangleAlert />
              <AlertDescription>{(deleteMutation.error as Error)?.message
                || t('settings.ai.platform.deleteError', 'Échec de la suppression.')}</AlertDescription>
            </BuiAlert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <BuiButton variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>
            {t('common.cancel')}
          </BuiButton>
          <BuiButton
            variant="destructive"
            size="sm"
            onClick={confirmDeleteModel}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending
              ? <Spinner className="size-3.5" />
              : <Delete size={16} strokeWidth={1.75} />}
            {t('settings.ai.platform.delete', 'Supprimer')}
          </BuiButton>
        </DialogActions>
      </Dialog>
    </AiSettingsCard>
  );
}
