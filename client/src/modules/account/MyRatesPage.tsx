import React from 'react';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import MyRatesSettings from '../settings/MyRatesSettings';

/**
 * « Mes tarifs » — taux horaire et forfaits par logement de l'intervenant.
 *
 * <p>Ecran a part entiere, et non une carte parmi d'autres dans « Mon compte » :
 * un intervenant y revient regulierement pour ajuster ses prix, alors que les
 * conditions, justificatifs et versements se remplissent une fois. Melanger ce
 * qu'on fait UNE fois et ce qu'on consulte SOUVENT obligeait a traverser la
 * page entiere a chaque ajustement.</p>
 */
export default function MyRatesPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="shrink-0">
        <PageHeader
          title={t('myRates.title', 'Mes tarifs')}
          subtitle={t('myRates.subtitle',
            'Votre taux horaire et vos forfaits par logement — la base du calcul de vos missions.')}
          showBackButton={false}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto pt-1.5">
        <MyRatesSettings />
      </div>
    </div>
  );
}
