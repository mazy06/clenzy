import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
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
  const theme = useTheme();

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
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
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
      ? <Chip label="Désactivé" size="small" sx={{ bgcolor: alpha(theme.palette.text.primary, 0.08) }} />
      : isProviderConfigured
        ? <Chip icon={<CheckCircle size={14} />} label="Connecté" size="small" color="success" />
        : <Chip icon={<ErrorOutline size={14} />} label="Configuration incomplète" size="small" color="warning" />;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header section */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
            {t('settings.whatsapp.title', 'Provider WhatsApp')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('settings.whatsapp.subtitle',
              "Choisissez comment Baitly envoie vos messages WhatsApp à vos voyageurs.")}
          </Typography>
        </Box>
        {statusChip}
      </Box>

      {/* Provider toggle — deux option cards mutuellement exclusives : le provider
          NON sélectionné est verrouillé tant que les envois sont activés (un seul
          provider actif à la fois). Pour changer : désactiver les envois d'abord. */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
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
        </Box>
        {enabled && (
          <Typography variant="caption" color="text.secondary">
            {t('settings.whatsapp.providerLockHint',
              'Un seul provider actif à la fois. Désactivez « Activer les envois » ci-dessous pour changer de provider.')}
          </Typography>
        )}
      </Box>

      {/* Disclaimer OpenWA — condensé : une ligne + détail complet en tooltip */}
      {provider === 'OPENWA' && (
        <Alert
          severity="warning"
          icon={<ErrorOutline size={18} />}
          sx={{ py: 0.5, '& .MuiAlert-message': { display: 'flex', alignItems: 'center', gap: 0.75 } }}
        >
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {t('settings.whatsapp.openwaDisclaimer.short',
              'OpenWA est hors conditions Meta — risque de ban du compte.')}
          </Typography>
          <Tooltip
            arrow
            title={t('settings.whatsapp.openwaDisclaimer.body',
              "WhatsApp peut bannir le compte associé sans préavis en cas de détection d'automation ou d'abus. " +
              'Nous recommandons OpenWA uniquement pour les phases de test ou les organisations en trial. ' +
              'Pour la production B2B, utilisez Meta Cloud API officielle.')}
          >
            <Box component="span" sx={{ display: 'inline-flex', cursor: 'help', color: 'warning.main' }}>
              <InfoOutlined size={15} strokeWidth={1.75} />
            </Box>
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

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, my: 1 }}>
            <Divider sx={{ flex: 1 }} />
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {t('settings.whatsapp.meta.orManual', 'OU configuration manuelle')}
            </Typography>
            <Divider sx={{ flex: 1 }} />
          </Box>

          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {t('settings.whatsapp.meta.formTitle', 'Identifiants Meta Cloud API')}
          </Typography>
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
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {t('settings.whatsapp.openwa.formTitle', 'Connexion à votre instance OpenWA')}
          </Typography>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1, flexWrap: 'wrap' }}>
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
            <Typography variant="caption" color="text.secondary">
              {config?.hasOpenwaApiKey
                ? t('settings.whatsapp.openwa.scanHint', 'Crée la session et affiche le QR à scanner avec votre téléphone.')
                : t('settings.whatsapp.openwa.scanHintNoKey', 'Saisissez la master key et enregistrez avant de scanner.')}
            </Typography>
          </Box>
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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {t('settings.whatsapp.enable', 'Activer les envois WhatsApp')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {enabled
              ? t('settings.whatsapp.enableOn', "Baitly enverra les messages WhatsApp via le provider sélectionné.")
              : t('settings.whatsapp.enableOff', "Aucun message WhatsApp ne sera envoyé.")}
          </Typography>
        </Box>
        <Switch
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          color="primary"
        />
      </Box>

      {/* Feedback */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>
      )}
      {success && (
        <Alert severity="success">{t('settings.whatsapp.saved', 'Configuration enregistrée.')}</Alert>
      )}

      {/* Save button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          disableElevation
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save size={14} strokeWidth={1.75} />}
          onClick={handleSave}
          disabled={!hasChanges || saving}
          size="small"
        >
          {saving ? t('common.saving', 'Enregistrement...') : t('common.save', 'Enregistrer')}
        </Button>
      </Box>
    </Box>
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
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          cursor: 'help',
          color: 'text.disabled',
          transition: 'color 150ms ease-out',
          '&:hover': { color: 'text.secondary' },
        }}
      >
        <InfoOutlined size={15} strokeWidth={1.75} />
      </Box>
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
      <Box
        sx={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          flexShrink: 0,
          border: '2px solid',
          borderColor: selected ? theme.palette.primary.main : alpha(theme.palette.text.primary, 0.3),
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'border-color 150ms ease-out',
        }}
      >
        {selected && (
          <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: theme.palette.primary.main }} />
        )}
      </Box>

      {/* Titre + badge + sous-titre */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{title}</Typography>
          <Chip
            label={badge.label}
            size="small"
            color={badge.color}
            variant="outlined"
            sx={{ height: 18, '& .MuiChip-label': { px: 0.75, fontSize: '0.6875rem' } }}
          />
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
          {subtitle}
        </Typography>
      </Box>

      {/* Avantages / limites — en tooltip pour ne pas alourdir la card */}
      <Tooltip
        arrow
        title={
          <Stack spacing={0.5} sx={{ py: 0.5 }}>
            {pros.map((p) => (
              <Box key={p} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, fontSize: '0.72rem' }}>
                <Box component="span" sx={{ color: 'success.light', fontWeight: 700, lineHeight: 1.4 }}>✓</Box>
                <span>{p}</span>
              </Box>
            ))}
            {cons.map((c) => (
              <Box key={c} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, fontSize: '0.72rem', opacity: 0.85 }}>
                <Box component="span" sx={{ fontWeight: 700, lineHeight: 1.4 }}>−</Box>
                <span>{c}</span>
              </Box>
            ))}
          </Stack>
        }
      >
        <Box
          component="span"
          sx={{
            display: 'inline-flex',
            flexShrink: 0,
            color: 'text.secondary',
            cursor: 'help',
            transition: 'color 150ms ease-out',
            '&:hover': { color: 'text.primary' },
          }}
        >
          <InfoOutlined size={16} strokeWidth={1.75} />
        </Box>
      </Tooltip>
    </Box>
  );
}
