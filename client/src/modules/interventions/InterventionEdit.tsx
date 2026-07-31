import React, { useState } from 'react';
import { Spinner } from '../../components/ui';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@mui/material';
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
              variant="outlined"
              size="small"
              onClick={() => navigate(`/interventions/${id}`)}
              startIcon={<Cancel size={18} strokeWidth={1.75} />}
              disabled={loading}
              title={t('common.cancel')}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={() => {
                const submitButton = document.querySelector('[data-submit-intervention]') as HTMLButtonElement;
                if (submitButton) {
                  submitButton.click();
                }
              }}
              startIcon={loading ? <Spinner className="size-4" /> : <Save size={18} strokeWidth={1.75} />}
              disabled={loading}
              title={t('common.save')}
            >
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
