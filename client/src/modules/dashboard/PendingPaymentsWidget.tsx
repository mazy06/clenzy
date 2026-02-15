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
  Payment,
  ArrowForward,
  Euro
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { interventionsApi } from '../../services/api';

interface PendingPaymentItem {
  id: number;
  title: string;
  property: string;
  estimatedCost: number | null;
  scheduledDate: string;
}

interface InterventionApiItem {
  id: number;
  title: string;
  property?: { name?: string };
  propertyName?: string;
  estimatedCost?: number;
  scheduledDate?: string;
  status: string;
}

export default function PendingPaymentsWidget() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [payments, setPayments] = useState<PendingPaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canViewInterventions = user?.permissions?.includes('interventions:view') || false;

  useEffect(() => {
    if (!canViewInterventions) {
      setLoading(false);
      return;
    }

    const loadPendingPayments = async () => {
      try {
        const data = await interventionsApi.getAll({
          status: 'AWAITING_PAYMENT',
          size: 10,
          sort: 'scheduledDate,asc'
        } as any);
        const items = (data as any).content || data || [];

        const pending = items
          .slice(0, 5)
          .map((item: InterventionApiItem) => ({
            id: item.id,
            title: item.title,
            property: item.property?.name || item.propertyName || 'N/A',
            estimatedCost: item.estimatedCost ?? null,
            scheduledDate: item.scheduledDate || '',
          }));

        setPayments(pending);
      } catch (err) {
        setError('Erreur de connexion');
      } finally {
        setLoading(false);
      }
    };

    loadPendingPayments();
  }, [canViewInterventions]);

  const formatCost = (cost: number | null) => {
    if (cost === null || cost === undefined) return '--';
    return `${cost.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} \u20AC`;
  };

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

  if (!canViewInterventions) {
    return null;
  }

  return (
    <Card>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Payment sx={{ fontSize: 16 }} />
            Paiements en attente
          </Typography>
          <Button
            variant="text"
            size="small"
            endIcon={<ArrowForward sx={{ fontSize: 14 }} />}
            onClick={() => navigate('/interventions/pending-payment')}
            sx={{
              textTransform: 'none',
              fontSize: '0.75rem',
              py: 0.25,
              px: 0.75,
              minWidth: 'auto',
            }}
          >
            Voir tout
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
        ) : payments.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 1.5, fontSize: '0.75rem' }}>
            Aucun paiement en attente
          </Typography>
        ) : (
          <List sx={{ py: 0 }}>
            {payments.map((payment) => (
              <ListItem
                key={payment.id}
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
                onClick={() => navigate(`/interventions/${payment.id}`)}
              >
                <ListItemIcon sx={{ minWidth: 30 }}>
                  <Euro sx={{ fontSize: 16, color: 'warning.main' }} />
                </ListItemIcon>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 0.5, flex: 1, minWidth: 0 }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      variant="body2"
                      sx={{ fontSize: '0.75rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {payment.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.625rem', display: 'block' }}>
                      {payment.property}
                      {payment.scheduledDate ? ` \u2022 ${formatDate(payment.scheduledDate)}` : ''}
                    </Typography>
                  </Box>
                  <Chip
                    label={formatCost(payment.estimatedCost)}
                    size="small"
                    sx={{ fontSize: '0.5625rem', height: 16, flexShrink: 0, '& .MuiChip-label': { px: 0.5 } }}
                    color="warning"
                  />
                </Box>
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}
