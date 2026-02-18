import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import { Cancel, Save } from '@mui/icons-material';
import ServiceRequestForm from './ServiceRequestForm';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';

// ─── Stable sx constants ────────────────────────────────────────────────────

const ACTION_BUTTON_SX = {
  textTransform: 'none',
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0.01em',
  height: 28,
  px: 1.5,
  '& .MuiButton-startIcon': { mr: 0.5 },
  '& .MuiSvgIcon-root': { fontSize: 14 },
} as const;

// ─── Component ──────────────────────────────────────────────────────────────

const ServiceRequestEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const submitRef = useRef<(() => void) | null>(null);

  const handleClose = () => navigate(`/service-requests/${id}`);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ flexShrink: 0 }}>
        <PageHeader
          title={t('serviceRequests.edit')}
          subtitle={t('serviceRequests.editSubtitle')}
          backPath={`/service-requests/${id}`}
          showBackButton={true}
          actions={
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              <Button
                variant="outlined"
                onClick={handleClose}
                startIcon={<Cancel />}
                size="small"
                disabled={loading}
                sx={ACTION_BUTTON_SX}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="contained"
                onClick={() => submitRef.current?.()}
                startIcon={<Save />}
                size="small"
                disabled={loading}
                sx={ACTION_BUTTON_SX}
              >
                {loading ? t('serviceRequests.updating') : t('serviceRequests.update')}
              </Button>
            </Box>
          }
        />
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <ServiceRequestForm
          serviceRequestId={Number(id)}
          mode="edit"
          onClose={handleClose}
          setLoading={setLoading}
          loading={loading}
          submitRef={submitRef}
        />
      </Box>
    </Box>
  );
};

export default ServiceRequestEdit;
