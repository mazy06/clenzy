import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui';
import { Cancel, Save } from "../../icons";
import ServiceRequestForm from './ServiceRequestForm';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';

// ─── Component ──────────────────────────────────────────────────────────────
// Boutons d'action : geometrie et typo portees par le kit Baitly UI.

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
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0">
        <PageHeader
          title={t('serviceRequests.create')}
          subtitle={t('serviceRequests.createSubtitle')}
          backPath="/service-requests"
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
        <ServiceRequestForm
          onClose={handleClose}
          onSuccess={handleSuccess}
          setLoading={setLoading}
          loading={loading}
          submitRef={submitRef}
        />
      </div>
    </div>
  );
};

export default ServiceRequestCreate;
