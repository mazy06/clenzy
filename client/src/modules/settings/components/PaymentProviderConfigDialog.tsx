import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Alert,
  MenuItem,
  Switch,
  FormControlLabel,
  IconButton,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import { Close as CloseIcon, Visibility, VisibilityOff } from '../../../icons';
import type {
  PaymentMethodConfig,
  PaymentMethodConfigUpdate,
  PaymentProviderType,
} from '../../../types/payment';
import { PAYMENT_PROVIDER_LABELS } from '../../../types/payment';

/**
 * Dialog de configuration des credentials d'un provider de paiement.
 *
 * <h2>Schemas dynamiques par provider</h2>
 * <ul>
 *   <li>PayTabs : Server Key (secret) + Profile ID (numerique, non secret)
 *       + Region (SA / AE / EG / JO / OM)</li>
 *   <li>CMI : Client ID + Store Key (secret) + OK URL + Fail URL</li>
 *   <li>Payzone / PayPal : a venir (stubs UI)</li>
 * </ul>
 *
 * <h2>Securite</h2>
 * <p>Les champs secrets ({@code Server Key}, {@code Store Key}) sont toggle-able
 * en mode "show/hide" et ne sont JAMAIS pre-remplis par la valeur courante
 * (l'API ne renvoie pas les credentials dechiffres). Si l'admin laisse vide,
 * la valeur existante est preservee cote backend.</p>
 *
 * <h2>configJson</h2>
 * <p>Les champs non-secrets (profileId, region, callbackUrl) vont dans le
 * {@code configJson} de la config — merge cote service pour ne pas ecraser
 * les autres clefs.</p>
 */

const ACCENT = '#4A9B8E';
const NEUTRAL = '#8A8378';

interface FieldSpec {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'url' | 'select';
  required: boolean;
  helper?: string;
  /** Si {@code true}, va dans {@code configJson} ; sinon dans la colonne dediee. */
  goesInConfigJson: boolean;
  /** Nom du champ cible au niveau de PaymentMethodConfigUpdate (apiKey, apiSecret, webhookSecret). */
  topLevelKey?: 'apiKey' | 'apiSecret' | 'webhookSecret';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

const PROVIDER_FIELDS: Record<PaymentProviderType, FieldSpec[]> = {
  STRIPE: [
    // Stripe credentials are configured via application.yml, not per-tenant in BDD.
    // Le dialog n'est pas utilise pour Stripe — on garde le toggle simple.
  ],
  PAYTABS: [
    {
      key: 'apiKey',
      label: 'Server Key',
      type: 'password',
      required: true,
      goesInConfigJson: false,
      topLevelKey: 'apiKey',
      helper: 'Disponible dans Dashboard PayTabs → Developers → Server Key. Laissez vide pour ne pas modifier.',
    },
    {
      key: 'profileId',
      label: 'Profile ID',
      type: 'number',
      required: true,
      goesInConfigJson: true,
      helper: 'Identifiant numerique du profil marchand (ex: 12345).',
    },
    {
      key: 'region',
      label: 'Region',
      type: 'select',
      required: true,
      goesInConfigJson: true,
      options: [
        { value: 'SA', label: 'Arabie Saoudite (SAR)' },
        { value: 'AE', label: 'Emirats Arabes Unis (AED)' },
        { value: 'EG', label: 'Egypte (EGP)' },
        { value: 'JO', label: 'Jordanie (JOD)' },
        { value: 'OM', label: 'Oman (OMR)' },
      ],
      helper: 'Determine l\'URL d\'API utilisee (secure.paytabs.sa pour KSA, etc.).',
    },
    {
      key: 'callbackUrl',
      label: 'Callback URL (IPN)',
      type: 'url',
      required: false,
      goesInConfigJson: true,
      placeholder: 'https://api.clenzy.fr/api/webhooks/payments/paytabs',
      helper: 'URL ou PayTabs envoie les notifications de paiement. Defaut : prod Clenzy.',
    },
  ],
  CMI: [
    {
      key: 'apiKey',
      label: 'Client ID',
      type: 'text',
      required: true,
      goesInConfigJson: false,
      topLevelKey: 'apiKey',
      helper: 'Identifiant marchand fourni par CMI Maroc.',
    },
    {
      key: 'apiSecret',
      label: 'Store Key',
      type: 'password',
      required: true,
      goesInConfigJson: false,
      topLevelKey: 'apiSecret',
      helper: 'Cle secrete pour le calcul du HASH SHA-512. Laissez vide pour ne pas modifier.',
    },
    {
      key: 'okUrl',
      label: 'OK URL',
      type: 'url',
      required: true,
      goesInConfigJson: true,
      placeholder: 'https://app.clenzy.fr/booking/success',
      helper: 'URL de redirection apres paiement reussi.',
    },
    {
      key: 'failUrl',
      label: 'Fail URL',
      type: 'url',
      required: true,
      goesInConfigJson: true,
      placeholder: 'https://app.clenzy.fr/booking/error',
      helper: 'URL de redirection apres echec.',
    },
    {
      key: 'callbackUrl',
      label: 'Callback URL',
      type: 'url',
      required: false,
      goesInConfigJson: true,
      placeholder: 'https://api.clenzy.fr/api/webhooks/payments/cmi',
      helper: 'URL server-to-server pour la confirmation. Defaut : prod Clenzy.',
    },
  ],
  PAYZONE: [
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      goesInConfigJson: false,
      topLevelKey: 'apiKey',
      helper: 'Clé API marchand Payzone Maroc. Disponible dans Dashboard Payzone → Developers. Laissez vide pour ne pas modifier.',
    },
    {
      key: 'webhookSecret',
      label: 'Webhook Secret',
      type: 'password',
      required: false,
      goesInConfigJson: false,
      topLevelKey: 'webhookSecret',
      helper: 'Secret de signature HMAC-SHA256 pour vérifier les webhooks. Si vide, l\'API Key sera utilisée comme fallback.',
    },
    {
      key: 'webhookUrl',
      label: 'Webhook URL',
      type: 'url',
      required: true,
      goesInConfigJson: true,
      placeholder: 'https://api.clenzy.fr/api/webhooks/payments/payzone',
      helper: 'URL où Payzone envoie les notifications de paiement. Doit être accessible publiquement (HTTPS).',
    },
    {
      key: 'defaultSuccessUrl',
      label: 'URL de succès par défaut',
      type: 'url',
      required: false,
      goesInConfigJson: true,
      placeholder: 'https://app.clenzy.fr/booking/success',
      helper: 'Page de retour après paiement réussi (peut être override par appel).',
    },
    {
      key: 'defaultFailureUrl',
      label: 'URL d\'échec par défaut',
      type: 'url',
      required: false,
      goesInConfigJson: true,
      placeholder: 'https://app.clenzy.fr/booking/error',
      helper: 'Page de retour après échec de paiement.',
    },
  ],
  PAYPAL: [
    {
      key: 'apiKey',
      label: 'Client ID',
      type: 'text',
      required: true,
      goesInConfigJson: false,
      topLevelKey: 'apiKey',
      helper: 'Client ID PayPal Business (REST API v2). Disponible dans developer.paypal.com → Apps & Credentials.',
    },
    {
      key: 'apiSecret',
      label: 'Client Secret',
      type: 'password',
      required: true,
      goesInConfigJson: false,
      topLevelKey: 'apiSecret',
      helper: 'Client Secret PayPal Business (gardez confidentiel). Laissez vide pour ne pas modifier.',
    },
    {
      key: 'webhookSecret',
      label: 'Webhook ID',
      type: 'password',
      required: false,
      goesInConfigJson: false,
      topLevelKey: 'webhookSecret',
      helper: 'Webhook ID PayPal (à créer dans developer.paypal.com → Webhooks). Utilisé pour la vérification des webhooks.',
    },
  ],
};

