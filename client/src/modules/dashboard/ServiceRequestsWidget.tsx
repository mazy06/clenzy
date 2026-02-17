import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  Chip,
  Box,
  Button,
  CircularProgress
} from '@mui/material';
import {
  Assignment,
  ArrowForward,
  PriorityHigh
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useDashboardData } from '../../hooks/useDashboardData';
import { formatRelativeDate } from '../../utils/formatUtils';
import {
  getServiceRequestStatusColor,
  getServiceRequestStatusLabel,
  getServiceRequestPriorityColor,
} from '../../utils/statusUtils';

const ServiceRequestsWidget: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { serviceRequests, loading } = useDashboardData();

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 }, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexShrink: 0 }}>
          <Typography variant="subtitle2" sx={{ fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Assignment sx={{ fontSize: 16 }} />
            {t('dashboard.serviceRequests')}
          </Typography>
          <Button
            variant="text"
            size="small"
            endIcon={<ArrowForward sx={{ fontSize: 14 }} />}
            onClick={() => navigate('/service-requests')}
            sx={{
              textTransform: 'none',
              fontSize: '0.75rem',
              py: 0.25,
              px: 0.75,
              minWidth: 'auto',
            }}
          >
            {t('dashboard.viewAll')}
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={20} />
          </Box>
        ) : serviceRequests.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 1.5, fontSize: '0.75rem' }}>
            {t('dashboard.noServiceRequests')}
          </Typography>
        ) : (
          <List sx={{ py: 0, flex: 1, overflow: 'auto', minHeight: 0 }}>
            {serviceRequests.map((request) => (
              <ListItem
                key={request.id}
                sx={{
                  px: 0,
                  py: 0.5,
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'action.hover'
                  },
                  '&:not(:last-child)': {
                    borderBottom: '1px solid',
                    borderColor: 'divider'
                  }
                }}
                onClick={() => navigate(`/service-requests/${request.id}`)}
              >
                <ListItemIcon sx={{ minWidth: 30 }}>
                  {(request.priority === 'urgent' || request.priority === 'critical') ? (
                    <PriorityHigh color="error" sx={{ fontSize: 16 }} />
                  ) : (
                    <Assignment color="primary" sx={{ fontSize: 16 }} />
                  )}
                </ListItemIcon>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 0.5, flex: 1, minWidth: 0 }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      variant="body2"
                      sx={{ fontSize: '0.75rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {request.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.625rem', display: 'block' }}>
                      {request.propertyName}
                      {request.dueDate ? ` \u2022 ${formatRelativeDate(request.dueDate, t)}` : ''}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, alignItems: 'center' }}>
                    <Chip
                      label={getServiceRequestStatusLabel(request.status, t)}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.625rem', height: 22, borderWidth: 1.5, '& .MuiChip-label': { px: 0.75 } }}
                      color={getServiceRequestStatusColor(request.status)}
                    />
                    {(request.priority === 'urgent' || request.priority === 'critical' || request.priority === 'high') && (
                      <Chip
                        label={request.priority === 'urgent' || request.priority === 'critical' ? t('serviceRequests.priorities.critical') : t('serviceRequests.priorities.high')}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.625rem', height: 22, borderWidth: 1.5, '& .MuiChip-label': { px: 0.75 } }}
                        color={getServiceRequestPriorityColor(request.priority)}
                      />
                    )}
                  </Box>
                </Box>
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
});

ServiceRequestsWidget.displayName = 'ServiceRequestsWidget';

export default ServiceRequestsWidget;
