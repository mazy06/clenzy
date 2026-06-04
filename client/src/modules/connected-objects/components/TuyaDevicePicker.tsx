import { useQuery } from '@tanstack/react-query';
import { Box, TextField, MenuItem, Alert, CircularProgress, Typography } from '@mui/material';
import { tuyaApi } from '../../../services/api';
import DevicePairingGuide from './DevicePairingGuide';

interface TuyaDevicePickerProps {
  /** Filtre par catégorie Tuya (ex: 'sp' caméra, 'wk' thermostat). Si le filtre ne ramène rien, on montre tout. */
  category?: string;
  selectedId: string;
  onSelect: (deviceId: string) => void;
}

/**
 * Sélecteur d'appareils découverts sur le compte Tuya relié de l'organisation (plug-and-play).
 * Remplace la saisie manuelle d'un device_id : interroge {@code tuyaApi.listDevices()}, filtre par
 * catégorie selon le type d'objet, et renvoie le device_id choisi. Org-scopé côté backend
 * (listOrgDevices). NON VALIDÉ faute de compte Tuya réel.
 */
export default function TuyaDevicePicker({ category, selectedId, onSelect }: TuyaDevicePickerProps) {
  const { data: devices = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['tuya-devices'],
    queryFn: () => tuyaApi.listDevices(),
    staleTime: 30_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>Recherche des appareils Tuya…</Typography>
      </Box>
    );
  }
  if (isError) {
    return (
      <Alert severity="warning" sx={{ py: 0.25 }}>
        Compte Tuya non relié ou indisponible. Reliez Tuya dans <strong>Réglages → Intégrations</strong>.
      </Alert>
    );
  }

  const filtered = category ? devices.filter((d) => d.category === category) : devices;
  const list = filtered.length > 0 ? filtered : devices; // repli : montre tout si le filtre ne ramène rien

  if (list.length === 0) {
    return (
      <Box>
        <Alert severity="info" sx={{ py: 0.25 }}>Aucun appareil trouvé sur le compte Tuya relié.</Alert>
        <DevicePairingGuide onRefresh={() => { void refetch(); }} refreshing={isFetching} />
      </Box>
    );
  }

  return (
    <TextField
      select
      fullWidth
      size="small"
      required
      label="Appareil Tuya"
      helperText="Sélectionnez l'appareil découvert sur le compte Tuya de l'organisation."
      value={list.some((d) => d.id === selectedId) ? selectedId : ''}
      onChange={(e) => onSelect(e.target.value)}
    >
      {list.map((d) => (
        <MenuItem key={d.id} value={d.id} disabled={d.alreadyAdded}>
          {(d.name || d.id) + (d.category ? ` · ${d.category}` : '') + (d.online ? '' : ' · hors ligne') + (d.alreadyAdded ? ' · déjà ajouté' : '')}
        </MenuItem>
      ))}
    </TextField>
  );
}
