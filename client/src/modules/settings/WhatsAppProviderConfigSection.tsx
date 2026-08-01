import React, { useEffect, useState } from 'react';
import { Badge } from '../../components/ui';
import { Alert as BuiAlert, AlertDescription, AlertAction, Button as BuiButton } from '../../components/ui';
import { TriangleAlert, X, CircleCheck } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { Alert, Box, Button, Divider, Stack, Switch, TextField, Tooltip, alpha, useTheme } from '@mui/material';
import StatusChip, { type StatusTone } from '../../components/StatusChip';
import { CheckCircle, ErrorOutline, InfoOutlined, Save } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import {
  whatsAppConfigApi,
  type WhatsAppConfig,
  type WhatsAppProviderType,
  type UpdateWhatsAppConfigRequest,
} from '../../services/api/whatsAppConfigApi';
import OpenWaQrScanDialog from './components/OpenWaQrScanDialog';
import MetaEmbeddedSignupButton from './components/MetaEmbeddedSignupButton';

/** Couleur MUI historique du badge des option cards -> ton de la primitive. */
const BADGE_TONES: Record<'success' | 'warning' | 'info', StatusTone> = {
  success: 'ok',
  warning: 'warn',
  info: 'info',
};

/**
 * Section Settings > Messagerie > Provider WhatsApp.
 *
 * <h2>Provider strategy</h2>
 * Une org choisit son provider WhatsApp :
 * <ul>
 *   <li><b>META</b> (default) : Meta Cloud API officielle. Necessite Meta
 *       Business Manager verifie + token permanent. Conforme ToS, features
 *       completes, mais payant.</li>
 *   <li><b>OPENWA</b> : Instance OpenWA self-hosted (whatsapp-web.js).
 *       Gratuit, setup ultra-rapide, mais <b>HORS ToS Meta</b>. Disclaimer
 *       fort affiche dans l'UI.</li>
 * </ul>
 *
 * <h2>UX</h2>
 * <ul>
 *   <li>Deux "option cards" radio en haut pour selectionner le provider</li>
 *   <li>Le formulaire dessous change selon le provider selectionne</li>
 *   <li>Les credentials de l'autre provider restent en base (utile pour
 *       revenir en arriere sans re-saisir)</li>
 *   <li>Les secrets (apiToken, openwaApiKey) sont en TextField type=password
 *       avec un placeholder "deja configure" si {@code hasApiToken} = true</li>
 *   <li>Bouton Save grise tant qu'aucun changement</li>
 * </ul>
 *
 * <h2>TODO Phase 4b (suivi)</h2>
 * <ul>
 *   <li>Bouton "Scanner le QR code" pour OpenWA (popup avec QR depuis
 *       endpoint backend qui proxy /api/sessions/{id}/qr)</li>
 *   <li>Polling status connexion OpenWA (connected / qr_pending / disconnected)</li>
 *   <li>Bouton "Tester l'envoi" qui envoie un message de test au numero du user</li>
 * </ul>
 */
