import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Skeleton, Button } from '@mui/material';
import {
  Edit,
  Assignment,
  Login,
  Logout,
} from '../../icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useServiceRequestDetails } from '../../hooks/useServiceRequestDetails';
import type { ServiceRequestDetailsData } from '../../hooks/useServiceRequestDetails';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import { formatDateTime } from '../../utils/formatUtils';
import { getServiceRequestStatusLabel } from '../../utils/statusUtils';
import WorkOrderDetailLayout, { type WorkOrderViewModel, type WorkOrderTimeRow } from '../work-orders/WorkOrderDetailLayout';

// ─── Re-export type for backward compatibility ──────────────────────────────

export type { ServiceRequestDetailsData };

// ─── Main component ──────────────────────────────────────────────────────────

const ServiceRequestDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();
  const { t } = useTranslation();

  const { serviceRequest, isLoading, isError, error } = useServiceRequestDetails(id);

  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    const checkPermissions = async () => {
      const canEditPermission = await hasPermissionAsync('service-requests:edit');
      setCanEdit(canEditPermission);
    };
    checkPermissions();
  }, [hasPermissionAsync]);

  if (isLoading) {
    return (
      <div className="p-3 flex flex-col gap-2">
        <Skeleton variant="rounded" height={64} sx={{ borderRadius: '14px' }} />
        <div className="flex gap-1.5">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} variant="rounded" height={72} sx={{ borderRadius: '14px', flex: 1 }} />
          ))}
        </div>
        <div className="flex gap-2">
          <Skeleton variant="rounded" height={260} sx={{ borderRadius: '14px', flex: 7 }} />
          <Skeleton variant="rounded" height={260} sx={{ borderRadius: '14px', flex: 5 }} />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-3">
        <Alert variant="destructive" className="py-1 text-[0.8125rem]">
          <TriangleAlert />
          <AlertDescription>{error || t('serviceRequests.loadError')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!serviceRequest) {
    return (
      <div className="p-3">
        <Alert variant="warning" className="py-1 text-[0.8125rem]">
          <TriangleAlert />
          <AlertDescription>{t('serviceRequests.notFound')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // ─── Map ServiceRequest → shared view-model ──────────────────────────────
  const sr = serviceRequest;

  const extraTimeRows: WorkOrderTimeRow[] = [];
  if (sr.guestCheckoutTime) {
    extraTimeRows.push({
      icon: <Logout size={16} strokeWidth={1.75} />,
      label: t('serviceRequests.details.guestCheckout'),
      value: formatDateTime(sr.guestCheckoutTime),
    });
  }
  if (sr.guestCheckinTime) {
    extraTimeRows.push({
      icon: <Login size={16} strokeWidth={1.75} />,
      label: t('serviceRequests.details.guestCheckin'),
      value: formatDateTime(sr.guestCheckinTime),
    });
  }

  const vm: WorkOrderViewModel = {
    type: sr.type,
    status: sr.status,
    statusLabel: getServiceRequestStatusLabel(sr.status, t),
    description: sr.description || undefined,
    importSource: sr.importSource,
    estimatedDurationHours: sr.estimatedDuration,
    dueDate: sr.dueDate,
    estimatedCost: sr.estimatedCost,
    recommendedCost: sr.recommendedCost,
    actualCost: sr.actualCost,
    createdAt: sr.createdAt,
    property: {
      id: sr.propertyId,
      name: sr.propertyName,
      address: sr.propertyAddress,
      city: sr.propertyCity,
      postalCode: sr.propertyPostalCode,
      country: sr.propertyCountry,
      type: sr.propertyType,
      squareMeters: sr.propertySquareMeters,
      bedroomCount: sr.propertyBedroomCount,
      bathroomCount: sr.propertyBathroomCount,
      maxGuests: sr.propertyMaxGuests,
      numberOfFloors: sr.propertyNumberOfFloors,
      hasExterior: sr.propertyHasExterior,
      hasLaundry: sr.propertyHasLaundry,
      cleaningDurationMinutes: sr.propertyCleaningDurationMinutes,
      description: sr.propertyDescription,
      cleaningNotes: sr.propertyCleaningNotes,
    },
    requestor: {
      name: sr.requestorName,
      email: sr.requestorEmail,
      roleLabel: sr.requestorRole,
    },
    assignee: {
      name: sr.assignedToName,
      email: sr.assignedToEmail,
      type: sr.assignedToType,
      typeLabel: sr.assignedToType === 'team' ? t('serviceRequests.team') : undefined,
    },
    extraTimeRows,
    specialInstructions: sr.specialInstructions,
    accessNotes: sr.accessNotes,
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="shrink-0">
        <PageHeader
          title={sr.title}
          subtitle={`${t('serviceRequests.detail.contextLabel', 'Demande de service')} · ${sr.propertyName}`}
          iconBadge={<Assignment />}
          backPath="/service-requests"
          actions={
            canEdit ? (
              <Button
                variant="outlined"
                startIcon={<Edit size={18} strokeWidth={1.75} />}
                onClick={() => navigate(`/service-requests/${id}/edit`)}
                size="small"
                title={t('serviceRequests.modify')}
              >
                {t('serviceRequests.modify')}
              </Button>
            ) : undefined
          }
        />
      </div>

      {/* ─── Content ─────────────────────────────────────────────────────── */}
      <WorkOrderDetailLayout
        vm={vm}
        propertyAction={
          <Button
            size="small"
            onClick={() => navigate(`/properties/${sr.propertyId}`)}
            sx={{ fontSize: '0.6875rem', textTransform: 'none', py: 0, minHeight: 24 }}
          >
            {t('serviceRequests.details.viewProperty')}
          </Button>
        }
      />
    </div>
  );
};

export default ServiceRequestDetails;
