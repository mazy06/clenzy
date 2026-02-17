import React from 'react';
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
  CircularProgress,
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
import type { AlertItem } from '../../hooks/useDashboardOverview';

// ─── Props ───────────────────────────────────────────────────────────────────

interface AlertsWidgetProps {
  alerts: AlertItem[];
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
  mb: 0.75,
  flexShrink: 0,
} as const;

const CHIP_SX = {
  fontSize: '0.625rem',
  height: 22,
  borderWidth: 1,
  letterSpacing: '0.02em',
  '& .MuiChip-label': { px: 0.625 },
} as const;

const AlertsWidget: React.FC<AlertsWidgetProps> = React.memo(({ alerts, loading }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const getIcon = (type: string) => {
    switch (type) {
      case 'urgent': return <Warning color="error" sx={{ fontSize: 16 }} />;
      case 'payment': return <Payment color="warning" sx={{ fontSize: 16 }} />;
      case 'validation': return <CheckCircle color="info" sx={{ fontSize: 16 }} />;
      default: return <Assignment color="primary" sx={{ fontSize: 16 }} />;
    }
  };

  const getColor = (type: string): 'error' | 'warning' | 'info' | 'default' => {
    switch (type) {
      case 'urgent': return 'error';
      case 'payment': return 'warning';
      case 'validation': return 'info';
      default: return 'default';
    }
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={CARD_CONTENT_SX}>
        <Typography variant="subtitle2" sx={SECTION_TITLE_SX}>
          {t('dashboard.alerts')}
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}>
            <CircularProgress size={18} />
          </Box>
        ) : alerts.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 1 }}>
            <CheckCircle color="success" sx={{ fontSize: 18, mb: 0.5, opacity: 0.5 }} />
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
              {t('dashboard.noAlerts')}
            </Typography>
          </Box>
        ) : (
          <List sx={{ py: 0, flex: 1, overflow: 'auto', minHeight: 0 }}>
            {alerts.slice(0, 3).map((alert, index) => (
              <React.Fragment key={alert.id}>
                <ListItem
                  sx={{
                    px: 0,
                    py: 0.375,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                  onClick={() => navigate(alert.route)}
                >
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    {getIcon(alert.type)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" sx={{ fontSize: '0.8125rem', fontWeight: 500, letterSpacing: '-0.01em' }}>
                          {alert.title}
                        </Typography>
                        {alert.count !== undefined && (
                          <Chip
                            label={alert.count}
                            size="small"
                            variant="outlined"
                            sx={CHIP_SX}
                            color={getColor(alert.type)}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" sx={{ fontSize: '0.6875rem', letterSpacing: '0.01em' }}>
                        {alert.description}
                      </Typography>
                    }
                  />
                  <ArrowForward sx={{ fontSize: 12, color: 'text.secondary' }} />
                </ListItem>
                {index < alerts.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
});

AlertsWidget.displayName = 'AlertsWidget';

export default AlertsWidget;
