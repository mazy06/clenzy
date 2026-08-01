import React, { useState } from 'react';
import { Spinner } from '../../components/ui';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { Cancel, Save } from "../../icons";
import InterventionForm from './InterventionForm';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';

const InterventionEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  return (
    <div className="p-4">
      <PageHeader
        title={t('interventions.editTitle')}
        subtitle={t('interventions.subtitle')}
        backPath={`/interventions/${id}`}
        backLabel="Retour aux détails"
        showBackButton={true}
        actions={
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/interventions/${id}`)}
              disabled={loading}
              title={t('common.cancel')}
            >
              <Cancel size={18} strokeWidth={1.75} />
              {t('common.cancel')}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const submitButton = document.querySelector('[data-submit-intervention]') as HTMLButtonElement;
                if (submitButton) {
                  submitButton.click();
                }
              }}
              disabled={loading}
              title={t('common.save')}
            >
              {loading ? <Spinner className="size-4" /> : <Save size={18} strokeWidth={1.75} />}
              {loading ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        }
      />

      <InterventionForm
        interventionId={Number(id)}
        mode="edit"
        setLoading={setLoading}
        loading={loading}
      />
    </div>
  );
};

export default InterventionEdit;
