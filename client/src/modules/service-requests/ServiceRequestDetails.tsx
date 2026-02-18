import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Grid,
  Chip,
  Paper,
  Divider,
} from '@mui/material';
import {
  Edit,
  LocationOn,
  Person,
  Category,
  PriorityHigh,
  Schedule,
  CalendarToday,
  AccessTime,
  Assignment,
  AutoAwesome,
  Build,
  Group,
  CheckCircle,
  Flag,
  CalendarMonth,
  Yard,
  BugReport,
  AutoFixHigh,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useServiceRequestDetails } from '../../hooks/useServiceRequestDetails';
import type { ServiceRequestDetailsData } from '../../hooks/useServiceRequestDetails';
import PageHeader from '../../components/PageHeader';
import { useTranslation } from '../../hooks/useTranslation';
import { formatDateTime, formatDuration } from '../../utils/formatUtils';
import {
  getServiceRequestStatusColor,
  getServiceRequestStatusLabel,
  getServiceRequestPriorityColor,
  getServiceRequestPriorityLabel,
  getInterventionTypeLabel,
} from '../../utils/statusUtils';

// ─── Stable sx constants (aligned with PropertyDetails) ──────────────────────

const METRIC_CARD_SX = {
  p: 1.5,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1.5,
  boxShadow: 'none',
  minHeight: 72,
  justifyContent: 'center',
} as const;

const METRIC_ICON_SX = {
  fontSize: 18,
  color: 'primary.main',
  mb: 0.25,
} as const;

const METRIC_VALUE_SX = {
  fontSize: '0.9375rem',
  fontWeight: 700,
  color: 'text.primary',
  lineHeight: 1.2,
} as const;

const METRIC_LABEL_SX = {
  fontSize: '0.625rem',
  fontWeight: 500,
  color: 'text.secondary',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  mt: 0.25,
} as const;

const SECTION_TITLE_SX = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'text.secondary',
  mb: 1,
} as const;

const INFO_ROW_SX = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  py: 0.75,
} as const;

const INFO_LABEL_SX = {
  fontSize: '0.6875rem',
  fontWeight: 500,
  color: 'text.secondary',
} as const;

const INFO_VALUE_SX = {
  fontSize: '0.8125rem',
  fontWeight: 500,
  color: 'text.primary',
} as const;

const STATUS_CHIP_SX = {
  height: 22,
  fontSize: '0.625rem',
  fontWeight: 600,
  borderWidth: 1.5,
  '& .MuiChip-label': { px: 0.75 },
} as const;

const EDIT_BUTTON_SX = {
  textTransform: 'none',
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0.01em',
  height: 28,
  px: 1.5,
  '& .MuiButton-startIcon': { mr: 0.5 },
  '& .MuiSvgIcon-root': { fontSize: 14 },
} as const;

const CARD_SX = {
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
  borderRadius: 1.5,
  p: 1.5,
} as const;

// ─── Type icon helper ────────────────────────────────────────────────────────

function getTypeIcon(type: string) {
  const iconSx = { fontSize: 18, color: 'primary.main', mb: 0.25 };
  const upper = type?.toUpperCase() || '';

  const cleaningTypes = [
    'CLEANING', 'EXPRESS_CLEANING', 'DEEP_CLEANING', 'WINDOW_CLEANING',
    'FLOOR_CLEANING', 'KITCHEN_CLEANING', 'BATHROOM_CLEANING',
    'EXTERIOR_CLEANING', 'DISINFECTION',
  ];
  const repairTypes = [
    'EMERGENCY_REPAIR', 'ELECTRICAL_REPAIR', 'PLUMBING_REPAIR',
    'HVAC_REPAIR', 'APPLIANCE_REPAIR',
  ];

  if (cleaningTypes.includes(upper)) return <AutoAwesome sx={iconSx} />;
  if (repairTypes.includes(upper)) return <Build sx={iconSx} />;
  if (upper === 'PREVENTIVE_MAINTENANCE') return <Build sx={iconSx} />;
  if (upper === 'GARDENING') return <Yard sx={iconSx} />;
  if (upper === 'PEST_CONTROL') return <BugReport sx={iconSx} />;
  if (upper === 'RESTORATION') return <AutoFixHigh sx={iconSx} />;
  return <Category sx={iconSx} />;
}

