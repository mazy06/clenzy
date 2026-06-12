import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, IconButton, Paper, Tooltip, Typography } from '@mui/material';
import { Settings2 } from 'lucide-react';
import OAuthProviderCard, { type OAuthApiAdapter } from './OAuthProviderCard';
import TuyaProjectConfigDialog from './TuyaProjectConfigDialog';
import NetatmoProjectConfigDialog from './NetatmoProjectConfigDialog';
import { tuyaApi, minutApi, netatmoApi } from '../../../services/api';

/**
 * Section « Objets connectés (IoT) » de l'onglet Intégrations : connexion des comptes
 * IoT de l'organisation (Tuya, Minut) via OAuth, réutilisant {@link OAuthProviderCard}.
 *
 * L'onglet Intégrations est déjà réservé aux SUPER_ADMIN / SUPER_MANAGER, et les endpoints
 * connect/disconnect le sont aussi côté backend. Une fois un service relié, les membres de
 * l'organisation peuvent ajouter leurs devices (cf. AddDeviceWizard).
 *
 * Tuya nécessite d'abord la configuration du <b>projet Cloud</b> (Access ID/Secret) : l'action
 * (icône engrenage + tooltip) est intégrée dans la carte Tuya et ouvre {@link TuyaProjectConfigDialog}
 * (credentials stockés chiffrés en base, sans redéploiement). Tant que le projet n'est pas configuré,
 * le bouton de connexion est désactivé (motif en tooltip).
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

const netatmoAdapter: OAuthApiAdapter = {
  connect: () => netatmoApi.connect(),
  disconnect: () => netatmoApi.disconnect().then(() => undefined),
  getStatus: async () => {
    const s = await netatmoApi.getStatus();
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
  const [configOpen, setConfigOpen] = useState(false);

  const { data: tuyaConfig, refetch: refetchConfig } = useQuery({
    queryKey: ['tuya', 'config'],
    queryFn: () => tuyaApi.getConfig(),
    staleTime: 60_000,
    retry: false,
  });
  const tuyaConfigured = tuyaConfig?.configured ?? false;

  const [netatmoConfigOpen, setNetatmoConfigOpen] = useState(false);
  const { data: netatmoConfig, refetch: refetchNetatmoConfig } = useQuery({
    queryKey: ['netatmo', 'config'],
    queryFn: () => netatmoApi.getConfig(),
    staleTime: 60_000,
    retry: false,
  });
  const netatmoConfigured = netatmoConfig?.configured ?? false;

  // Action « configurer le projet Tuya » en icône (libellé + statut/région portés par le tooltip).
  const tuyaConfigAction = (
    <Tooltip
      title={
        tuyaConfigured
          ? `Projet Tuya configuré${tuyaConfig?.region ? ` · ${tuyaConfig.region.toUpperCase()}` : ''} · Modifier les identifiants`
          : 'Configurer le projet Tuya Cloud (Access ID / Secret)'
      }
      arrow
    >
      <IconButton
        size="small"
        onClick={() => setConfigOpen(true)}
        aria-label="Configurer le projet Tuya"
        sx={{
          color: tuyaConfigured ? 'text.secondary' : 'var(--warn)',
          '&:hover': { bgcolor: 'action.hover' },
          cursor: 'pointer',
        }}
      >
        <Settings2 size={16} strokeWidth={2} />
      </IconButton>
    </Tooltip>
  );

  // Action « configurer l'app Netatmo » (Client ID / Secret / Redirect URI).
  const netatmoConfigAction = (
    <Tooltip
      title={netatmoConfigured ? "App Netatmo configurée · Modifier les identifiants" : "Configurer l'app Netatmo (Client ID / Secret)"}
      arrow
    >
      <IconButton
        size="small"
        onClick={() => setNetatmoConfigOpen(true)}
        aria-label="Configurer l'app Netatmo"
        sx={{
          color: netatmoConfigured ? 'text.secondary' : 'var(--warn)',
          '&:hover': { bgcolor: 'action.hover' },
          cursor: 'pointer',
        }}
      >
        <Settings2 size={16} strokeWidth={2} />
      </IconButton>
    </Tooltip>
  );

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
          serviceTooltipId="TUYA"
          secondaryAction={tuyaConfigAction}
          mainActionDisabled={!tuyaConfigured}
          mainActionDisabledReason="Configurez d'abord le projet Tuya Cloud (bouton ⚙)."
        />
        <OAuthProviderCard
          providerId="MINUT"
          label="Minut"
          description="Capteurs de bruit & environnement · OAuth2"
          api={minutAdapter}
          serviceTooltipId="MINUT"
        />
        <OAuthProviderCard
          providerId="NETATMO"
          label="Netatmo"
          description="Station météo, thermostat, caméras & détecteurs · OAuth2"
          api={netatmoAdapter}
          secondaryAction={netatmoConfigAction}
          mainActionDisabled={!netatmoConfigured}
          mainActionDisabledReason="Configurez d'abord l'app Netatmo (bouton ⚙)."
        />
      </Box>

      <TuyaProjectConfigDialog
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        current={tuyaConfig}
        onSaved={() => refetchConfig()}
      />

      <NetatmoProjectConfigDialog
        open={netatmoConfigOpen}
        onClose={() => setNetatmoConfigOpen(false)}
        current={netatmoConfig}
        onSaved={() => refetchNetatmoConfig()}
      />
    </Paper>
  );
}
