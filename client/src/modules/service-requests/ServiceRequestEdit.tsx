import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { Cancel, Save } from '@mui/icons-material';
import ServiceRequestForm from './ServiceRequestForm';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';

const ServiceRequestEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    navigate(`/service-requests/${id}`);
  };

  return (
    <Box>
      <PageHeader
        title={t('serviceRequests.edit')}
        subtitle={t('serviceRequests.editSubtitle')}
        backPath={`/service-requests/${id}`}
        showBackButton={true}
        actions={
          <>
            <Button
              variant="outlined"
              onClick={handleClose}
              startIcon={<Cancel />}
              disabled={loading}
              sx={{ mr: 1 }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                const form = document.querySelector('form');
                if (form) {
                  const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                  form.dispatchEvent(submitEvent);
                }
              }}
              startIcon={<Save />}
              disabled={loading}
            >
              {loading ? t('serviceRequests.updating') : t('serviceRequests.update')}
            </Button>
          </>
        }
      />

      <ServiceRequestForm
        serviceRequestId={Number(id)}
        mode="edit"
        onClose={handleClose}
        setLoading={setLoading}
        loading={loading}
      />
    </Box>
  );
};

export default ServiceRequestEdit;
