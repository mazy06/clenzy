import { Box, Paper, Typography } from '@mui/material';
import AccessCodeSection from '../components/AccessCodeSection';
import { DEVICE_KINDS } from '../deviceRegistry';
import type { ConnectedDevice } from '../types';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.5 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{label}</Typography>
      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary', textAlign: 'right' }}>{value}</Typography>
    </Box>
  );
}

/**
 * Corps « serrure » du détail unifié. Mince : la carte du hub gère déjà
 * verrouillage / batterie / suppression. Ici : gestion du code d'accès + identité.
 */
export default function LockDetail({ device }: { device: ConnectedDevice }) {
  const meta = DEVICE_KINDS[device.kind];
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 1.5 }}>
        <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 700 }}>Code d'accès</Typography>
        <AccessCodeSection deviceId={device.id} />
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 1.5 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>Informations</Typography>
        <InfoRow label="Type" value={meta.singular} />
        <InfoRow label="Marque" value={device.provider !== 'UNKNOWN' ? device.provider : '—'} />
        <InfoRow label="Logement" value={device.propertyName} />
        <InfoRow label="Pièce" value={device.roomName ?? '—'} />
      </Paper>
    </Box>
  );
}
