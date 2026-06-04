import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { VolumeUp, Lock, VpnKey } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import PageHeader from '../../../components/PageHeader';
import DashboardNoiseTab from '../../dashboard/DashboardNoiseTab';
import DashboardSmartLockTab from '../../dashboard/DashboardSmartLockTab';
import DashboardKeyExchangeTab from '../../dashboard/DashboardKeyExchangeTab';

/**
 * Écrans de gestion avancée par type d'objet connecté, atteints depuis le Hub
 * `/connected-objects`. Ils enveloppent les vues riches historiques (offres,
 * steppers de configuration, monitoring, historique) qui vivaient auparavant
 * dans les onglets du dashboard, avec un PageHeader + retour vers le Hub.
 *
 * Les libellés réutilisent les clés i18n existantes (`dashboard.tabs.*`,
 * `tabHeaders.dashboard.subtitle.*`) déjà traduites en fr/en/ar.
 */
interface ManagementScreenProps {
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: ReactNode;
}

function ManagementScreen({ title, subtitle, icon, children }: ManagementScreenProps) {
  const { t } = useTranslation();
  return (
    <Box>
      <PageHeader
        title={title}
        subtitle={subtitle}
        iconBadge={icon}
        backPath="/connected-objects"
        backLabel={t('navigation.connectedObjects', 'Objets connectés')}
      />
      {children}
    </Box>
  );
}

export function NoiseManagementScreen() {
  const { t } = useTranslation();
  return (
    <ManagementScreen
      title={t('dashboard.tabs.noise', 'Nuisance sonore')}
      subtitle={t('tabHeaders.dashboard.subtitle.noise', 'Monitoring sonore Minut sur vos propriétés : alertes en temps réel, historique et seuils par bien.')}
      icon={<VolumeUp />}
    >
      <DashboardNoiseTab />
    </ManagementScreen>
  );
}

export function LockManagementScreen() {
  const { t } = useTranslation();
  return (
    <ManagementScreen
      title={t('dashboard.tabs.smartLock', 'Serrures connectées')}
      subtitle={t('tabHeaders.dashboard.subtitle.smartLock', 'État et contrôle de vos serrures connectées (Tuya, Nuki) : verrouillage à distance et batterie.')}
      icon={<Lock />}
    >
      <DashboardSmartLockTab />
    </ManagementScreen>
  );
}

export function KeyExchangeManagementScreen() {
  const { t } = useTranslation();
  return (
    <ManagementScreen
      title={t('dashboard.tabs.keyExchange', 'Gestion des clés')}
      subtitle={t('tabHeaders.dashboard.subtitle.keyExchange', 'Échange de clés via KeyNest et boîtes à clés : suivi des transferts entre guests et équipes.')}
      icon={<VpnKey />}
    >
      <DashboardKeyExchangeTab />
    </ManagementScreen>
  );
}
