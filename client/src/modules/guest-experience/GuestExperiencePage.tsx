import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import { PageHeaderActionsProvider, usePageHeaderActionsSlot } from '../../components/PageHeaderActionsContext';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { Public } from '../../icons';
import WelcomeGuideAdmin from '../welcome-guide/WelcomeGuideAdmin';
import UpsellsAdmin from '../welcome-guide/UpsellsAdmin';
import StudioHome from '../booking-engine/studio/StudioHome';

/**
 * Page parent "Reservation & accueil" : regroupe en deux onglets le livret
 * d'accueil numerique (guest-facing) et le booking engine (acquisition directe).
 *
 * <p>L'onglet Booking Engine reste reserve au staff plateforme (comportement
 * historique) ; les HOST ne voient que le Livret d'accueil de leurs logements.</p>
 */
const GuestExperiencePage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const isPlatformStaff =
    user?.platformRole === 'SUPER_ADMIN' || user?.platformRole === 'SUPER_MANAGER';

  // Retour depuis l'éditeur Studio : on revient sur l'onglet « Booking Engine » (index 2).
  // Repli sur 0 si l'onglet est masqué pour ce rôle (non-staff).
  const requestedTab = (location.state as { tab?: number } | null)?.tab;
  const initialTab = requestedTab === 2 && !isPlatformStaff ? 0 : (typeof requestedTab === 'number' ? requestedTab : 0);
  const [tab, setTab] = useState(initialTab);
  // Slot DOM partagé : chaque onglet porte ses propres actions dans le PageHeader.
  const { slot, portalContainer } = usePageHeaderActionsSlot();

  const tabs = [
    { value: 0, label: t('guestExperience.tabs.welcomeGuide', "Livret d'accueil") },
    { value: 1, label: t('guestExperience.tabs.upsells', 'Services payants') },
    {
      value: 2,
      label: t('guestExperience.tabs.bookingEngine', 'Booking Engine'),
      hidden: !isPlatformStaff,
    },
  ];

  const subtitle =
    tab === 2
      ? t('guestExperience.subtitleBookingEngine', 'Configurez votre moteur de réservation directe')
      : tab === 1
        ? t('guestExperience.subtitleUpsells', 'Vendez des services additionnels à vos voyageurs')
        : t('guestExperience.subtitleWelcomeGuide', "Le livret d'accueil numérique de vos voyageurs");

  return (
    <PageHeaderActionsProvider slot={slot}>
      {/* En-tête + tabs FIXES ; seul le contenu sous les tabs défile (scroll interne,
          comme les pages à scroll propre du soft) → le PageHeader ne scrolle plus. */}
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <PageHeader
          title={t('guestExperience.title', 'Réservation & accueil')}
          subtitle={subtitle}
          iconBadge={<Public />}
          actions={portalContainer}
          showBackButton={false}
        />
        <PageTabs options={tabs} value={tab} onChange={setTab} />
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
          {tab === 2 && isPlatformStaff ? (
            <StudioHome embedded />
          ) : tab === 1 ? (
            <UpsellsAdmin />
          ) : (
            <WelcomeGuideAdmin />
          )}
        </Box>
      </Box>
    </PageHeaderActionsProvider>
  );
};

export default GuestExperiencePage;
