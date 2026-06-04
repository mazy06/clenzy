import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { KeyRound } from 'lucide-react';
import { tuyaApi, type TuyaConfigStatus } from '../../../services/api';

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        Configurer le projet Tuya Cloud
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Renseignez l'<strong>Access ID</strong> et l'<strong>Access Secret</strong> du projet cloud
          créé sur{' '}
          <Link href="https://iot.tuya.com" target="_blank" rel="noopener noreferrer">
            iot.tuya.com
          </Link>{' '}
          (Cloud → Development → votre projet → Authorization Key). Ils sont stockés chiffrés en base.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Access ID"
            value={accessId}
            onChange={(e) => setAccessId(e.target.value)}
            fullWidth
            autoComplete="off"
            disabled={saving}
          />
          <TextField
            label="Access Secret"
            value={accessSecret}
            onChange={(e) => setAccessSecret(e.target.value)}
            type="password"
            fullWidth
            autoComplete="new-password"
            disabled={saving}
            placeholder={alreadyConfigured ? '•••••••• (inchangé si laissé vide)' : undefined}
            helperText={
              alreadyConfigured
                ? 'Laissez vide pour conserver le secret déjà enregistré.'
                : undefined
            }
          />
          <TextField
            label="Data center"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            select
            fullWidth
            disabled={saving}
            helperText="Région du projet Tuya (doit correspondre à celle choisie sur iot.tuya.com)."
          >
            {DATA_CENTERS.map((dc) => (
              <MenuItem key={dc.value} value={dc.value}>
                {dc.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="App SDK schema (optionnel)"
            value={appSchema}
            onChange={(e) => setAppSchema(e.target.value)}
            fullWidth
            autoComplete="off"
            disabled={saving}
            helperText="Schema de l'App SDK Tuya (console → App → App SDK) — requis pour l'appairage mobile (modèle C). Laisser vide si non utilisé."
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ cursor: 'pointer' }}>
          Annuler
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={saving} sx={{ cursor: 'pointer' }}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
