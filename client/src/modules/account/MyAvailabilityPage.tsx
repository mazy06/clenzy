import React from 'react';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import { useOnboarding } from '../../hooks/useOnboarding';
import MyAvailabilityCard from './MyAvailabilityCard';

/**
 * « Mes disponibilites » — semaine type et absences de l'intervenant.
 *
 * <p>Ecran a part entiere : poser un conge ou changer ses horaires est un geste
 * du QUOTIDIEN, pas une etape d'installation. Il n'a rien a faire au milieu des
 * conditions de prestation et des justificatifs, qu'on ne touche qu'une fois.</p>
 */
export default function MyAvailabilityPage() {
  const { t } = useTranslation();
  const { completeStep } = useOnboarding();
  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="shrink-0">
        <PageHeader
          title={t('availability.title', 'Mes disponibilités')}
          subtitle={t('availability.subtitle',
            'Vos jours travaillés et vos absences — ce sur quoi les missions vous sont proposées.')}
          showBackButton={false}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto pt-1.5">
        <MyAvailabilityCard onSaved={() => completeStep('setup_availability')} />
      </div>
    </div>
  );
}
