import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription } from '../../../components/ui';
import { TriangleAlert, Info } from 'lucide-react';
import { Spinner } from '../../../components/ui';
import { TextField, MenuItem } from '@mui/material';
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
      <div className="flex items-center gap-1.5 py-1.5">
        <Spinner className="size-4" />
        <p className="cn-text-body2 text-muted-foreground">Recherche des {NOUN[source]} Netatmo…</p>
      </div>
    );
  }
  if (isError) {
    return (
      <Alert variant="warning" className="py-0.5">
        <TriangleAlert />
        <AlertDescription>Compte Netatmo non relié ou indisponible. Reliez Netatmo dans <strong>Réglages → Intégrations</strong>.</AlertDescription>
      </Alert>
    );
  }
  if (modules.length === 0) {
    return <Alert variant="info" className="py-0.5">
      <Info />
      <AlertDescription>Aucun de ces {NOUN[source]}sur le compte Netatmo relié.</AlertDescription>
    </Alert>;
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
