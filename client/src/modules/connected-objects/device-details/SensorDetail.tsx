import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Paper, Typography, Button, Chip, CircularProgress, Snackbar, Alert } from '@mui/material';
import { Refresh } from '../../../icons';
import { environmentSensorsApi, type EnvironmentSensorDto } from '../../../services/api/environmentSensorsApi';
import { softChipSx } from '../../../utils/statusUtils';
import BatteryIndicator from '../components/BatteryIndicator';
import { useState, type ReactNode } from 'react';
import type { ConnectedDevice } from '../types';

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, py: 0.625 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
      <Box sx={{ fontWeight: 600, color: 'text.primary', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{value}</Box>
    </Box>
  );
}

function fmt(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * Corps « capteur d'environnement » du détail unifié (temp/humidité, contact,
 * mouvement, fumée). Affiche l'état courant typé + batterie + horodatages, avec
 * un bouton de rafraîchissement (lecture Tuya à la demande). Écrit directement
 * sur `environmentSensorsApi`, dans le langage visuel du hub.
 */
export default function SensorDetail({ device }: { device: ConnectedDevice }) {
  const qc = useQueryClient();
  const sensor = device.raw as EnvironmentSensorDto;
  const [snack, setSnack] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  const refresh = useMutation({
    mutationFn: () => environmentSensorsApi.refresh(device.id),
    onSuccess: () => {
      setSnack({ msg: 'État rafraîchi', severity: 'success' });
      void qc.invalidateQueries({ queryKey: ['connected-objects'] });
    },
    onError: (e: unknown) => setSnack({ msg: e instanceof Error ? e.message : 'Échec du rafraîchissement', severity: 'error' }),
  });

  // État principal typé (chip colorée — le seul endroit où la couleur porte un sens).
  const primary = (() => {
    switch (sensor.sensorType) {
      case 'CONTACT': {
        const open = sensor.contactOpen === true;
        return { label: 'État', node: <Chip size="small" label={open ? 'Ouvert' : 'Fermé'} sx={softChipSx(open ? '#D4A574' : '#4A9B8E')} /> };
      }
      case 'MOTION': {
        const m = sensor.motionDetected === true;
        return { label: 'Mouvement', node: <Chip size="small" label={m ? 'Détecté' : 'Aucun'} sx={softChipSx(m ? '#D4A574' : '#4A9B8E')} /> };
      }
      case 'SMOKE': {
        const s = sensor.smokeDetected === true;
        return { label: 'Fumée / vape', node: <Chip size="small" label={s ? 'Détectée' : 'Aucune'} sx={softChipSx(s ? '#C97A7A' : '#4A9B8E')} /> };
      }
      default:
        return null; // climate : pas de chip binaire, on montre les mesures
    }
  })();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>État du capteur</Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={refresh.isPending ? <CircularProgress size={13} color="inherit" /> : <Refresh size={15} strokeWidth={1.75} />}
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending || !sensor.online}
            sx={{ textTransform: 'none' }}
          >
            Rafraîchir
          </Button>
        </Box>

        {primary && <InfoRow label={primary.label} value={primary.node} />}
        {sensor.sensorType === 'TEMP_HUMIDITY' && (
          <>
            <InfoRow label="Température" value={sensor.temperatureC != null ? `${sensor.temperatureC.toFixed(1)} °C` : '—'} />
            <InfoRow label="Humidité" value={sensor.humidity != null ? `${sensor.humidity} %` : '—'} />
          </>
        )}
        <InfoRow
          label="Connexion"
          value={sensor.online == null ? 'En attente' : sensor.online ? 'En ligne' : 'Hors ligne'}
        />
        {sensor.batteryLevel != null && (
          <InfoRow label="Batterie" value={<BatteryIndicator level={sensor.batteryLevel} />} />
        )}
        <InfoRow label="Dernière mesure" value={fmt(sensor.lastSeenAt)} />
        {(sensor.sensorType === 'SMOKE' || sensor.sensorType === 'MOTION' || sensor.sensorType === 'CONTACT') && (
          <InfoRow label="Dernière détection" value={fmt(sensor.lastEventAt)} />
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Identité</Typography>
        <InfoRow label="Pièce" value={device.roomName || '—'} />
        <InfoRow label="Fournisseur" value={sensor.brand || '—'} />
        <InfoRow label="Logement" value={device.propertyName} />
      </Paper>

      {(sensor.sensorType === 'SMOKE' || sensor.sensorType === 'MOTION') && (
        <Typography variant="caption" sx={{ color: 'text.secondary', px: 0.5 }}>
          Une notification est envoyée aux administrateurs et managers de l'organisation à chaque détection
          {sensor.sensorType === 'SMOKE' ? ' de fumée ou de vape' : ' de mouvement'} (avec anti-spam).
        </Typography>
      )}

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {snack ? <Alert severity={snack.severity} variant="filled" onClose={() => setSnack(null)} sx={{ width: '100%' }}>{snack.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
