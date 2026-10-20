import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { Cancel, Save } from "../../icons";
import ServiceRequestComposer from './ServiceRequestComposer';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import '../../theme/baitly-form-surfaces.css';

// ─── Component ──────────────────────────────────────────────────────────────
// Boutons d'action : geometrie et typo portees par le kit Baitly UI.

const ServiceRequestCreate: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
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

  const handleClose = () => navigate(pathname === '/interventions/new' ? '/interventions?tab=interventions' : '/service-requests');
  const handleSuccess = () => {
    navigate('/service-requests?success=true');
  };

  if (!canCreate) return null;

  return (
    <div className="baitly-form-surface baitly-form-page">
      <div className="baitly-form-header">
        <PageHeader
        title={t('requestComposer.heading')}
        subtitle={t('requestComposer.intro')}
          onBack={handleClose}
          backLabel={t('common.backToList')}
          showBackButton={true}
          actions={
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClose}
                disabled={loading}
                title={t('common.cancel')}
              >
                <Cancel strokeWidth={1.75} />
                {t('common.cancel')}
              </Button>
              <Button
                size="sm"
                onClick={() => submitRef.current?.()}
                disabled={loading}
                title={t('serviceRequests.createRequest')}
              >
                <Save strokeWidth={1.75} />
                {loading ? t('serviceRequests.creating') : t('serviceRequests.createRequest')}
              </Button>
            </div>
          }
        />
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <ServiceRequestComposer
          onClose={handleClose}
          onSuccess={handleSuccess}
          setLoading={setLoading}
          submitRef={submitRef}
        />
      </div>
    </div>
  );
};

export default ServiceRequestCreate;
