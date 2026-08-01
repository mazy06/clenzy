import { useState, type CSSProperties } from 'react';
import { cn } from '../../../utils/cn';
import { Alert, AlertDescription } from '../../../components/ui';
import { Info, TriangleAlert } from 'lucide-react';
import { Spinner } from '../../../components/ui';
import { Button } from '../../../components/ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  NativeSelectOption,
} from '../../../components/ui';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from '../../../icons';
import { propertiesApi, type Property } from '../../../services/api/propertiesApi';
import { smartLockApi, type SmartLockBrand, type SmartLockAccessCodeMode } from '../../../services/api/smartLockApi';
import { useTranslation } from '../../../hooks/useTranslation';
import { noiseDevicesApi } from '../../../services/api/noiseApi';
import { keyExchangeApi } from '../../../services/api/keyExchangeApi';
import { camerasApi } from '../../../services/api/camerasApi';
import { thermostatsApi } from '../../../services/api/thermostatsApi';
import { environmentSensorsApi, type SensorType } from '../../../services/api/environmentSensorsApi';
import TuyaDevicePicker from './TuyaDevicePicker';
import NetatmoDevicePicker from './NetatmoDevicePicker';
import { DEVICE_KINDS } from '../deviceRegistry';
import type { DeviceKind } from '../types';

interface AddDeviceWizardProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  /** Pré-sélectionne un logement (ajout depuis la vue d'un logement). */
  defaultPropertyId?: number | null;
  /** Pré-sélectionne un type (ajout depuis un écran dédié) et saute l'étape 1. */
  defaultKind?: DeviceKind;
}

/** Types ajoutables + providers proposés (un seul flux pour tous). */
const ADDABLE: DeviceKind[] = [
  'lock', 'noise', 'keybox', 'camera', 'thermostat', 'climate', 'contact', 'motion', 'smoke',
];

/** Capteurs d'environnement (modèle backend générique EnvironmentSensor). */
const ENV_SENSOR_KINDS: DeviceKind[] = ['climate', 'contact', 'motion', 'smoke'];
const SENSOR_TYPE_BY_KIND: Partial<Record<DeviceKind, SensorType>> = {
  climate: 'TEMP_HUMIDITY', contact: 'CONTACT', motion: 'MOTION', smoke: 'SMOKE',
};

const PROVIDERS: Record<DeviceKind, { value: string; label: string }[]> = {
  lock: [
    { value: 'NUKI', label: 'Nuki' }, { value: 'TUYA', label: 'Tuya' },
    { value: 'TTLOCK', label: 'TTLock' }, { value: 'YALE', label: 'Yale' },
  ],
  noise: [{ value: 'MINUT', label: 'Minut' }, { value: 'TUYA', label: 'Tuya' }],
  keybox: [{ value: 'CLENZY_KEYVAULT', label: 'Baitly KeyVault' }, { value: 'KEYNEST', label: 'KeyNest' }],
  camera: [
    { value: 'GENERIC', label: 'Caméra IP (RTSP)' }, { value: 'TUYA', label: 'Tuya (cloud)' },
    { value: 'REOLINK', label: 'Reolink' },
    { value: 'TAPO', label: 'Tapo' }, { value: 'HIKVISION', label: 'Hikvision' }, { value: 'DAHUA', label: 'Dahua' },
  ],
  thermostat: [{ value: 'TUYA', label: 'Tuya' }, { value: 'NETATMO', label: 'Netatmo' }],
  // Temp/humidité : Tuya/Zigbee OU station météo Netatmo (temp + humidité + CO2 + bruit).
  climate: [{ value: 'TUYA', label: 'Tuya' }, { value: 'NETATMO', label: 'Netatmo' }],
  contact: [{ value: 'TUYA', label: 'Tuya' }, { value: 'NETATMO', label: 'Netatmo (door tag)' }],
  motion: [{ value: 'TUYA', label: 'Tuya' }],
  smoke: [{ value: 'TUYA', label: 'Tuya' }, { value: 'NETATMO', label: 'Netatmo' }],
};

