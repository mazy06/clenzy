import { useState, useEffect } from 'react';
import {
  Alert,
  AlertDescription,
  Button,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  NativeSelectOption,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Separator,
} from '../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { KeyRound } from 'lucide-react';
import { tuyaApi, type TuyaConfigStatus } from '../../../services/api/noiseApi';

/**
 * Dialog de configuration du <b>projet Tuya Cloud</b> (credentials plateforme) : Access ID + Access
 * Secret + data center. Stocké chiffré en base côté backend (PUT /api/tuya/config), donc modifiable
 * sans redéploiement. Réservé aux SUPER_ADMIN / SUPER_MANAGER (gating onglet Intégrations + backend).
 */

interface DataCenter {
  value: string;
  label: string;
  baseUrl: string;
}

// Data centers Tuya (region = value). cf. https://developer.tuya.com/en/docs/iot/api-request
const DATA_CENTERS: DataCenter[] = [
  { value: 'eu', label: 'Europe centrale (EU)', baseUrl: 'https://openapi.tuyaeu.com' },
  { value: 'us', label: "Amérique de l'Ouest (US)", baseUrl: 'https://openapi.tuyaus.com' },
  { value: 'cn', label: 'Chine', baseUrl: 'https://openapi.tuyacn.com' },
  { value: 'in', label: 'Inde', baseUrl: 'https://openapi.tuyain.com' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  current?: TuyaConfigStatus;
  onSaved: (status: TuyaConfigStatus) => void;
}

export default function TuyaProjectConfigDialog({ open, onClose, current, onSaved }: Props) {
  const alreadyConfigured = current?.configured ?? false;

  const [accessId, setAccessId] = useState(current?.accessId ?? '');
  const [accessSecret, setAccessSecret] = useState('');
  const [region, setRegion] = useState(current?.region ?? 'eu');
  const [appSchema, setAppSchema] = useState(current?.appSchema ?? '');
  const [appKey, setAppKey] = useState(current?.appKey ?? '');
  const [appSecret, setAppSecret] = useState('');
  const [androidAppKey, setAndroidAppKey] = useState(current?.androidAppKey ?? '');
  const [androidAppSecret, setAndroidAppSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-synchronise les champs depuis `current` a chaque ouverture du dialog : `current` (GET config)
  // peut charger APRES le montage initial -> sans ca les valeurs deja enregistrees ne s'affichent pas
  // et la sauvegarde echoue (« Access ID obligatoire »). Les secrets restent vides (= inchanges).
  useEffect(() => {
    if (!open) return;
    setAccessId(current?.accessId ?? '');
    setRegion(current?.region ?? 'eu');
    setAppSchema(current?.appSchema ?? '');
    setAppKey(current?.appKey ?? '');
    setAndroidAppKey(current?.androidAppKey ?? '');
    setAccessSecret('');
    setAppSecret('');
    setAndroidAppSecret('');
    setError(null);
  }, [open, current]);

  const handleSave = async () => {
    setError(null);
    if (!accessId.trim()) {
      setError("L'Access ID est obligatoire.");
      return;
    }
    // À la première configuration, le secret est requis ; en modification on peut le laisser vide.
    if (!alreadyConfigured && !accessSecret.trim()) {
      setError("L'Access Secret est obligatoire à la première configuration.");
      return;
    }
    const dc = DATA_CENTERS.find((d) => d.value === region) ?? DATA_CENTERS[0];
    setSaving(true);
    try {
      const status = await tuyaApi.saveConfig({
        accessId: accessId.trim(),
        accessSecret: accessSecret.trim() || undefined,
        baseUrl: dc.baseUrl,
        region: dc.value,
        appSchema: appSchema.trim() || undefined,
        appKey: appKey.trim() || undefined,
        appSecret: appSecret.trim() || undefined,
        androidAppKey: androidAppKey.trim() || undefined,
        androidAppSecret: androidAppSecret.trim() || undefined,
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
    <Dialog open={open} onOpenChange={(next) => { if (!next && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5 font-semibold">
            <KeyRound size={18} />
            Configurer le projet Tuya Cloud
          </DialogTitle>
          {/* Le texte d'explication devient la description du dialog : il en
              porte deja le role, et Radix l'associe alors via aria-describedby. */}
          <DialogDescription className="text-xs">
            Renseignez l'<strong>Access ID</strong> et l'<strong>Access Secret</strong> du projet cloud
            créé sur{' '}
            <a
              href="https://iot.tuya.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary-deep"
            >
              iot.tuya.com
            </a>{' '}
            (Cloud → Development → votre projet → Authorization Key). Ils sont stockés chiffrés en base.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mb-3">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="tuya-access-id">Access ID</FieldLabel>
            <Input
              id="tuya-access-id"
              value={accessId}
              onChange={(e) => setAccessId(e.target.value)}
              autoComplete="off"
              disabled={saving}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="tuya-access-secret">Access Secret</FieldLabel>
            <Input
              id="tuya-access-secret"
              value={accessSecret}
              onChange={(e) => setAccessSecret(e.target.value)}
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
            <FieldLabel htmlFor="tuya-region">Data center</FieldLabel>
            <NativeSelect
              id="tuya-region"
              className="w-full"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              disabled={saving}
            >
              {DATA_CENTERS.map((dc) => (
                <NativeSelectOption key={dc.value} value={dc.value}>
                  {dc.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldDescription>
              Région du projet Tuya (doit correspondre à celle choisie sur iot.tuya.com).
            </FieldDescription>
          </Field>
          <Separator className="mt-0.5" />
          <p className="text-2xs font-semibold text-muted-foreground">
            App SDK mobile (appairage — modèle C)
          </p>
          <Field>
            <FieldLabel htmlFor="tuya-app-schema">App SDK schema (optionnel)</FieldLabel>
            <Input
              id="tuya-app-schema"
              value={appSchema}
              onChange={(e) => setAppSchema(e.target.value)}
              autoComplete="off"
              disabled={saving}
            />
            <FieldDescription>
              Schema de l'App SDK Tuya (console → App → App SDK) — requis pour l'appairage mobile.
              Laisser vide si non utilisé.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="tuya-app-key-ios">AppKey iOS (App SDK)</FieldLabel>
            <Input
              id="tuya-app-key-ios"
              value={appKey}
              onChange={(e) => setAppKey(e.target.value)}
              autoComplete="off"
              disabled={saving}
            />
            <FieldDescription>
              AppKey iOS de l'App SDK Tuya (console → App → Get Key → iOS).
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="tuya-app-secret-ios">AppSecret iOS (App SDK)</FieldLabel>
            <Input
              id="tuya-app-secret-ios"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              type="password"
              autoComplete="new-password"
              disabled={saving}
              placeholder={current?.appKey ? '•••••••• (inchangé si laissé vide)' : undefined}
            />
            <FieldDescription>
              Laisser vide pour conserver l'AppSecret iOS déjà enregistré.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="tuya-app-key-android">AppKey Android (App SDK)</FieldLabel>
            <Input
              id="tuya-app-key-android"
              value={androidAppKey}
              onChange={(e) => setAndroidAppKey(e.target.value)}
              autoComplete="off"
              disabled={saving}
            />
            <FieldDescription>
              AppKey Android de l'App SDK Tuya (console → App → Get Key → Android) — distinct de l'iOS.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="tuya-app-secret-android">AppSecret Android (App SDK)</FieldLabel>
            <Input
              id="tuya-app-secret-android"
              value={androidAppSecret}
              onChange={(e) => setAndroidAppSecret(e.target.value)}
              type="password"
              autoComplete="new-password"
              disabled={saving}
              placeholder={current?.androidAppKey ? '•••••••• (inchangé si laissé vide)' : undefined}
            />
            <FieldDescription>
              Laisser vide pour conserver l'AppSecret Android déjà enregistré.
            </FieldDescription>
          </Field>
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="ghost" disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
