import React from 'react';

import PageHeader from '../../components/PageHeader';
import PageTabs from '../../components/PageTabs';
import { useTabKeyParam } from '../../components/tabKeyParam';
import { PageHeaderActionsProvider, usePageHeaderActionsSlot, usePageHeaderFiltersSlot } from '../../components/PageHeaderActionsContext';
import { useTranslation } from '../../hooks/useTranslation';
import { useScreenTabs } from '../../hooks/useScreenTabs';
import { Public } from '../../icons';
import WelcomeGuideAdmin from '../welcome-guide/WelcomeGuideAdmin';
import UpsellsAdmin from '../welcome-guide/UpsellsAdmin';
import StudioHome from '../booking-engine/studio/StudioHome';

/**
 * Page parent "Reservation & accueil" : regroupe en trois onglets le livret
 * d'accueil numerique (guest-facing), les services payants et le booking engine
 * (acquisition directe).
 *
 * <p>L'onglet Booking Engine reste reserve au staff plateforme (comportement
 * historique) ; les HOST ne voient que le Livret d'accueil et les services.</p>
 *
 * <p><b>L'onglet actif vit dans l'URL</b> (`?tab=<cle>`), comme partout
 * ailleurs, et non plus dans un `useState` alimente par `location.state`. Deux
 * raisons : la barre laterale deplie desormais ces onglets dans son troisieme
 * tiroir et doit pouvoir y renvoyer directement, et un retour de l'editeur
 * Studio redevient un lien, pas un etat de navigation a transporter.</p>
 *
 * <p>Aucun onglet par defaut a arbitrer : l'ordre du registre
 * (config/screenTabs.tsx) porte les deux cas. Le staff plateforme ouvre le
 * Booking Engine, premier onglet visible pour lui ; masque pour un HOST, le
 * premier visible devient le livret d'accueil — son entree a lui.</p>
 */
const GuestExperiencePage: React.FC = () => {
  const { t } = useTranslation();

  const tabs = useScreenTabs('/booking-engine');
  const [activeTab, setActiveTab] = useTabKeyParam(tabs);
  const activeKey = tabs.filter((tab) => !tab.hidden)[activeTab]?.key;

  // Slot DOM partagé : chaque onglet porte ses propres actions dans le PageHeader.
  const { slot, portalContainer } = usePageHeaderActionsSlot();
  // Slot filtres (recherche + filtres) — utilisé par l'onglet « Services payants ».
  const { filtersSlot, filtersContainer } = usePageHeaderFiltersSlot();

  const subtitle =
    activeKey === 'booking-engine'
      ? t('guestExperience.subtitleBookingEngine', 'Configurez votre moteur de réservation directe')
      : activeKey === 'upsells'
        ? t('guestExperience.subtitleUpsells', 'Vendez des services additionnels à vos voyageurs')
        : t('guestExperience.subtitleWelcomeGuide', "Le livret d'accueil numérique de vos voyageurs");

  return (
    <PageHeaderActionsProvider slot={slot} filtersSlot={filtersSlot}>
      {/* En-tête + tabs FIXES ; seul le contenu sous les tabs défile (scroll interne,
          comme les pages à scroll propre du soft) → le PageHeader ne scrolle plus. */}
      <div className="flex flex-col flex-1 min-h-0">
        <PageHeader
          title={t('guestExperience.title', 'Réservation & accueil')}
          subtitle={subtitle}
          iconBadge={<Public />}
          actions={portalContainer}
          filters={filtersContainer}
          showBackButton={false}
        />
        <PageTabs options={tabs} value={activeTab} onChange={setActiveTab} />
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          {activeKey === 'booking-engine' ? (
            <StudioHome embedded />
          ) : activeKey === 'upsells' ? (
            <UpsellsAdmin />
          ) : (
            <WelcomeGuideAdmin />
          )}
        </div>
      </div>
    </PageHeaderActionsProvider>
  );
};

export default GuestExperiencePage;