export default function AddDeviceWizard({ open, onClose, onAdded, defaultPropertyId, defaultKind }: AddDeviceWizardProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(defaultKind ? 1 : 0);
  const [kind, setKind] = useState<DeviceKind | null>(defaultKind ?? null);
  const [provider, setProvider] = useState('');
  const [propertyId, setPropertyId] = useState<number | ''>(defaultPropertyId ?? '');
  const [name, setName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [externalDeviceId, setExternalDeviceId] = useState('');
  const [accessCodeMode, setAccessCodeMode] = useState<SmartLockAccessCodeMode>('PMS_GENERATED');
  const [rtspUrl, setRtspUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['co-properties'],
    queryFn: () => propertiesApi.getAll(),
    enabled: open,
  });

  const reset = () => {
    setStep(defaultKind ? 1 : 0); setKind(defaultKind ?? null); setProvider(''); setPropertyId(defaultPropertyId ?? '');
    setName(''); setRoomName(''); setExternalDeviceId(''); setRtspUrl(''); setError(null); setSubmitting(false);
  };
  const handleClose = () => { reset(); onClose(); };

  const canNext = (step === 0 && kind) || (step === 1 && provider)
    || (step === 2 && propertyId && name.trim()
        && (kind !== 'camera' || (provider === 'TUYA' ? externalDeviceId.trim() : rtspUrl.trim())));

  const submit = async () => {
    if (!kind || !provider || !propertyId || !name.trim()) return;
    setSubmitting(true); setError(null);
    try {
      if (kind === 'lock') {
        await smartLockApi.create({ name: name.trim(), propertyId, roomName: roomName || undefined, externalDeviceId: externalDeviceId || undefined, brand: provider as SmartLockBrand, accessCodeMode });
      } else if (kind === 'noise') {
        await noiseDevicesApi.create({ deviceType: provider, name: name.trim(), propertyId, roomName: roomName || undefined, externalDeviceId: externalDeviceId || undefined });
      } else if (kind === 'keybox') {
        await keyExchangeApi.createPoint({ propertyId, provider: provider as 'KEYNEST' | 'CLENZY_KEYVAULT', storeName: name.trim(), guardianType: 'INDIVIDUAL' });
      } else if (kind === 'camera') {
        await camerasApi.create({ name: name.trim(), propertyId, roomName: roomName || undefined, brand: provider,
          rtspUrl: provider === 'TUYA' ? undefined : rtspUrl.trim(),
          externalDeviceId: provider === 'TUYA' ? externalDeviceId.trim() : undefined });
      } else if (kind === 'thermostat') {
        await thermostatsApi.create({ name: name.trim(), propertyId, roomName: roomName || undefined, brand: provider, externalDeviceId: externalDeviceId || undefined });
      } else if (ENV_SENSOR_KINDS.includes(kind)) {
        await environmentSensorsApi.create({
          name: name.trim(), propertyId, roomName: roomName || undefined,
          sensorType: SENSOR_TYPE_BY_KIND[kind]!, brand: provider, externalDeviceId: externalDeviceId || undefined,
        });
      }
      onAdded();
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'ajouter l'objet. Vérifiez que le service est relié dans les Réglages.");
      setSubmitting(false);
    }
  };

  return (
    // maxWidth="sm" + fullWidth MUI = pleine largeur plafonnee a 600 px.
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <DialogContent className="w-full sm:max-w-[600px] max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Ajouter un objet connecté</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto">
        {/* Étape 1 — Type */}
        {step === 0 && (
          <div className="grid grid-cols-[repeat(auto-fit,_minmax(140px,_1fr))] gap-1.5 mt-1.5">
            {ADDABLE.map((k) => {
              const meta = DEVICE_KINDS[k];
              const selected = kind === k;
              return (
                // `meta.color` est une valeur runtime : elle passe par la variable
                // CSS `--kind-color` pour rester utilisable dans une classe (bordure
                // au survol, fond teinte) — une classe Tailwind ne peut pas naitre
                // d'une variable.
                <button
                  key={k}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => { setKind(k); setProvider(''); }}
                  style={{ '--kind-color': meta.color } as CSSProperties}
                  className={cn(
                    'p-[9px] rounded-[var(--radius-md)] cursor-pointer text-center',
                    'flex flex-col items-center gap-[4.5px] border border-solid',
                    'transition-[border-color,background-color] duration-150 hover:border-[var(--kind-color)]',
                    selected
                      ? 'border-[var(--kind-color)] bg-[color-mix(in_srgb,var(--kind-color)_8%,transparent)]'
                      : 'border-[var(--line)] bg-transparent',
                  )}
                >
                  <span className="inline-flex text-[var(--kind-color)]">{meta.icon(22)}</span>
                  <span className="cn-text-body2 font-semibold">{meta.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Étape 2 — Service / marque */}
        {step === 1 && kind && (
          <div className="mt-2">
            <Field>
              <FieldLabel htmlFor="wizard-provider">Service / marque</FieldLabel>
              <NativeSelect
                className="w-full"
                id="wizard-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
              >
                {/* Option vide explicite : un select natif afficherait sinon le
                    premier service alors qu'aucun n'est encore choisi. */}
                <NativeSelectOption value="">—</NativeSelectOption>
                {PROVIDERS[kind].map((p) => (
                  <NativeSelectOption key={p.value} value={p.value}>{p.label}</NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Alert variant="info" className="mt-2">
              <Info />
              <AlertDescription>Le service doit être relié dans <strong>Réglages → Services connectés</strong>pour piloter l'objet à distance.</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Étape 3 — Affectation */}
        {step === 2 && kind && (
          <div className="mt-2 flex flex-col gap-2">
            <Field>
              <FieldLabel htmlFor="wizard-property">Logement</FieldLabel>
              <NativeSelect
                className="w-full"
                id="wizard-property"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value === '' ? '' : Number(e.target.value))}
              >
                {/* Option vide explicite : un select natif afficherait sinon le
                    premier logement alors qu'aucun n'est encore affecte. */}
                <NativeSelectOption value="">—</NativeSelectOption>
                {properties.map((p) => (
                  <NativeSelectOption key={p.id} value={p.id}>{p.name}</NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="wizard-name">
                {kind === 'keybox' ? 'Nom du point' : "Nom de l'objet"}
              </FieldLabel>
              <Input
                id="wizard-name"
                className="w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            {kind !== 'keybox' && (
              <Field>
                <FieldLabel htmlFor="wizard-room">Pièce (optionnel)</FieldLabel>
                <Input
                  id="wizard-room"
                  className="w-full"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                />
              </Field>
            )}
            {kind === 'camera' && provider !== 'TUYA' && (
              <Field>
                <FieldLabel htmlFor="wizard-rtsp-url">URL du flux (RTSP recommandé)</FieldLabel>
                <Input
                  id="wizard-rtsp-url"
                  className="w-full"
                  required
                  placeholder="rtsp://user:pass@192.168.1.50:554/stream"
                  value={rtspUrl}
                  onChange={(e) => setRtspUrl(e.target.value)}
                />
                <FieldDescription>
                  RTSP recommandé : lecture directe et fluide. Une URL HTTP/HLS est transcodée (CPU, qualité réduite — pour test). Chiffré côté serveur.
                </FieldDescription>
              </Field>
            )}
            {kind === 'camera' && /^https?:\/\//i.test(rtspUrl.trim()) && (
              <Alert variant="warning" className="py-0.5">
                <TriangleAlert />
                <AlertDescription>URL HTTP/HLS : <strong>transcodée</strong>côté serveur (CPU, qualité réduite, latence) — à réserver au test.
                Préférez une URL <strong>RTSP</strong>pour une lecture directe et fluide.</AlertDescription>
              </Alert>
            )}
            {kind === 'camera' && provider === 'TUYA' && (
              <TuyaDevicePicker category="sp" selectedId={externalDeviceId} onSelect={setExternalDeviceId} />
            )}
            {(kind === 'lock' || kind === 'noise' || kind === 'thermostat' || ENV_SENSOR_KINDS.includes(kind)) && provider === 'TUYA' && (
              <TuyaDevicePicker category={kind === 'thermostat' ? 'wk' : undefined} selectedId={externalDeviceId} onSelect={setExternalDeviceId} />
            )}
            {kind === 'lock' && (
              <Field>
                <FieldLabel htmlFor="wizard-access-code-mode">
                  {t('connectedObjects.codeMode.label', "Origine du code d'accès")}
                </FieldLabel>
                <NativeSelect
                  className="w-full"
                  id="wizard-access-code-mode"
                  value={accessCodeMode}
                  onChange={(e) => setAccessCodeMode(e.target.value as SmartLockAccessCodeMode)}
                >
                  <NativeSelectOption value="PMS_GENERATED">{t('connectedObjects.codeMode.pms', 'Le PMS génère et pousse le code')}</NativeSelectOption>
                  <NativeSelectOption value="LOCK_GENERATED">{t('connectedObjects.codeMode.lock', 'La serrure génère le code')}</NativeSelectOption>
                </NativeSelect>
                <FieldDescription>
                  {accessCodeMode === 'PMS_GENERATED'
                    ? t('connectedObjects.codeMode.helperPms', 'Le code configuré dans le PMS est poussé à la serrure.')
                    : t('connectedObjects.codeMode.helperLock', 'La serrure génère son propre code ; le PMS le récupère.')}
                </FieldDescription>
              </Field>
            )}
            {kind === 'climate' && provider === 'NETATMO' && (
              <NetatmoDevicePicker source="weather" selectedId={externalDeviceId} onSelect={setExternalDeviceId} />
            )}
            {(kind === 'smoke' || kind === 'contact') && provider === 'NETATMO' && (
              <NetatmoDevicePicker source="security" selectedId={externalDeviceId} onSelect={setExternalDeviceId} />
            )}
            {kind === 'thermostat' && provider === 'NETATMO' && (
              <NetatmoDevicePicker source="thermostat" selectedId={externalDeviceId} onSelect={setExternalDeviceId} />
            )}
            {(kind === 'lock' || kind === 'noise' || kind === 'thermostat') && provider !== 'TUYA' && (
              <Field>
                <FieldLabel htmlFor="wizard-external-device-id">Identifiant externe (optionnel)</FieldLabel>
                <Input
                  id="wizard-external-device-id"
                  className="w-full"
                  value={externalDeviceId}
                  onChange={(e) => setExternalDeviceId(e.target.value)}
                />
                <FieldDescription>
                  {kind === 'thermostat' ? 'ID du device Tuya' : 'ID du device chez le fournisseur'}
                </FieldDescription>
              </Field>
            )}
            {error && <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>}
          </div>
        )}
        </div>
        {/* Trois niveaux dans la meme zone : « Annuler » abandonne (ghost),
            « Retour » navigue dans l'assistant et merite un cadre (outline),
            l'action de progression reste la seule encre pleine. */}
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>Annuler</Button>
          {step > 0 && <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={submitting}>Retour</Button>}
          {step < 2 ? (
            <Button variant="default" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              Continuer
              <ChevronRight size={16} strokeWidth={2} />
            </Button>
          ) : (
            <Button variant="default" disabled={!canNext || submitting} onClick={submit}>
              {submitting ? <Spinner className="size-3.5" /> : null}
              Ajouter
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
