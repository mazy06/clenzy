import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@mui/material';
import { Cancel, Save } from "../../icons";
import ServiceRequestForm from './ServiceRequestForm';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';

// ─── Component ──────────────────────────────────────────────────────────────
// Boutons d'action : géométrie/typo héritées du thème global (.s-btn small).

const ServiceRequestEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const submitRef = useRef<(() => void) | null>(null);

  const handleClose = () => navigate(`/service-requests/${id}`);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0">
        <PageHeader
          title={t('serviceRequests.edit')}
          subtitle={t('serviceRequests.editSubtitle')}
          backPath={`/service-requests/${id}`}
          showBackButton={true}
          actions={
            <div className="flex gap-1">
              <Button
                variant="outlined"
                onClick={handleClose}
                startIcon={<Cancel size={18} strokeWidth={1.75} />}
                size="small"
                disabled={loading}
                title={t('common.cancel')}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="contained"
                onClick={() => submitRef.current?.()}
                startIcon={<Save size={18} strokeWidth={1.75} />}
                size="small"
                disabled={loading}
                title={t('serviceRequests.update')}
              >
                {loading ? t('serviceRequests.updating') : t('serviceRequests.update')}
              </Button>
            </div>
          }
        />
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <ServiceRequestForm
          serviceRequestId={Number(id)}
          mode="edit"
          onClose={handleClose}
          setLoading={setLoading}
          loading={loading}
          submitRef={submitRef}
        />
      </div>
    </div>
  );
};

export default ServiceRequestEdit;
