import { Box, Paper, Typography } from '@mui/material';
import OAuthProviderCard, { type OAuthApiAdapter } from './OAuthProviderCard';
import { tuyaApi, minutApi } from '../../../services/api';

/**
 * Section « Objets connectés (IoT) » de l'onglet Intégrations : connexion des comptes
 * IoT de l'organisation (Tuya, Minut) via OAuth, réutilisant {@link OAuthProviderCard}.
 *
 * L'onglet Intégrations est déjà réservé aux SUPER_ADMIN / SUPER_MANAGER, et les endpoints
 * connect/disconnect le sont aussi côté backend. Une fois un service relié, les membres de
 * l'organisation peuvent ajouter leurs devices (cf. AddDeviceWizard).
 */

const deviceScope = (count: number): string | undefined =>
  count > 0 ? `${count} appareil${count > 1 ? 's' : ''} rattaché${count > 1 ? 's' : ''}` : undefined;

const tuyaAdapter: OAuthApiAdapter = {
  connect: () => tuyaApi.connect(),
  disconnect: () => tuyaApi.disconnect().then(() => undefined),
  getStatus: async () => {
    const s = await tuyaApi.getStatus();
    return {
      connected: s.connected,
      connectedAt: s.connectedAt ?? undefined,
      status: s.status,
      errorMessage: s.errorMessage ?? undefined,
      scopes: deviceScope(s.deviceCount),
    };
  },
};

const minutAdapter: OAuthApiAdapter = {
  connect: () => minutApi.connect(),
  disconnect: () => minutApi.disconnect().then(() => undefined),
  getStatus: async () => {
    const s = await minutApi.getStatus();
    return {
      connected: s.connected,
      connectedAt: s.connectedAt ?? undefined,
      status: s.status,
      errorMessage: s.errorMessage ?? undefined,
      scopes: deviceScope(s.deviceCount),
    };
  },
};

export default function IoTServicesSection() {
  return (
    <Paper
      id="section-connected-objects"
      elevation={0}
      sx={{
        borderRadius: '12px',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: 'none',
        mt: 3,
        mb: 2,
        px: 2,
        py: 1.75,
        scrollMarginTop: 80,
      }}
    >
      <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 0.25 }}>Objets connectés (IoT)</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.75 }}>
        Reliez les comptes IoT de l'organisation : serrures, caméras, thermostats et capteurs de bruit.
        Une fois un service connecté, les membres de l'org ajoutent leurs appareils en quelques clics.
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 1.5 }}>
        <OAuthProviderCard
          providerId="TUYA"
          label="Tuya"
          description="Serrures, caméras, thermostats et capteurs · cloud Tuya IoT"
          api={tuyaAdapter}
        />
        <OAuthProviderCard
          providerId="MINUT"
          label="Minut"
          description="Capteurs de bruit & environnement · OAuth2"
          api={minutAdapter}
        />
      </Box>
    </Paper>
  );
}
