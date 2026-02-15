import React, { useState, useEffect } from 'react';
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
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Assignment,
  ArrowForward,
  PriorityHigh
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import apiClient from '../../services/apiClient';

interface ServiceRequest {
  id: string;
  title: string;
  propertyName: string;
  status: string;
  priority: string;
  dueDate: string;
  createdAt: string;
}

interface ServiceRequestApiItem {
  id: number;
  title: string;
  property?: { name?: string };
  status?: string;
  priority?: string;
  desiredDate?: string;
  dueDate?: string;
  createdAt?: string;
}

type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

export default function ServiceRequestsWidget() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canViewServiceRequests = user?.permissions?.includes('service-requests:view') || false;

  useEffect(() => {
    if (!canViewServiceRequests) {
      setLoading(false);
      return;
    }

    const loadServiceRequests = async () => {
      try {
        const data = await apiClient.get<any>('/service-requests', {
          params: { size: 5, sort: 'createdAt,desc' }
        });
        const items = data.content || data || [];

        const requests = items
          .slice(0, 5)
          .map((item: ServiceRequestApiItem) => ({
            id: item.id.toString(),
            title: item.title,
            propertyName: item.property?.name || 'Propriete inconnue',
            status: item.status || 'PENDING',
            priority: item.priority?.toLowerCase() || 'normal',
            dueDate: item.desiredDate || item.dueDate || '',
            createdAt: item.createdAt || ''
          }));

        setServiceRequests(requests);
      } catch (err) {
        setError('Erreur de connexion');
      } finally {
        setLoading(false);
      }
    };

    loadServiceRequests();
  }, [canViewServiceRequests]);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (date.toDateString() === today.toDateString()) {
        return t('dashboard.today');
      } else if (date.toDateString() === tomorrow.toDateString()) {
        return t('dashboard.tomorrow');
      } else {
        return date.toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
          year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
        });
      }
    } catch {
      return '';
    }
  };

  const getStatusLabel = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case 'pending': return t('serviceRequests.statuses.pending');
      case 'approved': return t('serviceRequests.statuses.approved');
      case 'in_progress': return t('serviceRequests.statuses.inProgress');
      case 'completed': return t('serviceRequests.statuses.completed');
      case 'cancelled': return t('serviceRequests.statuses.cancelled');
      case 'rejected': return t('serviceRequests.statuses.rejected');
      default: return status;
    }
  };

  const getStatusColor = (status: string): ChipColor => {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case 'pending': return 'warning';
      case 'approved': return 'info';
      case 'in_progress': return 'info';
      case 'completed': return 'success';
      case 'cancelled': return 'default';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string): ChipColor => {
    const priorityLower = priority?.toLowerCase() || '';
    switch (priorityLower) {
      case 'urgent':
      case 'critical': return 'error';
      case 'high': return 'warning';
      default: return 'default';
    }
  };

  if (!canViewServiceRequests) {
    return null;
  }

  return (
    <Card>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
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
        ) : error ? (
          <Alert severity="error" sx={{ fontSize: '0.75rem' }}>
            {error}
          </Alert>
        ) : serviceRequests.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 1.5, fontSize: '0.75rem' }}>
            {t('dashboard.noServiceRequests')}
          </Typography>
        ) : (
          <List sx={{ py: 0 }}>
            {serviceRequests.map((request) => (
              <ListItem
                key={request.id}
                sx={{
                  px: 0,
                  py: 0.75,
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
                      {request.dueDate ? ` \u2022 ${formatDate(request.dueDate)}` : ''}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, alignItems: 'center' }}>
                    <Chip
                      label={getStatusLabel(request.status)}
                      size="small"
                      sx={{ fontSize: '0.5625rem', height: 16, '& .MuiChip-label': { px: 0.5 } }}
                      color={getStatusColor(request.status)}
                    />
                    {(request.priority === 'urgent' || request.priority === 'critical' || request.priority === 'high') && (
                      <Chip
                        label={request.priority === 'urgent' || request.priority === 'critical' ? t('serviceRequests.priorities.critical') : t('serviceRequests.priorities.high')}
                        size="small"
                        sx={{ fontSize: '0.5625rem', height: 16, '& .MuiChip-label': { px: 0.5 } }}
                        color={getPriorityColor(request.priority)}
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
}
