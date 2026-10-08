import { useState, useEffect } from 'react';
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
} from '../../../components/ui';
import { TriangleAlert } from '../../../icons/glyphs';
import { KeyRound } from '../../../icons/glyphs';
import { netatmoApi, type NetatmoConfigStatus } from '../../../services/api/netatmoApi';
import { useTranslation } from '../../../hooks/useTranslation';

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
  const { t } = useTranslation();
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
      setError(t('iot.clientIdRequired'));
      return;
    }
    if (!redirectUri.trim()) {
      setError(t('iot.redirectUriRequired'));
      return;
    }
    if (!alreadyConfigured && !clientSecret.trim()) {
      setError(t('iot.clientSecretRequiredFirst'));
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
          <DialogTitle className="flex items-center gap-1.5 font-semibold">
            <KeyRound size={18} />
            Configurer l'app Netatmo
          </DialogTitle>
          {/* Le texte d'explication devient la description du dialog : il en
              porte deja le role, et Radix l'associe alors via aria-describedby. */}
          <DialogDescription className="text-xs">
            {t('settings.netatmo.introHead')} <strong>{t('settings.netatmo.clientId')}</strong> {t('settings.netatmo.and')} <strong>{t('settings.netatmo.clientSecret')}</strong>{' '}
            {t('settings.netatmo.introTail')}{' '}
            <a
              href="https://dev.netatmo.com/apps/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary"
            >
              dev.netatmo.com
            </a>
            . {t('settings.netatmo.theArticle')} <strong>{t('settings.netatmo.redirectUri')}</strong> {t('settings.netatmo.mustBe')} <u>{t('settings.netatmo.identical')}</u>{' '}
            {t('settings.netatmo.identicalTail')}
          </DialogDescription>
        </DialogHeader>

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
              placeholder={alreadyConfigured ? t('common.unchangedIfEmpty') : undefined}
            />
            {alreadyConfigured && (
              <FieldDescription>{t('settings.netatmo.keepSecret')}</FieldDescription>
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
              {t('settings.netatmo.redirectUriHint')}
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