export default function WhatsAppProviderConfigSection() {
  const { t } = useTranslation();

  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);

  // Form local — distinct de `config` pour pouvoir comparer et detecter
  // les changements (bouton Save grise tant que rien n'a bouge).
  const [provider, setProvider] = useState<WhatsAppProviderType>('META');
  const [enabled, setEnabled] = useState(false);
  // Meta fields
  const [apiToken, setApiToken] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [webhookVerifyToken, setWebhookVerifyToken] = useState('');
  // OpenWA fields
  const [openwaSessionId, setOpenwaSessionId] = useState('');
  const [openwaApiKey, setOpenwaApiKey] = useState('');

  const reloadConfig = async () => {
    try {
      const data = await whatsAppConfigApi.getConfig();
      if (data) {
        setConfig(data);
        setProvider(data.provider);
        setEnabled(data.enabled);
        setPhoneNumberId(data.phoneNumberId ?? '');
        setBusinessAccountId(data.businessAccountId ?? '');
        setOpenwaSessionId(data.openwaSessionId ?? '');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      await reloadConfig();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detection de changements pour griser Save
  const hasChanges =
    !config ||
    provider !== config.provider ||
    enabled !== config.enabled ||
    phoneNumberId !== (config.phoneNumberId ?? '') ||
    businessAccountId !== (config.businessAccountId ?? '') ||
    webhookVerifyToken.length > 0 ||
    openwaSessionId !== (config.openwaSessionId ?? '') ||
    apiToken.length > 0 ||
    openwaApiKey.length > 0;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const patch: UpdateWhatsAppConfigRequest = {
        provider,
        enabled,
      };
      // Champs Meta : envoyer uniquement ceux qui ont change ou qui sont
      // remplis (eviter d'ecraser un token Meta existant avec une chaine vide).
      if (phoneNumberId !== (config?.phoneNumberId ?? '')) patch.phoneNumberId = phoneNumberId;
      if (businessAccountId !== (config?.businessAccountId ?? '')) patch.businessAccountId = businessAccountId;
      if (apiToken.length > 0) patch.apiToken = apiToken;
      if (webhookVerifyToken.length > 0) patch.webhookVerifyToken = webhookVerifyToken;
      // Champs OpenWA : meme logique
      if (openwaSessionId !== (config?.openwaSessionId ?? '')) patch.openwaSessionId = openwaSessionId;
      if (openwaApiKey.length > 0) patch.openwaApiKey = openwaApiKey;

      const updated = await whatsAppConfigApi.updateConfig(patch);
      setConfig(updated);
      // Reset les champs secrets pour ne pas les garder en memoire ni les renvoyer
      setApiToken('');
      setOpenwaApiKey('');
      setWebhookVerifyToken('');
      setSuccess(true);
      window.setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-9">
        <Spinner className="size-7" />
      </div>
    );
  }

  // Status badge en haut a droite : "Connecte" / "Configuration incomplete" /
  // "Desactive" selon la coherence config courante <> provider actif.
  const isProviderConfigured =
    provider === 'META'
      ? !!(config?.hasApiToken && config?.phoneNumberId)
      : !!(config?.hasOpenwaApiKey && config?.openwaSessionId);

  const statusChip = !config
    ? null
    : !enabled
      ? <StatusChip tone="neutral" label="Désactivé" />
      : isProviderConfigured
        ? <Badge variant="success"><CheckCircle size={14} />Connecté</Badge>
        : <Badge variant="warning"><ErrorOutline size={14} />Configuration incomplète</Badge>;

  return (
    <div className="flex flex-col gap-4">
      {/* Header section */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h6 className="cn-text-h6 font-semibold mb-0.5">
            {t('settings.whatsapp.title', 'Provider WhatsApp')}
          </h6>
          <p className="cn-text-body2 text-muted-foreground">
            {t('settings.whatsapp.subtitle',
              "Choisissez comment Baitly envoie vos messages WhatsApp à vos voyageurs.")}
          </p>
        </div>
        {statusChip}
      </div>

      {/* Provider toggle — deux option cards mutuellement exclusives : le provider
          NON sélectionné est verrouillé tant que les envois sont activés (un seul
          provider actif à la fois). Pour changer : désactiver les envois d'abord. */}
      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-[1fr] min-[900px]:grid-cols-[1fr_1fr] gap-3">
          <ProviderOptionCard
            selected={provider === 'META'}
            onClick={() => setProvider('META')}
            disabled={enabled && provider === 'OPENWA'}
            title="Meta Cloud API"
            subtitle="Officiel — recommandé pour la production"
            badge={{ label: 'Recommandé', color: 'success' }}
            pros={[
              'Conforme ToS WhatsApp',
              'Templates approuvés, boutons, listes',
              'SLA 99.95%',
            ]}
            cons={[
              'Setup 1-3 jours (vérif Meta Business)',
              'Payant (~$0.014-$0.07/conversation)',
            ]}
          />
          <ProviderOptionCard
            selected={provider === 'OPENWA'}
            onClick={() => setProvider('OPENWA')}
            disabled={enabled && provider === 'META'}
            title="OpenWA"
            subtitle="Self-hosted — pour trials et MVP"
            badge={{ label: 'Hors ToS Meta', color: 'warning' }}
            pros={[
              'Gratuit (hors coût infra)',
              'Setup 5 min (scan QR code)',
              'Pas besoin de Meta Business Manager',
            ]}
            cons={[
              'Risque ban du compte WhatsApp',
              'Pas de templates approuvés ni boutons',
              'Throughput limité (20 msg/min)',
            ]}
          />
        </div>
        {enabled && (
          <span className="cn-text-caption text-muted-foreground">
            {t('settings.whatsapp.providerLockHint',
              'Un seul provider actif à la fois. Désactivez « Activer les envois » ci-dessous pour changer de provider.')}
          </span>
        )}
      </div>

      {/* Disclaimer OpenWA — condensé : une ligne + détail complet en tooltip */}
      {provider === 'OPENWA' && (
        <Alert
          severity="warning"
          icon={<ErrorOutline size={18} />}
          sx={{ py: 0.5, '& .MuiAlert-message': { display: 'flex', alignItems: 'center', gap: 0.75 } }}
        >
          <p className="cn-text-body2 font-medium">
            {t('settings.whatsapp.openwaDisclaimer.short',
              'OpenWA est hors conditions Meta — risque de ban du compte.')}
          </p>
          <Tooltip
            arrow
            title={t('settings.whatsapp.openwaDisclaimer.body',
              "WhatsApp peut bannir le compte associé sans préavis en cas de détection d'automation ou d'abus. " +
              'Nous recommandons OpenWA uniquement pour les phases de test ou les organisations en trial. ' +
              'Pour la production B2B, utilisez Meta Cloud API officielle.')}
          >
            <span className="inline-flex cursor-help text-[#D4A574]">
              <InfoOutlined size={15} strokeWidth={1.75} />
            </span>
          </Tooltip>
        </Alert>
      )}

      <Divider />

      {/* Form selon provider */}
      {provider === 'META' ? (
        <Stack spacing={2}>
          {/* Embedded Signup — methode rapide (~5 min, sans Meta Business Manager
              prealable). Le composant gere lui-meme son etat ; si la Meta App
              n'est pas configuree cote serveur (META_APP_ID vide), il rend null
              et l'user voit uniquement le form manuel ci-dessous. */}
          <MetaEmbeddedSignupButton
            onSuccess={async () => {
              // Reload la config pour pickup hasApiToken, phoneNumberId, businessAccountId
              // qui viennent d'etre provisionnes automatiquement.
              await reloadConfig();
            }}
          />

          <div className="flex items-center gap-3 my-1.5">
            <Divider sx={{ flex: 1 }} />
            <span className="cn-text-caption text-muted-foreground whitespace-nowrap">
              {t('settings.whatsapp.meta.orManual', 'OU configuration manuelle')}
            </span>
            <Divider sx={{ flex: 1 }} />
          </div>

          <h6 className="cn-text-subtitle2 font-semibold">
            {t('settings.whatsapp.meta.formTitle', 'Identifiants Meta Cloud API')}
          </h6>
          <TextField
            label={t('settings.whatsapp.meta.apiToken', 'API Token (permanent)')}
            type="password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder={config?.hasApiToken ? '••••••••••••  (déjà configuré, laissez vide pour conserver)' : 'EAAxxxxxxxxxxxxxxxx...'}
            fullWidth
            size="small"
            autoComplete="off"
            InputProps={{
              endAdornment: (
                <FieldInfo text={t('settings.whatsapp.meta.apiTokenHelp',
                  'Token permanent depuis Meta Business Manager > System Users > Generate Token.')} />
              ),
            }}
          />
          <TextField
            label={t('settings.whatsapp.meta.phoneNumberId', 'Phone Number ID')}
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder="123456789012345"
            fullWidth
            size="small"
            InputProps={{
              endAdornment: <FieldInfo text="ID numérique du numéro WhatsApp Business approuvé." />,
            }}
          />
          <TextField
            label={t('settings.whatsapp.meta.businessAccountId', 'Business Account ID')}
            value={businessAccountId}
            onChange={(e) => setBusinessAccountId(e.target.value)}
            placeholder="987654321098765"
            fullWidth
            size="small"
            InputProps={{
              endAdornment: <FieldInfo text="ID du Business Account (WABA). Utilisé pour les templates." />,
            }}
          />
          <TextField
            label={t('settings.whatsapp.meta.webhookVerifyToken', 'Webhook Verify Token')}
            value={webhookVerifyToken}
            onChange={(e) => setWebhookVerifyToken(e.target.value)}
            placeholder={config?.hasApiToken ? '•••••  (laissez vide pour conserver)' : 'une chaîne secrète de votre choix'}
            fullWidth
            size="small"
            autoComplete="off"
            InputProps={{
              endAdornment: <FieldInfo text="Chaîne secrète que VOUS choisissez et saisissez à l'identique côté Meta (Configuration → Webhooks → Verify token). Valide l'abonnement du webhook entrant." />,
            }}
          />
        </Stack>
      ) : (
        <Stack spacing={2}>
          <h6 className="cn-text-subtitle2 font-semibold">
            {t('settings.whatsapp.openwa.formTitle', 'Connexion à votre instance OpenWA')}
          </h6>
          <TextField
            label={t('settings.whatsapp.openwa.masterKey', 'Master key OpenWA')}
            type="password"
            value={openwaApiKey}
            onChange={(e) => setOpenwaApiKey(e.target.value)}
            placeholder={config?.hasOpenwaApiKey ? '••••••••••••  (déjà configurée, laissez vide pour conserver)' : 'dev-admin-key'}
            fullWidth
            size="small"
            autoComplete="off"
            InputProps={{
              endAdornment: <FieldInfo text="Clé ADMIN de l'instance OpenWA (header X-API-Key). En dev : dev-admin-key. Stockée chiffrée en base, jamais exposée." />,
            }}
          />
          <TextField
            label={t('settings.whatsapp.openwa.sessionId', 'Session ID')}
            value={openwaSessionId}
            placeholder={t('settings.whatsapp.openwa.sessionIdAuto', '(généré automatiquement)')}
            fullWidth
            size="small"
            disabled
            InputProps={{
              endAdornment: <FieldInfo text="Identifiant de la session OpenWA, généré automatiquement au scan du QR code." />,
            }}
          />
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Button
              variant="outlined"
              size="small"
              onClick={() => setQrDialogOpen(true)}
              disabled={!config?.hasOpenwaApiKey}
              disableElevation
            >
              {config?.openwaSessionId
                ? t('settings.whatsapp.openwa.rescan', 'Re-scanner le QR code')
                : t('settings.whatsapp.openwa.scan', 'Scanner le QR code')}
            </Button>
            <span className="cn-text-caption text-muted-foreground">
              {config?.hasOpenwaApiKey
                ? t('settings.whatsapp.openwa.scanHint', 'Crée la session et affiche le QR à scanner avec votre téléphone.')
                : t('settings.whatsapp.openwa.scanHintNoKey', 'Saisissez la master key et enregistrez avant de scanner.')}
            </span>
          </div>
        </Stack>
      )}

      {/* Dialog QR scan — flow Phase 4b complet (creation session, polling status).
          Le Dialog est toujours rendu (open piloted), pas conditionnellement, pour
          que les transitions enter/exit de MUI fonctionnent proprement. */}
      <OpenWaQrScanDialog
        open={qrDialogOpen}
        onClose={() => setQrDialogOpen(false)}
        onSuccess={async () => {
          // Recharge la config pour pickup le nouveau sessionId et hasOpenwaApiKey,
          // puis ferme le dialog. L'user voit immediatement le status "Connecte".
          await reloadConfig();
          setQrDialogOpen(false);
        }}
      />

      <Divider />

      {/* Toggle enable */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h6 className="cn-text-subtitle2 font-semibold">
            {t('settings.whatsapp.enable', 'Activer les envois WhatsApp')}
          </h6>
          <span className="cn-text-caption text-muted-foreground">
            {enabled
              ? t('settings.whatsapp.enableOn', "Baitly enverra les messages WhatsApp via le provider sélectionné.")
              : t('settings.whatsapp.enableOff', "Aucun message WhatsApp ne sera envoyé.")}
          </span>
        </div>
        <Switch
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          color="primary"
        />
      </div>

      {/* Feedback */}
      {error && (
        <BuiAlert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
            <BuiButton variant="ghost" size="icon-xs" aria-label="Fermer" onClick={() => setError(null)}>
              <X />
            </BuiButton>
          </AlertAction>
        </BuiAlert>
      )}
      {success && (
        <BuiAlert variant="success">
          <CircleCheck />
          <AlertDescription>{t('settings.whatsapp.saved', 'Configuration enregistrée.')}</AlertDescription>
        </BuiAlert>
      )}

      {/* Save button */}
      <div className="flex justify-end">
        <Button
          variant="contained"
          disableElevation
          startIcon={saving ? <Spinner className="size-3.5" /> : <Save size={14} strokeWidth={1.75} />}
          onClick={handleSave}
          disabled={!hasChanges || saving}
          size="small"
        >
          {saving ? t('common.saving', 'Enregistrement...') : t('common.save', 'Enregistrer')}
        </Button>
      </div>
    </div>
  );
}

// ─── Sous-composant : option card pour le toggle provider ──────────────────

interface ProviderOptionCardProps {
  selected: boolean;
  onClick: () => void;
  /** Verrouille la carte (grisée, non cliquable) — ex: provider non actif pendant que les envois sont activés. */
  disabled?: boolean;
  title: string;
  subtitle: string;
  badge: { label: string; color: 'success' | 'warning' | 'info' };
  pros: string[];
  cons: string[];
}

/**
 * Petite icône d'aide (tooltip) — déplace les explications détaillées hors du
 * flux visuel pour garder le formulaire lisible. Utilisée en endAdornment des
 * champs et dans les option cards.
 */
function FieldInfo({ text }: { text: string }) {
  return (
    <Tooltip arrow title={text}>
      <span className="inline-flex items-center cursor-help text-[var(--faint)] [transition:color_150ms_ease-out] hover:text-[var(--muted)]">
        <InfoOutlined size={15} strokeWidth={1.75} />
      </span>
    </Tooltip>
  );
}

function ProviderOptionCard({
  selected,
  onClick,
  disabled = false,
  title,
  subtitle,
  badge,
  pros,
  cons,
}: ProviderOptionCardProps) {
  const theme = useTheme();
  return (
    <Box
      component="button"
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-pressed={selected}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      sx={{
        textAlign: 'left',
        p: 1.5,
        borderRadius: 2,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        bgcolor: selected ? alpha(theme.palette.primary.main, 0.06) : 'background.paper',
        border: '1.5px solid',
        borderColor: selected ? theme.palette.primary.main : alpha(theme.palette.text.primary, 0.12),
        transition: 'border-color 180ms ease-out, background-color 180ms ease-out, opacity 180ms ease-out',
        fontFamily: 'inherit',
        '&:hover': disabled
          ? {}
          : {
              borderColor: selected ? theme.palette.primary.main : alpha(theme.palette.primary.main, 0.5),
            },
        '&:focus-visible': {
          outline: `2px solid ${alpha(theme.palette.primary.main, 0.5)}`,
          outlineOffset: 2,
        },
      }}
    >
      {/* Indicateur radio */}
      <div className="w-[18px] h-[18px] rounded-[50%] shrink-0 border-[2px] border-solid inline-flex items-center justify-center" style={{ borderColor: selected ? theme.palette.primary.main : alpha(theme.palette.text.primary, 0.3), transition: 'border-color 150ms ease-out' }}>
        {selected && (
          <div className="w-[9px] h-[9px] rounded-[50%]" style={{ backgroundColor: theme.palette.primary.main }} />
        )}
      </div>

      {/* Titre + badge + sous-titre */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <h6 className="cn-text-subtitle2 font-semibold">{title}</h6>
          <StatusChip
            size="sm"
            tone={BADGE_TONES[badge.color]}
            label={badge.label}
            className="text-[0.6875rem]"
          />
        </div>
        <span className="cn-text-caption text-muted-foreground block mt-0.5">
          {subtitle}
        </span>
      </div>

      {/* Avantages / limites — en tooltip pour ne pas alourdir la card */}
      <Tooltip
        arrow
        title={
          <Stack spacing={0.5} sx={{ py: 0.5 }}>
            {pros.map((p) => (
              <div className="flex items-start gap-1 text-[0.72rem]" key={p}>
                <span className="text-[var(--mui-success-l)] font-bold leading-[1.4]">✓</span>
                <span>{p}</span>
              </div>
            ))}
            {cons.map((c) => (
              <div className="flex items-start gap-1 text-[0.72rem] opacity-85" key={c}>
                <span className="font-bold leading-[1.4]">−</span>
                <span>{c}</span>
              </div>
            ))}
          </Stack>
        }
      >
        <span className="inline-flex shrink-0 cursor-help text-[var(--muted)] [transition:color_150ms_ease-out] hover:text-[var(--ink)]">
          <InfoOutlined size={16} strokeWidth={1.75} />
        </span>
      </Tooltip>
    </Box>
  );
}
