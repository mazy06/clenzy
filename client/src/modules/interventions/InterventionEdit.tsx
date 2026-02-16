import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Box, CircularProgress } from '@mui/material';
import { Cancel, Save } from '@mui/icons-material';
import InterventionForm from './InterventionForm';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';

const InterventionEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title={t('interventions.editTitle')}
        subtitle={t('interventions.subtitle')}
        backPath={`/interventions/${id}`}
        backLabel="Retour aux détails"
        showBackButton={true}
        actions={
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => navigate(`/interventions/${id}`)}
              startIcon={<Cancel />}
              disabled={loading}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                const submitButton = document.querySelector('[data-submit-intervention]') as HTMLButtonElement;
                if (submitButton) {
                  submitButton.click();
                }
              }}
              startIcon={loading ? <CircularProgress size={20} /> : <Save />}
              disabled={loading}
            >
              {loading ? t('common.loading') : t('common.save')}
            </Button>
          </Box>
        }
      />

      <InterventionForm
        interventionId={Number(id)}
        mode="edit"
        setLoading={setLoading}
        loading={loading}
      />
    </Box>
  );
};

export default InterventionEdit;