// ─── Re-export type for backward compatibility ──────────────────────────────

export type { ServiceRequestDetailsData };

// ─── Main component ──────────────────────────────────────────────────────────

const ServiceRequestDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermissionAsync } = useAuth();
  const { t } = useTranslation();

  // ─── React Query ──────────────────────────────────────────────────────────
  const { serviceRequest, isLoading, isError, error } = useServiceRequestDetails(id);

  const [canEdit, setCanEdit] = useState(false);

  // ─── Permissions ──────────────────────────────────────────────────────────
  useEffect(() => {
    const checkPermissions = async () => {
      const canEditPermission = await hasPermissionAsync('service-requests:edit');
      setCanEdit(canEditPermission);
    };
    checkPermissions();
  }, [hasPermissionAsync]);

  // ─── Loading / Error states ───────────────────────────────────────────────

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" sx={{ py: 0.75, fontSize: '0.8125rem' }}>
          {error || t('serviceRequests.loadError')}
        </Alert>
      </Box>
    );
  }

  if (!serviceRequest) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning" sx={{ py: 0.75, fontSize: '0.8125rem' }}>
          {t('serviceRequests.notFound')}
        </Alert>
      </Box>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <Box sx={{ flexShrink: 0 }}>
        <PageHeader
          title={serviceRequest.title}
          subtitle={`${getInterventionTypeLabel(serviceRequest.type, t)} · ${serviceRequest.propertyName}`}
          backPath="/service-requests"
          actions={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Chip
                label={getServiceRequestStatusLabel(serviceRequest.status, t)}
                color={getServiceRequestStatusColor(serviceRequest.status)}
                size="small"
                variant="outlined"
                sx={STATUS_CHIP_SX}
              />
              <Chip
                label={getServiceRequestPriorityLabel(serviceRequest.priority, t)}
                color={getServiceRequestPriorityColor(serviceRequest.priority)}
                size="small"
                variant="outlined"
                icon={<PriorityHigh sx={{ fontSize: 12 }} />}
                sx={STATUS_CHIP_SX}
              />
              {canEdit && (
                <Button
                  variant="outlined"
                  startIcon={<Edit />}
                  onClick={() => navigate(`/service-requests/${id}/edit`)}
                  size="small"
                  sx={EDIT_BUTTON_SX}
                >
                  {t('serviceRequests.modify')}
                </Button>
              )}
            </Box>
          }
        />
      </Box>

      {/* ─── Content ───────────────────────────────────────────────────────── */}
      <Box sx={{ pt: 1.5, flex: 1, minHeight: 0, overflow: 'auto' }}>
        {/* ── Key metrics grid ──────────────────────────────────────────── */}
        <Grid container spacing={1} sx={{ mb: 1.5 }}>
          <Grid item xs={6} sm={4} md={2}>
            <Box sx={{ ...METRIC_CARD_SX, borderColor: 'primary.main', bgcolor: 'primary.50' }}>
              {getTypeIcon(serviceRequest.type)}
              <Typography sx={{ ...METRIC_VALUE_SX, color: 'primary.main', fontSize: '0.75rem' }}>
                {getInterventionTypeLabel(serviceRequest.type, t)}
              </Typography>
              <Typography sx={METRIC_LABEL_SX}>{t('common.type')}</Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Box sx={METRIC_CARD_SX}>
              <AccessTime sx={METRIC_ICON_SX} />
              <Typography sx={METRIC_VALUE_SX}>
                {formatDuration(serviceRequest.estimatedDuration)}
              </Typography>
              <Typography sx={METRIC_LABEL_SX}>{t('serviceRequests.estimatedDurationLabel')}</Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Box sx={METRIC_CARD_SX}>
              <CalendarToday sx={METRIC_ICON_SX} />
              <Typography sx={{ ...METRIC_VALUE_SX, fontSize: '0.75rem' }}>
                {formatDateTime(serviceRequest.dueDate)}
              </Typography>
              <Typography sx={METRIC_LABEL_SX}>{t('serviceRequests.dueDateShort')}</Typography>
            </Box>
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <Box sx={METRIC_CARD_SX}>
              <Schedule sx={METRIC_ICON_SX} />
              <Typography sx={{ ...METRIC_VALUE_SX, fontSize: '0.75rem' }}>
                {formatDateTime(serviceRequest.createdAt)}
              </Typography>
              <Typography sx={METRIC_LABEL_SX}>{t('serviceRequests.createdDateShort')}</Typography>
            </Box>
          </Grid>
          {serviceRequest.approvedAt && (
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={METRIC_CARD_SX}>
                <CheckCircle sx={{ ...METRIC_ICON_SX, color: 'success.main' }} />
                <Typography sx={{ ...METRIC_VALUE_SX, fontSize: '0.75rem' }}>
                  {formatDateTime(serviceRequest.approvedAt)}
                </Typography>
                <Typography sx={METRIC_LABEL_SX}>{t('serviceRequests.approvedDateShort')}</Typography>
              </Box>
            </Grid>
          )}
          {serviceRequest.completedAt && (
            <Grid item xs={6} sm={4} md={2}>
              <Box sx={METRIC_CARD_SX}>
                <CheckCircle sx={{ ...METRIC_ICON_SX, color: 'success.main' }} />
                <Typography sx={{ ...METRIC_VALUE_SX, fontSize: '0.75rem' }}>
                  {formatDateTime(serviceRequest.completedAt)}
                </Typography>
                <Typography sx={METRIC_LABEL_SX}>{t('serviceRequests.completedDateShort')}</Typography>
              </Box>
            </Grid>
          )}
        </Grid>

        {/* ── Two-column detail layout ──────────────────────────────────── */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
          {/* ── Left column: Infos ─────────────────────────────────────── */}
          <Box sx={{ flex: 7, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {/* Description */}
            <Paper sx={CARD_SX}>
              <Typography sx={SECTION_TITLE_SX}>
                {t('serviceRequests.fields.detailedDescription')}
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: 'text.primary', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                {serviceRequest.description || '—'}
              </Typography>
            </Paper>

            {/* Propriété */}
            <Paper sx={CARD_SX}>
              <Typography sx={SECTION_TITLE_SX}>
                {t('serviceRequests.sections.property')}
              </Typography>

              <Box sx={INFO_ROW_SX}>
                <LocationOn sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={INFO_LABEL_SX}>{t('serviceRequests.propertyNameLabel')}</Typography>
                  <Typography sx={INFO_VALUE_SX}>{serviceRequest.propertyName}</Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 0.5 }} />

              <Box sx={INFO_ROW_SX}>
                <LocationOn sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={INFO_LABEL_SX}>{t('serviceRequests.fullAddressLabel')}</Typography>
                  <Typography sx={INFO_VALUE_SX}>
                    {serviceRequest.propertyAddress}, {serviceRequest.propertyCity}
                    {serviceRequest.propertyPostalCode && ` ${serviceRequest.propertyPostalCode}`}
                  </Typography>
                </Box>
              </Box>

              {serviceRequest.propertyCountry && (
                <>
                  <Divider sx={{ my: 0.5 }} />
                  <Box sx={INFO_ROW_SX}>
                    <Flag sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={INFO_LABEL_SX}>{t('properties.country')}</Typography>
                      <Typography sx={INFO_VALUE_SX}>{serviceRequest.propertyCountry}</Typography>
                    </Box>
                  </Box>
                </>
              )}
            </Paper>
          </Box>

          {/* ── Right column: Assignation, Planning, Système ───────────── */}
          <Box sx={{ flex: 5, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {/* Personnes impliquées */}
            <Paper sx={CARD_SX}>
              <Typography sx={SECTION_TITLE_SX}>
                {t('serviceRequests.peopleInvolved')}
              </Typography>

              {/* Demandeur */}
              <Box sx={INFO_ROW_SX}>
                <Person sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={INFO_LABEL_SX}>{t('serviceRequests.fields.requestor')}</Typography>
                  <Typography sx={INFO_VALUE_SX}>
                    {serviceRequest.requestorName}
                  </Typography>
                  {serviceRequest.requestorEmail && (
                    <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                      {serviceRequest.requestorEmail}
                    </Typography>
                  )}
                </Box>
              </Box>

              <Divider sx={{ my: 0.5 }} />

              {/* Assignation */}
              <Box sx={INFO_ROW_SX}>
                {serviceRequest.assignedToType === 'team' ? (
                  <Group sx={{ fontSize: 16, color: 'text.secondary' }} />
                ) : (
                  <Assignment sx={{ fontSize: 16, color: 'text.secondary' }} />
                )}
                <Box sx={{ flex: 1 }}>
                  <Typography sx={INFO_LABEL_SX}>{t('serviceRequests.assignedTo')}</Typography>
                  {serviceRequest.assignedToName ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography sx={INFO_VALUE_SX}>
                        {serviceRequest.assignedToName}
                      </Typography>
                      {serviceRequest.assignedToType === 'team' && (
                        <Chip
                          label={t('serviceRequests.team')}
                          size="small"
                          variant="outlined"
                          color="info"
                          sx={{ height: 20, fontSize: '0.6rem', '& .MuiChip-label': { px: 0.5 } }}
                        />
                      )}
                    </Box>
                  ) : (
                    <Typography sx={{ ...INFO_VALUE_SX, color: 'text.disabled', fontStyle: 'italic' }}>
                      {t('serviceRequests.fields.noAssignment')}
                    </Typography>
                  )}
                  {serviceRequest.assignedToEmail && serviceRequest.assignedToType === 'user' && (
                    <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                      {serviceRequest.assignedToEmail}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Paper>

            {/* Planification */}
            <Paper sx={CARD_SX}>
              <Typography sx={SECTION_TITLE_SX}>
                {t('serviceRequests.planning')}
              </Typography>

              <Box sx={INFO_ROW_SX}>
                <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={INFO_LABEL_SX}>{t('serviceRequests.dueDateLabel')}</Typography>
                  <Typography sx={INFO_VALUE_SX}>
                    {formatDateTime(serviceRequest.dueDate) || '—'}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 0.5 }} />

              <Box sx={INFO_ROW_SX}>
                <AccessTime sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={INFO_LABEL_SX}>{t('serviceRequests.estimatedDurationLabel')}</Typography>
                  <Typography sx={INFO_VALUE_SX}>
                    {formatDuration(serviceRequest.estimatedDuration)}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* Informations système */}
            {(serviceRequest.updatedAt || serviceRequest.completedAt) && (
              <Paper sx={CARD_SX}>
                <Typography sx={SECTION_TITLE_SX}>
                  {t('serviceRequests.systemInfo')}
                </Typography>

                <Box sx={INFO_ROW_SX}>
                  <CalendarMonth sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={INFO_LABEL_SX}>{t('serviceRequests.createdDateLabel')}</Typography>
                    <Typography sx={INFO_VALUE_SX}>{formatDateTime(serviceRequest.createdAt)}</Typography>
                  </Box>
                </Box>

                {serviceRequest.updatedAt && (
                  <>
                    <Divider sx={{ my: 0.5 }} />
                    <Box sx={INFO_ROW_SX}>
                      <Schedule sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={INFO_LABEL_SX}>{t('serviceRequests.updatedDateShort')}</Typography>
                        <Typography sx={INFO_VALUE_SX}>{formatDateTime(serviceRequest.updatedAt)}</Typography>
                      </Box>
                    </Box>
                  </>
                )}

                {serviceRequest.completedAt && (
                  <>
                    <Divider sx={{ my: 0.5 }} />
                    <Box sx={INFO_ROW_SX}>
                      <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={INFO_LABEL_SX}>{t('serviceRequests.completedDateShort')}</Typography>
                        <Typography sx={INFO_VALUE_SX}>{formatDateTime(serviceRequest.completedAt)}</Typography>
                      </Box>
                    </Box>
                  </>
                )}
              </Paper>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default ServiceRequestDetails;
