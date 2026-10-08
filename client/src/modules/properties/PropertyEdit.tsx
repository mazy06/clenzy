import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/ui';
import { Cancel, Save } from '../../icons';
import PropertyForm from './PropertyForm';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import { propertyFormKeys } from '../../hooks/usePropertyForm';
import { propertiesApi } from '../../services/api/propertiesApi';

// ─── Component ──────────────────────────────────────────────────────────────

const PropertyEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  // Même clé et même requête que le formulaire : le nom vient du cache, sans appel en plus.
  const property = useQuery({
    queryKey: propertyFormKeys.property(Number(id)),
    queryFn: () => propertiesApi.getById(Number(id)),
    enabled: !!id,
    staleTime: 60_000,
  });

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0">
        <PageHeader
          title={property.data?.name ?? t('properties.modify')}
          subtitle={t('propertyWorkspace.form.editSubtitle')}
          backPath={`/properties/${id}`}
          backLabel={t('properties.backToDetails', 'Retour aux détails')}
          showBackButton={true}
          actions={
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/properties/${id}`)}
                title={t('common.cancel')}
              >
                <Cancel size={18} strokeWidth={1.75} />
                {t('common.cancel')}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  const submitButton = document.querySelector('[data-submit-property]') as HTMLButtonElement;
                  if (submitButton) submitButton.click();
                }}
                title={t('common.save')}
              >
                <Save size={18} strokeWidth={1.75} />
                {t('common.save')}
              </Button>
            </div>
          }
        />
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <PropertyForm propertyId={Number(id)} mode="edit" />
      </div>
    </div>
  );
};

export default PropertyEdit;
