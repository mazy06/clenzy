import React, { useRef, useState } from 'react';
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Field,
  FieldLabel,
  Input,
  Spinner,
} from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Business, DeleteOutline, Save, UploadFile } from '../../icons';
import { useNotification } from '../../hooks/useNotification';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { usersApi } from '../../services/api/usersApi';

/** Formats acceptés — mêmes que l'avatar, mêmes 5 Mo côté serveur. */
const ACCEPTED = 'image/jpeg,image/png,image/webp,image/gif';

/**
 * Raison sociale et logo de l'intervenant.
 *
 * <p>Les deux ressortent dans les documents générés : le nom via le tag
 * `${client.societe}` / `${technicien.societe}`, déjà câblé, et le logo via
 * `${logo_prestataire}`. C'est ce qui permet à un indépendant de facturer sous
 * sa propre enseigne plutôt que sous celle de la plateforme.</p>
 */
export default function MyCompanyCard() {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const { user } = useAuth();

  const [companyName, setCompanyName] = useState(user?.companyName ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Incrémenté après chaque dépôt : l'URL du logo est stable, seul ce jeton
  // force le navigateur à relire l'image au lieu de servir son cache.
  const [logoVersion, setLogoVersion] = useState(0);
  const [hasLogo, setHasLogo] = useState(user?.hasCompanyLogo ?? false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await usersApi.updateMyProfile({ companyName: companyName.trim() });
      notify.success(t('company.saved', 'Entreprise enregistrée'));
    } catch {
      setError(t('company.saveError', "L'enregistrement a échoué, réessayez."));
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      await usersApi.uploadMyCompanyLogo(file);
      setHasLogo(true);
      setLogoVersion((version) => version + 1);
      notify.success(t('company.logoSaved', 'Logo enregistré'));
    } catch {
      setError(t('company.logoError', "Le dépôt a échoué : formats JPEG, PNG, WEBP ou GIF, 5 Mo maximum."));
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    await usersApi.deleteMyCompanyLogo().catch(() => undefined);
    setHasLogo(false);
    setLogoVersion((version) => version + 1);
  };

  return (
    <Card size="sm" className="shadow-none">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Business size={16} strokeWidth={1.75} className="text-muted-foreground" />
          <p className="m-0 text-2xs font-bold uppercase tracking-wider text-faint">
            {t('company.title', 'Mon entreprise')}
          </p>
        </div>

        <p className="m-0 text-xs text-muted-foreground">
          {t('company.help',
            'Ces informations apparaissent sur les devis, factures et bons d’intervention générés par Baitly.')}
        </p>

        {error && (
          <Alert variant="destructive" className="py-1.5">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-3 min-[900px]:flex-row min-[900px]:items-end">
          <Field className="min-[900px]:max-w-[320px] min-[900px]:flex-1">
            <FieldLabel htmlFor="company-name">
              {t('company.name', 'Raison sociale')}
            </FieldLabel>
            <Input
              id="company-name"
              maxLength={200}
              placeholder={t('company.namePlaceholder', 'Ex. Mazy Rénovation')}
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
            />
          </Field>
          <Button variant="secondary" size="sm" onClick={save} disabled={saving}>
            {saving ? <Spinner className="size-4" /> : <Save size={16} strokeWidth={1.75} />}
            {t('company.save', 'Enregistrer')}
          </Button>
        </div>

        <div className="flex flex-col gap-2 border-t border-solid border-border pt-3">
          <p className="m-0 text-xs font-medium text-foreground">
            {t('company.logo', 'Logo')}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {/* `onError` en filet : l'état initial vient de `/me`, mais un
                binaire effacé hors application donnerait un 404 silencieux. */}
            {hasLogo && (
              <img
                src={usersApi.myCompanyLogoUrl(logoVersion)}
                alt={t('company.logoAlt', 'Logo de mon entreprise')}
                className="h-12 w-auto max-w-[180px] rounded-md border border-solid border-border bg-card object-contain p-1"
                onError={() => setHasLogo(false)}
              />
            )}
            {!hasLogo && (
              <span className="text-xs text-muted-foreground">
                {t('company.noLogo', 'Aucun logo déposé')}
              </span>
            )}

            <input
              ref={fileInput}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload(file);
                event.target.value = '';
              }}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
            >
              {uploading
                ? <Spinner className="size-4" />
                : <UploadFile size={16} strokeWidth={1.75} />}
              {hasLogo
                ? t('company.replaceLogo', 'Remplacer')
                : t('company.uploadLogo', 'Déposer un logo')}
            </Button>
            {hasLogo && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive-ink"
                aria-label={t('company.removeLogo', 'Retirer le logo')}
                onClick={removeLogo}
              >
                <DeleteOutline size={16} strokeWidth={1.75} />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
