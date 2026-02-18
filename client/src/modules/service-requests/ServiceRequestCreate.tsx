import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Box } from '@mui/material';
import { Cancel, Save } from '@mui/icons-material';
import ServiceRequestForm from './ServiceRequestForm';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
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

const ServiceRequestCreate: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const submitRef = useRef<(() => void) | null>(null);

  const [canCreate, setCanCreate] = useState(false);

  useEffect(() => {
    const checkPermissions = async () => {
      const canCreatePermission = await hasPermissionAsync('service-requests:create');
      setCanCreate(canCreatePermission);
    };
    checkPermissions();
  }, [hasPermissionAsync]);

  const handleClose = () => navigate('/service-requests');
  const handleSuccess = () => {
    setTimeout(() => navigate('/service-requests'), 1200);
  };

  if (!canCreate) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ flexShrink: 0 }}>
        <PageHeader
          title={t('serviceRequests.create')}
          subtitle={t('serviceRequests.createSubtitle')}
          backPath="/service-requests"
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
                {loading ? t('serviceRequests.creating') : t('serviceRequests.createRequest')}
              </Button>
            </Box>
          }
        />
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <ServiceRequestForm
          onClose={handleClose}
          onSuccess={handleSuccess}
          setLoading={setLoading}
          loading={loading}
          submitRef={submitRef}
        />
      </Box>
    </Box>
  );
};

export default ServiceRequestCreate;
