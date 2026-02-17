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
import { useDashboardData } from '../../hooks/useDashboardData';

const AlertsWidget: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { alerts, loading } = useDashboardData();

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
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 }, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Typography variant="subtitle2" sx={{ fontSize: '0.8125rem', fontWeight: 600, mb: 1, flexShrink: 0 }}>
          {t('dashboard.alerts')}
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={20} />
          </Box>
        ) : alerts.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 1 }}>
            <CheckCircle color="success" sx={{ fontSize: 20, mb: 0.5, opacity: 0.5 }} />
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
                    py: 0.5,
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'action.hover'
                    }
                  }}
                  onClick={() => navigate(alert.route)}
                >
                  <ListItemIcon sx={{ minWidth: 30 }}>
                    {getIcon(alert.type)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                          {alert.title}
                        </Typography>
                        {alert.count !== undefined && (
                          <Chip
                            label={alert.count}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.625rem', height: 22, borderWidth: 1.5, '& .MuiChip-label': { px: 0.75 } }}
                            color={getColor(alert.type)}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" sx={{ fontSize: '0.625rem' }}>
                        {alert.description}
                      </Typography>
                    }
                  />
                  <ArrowForward sx={{ fontSize: 14, color: 'text.secondary' }} />
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
