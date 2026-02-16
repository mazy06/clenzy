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
  Payment,
  ArrowForward,
  Euro
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useDashboardData } from '../../hooks/useDashboardData';
import { formatRelativeDate } from '../../utils/formatUtils';

const PendingPaymentsWidget: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { pendingPayments, loading } = useDashboardData();

  const formatCost = (cost: number | null) => {
    if (cost === null || cost === undefined) return '--';
    return `${cost.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} \u20AC`;
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 }, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexShrink: 0 }}>
          <Typography variant="subtitle2" sx={{ fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Payment sx={{ fontSize: 16 }} />
            {t('dashboard.pendingPayments')}
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
            {t('dashboard.viewAll')}
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={20} />
          </Box>
        ) : pendingPayments.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 1.5, fontSize: '0.75rem' }}>
            {t('dashboard.noPendingPayments')}
          </Typography>
        ) : (
          <List sx={{ py: 0, flex: 1, overflow: 'auto', minHeight: 0 }}>
            {pendingPayments.map((payment) => (
              <ListItem
                key={payment.id}
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
                      {payment.scheduledDate ? ` \u2022 ${formatRelativeDate(payment.scheduledDate, t)}` : ''}
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
});

PendingPaymentsWidget.displayName = 'PendingPaymentsWidget';

export default PendingPaymentsWidget;
