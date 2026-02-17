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
import { formatRelativeDate } from '../../utils/formatUtils';
import type { PendingPaymentItem } from '../../hooks/useDashboardOverview';

// ─── Props ───────────────────────────────────────────────────────────────────

interface PendingPaymentsWidgetProps {
  pendingPayments: PendingPaymentItem[];
  loading: boolean;
}

// ─── Stable sx constants ────────────────────────────────────────────────────

const CARD_CONTENT_SX = {
  p: 1.25, '&:last-child': { pb: 1.25 },
  flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
} as const;

const SECTION_TITLE_SX = {
  fontSize: '0.75rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  color: 'text.secondary',
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
} as const;

const VIEW_ALL_SX = {
  textTransform: 'none',
  fontSize: '0.75rem',
  fontWeight: 600,
  py: 0.25,
  px: 0.75,
  minWidth: 'auto',
  letterSpacing: '0.01em',
} as const;

const LIST_ITEM_SX = {
  px: 0,
  py: 0.5,
  cursor: 'pointer',
  '&:hover': { bgcolor: 'action.hover' },
  '&:not(:last-child)': { borderBottom: '1px solid', borderColor: 'divider' },
} as const;

const ITEM_TITLE_SX = {
  fontSize: '0.8125rem',
  fontWeight: 500,
  letterSpacing: '-0.01em',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

const ITEM_SUB_SX = {
  fontSize: '0.6875rem',
  display: 'block',
  letterSpacing: '0.01em',
} as const;

const CHIP_SX = {
  fontSize: '0.625rem',
  height: 22,
  flexShrink: 0,
  borderWidth: 1,
  fontVariantNumeric: 'tabular-nums',
  '& .MuiChip-label': { px: 0.625 },
} as const;

const PendingPaymentsWidget: React.FC<PendingPaymentsWidgetProps> = React.memo(({ pendingPayments, loading }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const formatCost = (cost: number | null) => {
    if (cost === null || cost === undefined) return '--';
    return `${cost.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} \u20AC`;
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={CARD_CONTENT_SX}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75, flexShrink: 0 }}>
          <Typography variant="subtitle2" sx={SECTION_TITLE_SX}>
            <Payment sx={{ fontSize: 16 }} />
            {t('dashboard.pendingPayments')}
          </Typography>
          <Button
            variant="text"
            size="small"
            endIcon={<ArrowForward sx={{ fontSize: 12 }} />}
            onClick={() => navigate('/interventions/pending-payment')}
            sx={VIEW_ALL_SX}
          >
            {t('dashboard.viewAll')}
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}>
            <CircularProgress size={18} />
          </Box>
        ) : pendingPayments.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 1.5, fontSize: '0.6875rem' }}>
            {t('dashboard.noPendingPayments')}
          </Typography>
        ) : (
          <List sx={{ py: 0, flex: 1, overflow: 'auto', minHeight: 0 }}>
            {pendingPayments.map((payment) => (
              <ListItem
                key={payment.id}
                sx={LIST_ITEM_SX}
                onClick={() => navigate(`/interventions/${payment.id}`)}
              >
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <Euro sx={{ fontSize: 16, color: 'warning.main' }} />
                </ListItemIcon>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 0.5, flex: 1, minWidth: 0 }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" sx={ITEM_TITLE_SX}>
                      {payment.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={ITEM_SUB_SX}>
                      {payment.property}
                      {payment.scheduledDate ? ` \u2022 ${formatRelativeDate(payment.scheduledDate, t)}` : ''}
                    </Typography>
                  </Box>
                  <Chip
                    label={formatCost(payment.estimatedCost)}
                    size="small"
                    variant="outlined"
                    color="warning"
                    sx={CHIP_SX}
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
