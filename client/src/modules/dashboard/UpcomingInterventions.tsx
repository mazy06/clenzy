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
  Build,
  Schedule,
  ArrowForward,
  Warning
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useDashboardData } from '../../hooks/useDashboardData';
import { formatRelativeDate } from '../../utils/formatUtils';
import { getInterventionStatusColor } from '../../utils/statusUtils';

const UpcomingInterventions: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { upcomingInterventions, loading } = useDashboardData();

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 }, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexShrink: 0 }}>
          <Typography variant="subtitle2" sx={{ fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Schedule sx={{ fontSize: 16 }} />
            {t('dashboard.upcomingInterventions')}
          </Typography>
          <Button
            variant="text"
            size="small"
            endIcon={<ArrowForward sx={{ fontSize: 14 }} />}
            onClick={() => navigate('/interventions')}
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
        ) : upcomingInterventions.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 1.5, fontSize: '0.75rem' }}>
            {t('dashboard.noUpcomingInterventions')}
          </Typography>
        ) : (
          <List sx={{ py: 0, flex: 1, overflow: 'auto', minHeight: 0 }}>
            {upcomingInterventions.map((intervention) => (
              <ListItem
                key={intervention.id}
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
                onClick={() => navigate(`/interventions/${intervention.id}`)}
              >
                <ListItemIcon sx={{ minWidth: 30 }}>
                  {intervention.priority === 'URGENT' ? (
                    <Warning color="error" sx={{ fontSize: 16 }} />
                  ) : (
                    <Build color="primary" sx={{ fontSize: 16 }} />
                  )}
                </ListItemIcon>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 0.5, flex: 1, minWidth: 0 }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      variant="body2"
                      sx={{ fontSize: '0.75rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {intervention.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.625rem', display: 'block' }}>
                      {intervention.property} &bull; {formatRelativeDate(intervention.scheduledDate, t)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, alignItems: 'center' }}>
                    <Chip
                      label={intervention.status}
                      size="small"
                      sx={{ fontSize: '0.5625rem', height: 16, '& .MuiChip-label': { px: 0.5 } }}
                      color={getInterventionStatusColor(intervention.status)}
                    />
                    {intervention.priority === 'URGENT' && (
                      <Chip
                        label={intervention.priority}
                        size="small"
                        sx={{ fontSize: '0.5625rem', height: 16, '& .MuiChip-label': { px: 0.5 } }}
                        color="error"
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

UpcomingInterventions.displayName = 'UpcomingInterventions';

export default UpcomingInterventions;
