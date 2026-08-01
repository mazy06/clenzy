import { useState, useEffect } from 'react';
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
} from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
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
    // maxWidth="sm" MUI = 600 px. L'enregistrement en cours verrouille la fermeture.
    <Dialog open={open} onOpenChange={(next) => { if (!next && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-[6px] font-bold">
            <KeyRound size={18} />
            Configurer l'app Netatmo
          </DialogTitle>
        </DialogHeader>
        <p className="cn-text-body2 text-muted-foreground mb-3">
          Renseignez le <strong>Client ID</strong> et le <strong>Client Secret</strong> de l'app créée sur{' '}
          <a
            href="https://dev.netatmo.com/apps/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--mui-primary)] underline underline-offset-2"
          >
            dev.netatmo.com
          </a>
          . La <strong>Redirect URI</strong> doit être <u>identique</u> à celle déclarée dans l'app Netatmo.
          Les identifiants sont stockés chiffrés en base.
        </p>

        {error && <Alert variant="destructive" className="mb-3">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>}

        <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="netatmo-client-id">Client ID</FieldLabel>
            <Input
              id="netatmo-client-id"
              className="w-full"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              autoComplete="off"
              disabled={saving}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="netatmo-client-secret">Client Secret</FieldLabel>
            <Input
              id="netatmo-client-secret"
              className="w-full"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              type="password"
              autoComplete="new-password"
              disabled={saving}
              placeholder={alreadyConfigured ? '•••••••• (inchangé si laissé vide)' : undefined}
            />
            {alreadyConfigured && (
              <FieldDescription>Laissez vide pour conserver le secret déjà enregistré.</FieldDescription>
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="netatmo-redirect-uri">Redirect URI</FieldLabel>
            <Input
              id="netatmo-redirect-uri"
              className="w-full"
              value={redirectUri}
              onChange={(e) => setRedirectUri(e.target.value)}
              autoComplete="off"
              disabled={saving}
            />
            <FieldDescription>
              Doit correspondre exactement à l'URI de redirection déclarée dans l'app Netatmo.
            </FieldDescription>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
