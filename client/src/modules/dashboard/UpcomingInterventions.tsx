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
  Build,
  Schedule,
  ArrowForward,
  Warning
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { API_CONFIG } from '../../config/api';

interface UpcomingIntervention {
  id: number;
  title: string;
  property: string;
  scheduledDate: string;
  status: string;
  priority: string;
}

export default function UpcomingInterventions() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [interventions, setInterventions] = useState<UpcomingIntervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canViewInterventions = user?.permissions?.includes('interventions:view') || false;

  useEffect(() => {
    // Ne pas charger les données si l'utilisateur n'a pas la permission
    if (!canViewInterventions) {
      setLoading(false);
      return;
    }

    const loadUpcomingInterventions = async () => {
      try {
        const token = localStorage.getItem('kc_access_token');
        if (!token) {
          setError('Non authentifié');
          setLoading(false);
          return;
        }

        // Récupérer les interventions à venir (statut IN_PROGRESS ou PENDING avec date planifiée)
        const response = await fetch(
          `${API_CONFIG.BASE_URL}/api/interventions?size=20&sort=scheduledDate,asc`,
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
          
          // Filtrer et formater les interventions à venir
          const upcoming = items
            .filter((item: any) => {
              if (!item.scheduledDate) return false;
              const scheduledDate = new Date(item.scheduledDate);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              return scheduledDate >= today;
            })
            .slice(0, 5)
            .map((item: any) => ({
              id: item.id,
              title: item.title,
              property: item.property?.name || item.propertyName || 'N/A',
              scheduledDate: item.scheduledDate,
              status: item.status,
              priority: item.priority || 'NORMAL'
            }));
          
          setInterventions(upcoming);
        } else {
          setError('Erreur lors du chargement');
        }
      } catch (err) {
        console.error('Erreur chargement interventions à venir:', err);
        setError('Erreur de connexion');
      } finally {
        setLoading(false);
      }
    };

    loadUpcomingInterventions();
  }, [canViewInterventions]);

  const formatDate = (dateString: string) => {
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
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS': return 'info';
      case 'PENDING': return 'warning';
      case 'AWAITING_PAYMENT': return 'error';
      case 'AWAITING_VALIDATION': return 'warning';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'error';
      case 'HIGH': return 'warning';
      default: return 'default';
    }
  };

  // Ne pas afficher le widget si l'utilisateur n'a pas la permission
  if (!canViewInterventions) {
    return null;
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Schedule sx={{ fontSize: '20px' }} />
            {t('dashboard.upcomingInterventions')}
          </Typography>
          <Button
            variant="text"
            size="small"
            endIcon={<ArrowForward sx={{ fontSize: '16px' }} />}
            onClick={() => navigate('/interventions')}
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
        ) : interventions.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2, fontSize: '0.8125rem' }}>
            {t('dashboard.noUpcomingInterventions')}
          </Typography>
        ) : (
          <List sx={{ py: 0 }}>
            {interventions.map((intervention) => (
              <ListItem
                key={intervention.id}
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
                onClick={() => navigate(`/interventions/${intervention.id}`)}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {intervention.priority === 'URGENT' ? (
                    <Warning color="error" sx={{ fontSize: '20px' }} />
                  ) : (
                    <Build color="primary" sx={{ fontSize: '20px' }} />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={intervention.title}
                  secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                        {intervention.property}
                      </Typography>
                      <Chip
                        label={formatDate(intervention.scheduledDate)}
                        size="small"
                        sx={{ fontSize: '0.6875rem', height: 20 }}
                        color="info"
                      />
                      <Chip
                        label={intervention.status}
                        size="small"
                        sx={{ fontSize: '0.6875rem', height: 20 }}
                        color={getStatusColor(intervention.status) as any}
                      />
                      {intervention.priority === 'URGENT' && (
                        <Chip
                          label={intervention.priority}
                          size="small"
                          sx={{ fontSize: '0.6875rem', height: 20 }}
                          color="error"
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
