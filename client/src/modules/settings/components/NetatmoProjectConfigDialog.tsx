import { useState, useEffect } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Link, TextField, Typography,
} from '@mui/material';
import { KeyRound } from 'lucide-react';
import { netatmoApi, type NetatmoConfigStatus } from '../../../services/api/netatmoApi';

/**
 * Dialog de configuration de l'<b>app Netatmo</b> (credentials OAuth plateforme) : Client ID +
 * Client Secret + Redirect URI. Stocké <b>chiffré en base</b> côté backend (PUT /api/netatmo/config),
 * donc modifiable sans redéploiement. Réservé aux SUPER_ADMIN / SUPER_MANAGER (gating onglet
 * Intégrations + backend). Calqué sur {@link TuyaProjectConfigDialog}.
 */

const DEFAULT_REDIRECT_URI = 'https://app.clenzy.fr/api/netatmo/callback';

interface Props {
  open: boolean;
  onClose: () => void;
  current?: NetatmoConfigStatus;
  onSaved: (status: NetatmoConfigStatus) => void;
}

export default function NetatmoProjectConfigDialog({ open, onClose, current, onSaved }: Props) {
  const alreadyConfigured = current?.configured ?? false;

  const [clientId, setClientId] = useState(current?.clientId ?? '');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState(current?.redirectUri ?? DEFAULT_REDIRECT_URI);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-synchronise depuis `current` à l'ouverture (le GET config peut charger après le montage).
  useEffect(() => {
    if (!open) return;
    setClientId(current?.clientId ?? '');
    setRedirectUri(current?.redirectUri || DEFAULT_REDIRECT_URI);
    setClientSecret('');
    setError(null);
  }, [open, current]);

  const handleSave = async () => {
    setError(null);
    if (!clientId.trim()) {
      setError('Le Client ID est obligatoire.');
      return;
    }
    if (!redirectUri.trim()) {
      setError("La Redirect URI est obligatoire.");
      return;
    }
    if (!alreadyConfigured && !clientSecret.trim()) {
      setError('Le Client Secret est obligatoire à la première configuration.');
      return;
    }
    setSaving(true);
    try {
      const status = await netatmoApi.saveConfig({
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim() || undefined,
        redirectUri: redirectUri.trim(),
      });
      onSaved(status);
      onClose();
    } catch {
      setError("Échec de l'enregistrement. Vérifiez les identifiants et réessayez.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
        <KeyRound size={18} />
        Configurer l'app Netatmo
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Renseignez le <strong>Client ID</strong> et le <strong>Client Secret</strong> de l'app créée sur{' '}
          <Link href="https://dev.netatmo.com/apps/" target="_blank" rel="noopener noreferrer">
            dev.netatmo.com
          </Link>
          . La <strong>Redirect URI</strong> doit être <u>identique</u> à celle déclarée dans l'app Netatmo.
          Les identifiants sont stockés chiffrés en base.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Client ID"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            fullWidth
            autoComplete="off"
            disabled={saving}
          />
          <TextField
            label="Client Secret"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            type="password"
            fullWidth
            autoComplete="new-password"
            disabled={saving}
            placeholder={alreadyConfigured ? '•••••••• (inchangé si laissé vide)' : undefined}
            helperText={alreadyConfigured ? 'Laissez vide pour conserver le secret déjà enregistré.' : undefined}
          />
          <TextField
            label="Redirect URI"
            value={redirectUri}
            onChange={(e) => setRedirectUri(e.target.value)}
            fullWidth
            autoComplete="off"
            disabled={saving}
            helperText="Doit correspondre exactement à l'URI de redirection déclarée dans l'app Netatmo."
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ cursor: 'pointer' }}>Annuler</Button>
        <Button onClick={handleSave} variant="contained" disabled={saving} sx={{ cursor: 'pointer' }}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
