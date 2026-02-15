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
  Alert,
  Divider
} from '@mui/material';
import {
  Warning,
  Payment,
  CheckCircle,
  Assignment,
  ArrowForward
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { interventionsApi } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

interface AlertItem {
  id: number;
  type: 'urgent' | 'payment' | 'validation' | 'overdue';
  title: string;
  description: string;
  count?: number;
  route: string;
}

export default function AlertsWidget() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAdmin, isManager, isHost, user } = useAuth();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  const canViewInterventions = user?.permissions?.includes('interventions:view') || false;

  useEffect(() => {
    // Ne pas charger les données si l'utilisateur n'a pas la permission
    if (!canViewInterventions) {
      setLoading(false);
      return;
    }

    const loadAlerts = async () => {
      try {
        const alertItems: AlertItem[] = [];

        // Récupérer les interventions urgentes (IN_PROGRESS et PENDING)
        let urgentItems: Array<{ id: number; status?: string; priority?: string }> = [];

        try {
          const urgentInProgressData = await interventionsApi.getAll({ priority: 'URGENT', status: 'IN_PROGRESS', size: 10 } as any);
          const items = (urgentInProgressData as any).content || urgentInProgressData || [];
          urgentItems = [...urgentItems, ...items];
        } catch (err) {
        }

        try {
          const urgentPendingData = await interventionsApi.getAll({ priority: 'URGENT', status: 'PENDING', size: 10 } as any);
          const items = (urgentPendingData as any).content || urgentPendingData || [];
          urgentItems = [...urgentItems, ...items];
        } catch (err) {
        }

        // Dédupliquer par ID
        const uniqueUrgentItems = urgentItems.filter((item, index, self) =>
          index === self.findIndex((t) => t.id === item.id)
        );

        if (uniqueUrgentItems.length > 0) {
          alertItems.push({
            id: 1,
            type: 'urgent',
            title: t('dashboard.urgentInterventions'),
            description: `${uniqueUrgentItems.length} ${t('dashboard.interventionsRequireAttention')}`,
            count: uniqueUrgentItems.length,
            route: '/interventions?priority=URGENT'
          });
        }

        // Pour les managers/admins : interventions en attente de validation
        if (isManager() || isAdmin()) {
          try {
            const validationData = await interventionsApi.getAll({ status: 'AWAITING_VALIDATION', size: 10 } as any);
            const validationItems = (validationData as any).content || validationData || [];
            if (validationItems.length > 0) {
              alertItems.push({
                id: 2,
                type: 'validation',
                title: t('dashboard.interventionsPendingValidation'),
                description: `${validationItems.length} ${t('dashboard.interventionsAwaitingValidation')}`,
                count: validationItems.length,
                route: '/interventions/pending-validation'
              });
            }
          } catch (err) {
          }
        }

        // Pour les hosts : interventions en attente de paiement
        if (isHost()) {
          try {
            const paymentData = await interventionsApi.getAll({ status: 'AWAITING_PAYMENT', size: 10 } as any);
            const paymentItems = (paymentData as any).content || paymentData || [];
            if (paymentItems.length > 0) {
              alertItems.push({
                id: 3,
                type: 'payment',
                title: t('dashboard.interventionsPendingPayment'),
                description: `${paymentItems.length} ${t('dashboard.interventionsAwaitingPayment')}`,
                count: paymentItems.length,
                route: '/interventions/pending-payment'
              });
            }
          } catch (err) {
          }
        }

        setAlerts(alertItems);
      } catch (err) {
      } finally {
        setLoading(false);
      }
    };

    loadAlerts();
  }, [isAdmin, isManager, isHost, canViewInterventions, t]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'urgent':
        return <Warning color="error" sx={{ fontSize: '20px' }} />;
      case 'payment':
        return <Payment color="warning" sx={{ fontSize: '20px' }} />;
      case 'validation':
        return <CheckCircle color="info" sx={{ fontSize: '20px' }} />;
      default:
        return <Assignment color="primary" sx={{ fontSize: '20px' }} />;
    }
  };

  const getColor = (type: string): 'error' | 'warning' | 'info' | 'default' => {
    switch (type) {
      case 'urgent':
        return 'error';
      case 'payment':
        return 'warning';
      case 'validation':
        return 'info';
      default:
        return 'default';
    }
  };

  // Ne pas afficher le widget si l'utilisateur n'a pas la permission
  if (!canViewInterventions) {
    return null;
  }

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mb: 1.5 }}>
          {t('dashboard.alerts')}
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : alerts.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <CheckCircle color="success" sx={{ fontSize: '40px', mb: 1, opacity: 0.5 }} />
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
              {t('dashboard.noAlerts')}
            </Typography>
          </Box>
        ) : (
          <List sx={{ py: 0 }}>
            {alerts.map((alert, index) => (
              <React.Fragment key={alert.id}>
                <ListItem
                  sx={{
                    px: 0,
                    py: 1.5,
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'action.hover'
                    }
                  }}
                  onClick={() => navigate(alert.route)}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {getIcon(alert.type)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>
                          {alert.title}
                        </Typography>
                        {alert.count !== undefined && (
                          <Chip
                            label={alert.count}
                            size="small"
                            sx={{ fontSize: '0.6875rem', height: 20 }}
                            color={getColor(alert.type)}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" sx={{ fontSize: '0.75rem', mt: 0.5 }}>
                        {alert.description}
                      </Typography>
                    }
                  />
                  <ArrowForward sx={{ fontSize: '16px', color: 'text.secondary' }} />
                </ListItem>
                {index < alerts.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}
