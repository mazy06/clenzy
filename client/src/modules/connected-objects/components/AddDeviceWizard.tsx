import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Box, Typography, Paper, Alert, CircularProgress, alpha, useTheme,
} from '@mui/material';
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
  const theme = useTheme();
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
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>Ajouter un objet connecté</DialogTitle>
      <DialogContent>
        {/* Étape 1 — Type */}
        {step === 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 1, mt: 1 }}>
            {ADDABLE.map((k) => {
              const meta = DEVICE_KINDS[k];
              const selected = kind === k;
              return (
                <Paper
                  key={k}
                  variant="outlined"
                  onClick={() => { setKind(k); setProvider(''); }}
                  sx={{
                    p: 1.5, borderRadius: 1.5, cursor: 'pointer', textAlign: 'center',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75,
                    borderColor: selected ? meta.color : 'divider',
                    bgcolor: selected ? alpha(meta.color, 0.08) : 'transparent',
                    transition: 'border-color 150ms, background-color 150ms',
                    '&:hover': { borderColor: meta.color },
                  }}
                >
                  <Box sx={{ color: meta.color, display: 'inline-flex' }}>{meta.icon(22)}</Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{meta.label}</Typography>
                </Paper>
              );
            })}
          </Box>
        )}

        {/* Étape 2 — Service / marque */}
        {step === 1 && kind && (
          <Box sx={{ mt: 1.5 }}>
            <TextField
              select fullWidth size="small" label="Service / marque" value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              {PROVIDERS[kind].map((p) => (
                <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
              ))}
            </TextField>
            <Alert severity="info" sx={{ mt: 1.5 }}>
              Le service doit être relié dans <strong>Réglages → Services connectés</strong> pour piloter l'objet à distance.
            </Alert>
          </Box>
        )}

        {/* Étape 3 — Affectation */}
        {step === 2 && kind && (
          <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <TextField
              select fullWidth size="small" label="Logement" value={propertyId}
              onChange={(e) => setPropertyId(Number(e.target.value))}
            >
              {properties.map((p) => (
                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
              ))}
            </TextField>
            <TextField fullWidth size="small" label={kind === 'keybox' ? 'Nom du point' : "Nom de l'objet"} value={name} onChange={(e) => setName(e.target.value)} />
            {kind !== 'keybox' && (
              <TextField fullWidth size="small" label="Pièce (optionnel)" value={roomName} onChange={(e) => setRoomName(e.target.value)} />
            )}
            {kind === 'camera' && provider !== 'TUYA' && (
              <TextField
                fullWidth size="small" required label="URL du flux (RTSP recommandé)"
                placeholder="rtsp://user:pass@192.168.1.50:554/stream"
                helperText="RTSP recommandé : lecture directe et fluide. Une URL HTTP/HLS est transcodée (CPU, qualité réduite — pour test). Chiffré côté serveur."
                value={rtspUrl} onChange={(e) => setRtspUrl(e.target.value)}
              />
            )}
            {kind === 'camera' && /^https?:\/\//i.test(rtspUrl.trim()) && (
              <Alert severity="warning" sx={{ py: 0.25 }}>
                URL HTTP/HLS : <strong>transcodée</strong> côté serveur (CPU, qualité réduite, latence) — à réserver au test.
                Préférez une URL <strong>RTSP</strong> pour une lecture directe et fluide.
              </Alert>
            )}
            {kind === 'camera' && provider === 'TUYA' && (
              <TuyaDevicePicker category="sp" selectedId={externalDeviceId} onSelect={setExternalDeviceId} />
            )}
            {(kind === 'lock' || kind === 'noise' || kind === 'thermostat' || ENV_SENSOR_KINDS.includes(kind)) && provider === 'TUYA' && (
              <TuyaDevicePicker category={kind === 'thermostat' ? 'wk' : undefined} selectedId={externalDeviceId} onSelect={setExternalDeviceId} />
            )}
            {kind === 'lock' && (
              <TextField
                select fullWidth size="small" label={t('connectedObjects.codeMode.label', "Origine du code d'accès")}
                value={accessCodeMode}
                onChange={(e) => setAccessCodeMode(e.target.value as SmartLockAccessCodeMode)}
                helperText={accessCodeMode === 'PMS_GENERATED'
                  ? t('connectedObjects.codeMode.helperPms', 'Le code configuré dans le PMS est poussé à la serrure.')
                  : t('connectedObjects.codeMode.helperLock', 'La serrure génère son propre code ; le PMS le récupère.')}
              >
                <MenuItem value="PMS_GENERATED">{t('connectedObjects.codeMode.pms', 'Le PMS génère et pousse le code')}</MenuItem>
                <MenuItem value="LOCK_GENERATED">{t('connectedObjects.codeMode.lock', 'La serrure génère le code')}</MenuItem>
              </TextField>
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
              <TextField
                fullWidth size="small" label="Identifiant externe (optionnel)"
                helperText={kind === 'thermostat' ? 'ID du device Tuya' : 'ID du device chez le fournisseur'}
                value={externalDeviceId} onChange={(e) => setExternalDeviceId(e.target.value)}
              />
            )}
            {error && <Alert severity="error">{error}</Alert>}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} color="inherit">Annuler</Button>
        {step > 0 && <Button onClick={() => setStep((s) => s - 1)} disabled={submitting}>Retour</Button>}
        {step < 2 ? (
          <Button variant="contained" disabled={!canNext} endIcon={<ChevronRight size={16} strokeWidth={2} />} onClick={() => setStep((s) => s + 1)}>
            Continuer
          </Button>
        ) : (
          <Button variant="contained" disabled={!canNext || submitting} startIcon={submitting ? <CircularProgress size={14} /> : undefined} onClick={submit}>
            Ajouter
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
