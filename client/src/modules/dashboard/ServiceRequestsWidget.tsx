import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Box,
  Button,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Assignment,
  Schedule,
  ArrowForward,
  PriorityHigh,
  LocationOn
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';

interface ServiceRequest {
  id: string;
  title: string;
  propertyName: string;
  status: string;
  priority: string;
  dueDate: string;
  createdAt: string;
}

export default function ServiceRequestsWidget() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canViewServiceRequests = user?.permissions?.includes('service-requests:view') || false;

  useEffect(() => {
    // Ne pas charger les données si l'utilisateur n'a pas la permission
    if (!canViewServiceRequests) {
      setLoading(false);
      return;
    }

    const loadServiceRequests = async () => {
      try {
        const token = localStorage.getItem('kc_access_token');
        if (!token) {
          setError('Non authentifié');
          setLoading(false);
          return;
        }

        // Récupérer les demandes de service récentes (limitées à 5)
        const response = await fetch(
          `${API_CONFIG.BASE_URL}/api/service-requests?size=5&sort=createdAt,desc`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          const items = data.content || data || [];
          
          // Formater les demandes de service
          const requests = items
            .slice(0, 5)
            .map((item: any) => ({
              id: item.id.toString(),
              title: item.title,
              propertyName: item.property?.name || 'Propriété inconnue',
              status: item.status || 'PENDING',
              priority: item.priority?.toLowerCase() || 'normal',
              dueDate: item.desiredDate || item.dueDate || '',
              createdAt: item.createdAt || ''
            }));
          
          setServiceRequests(requests);
        } else {
          setError('Erreur lors du chargement');
        }
      } catch (err) {
        console.error('Erreur chargement demandes de service:', err);
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
      case 'pending':
        return t('serviceRequests.statuses.pending');
      case 'approved':
        return t('serviceRequests.statuses.approved');
      case 'in_progress':
        return t('serviceRequests.statuses.inProgress');
      case 'completed':
        return t('serviceRequests.statuses.completed');
      case 'cancelled':
        return t('serviceRequests.statuses.cancelled');
      case 'rejected':
        return t('serviceRequests.statuses.rejected');
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case 'pending':
        return 'warning';
      case 'approved':
        return 'info';
      case 'in_progress':
        return 'info';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'default';
      case 'rejected':
        return 'error';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    const priorityLower = priority?.toLowerCase() || '';
    switch (priorityLower) {
      case 'urgent':
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      default:
        return 'default';
    }
  };

  // Ne pas afficher le widget si l'utilisateur n'a pas la permission
  if (!canViewServiceRequests) {
    return null;
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Assignment sx={{ fontSize: '20px' }} />
            {t('dashboard.serviceRequests')}
          </Typography>
          <Button
            variant="text"
            size="small"
            endIcon={<ArrowForward sx={{ fontSize: '16px' }} />}
            onClick={() => navigate('/service-requests')}
            sx={{ 
              textTransform: 'none',
              fontSize: '0.8125rem',
              py: 0.5,
              px: 1
            }}
          >
            {t('dashboard.viewAll')}
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ fontSize: '0.8125rem' }}>
            {error}
          </Alert>
        ) : serviceRequests.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2, fontSize: '0.8125rem' }}>
            {t('dashboard.noServiceRequests')}
          </Typography>
        ) : (
          <List sx={{ py: 0 }}>
            {serviceRequests.map((request) => (
              <ListItem
                key={request.id}
                sx={{
                  px: 0,
                  py: 1,
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
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {(request.priority === 'urgent' || request.priority === 'critical') ? (
                    <PriorityHigh color="error" sx={{ fontSize: '20px' }} />
                  ) : (
                    <Assignment color="primary" sx={{ fontSize: '20px' }} />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={request.title}
                  secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <LocationOn sx={{ fontSize: '14px', color: 'text.secondary' }} />
                        <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                          {request.propertyName}
                        </Typography>
                      </Box>
                      {request.dueDate && (
                        <Chip
                          label={formatDate(request.dueDate)}
                          size="small"
                          sx={{ fontSize: '0.6875rem', height: 20 }}
                          color="info"
                          icon={<Schedule sx={{ fontSize: '12px' }} />}
                        />
                      )}
                      <Chip
                        label={getStatusLabel(request.status)}
                        size="small"
                        sx={{ fontSize: '0.6875rem', height: 20 }}
                        color={getStatusColor(request.status) as any}
                      />
                      {(request.priority === 'urgent' || request.priority === 'critical' || request.priority === 'high') && (
                        <Chip
                          label={request.priority === 'urgent' || request.priority === 'critical' ? t('serviceRequests.priorities.critical') : t('serviceRequests.priorities.high')}
                          size="small"
                          sx={{ fontSize: '0.6875rem', height: 20 }}
                          color={getPriorityColor(request.priority) as any}
                        />
                      )}
                    </Box>
                  }
                  primaryTypographyProps={{
                    sx: { fontSize: '0.875rem', fontWeight: 500 }
                  }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}
