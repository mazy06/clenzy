import { useRef, useState } from 'react';
import { cn } from '../../../utils/cn';
import { Alert, AlertDescription } from '../../../components/ui';
import { Info, TriangleAlert } from '../../../icons/glyphs';
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
  Skeleton,
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
import { baitlyIotApi, baitlyIotError, type BaitlyProvisioning, type CreateBaitlySensor } from '../../../services/api/baitlyIotApi';
import BaitlyProvisioningSecrets from './BaitlyProvisioningSecrets';
import { onboardingModels } from '../deviceOnboardingCatalog';
import DeviceModelGuide from './DeviceModelGuide';
import DeviceQrReader from './DeviceQrReader';

interface AddDeviceWizardProps {
  open: boolean;
  onClose: () => void;
  onAdded: (created?: { id: number; kind: DeviceKind; propertyId: number }) => void;
  /** Pré-sélectionne un logement (ajout depuis la vue d'un logement). */
  defaultPropertyId?: number | null;
  /** Pré-sélectionne un type (ajout depuis un écran dédié) et saute l'étape 1. */
  defaultKind?: DeviceKind;
  /** Pièce du parcours visuel, enregistrée par l'API avec l'appareil. */
  defaultRoomName?: string;
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

// `labelKey` quand le libelle est du texte (et non un nom de marque).
const PROVIDERS: Record<DeviceKind, { value: string; label?: string; labelKey?: string }[]> = {
  lock: [
    { value: 'NUKI', label: 'Nuki' }, { value: 'TUYA', label: 'Tuya' },
    { value: 'TTLOCK', label: 'TTLock' }, { value: 'YALE', label: 'Yale' },
  ],
  noise: [{ value: 'MINUT', label: 'Minut' }, { value: 'TUYA', label: 'Tuya' }],
  keybox: [{ value: 'CLENZY_KEYVAULT', label: 'Baitly KeyVault' }, { value: 'KEYNEST', label: 'KeyNest' }],
  camera: [
    { value: 'GENERIC', labelKey: 'connectedObjects.brands.genericIpCamera' }, { value: 'TUYA', label: 'Tuya (cloud)' },
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

export default function AddDeviceWizard({ open, onClose, onAdded, defaultPropertyId, defaultKind, defaultRoomName }: AddDeviceWizardProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(defaultKind ? 1 : 0);
  const [kind, setKind] = useState<DeviceKind | null>(defaultKind ?? null);
  const [provider, setProvider] = useState('');
  const [modelId, setModelId] = useState('');
  const [connection, setConnection] = useState<'integration' | 'internal'>('integration');
  // register = new physical device, attach = already registered in Baitly IoT, simulation = test tool.
  const [origin, setOrigin] = useState<'register' | 'attach' | 'simulation'>('register');
  const simulation = origin === 'simulation';
  const attempt = useRef<CreateBaitlySensor | null>(null);
  const [provisioned, setProvisioned] = useState<{ result: BaitlyProvisioning; created: { id: number; kind: DeviceKind; propertyId: number } } | null>(null);
  const [propertyId, setPropertyId] = useState<number | ''>(defaultPropertyId ?? '');
  const [name, setName] = useState('');
  const [roomName, setRoomName] = useState(defaultRoomName ?? '');
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
  const configuration = useQuery({ queryKey: ['baitly-iot-configuration'], queryFn: baitlyIotApi.configuration,
    enabled: open && connection === 'internal', retry: false });
  const internal = connection === 'internal';
  const selectedModel = kind ? onboardingModels(kind, provider).find(model => model.id === modelId) : undefined;
  const hasConnectionGuide = kind === 'keybox' || Boolean(selectedModel);
  const validExternalId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(externalDeviceId.trim());

  const reset = () => {
    setStep(defaultKind ? 1 : 0); setKind(defaultKind ?? null); setProvider(''); setModelId(''); setPropertyId(defaultPropertyId ?? '');
    setName(''); setRoomName(defaultRoomName ?? ''); setExternalDeviceId(''); setRtspUrl(''); setError(null); setSubmitting(false);
    setConnection('integration'); setOrigin('register'); attempt.current = null; setProvisioned(null);
  };
  const handleClose = () => {
    if (submitting) return;
    // The device exists once registered: closing the secret screen still reports it to the caller.
    if (provisioned) onAdded(provisioned.created);
    reset(); onClose();
  };

  const canNext = (step === 0 && kind) || (step === 1 && (internal ? kind === 'noise' && configuration.data?.configured : provider && hasConnectionGuide))
    || (step === 2 && propertyId && name.trim() && (internal || provider)
        && (internal || hasConnectionGuide && (kind === 'keybox' || externalDeviceId.trim()))
        && (!internal || kind === 'noise' && configuration.data?.configured
            && (origin === 'register' || origin === 'attach' && validExternalId || simulation && configuration.data.simulatorsEnabled))
        && (kind !== 'camera' || (provider === 'TUYA' ? externalDeviceId.trim() : rtspUrl.trim())));

  const submit = async () => {
    if (submitting || !canNext || !kind || !propertyId || !name.trim()) return;
    setSubmitting(true); setError(null);
    try {
      let created: { id: number; kind: DeviceKind; propertyId: number } | undefined;
      if (internal && kind === 'noise') {
        const input = { propertyId, name: name.trim(), roomName: roomName.trim() || undefined };
        if (origin !== 'attach') {
          // One requestId per attempt and its retries: the server reuses the same registration.
          if (!attempt.current || JSON.stringify(input) !== JSON.stringify({ propertyId: attempt.current.propertyId,
            name: attempt.current.name, roomName: attempt.current.roomName })) {
            attempt.current = { ...input, requestId: crypto.randomUUID() };
          }
        }
        if (origin === 'register') {
          const result = await baitlyIotApi.register(attempt.current!);
          setProvisioned({ result, created: { id: result.id, kind, propertyId } });
          setSubmitting(false);
          return;
        } else if (simulation) {
          const result = await baitlyIotApi.create(attempt.current!);
          created = { id: result.id, kind, propertyId };
        } else {
          const result = await baitlyIotApi.attach({ ...input, externalDeviceId: externalDeviceId.trim() });
          created = { id: result.id, kind, propertyId };
        }
      } else if (kind === 'lock') {
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
      onAdded(created);
      reset(); onClose();
    } catch (e) {
      setError(baitlyIotError(e, t('baitlyIot.actionError')));
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); }}>
      <DialogContent className="w-full sm:max-w-[600px] max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t('connectedObjects.wizard.title')}</DialogTitle>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {t('baitlyIot.onboarding.progress', { step: step + 1 })} · {t(`baitlyIot.onboarding.steps.${step}`)}
          </p>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto">
        {provisioned && <BaitlyProvisioningSecrets provisioning={provisioned.result} />}
        {/* Étape 1 — Type */}
        {!provisioned && step === 0 && (
          <div className="mt-1.5 grid gap-x-4 sm:grid-cols-2">
            {ADDABLE.map((k) => {
              const meta = DEVICE_KINDS[k];
              const selected = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => { setKind(k); setProvider(''); setModelId(''); setExternalDeviceId(''); setConnection('integration'); setOrigin('register'); setError(null); }}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 border-b border-border px-2 py-3 text-start',
                    'transition-colors duration-150 ease-out hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none',
                    selected ? 'bg-muted font-semibold' : 'bg-transparent',
                  )}
                >
                  <img src={`/images/connected-devices/baitly-${k}.webp`} alt="" width={36} height={36} className="size-9 object-contain" />
                  <span className="text-sm">{t(meta.labelKey)}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Étape 2 : le mode de connexion est distinct de la marque de l'objet. */}
        {!provisioned && step === 1 && kind && (
          <div className="mt-2 flex flex-col gap-3">
            <Field>
              <FieldLabel htmlFor="wizard-connection">{t('baitlyIot.onboarding.connection')}</FieldLabel>
              <NativeSelect id="wizard-connection" className="w-full" value={connection}
                onChange={event => { setConnection(event.target.value as 'integration' | 'internal'); setProvider(''); setModelId(''); setExternalDeviceId(''); setOrigin('register'); setError(null); }}>
                <NativeSelectOption value="integration">{t('baitlyIot.onboarding.integration')}</NativeSelectOption>
                <NativeSelectOption value="internal" disabled={kind !== 'noise'}>{t('baitlyIot.onboarding.direct')}</NativeSelectOption>
              </NativeSelect>
              {kind !== 'noise' && <FieldDescription>{t('baitlyIot.onboarding.unsupportedKind')}</FieldDescription>}
            </Field>
            {internal ? <>
              <p className="max-w-prose text-sm text-muted-foreground">{t('baitlyIot.onboarding.compatibility')}</p>
              <Field>
                <FieldLabel htmlFor="wizard-device-origin">{t('baitlyIot.onboarding.source')}</FieldLabel>
                <NativeSelect id="wizard-device-origin" className="w-full" value={origin}
                  onChange={event => { setOrigin(event.target.value as typeof origin); setError(null); }}>
                  <NativeSelectOption value="register">{t('baitlyIot.onboarding.register')}</NativeSelectOption>
                  <NativeSelectOption value="attach">{t('baitlyIot.onboarding.physical')}</NativeSelectOption>
                  {configuration.data?.simulatorsEnabled && <NativeSelectOption value="simulation">{t('baitlyIot.onboarding.simulator')}</NativeSelectOption>}
                </NativeSelect>
              </Field>
              <p className="text-xs text-muted-foreground">{t(simulation ? 'baitlyIot.simulationHint'
                : origin === 'register' ? 'baitlyIot.onboarding.registerHint' : 'baitlyIot.onboarding.physicalHint')}</p>
              {configuration.isLoading && <Skeleton className="h-12 w-full" />}
              {(configuration.isError || configuration.data && !configuration.data.configured) && <Alert variant="destructive">
                <AlertDescription>{t(configuration.isError ? 'baitlyIot.loadError' : 'baitlyIot.notConfigured')}
                  <Button variant="ghost" size="sm" onClick={() => { void configuration.refetch(); }}>{t('common.retry')}</Button>
                </AlertDescription>
              </Alert>}
            </> : <>
            {kind !== 'keybox' && <p className="text-xs text-muted-foreground">{t('deviceOnboarding.scope')}</p>}
            <Field>
              <FieldLabel htmlFor="wizard-provider">{t('baitlyIot.onboarding.brandOrService')}</FieldLabel>
              <NativeSelect
                className="w-full"
                id="wizard-provider"
                value={provider}
                onChange={(e) => { setProvider(e.target.value); setModelId(''); setExternalDeviceId(''); setError(null); }}
              >
                {/* Option vide explicite : un select natif afficherait sinon le
                    premier service alors qu'aucun n'est encore choisi. */}
                <NativeSelectOption value="">—</NativeSelectOption>
                {PROVIDERS[kind].map((p) => (
                  <NativeSelectOption key={p.value} value={p.value}>
                    {p.labelKey ? t(p.labelKey) : p.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            {provider && kind !== 'keybox' && <DeviceModelGuide kind={kind} provider={provider} modelId={modelId}
              onChange={id => { setModelId(id); setExternalDeviceId(''); setError(null); }} />}
            {kind !== 'keybox' && <DeviceQrReader onHint={hint => {
              const identified = hint === 'tuya' && PROVIDERS[kind].some(item => item.value === 'TUYA');
              setProvider(identified ? 'TUYA' : ''); setModelId(''); setExternalDeviceId(''); setError(null);
            }} />}
            {kind === 'keybox' && <Alert variant="info" className="mt-2">
              <Info />
              <AlertDescription>{t('connectedObjects.wizard.serviceRequired')} <strong>{t('connectedObjects.wizard.settingsPath')}</strong> {t('connectedObjects.wizard.serviceRequiredTail')}</AlertDescription>
            </Alert>}
            </>}
          </div>
        )}

        {/* Étape 3 — Affectation */}
        {!provisioned && step === 2 && kind && (
          <div className="mt-2 flex flex-col gap-2">
            {!internal && selectedModel && <p className="text-xs text-muted-foreground">
              {provider === 'MINUT' ? 'Minut' : 'Nuki'} · {selectedModel.label}. {t('deviceOnboarding.attachmentReminder')}
            </p>}
            <Field>
              <FieldLabel htmlFor="wizard-property">{t('baitlyIot.property')}</FieldLabel>
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
                {t(kind === 'keybox'
                  ? 'connectedObjects.wizard.pointName'
                  : 'connectedObjects.wizard.deviceName')}
              </FieldLabel>
              <Input
                id="wizard-name"
                className="w-full"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            {kind !== 'keybox' && (
              <Field>
                <FieldLabel htmlFor="wizard-room">{t('connectedObjects.wizard.room')}</FieldLabel>
                <Input
                  id="wizard-room"
                  className="w-full"
                  value={roomName}
                  maxLength={120}
                  onChange={(e) => setRoomName(e.target.value)}
                />
              </Field>
            )}
            {kind === 'camera' && provider !== 'TUYA' && (
              <Field>
                <FieldLabel htmlFor="wizard-rtsp-url">{t('connectedObjects.wizard.streamUrl')}</FieldLabel>
                <Input
                  id="wizard-rtsp-url"
                  className="w-full"
                  required
                  placeholder="rtsp://user:pass@192.168.1.50:554/stream"
                  value={rtspUrl}
                  onChange={(e) => setRtspUrl(e.target.value)}
                />
                <FieldDescription>
                  {t('connectedObjects.wizard.streamHint')}
                </FieldDescription>
              </Field>
            )}
            {kind === 'camera' && /^https?:\/\//i.test(rtspUrl.trim()) && (
              <Alert variant="warning" className="py-0.5">
                <TriangleAlert />
                <AlertDescription>{t('connectedObjects.wizard.httpWarnHead')} <strong>{t('connectedObjects.wizard.transcoded')}</strong> {t('connectedObjects.wizard.transcodedHint')} <strong>RTSP</strong> {t('connectedObjects.wizard.httpWarnTail')}</AlertDescription>
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
            {internal && <>
              <p className="text-xs text-muted-foreground">{t(simulation ? 'baitlyIot.simulationHint'
                : origin === 'register' ? 'baitlyIot.onboarding.registerHint' : 'baitlyIot.onboarding.attachmentHint')}</p>
              {origin === 'attach' && <Field>
                <FieldLabel htmlFor="wizard-internal-id">{t('baitlyIot.onboarding.deviceId')}</FieldLabel>
                <Input id="wizard-internal-id" dir="ltr" value={externalDeviceId} maxLength={36}
                  onChange={event => setExternalDeviceId(event.target.value)} aria-describedby="wizard-internal-id-hint" />
                <FieldDescription id="wizard-internal-id-hint">{t('baitlyIot.onboarding.deviceIdHint')}</FieldDescription>
              </Field>}
            </>}
            {!internal && (kind === 'lock' || kind === 'noise' || kind === 'thermostat') && provider !== 'TUYA' && (
              <Field>
                <FieldLabel htmlFor="wizard-external-device-id">{t(selectedModel ? 'deviceOnboarding.deviceId' : 'connectedObjects.wizard.externalId')}</FieldLabel>
                <Input
                  id="wizard-external-device-id"
                  className="w-full"
                  value={externalDeviceId}
                  required={Boolean(selectedModel)}
                  maxLength={120}
                  onChange={(e) => setExternalDeviceId(e.target.value)}
                />
                <FieldDescription>
                  {t(kind === 'thermostat'
                    ? 'connectedObjects.wizard.externalIdTuya'
                    : 'connectedObjects.wizard.externalIdProvider')}
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
        {provisioned ? <DialogFooter>
          <Button variant="default" onClick={handleClose}>{t('baitlyIot.provisioned.done')}</Button>
        </DialogFooter> : <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>{t('common.cancel')}</Button>
          {step > 0 && <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={submitting}>{t('common.back')}</Button>}
          {step < 2 ? (
            <Button variant="default" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              {t('common.continue')}
              <ChevronRight className="cn-rtl-flip" size={16} strokeWidth={2} />
            </Button>
          ) : (
            <Button variant="default" disabled={!canNext || submitting} onClick={submit}>
              {submitting ? <Spinner className="size-3.5" /> : null}
              {t(internal && simulation ? 'baitlyIot.onboarding.addSimulator'
                : internal && origin === 'register' ? 'baitlyIot.onboarding.registerAction' : 'baitlyIot.onboarding.attach')}
            </Button>
          )}
        </DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
