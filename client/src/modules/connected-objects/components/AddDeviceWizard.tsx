import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem,
  Box, Typography, Paper, Alert, CircularProgress, alpha, useTheme,
} from '@mui/material';
import { ChevronRight } from '../../../icons';
import { propertiesApi, type Property } from '../../../services/api/propertiesApi';
import { smartLockApi, type SmartLockBrand } from '../../../services/api/smartLockApi';
import { noiseDevicesApi } from '../../../services/api/noiseApi';
import { keyExchangeApi } from '../../../services/api/keyExchangeApi';
import { DEVICE_KINDS } from '../deviceRegistry';
import type { DeviceKind } from '../types';

interface AddDeviceWizardProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
  /** Pré-sélectionne un logement (ajout depuis la vue d'un logement). */
  defaultPropertyId?: number | null;
}

/** Types ajoutables + providers proposés (un seul flux pour tous). */
const ADDABLE: DeviceKind[] = ['lock', 'noise', 'keybox'];

const PROVIDERS: Record<DeviceKind, { value: string; label: string }[]> = {
  lock: [
    { value: 'NUKI', label: 'Nuki' }, { value: 'TUYA', label: 'Tuya' },
    { value: 'TTLOCK', label: 'TTLock' }, { value: 'YALE', label: 'Yale' },
  ],
  noise: [{ value: 'MINUT', label: 'Minut' }, { value: 'TUYA', label: 'Tuya' }],
  keybox: [{ value: 'CLENZY_KEYVAULT', label: 'Baitly KeyVault' }, { value: 'KEYNEST', label: 'KeyNest' }],
  camera: [],
  thermostat: [],
};

export default function AddDeviceWizard({ open, onClose, onAdded, defaultPropertyId }: AddDeviceWizardProps) {
  const theme = useTheme();
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<DeviceKind | null>(null);
  const [provider, setProvider] = useState('');
  const [propertyId, setPropertyId] = useState<number | ''>(defaultPropertyId ?? '');
  const [name, setName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [externalDeviceId, setExternalDeviceId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['co-properties'],
    queryFn: () => propertiesApi.getAll(),
    enabled: open,
  });

  const reset = () => {
    setStep(0); setKind(null); setProvider(''); setPropertyId(defaultPropertyId ?? '');
    setName(''); setRoomName(''); setExternalDeviceId(''); setError(null); setSubmitting(false);
  };
  const handleClose = () => { reset(); onClose(); };

  const canNext = (step === 0 && kind) || (step === 1 && provider) || (step === 2 && propertyId && name.trim());

  const submit = async () => {
    if (!kind || !provider || !propertyId || !name.trim()) return;
    setSubmitting(true); setError(null);
    try {
      if (kind === 'lock') {
        await smartLockApi.create({ name: name.trim(), propertyId, roomName: roomName || undefined, externalDeviceId: externalDeviceId || undefined, brand: provider as SmartLockBrand });
      } else if (kind === 'noise') {
        await noiseDevicesApi.create({ deviceType: provider, name: name.trim(), propertyId, roomName: roomName || undefined, externalDeviceId: externalDeviceId || undefined });
      } else if (kind === 'keybox') {
        await keyExchangeApi.createPoint({ propertyId, provider: provider as 'KEYNEST' | 'CLENZY_KEYVAULT', storeName: name.trim(), guardianType: 'INDIVIDUAL' });
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
              <>
                <TextField fullWidth size="small" label="Pièce (optionnel)" value={roomName} onChange={(e) => setRoomName(e.target.value)} />
                <TextField fullWidth size="small" label="Identifiant externe (optionnel)" helperText="ID du device chez le fournisseur" value={externalDeviceId} onChange={(e) => setExternalDeviceId(e.target.value)} />
              </>
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