interface PaymentProviderConfigDialogProps {
  open: boolean;
  providerType: PaymentProviderType | null;
  /** Config actuelle (pour pre-remplir les non-secrets). null = vierge. */
  currentConfig: PaymentMethodConfig | null;
  onClose: () => void;
  onSave: (data: PaymentMethodConfigUpdate) => Promise<void>;
}

export default function PaymentProviderConfigDialog({
  open,
  providerType,
  currentConfig,
  onClose,
  onSave,
}: PaymentProviderConfigDialogProps) {
  const fields = useMemo(
    () => (providerType ? PROVIDER_FIELDS[providerType] : []),
    [providerType],
  );

  const [values, setValues] = useState<Record<string, string>>({});
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [sandboxMode, setSandboxMode] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-remplit les champs non-secrets depuis la config existante a l'ouverture.
  useEffect(() => {
    if (!open || !providerType) return;
    const initial: Record<string, string> = {};
    const existingConfigJson = (currentConfig?.config ?? {}) as Record<string, unknown>;
    fields.forEach((f) => {
      if (f.type === 'password') {
        // Les secrets ne sont jamais pre-remplis (API ne les renvoie pas dechiffres)
        initial[f.key] = '';
      } else if (f.goesInConfigJson) {
        const v = existingConfigJson[f.key];
        initial[f.key] = v != null ? String(v) : '';
      } else if (f.topLevelKey === 'apiKey' && f.type === 'text') {
        // Client ID CMI = non secret mais stocke en apiKeyEncrypted
        // → l'API ne le renvoie pas non plus en clair → start empty.
        initial[f.key] = '';
      } else {
        initial[f.key] = '';
      }
    });
    setValues(initial);
    setSandboxMode(currentConfig?.sandboxMode ?? true);
    setError(null);
    setShowSecret({});
  }, [open, providerType, currentConfig, fields]);

  if (!providerType) return null;

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const toggleShow = (key: string) => {
    setShowSecret((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const validate = (): string | null => {
    for (const f of fields) {
      if (!f.required) continue;
      // Les secrets sont OPTIONNELS a l'update si une valeur existe deja
      // (currentConfig.config[…] / currentConfig.id != null).
      // Pour une 1ere config (currentConfig?.id == undefined), tous les
      // required sont obligatoires.
      const isFirstSetup = !currentConfig || currentConfig.id == null;
      if (f.type === 'password' && !isFirstSetup) continue;
      if (!values[f.key] || values[f.key].trim() === '') {
        return `Le champ "${f.label}" est requis.`;
      }
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: PaymentMethodConfigUpdate = { sandboxMode };
      const configJsonPatch: Record<string, unknown> = {};
      fields.forEach((f) => {
        const v = values[f.key];
        if (!v || v.trim() === '') return; // skip empty fields (preserve existing)
        if (f.goesInConfigJson) {
          configJsonPatch[f.key] = f.type === 'number' ? Number(v) : v;
        } else if (f.topLevelKey) {
          payload[f.topLevelKey] = v;
        }
      });
      if (Object.keys(configJsonPatch).length > 0) {
        payload.configJson = configJsonPatch;
      }
      await onSave(payload);
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur inconnue';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: '12px' } }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.95rem',
          fontWeight: 700,
          letterSpacing: '-0.005em',
          pb: 1,
        }}
      >
        <Box>
          Configurer {PAYMENT_PROVIDER_LABELS[providerType]}
          <Typography
            component="span"
            sx={{ display: 'block', fontSize: '0.72rem', fontWeight: 400, color: 'text.secondary', mt: 0.25 }}
          >
            Renseignez les identifiants marchands. Les secrets sont chiffres avant stockage (AES-256-GCM).
          </Typography>
        </Box>
        <IconButton onClick={onClose} disabled={saving} size="small">
          <CloseIcon size={16} strokeWidth={2} />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {fields.length === 0 && (
          <Alert severity="info" sx={{ borderRadius: '8px', fontSize: '0.8rem' }}>
            Aucun parametre a configurer pour ce provider — utilisez le toggle pour l'activer / desactiver.
          </Alert>
        )}

        {fields.map((field) => {
          const isPassword = field.type === 'password';
          const showValue = isPassword ? !!showSecret[field.key] : true;
          return (
            <TextField
              key={field.key}
              label={field.label}
              type={field.type === 'select' ? undefined : (isPassword && !showValue ? 'password' : (field.type === 'number' ? 'number' : 'text'))}
              select={field.type === 'select'}
              value={values[field.key] ?? ''}
              onChange={(e) => handleChange(field.key, e.target.value)}
              helperText={field.helper}
              required={field.required}
              fullWidth
              size="small"
              placeholder={field.placeholder}
              disabled={saving}
              InputProps={isPassword ? {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => toggleShow(field.key)}
                      edge="end"
                      size="small"
                      tabIndex={-1}
                    >
                      {showValue ? <VisibilityOff size={16} /> : <Visibility size={16} />}
                    </IconButton>
                  </InputAdornment>
                ),
              } : undefined}
              sx={{
                '& .MuiOutlinedInput-root': { fontSize: '0.82rem' },
                '& .MuiInputLabel-root': { fontSize: '0.82rem' },
                '& .MuiFormHelperText-root': { fontSize: '0.68rem', mt: 0.25 },
              }}
            >
              {field.type === 'select' && field.options?.map((opt) => (
                <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.82rem' }}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
          );
        })}

        <FormControlLabel
          control={
            <Switch
              checked={sandboxMode}
              onChange={(e) => setSandboxMode(e.target.checked)}
              disabled={saving}
              size="small"
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: ACCENT },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: ACCENT },
              }}
            />
          }
          label={
            <Box>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
                Mode sandbox
              </Typography>
              <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>
                Activez en developpement ; desactivez pour la production (apres validation KYB).
              </Typography>
            </Box>
          }
          sx={{ alignItems: 'flex-start', mt: 0.5 }}
        />

        {error && (
          <Alert severity="error" sx={{ borderRadius: '8px', fontSize: '0.8rem' }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5, gap: 1 }}>
        <Button
          onClick={onClose}
          disabled={saving}
          size="small"
          sx={{
            textTransform: 'none',
            fontSize: '0.78rem',
            fontWeight: 600,
            borderRadius: '8px',
            color: NEUTRAL,
          }}
        >
          Annuler
        </Button>
        <Button
          variant="contained"
          size="small"
          onClick={handleSave}
          disabled={saving || fields.length === 0}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : undefined}
          sx={{
            textTransform: 'none',
            fontSize: '0.78rem',
            fontWeight: 600,
            borderRadius: '8px',
            bgcolor: ACCENT,
            color: '#fff',
            boxShadow: 'none',
            '&:hover': { bgcolor: ACCENT, filter: 'brightness(0.94)' },
          }}
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
