import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ServiceRequestForm from './ServiceRequestForm';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import '../../theme/baitly-form-surfaces.css';

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
    <div className="baitly-form-surface baitly-form-page">
      <div className="baitly-form-header">
        <PageHeader
          title={t('serviceRequests.edit')}
          subtitle={t('serviceRequests.editSubtitle')}
          onBack={handleClose}
          backLabel={t('common.backToDetails')}
          showBackButton={true}
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
