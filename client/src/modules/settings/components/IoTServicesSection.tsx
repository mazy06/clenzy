import { useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
import { useQuery } from '@tanstack/react-query';
import { Settings2 } from 'lucide-react';
import OAuthProviderCard, { type OAuthApiAdapter } from './OAuthProviderCard';
import TuyaProjectConfigDialog from './TuyaProjectConfigDialog';
import NetatmoProjectConfigDialog from './NetatmoProjectConfigDialog';
import { tuyaApi, minutApi } from '../../../services/api/noiseApi';
import { netatmoApi } from '../../../services/api/netatmoApi';

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
    <Tooltip>
      {/* Le trigger enveloppe un <span> (element hote) : Radix y pose sa ref
          d'ancrage, ce qu'un composant fonction React 18 ne peut pas recevoir. */}
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setConfigOpen(true)}
            aria-label="Configurer le projet Tuya"
            // La couleur est le seul ecart entre les deux etats : encre `-ink`
            // (AA sur la carte) et non la teinte vive, illisible a cette taille.
            className={tuyaConfigured ? 'text-muted-foreground' : 'text-warning-ink'}
          >
            <Settings2 size={16} strokeWidth={2} />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {tuyaConfigured
          ? `Projet Tuya configuré${tuyaConfig?.region ? ` · ${tuyaConfig.region.toUpperCase()}` : ''} · Modifier les identifiants`
          : 'Configurer le projet Tuya Cloud (Access ID / Secret)'}
      </TooltipContent>
    </Tooltip>
  );

  // Action « configurer l'app Netatmo » (Client ID / Secret / Redirect URI).
  const netatmoConfigAction = (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setNetatmoConfigOpen(true)}
            aria-label="Configurer l'app Netatmo"
            className={netatmoConfigured ? 'text-muted-foreground' : 'text-warning-ink'}
          >
            <Settings2 size={16} strokeWidth={2} />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {netatmoConfigured ? "App Netatmo configurée · Modifier les identifiants" : "Configurer l'app Netatmo (Client ID / Secret)"}
      </TooltipContent>
    </Tooltip>
  );

  return (
    <Card className="gap-0 border-border mt-4 mb-3 px-3 py-2.5 scroll-mt-[80px]" id="section-connected-objects">
      {/* `px-0` : la Card porte deja son inset horizontal, les slots du kit
          n'en rajoutent pas un second. */}
      <CardHeader className="px-0 gap-0.5">
        <CardTitle className="text-base font-semibold tracking-tight text-balance">
          Objets connectés (IoT)
        </CardTitle>
        <CardDescription className="text-xs">
          Reliez les comptes IoT de l'organisation : serrures, caméras, thermostats et capteurs de bruit.
          Une fois un service connecté, les membres de l'org ajoutent leurs appareils en quelques clics.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-0 pt-2.5">
        <div className="grid grid-cols-[repeat(auto-fill,_minmax(320px,_1fr))] gap-[9px]">
          <OAuthProviderCard
            providerId="TUYA"
            label="Tuya"
            description="Serrures, caméras, thermostats et capteurs · cloud Tuya IoT"
            api={tuyaAdapter}
            serviceTooltipId="TUYA"
            secondaryAction={tuyaConfigAction}
            mainActionDisabled={!tuyaConfigured}
            mainActionDisabledReason="Configurez d'abord le projet Tuya Cloud (icône engrenage)."
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
            mainActionDisabledReason="Configurez d'abord l'app Netatmo (icône engrenage)."
          />
        </div>
      </CardContent>

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
    </Card>
  );
}
