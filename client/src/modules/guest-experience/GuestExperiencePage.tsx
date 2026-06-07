import React, { useState } from 'react';
import { Box } from '@mui/material';
import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { Public } from '../../icons';
import WelcomeGuideAdmin from '../welcome-guide/WelcomeGuideAdmin';
import UpsellsAdmin from '../welcome-guide/UpsellsAdmin';
import BookingEnginePage from '../booking-engine/BookingEnginePage';

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
  const isPlatformStaff =
    user?.platformRole === 'SUPER_ADMIN' || user?.platformRole === 'SUPER_MANAGER';

  const [tab, setTab] = useState(0);

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
    <Box>
      <PageHeader
        title={t('guestExperience.title', 'Réservation & accueil')}
        subtitle={subtitle}
        iconBadge={<Public />}
        backPath="/dashboard"
      />
      <PageTabs options={tabs} value={tab} onChange={setTab} />
      {tab === 2 && isPlatformStaff ? (
        <BookingEnginePage embedded />
      ) : tab === 1 ? (
        <UpsellsAdmin />
      ) : (
        <WelcomeGuideAdmin />
      )}
    </Box>
  );
};

export default GuestExperiencePage;
