import { useQuery } from '@tanstack/react-query';
import { Box, TextField, MenuItem, Alert, CircularProgress, Typography } from '@mui/material';
import { netatmoApi } from '../../../services/api/netatmoApi';

type NetatmoSource = 'weather' | 'thermostat' | 'security';

interface NetatmoDevicePickerProps {
  selectedId: string;
  onSelect: (moduleId: string) => void;
  /** Liste interrogée : stations météo (capteurs), thermostats/vannes, ou modules sécurité. */
  source?: NetatmoSource;
}

const LABEL: Record<NetatmoSource, string> = {
  weather: 'Module Netatmo',
  thermostat: 'Thermostat Netatmo',
  security: 'Appareil sécurité Netatmo',
};
const NOUN: Record<NetatmoSource, string> = {
  weather: 'stations',
  thermostat: 'thermostats',
  security: 'appareils sécurité',
};

/**
 * Sélecteur d'appareils découverts sur le compte Netatmo relié de l'organisation.
 * `source` choisit la liste interrogée. Renvoie l'identifiant à stocker comme
 * externalDeviceId (module _id pour la météo, {@code homeId|roomId} pour un thermostat,
 * {@code homeId|moduleId} pour la sécurité). Org-scopé côté backend. NON VALIDÉ
 * faute de compte Netatmo réel.
 */
export default function NetatmoDevicePicker({ selectedId, onSelect, source = 'weather' }: NetatmoDevicePickerProps) {
  const { data: modules = [], isLoading, isError } = useQuery({
    queryKey: ['netatmo-devices', source],
    queryFn: () =>
      source === 'thermostat' ? netatmoApi.getThermostats()
        : source === 'security' ? netatmoApi.getSecurity()
          : netatmoApi.getDevices(),
    staleTime: 30_000,
    retry: false,
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
        <CircularProgress size={16} />
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>Recherche des {NOUN[source]} Netatmo…</Typography>
      </Box>
    );
  }
  if (isError) {
    return (
      <Alert severity="warning" sx={{ py: 0.25 }}>
        Compte Netatmo non relié ou indisponible. Reliez Netatmo dans <strong>Réglages → Intégrations</strong>.
      </Alert>
    );
  }
  if (modules.length === 0) {
    return <Alert severity="info" sx={{ py: 0.25 }}>Aucun de ces {NOUN[source]} sur le compte Netatmo relié.</Alert>;
  }

  return (
    <TextField
      select
      fullWidth
      size="small"
      required
      label={LABEL[source]}
      helperText="Sélectionnez l'appareil découvert sur le compte Netatmo de l'organisation."
      value={modules.some((m) => m.id === selectedId) ? selectedId : ''}
      onChange={(e) => onSelect(e.target.value)}
    >
      {modules.map((m) => (
        <MenuItem key={m.id} value={m.id}>
          {m.name
            + (m.stationName && m.stationName !== m.name ? ` · ${m.stationName}` : '')
            + (m.reachable ? '' : ' · hors ligne')}
        </MenuItem>
      ))}
    </TextField>
  );
}
