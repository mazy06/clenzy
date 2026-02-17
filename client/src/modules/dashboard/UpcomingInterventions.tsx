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
import { formatRelativeDate } from '../../utils/formatUtils';
import { getInterventionStatusColor } from '../../utils/statusUtils';
import type { UpcomingIntervention } from '../../hooks/useDashboardOverview';

// ─── Props ───────────────────────────────────────────────────────────────────

interface UpcomingInterventionsProps {
  upcomingInterventions: UpcomingIntervention[];
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
  borderWidth: 1,
  letterSpacing: '0.02em',
  textTransform: 'uppercase' as const,
  '& .MuiChip-label': { px: 0.625 },
} as const;

const UpcomingInterventions: React.FC<UpcomingInterventionsProps> = React.memo(({ upcomingInterventions, loading }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={CARD_CONTENT_SX}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75, flexShrink: 0 }}>
          <Typography variant="subtitle2" sx={SECTION_TITLE_SX}>
            <Schedule sx={{ fontSize: 16 }} />
            {t('dashboard.upcomingInterventions')}
          </Typography>
          <Button
            variant="text"
            size="small"
            endIcon={<ArrowForward sx={{ fontSize: 12 }} />}
            onClick={() => navigate('/interventions')}
            sx={VIEW_ALL_SX}
          >
            {t('dashboard.viewAll')}
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}>
            <CircularProgress size={18} />
          </Box>
        ) : upcomingInterventions.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 1.5, fontSize: '0.6875rem' }}>
            {t('dashboard.noUpcomingInterventions')}
          </Typography>
        ) : (
          <List sx={{ py: 0, flex: 1, overflow: 'auto', minHeight: 0 }}>
            {upcomingInterventions.map((intervention) => (
              <ListItem
                key={intervention.id}
                sx={LIST_ITEM_SX}
                onClick={() => navigate(`/interventions/${intervention.id}`)}
              >
                <ListItemIcon sx={{ minWidth: 28 }}>
                  {intervention.priority === 'URGENT' ? (
                    <Warning color="error" sx={{ fontSize: 16 }} />
                  ) : (
                    <Build color="primary" sx={{ fontSize: 16 }} />
                  )}
                </ListItemIcon>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 0.5, flex: 1, minWidth: 0 }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" sx={ITEM_TITLE_SX}>
                      {intervention.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={ITEM_SUB_SX}>
                      {intervention.property} &bull; {formatRelativeDate(intervention.scheduledDate, t)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.375, flexShrink: 0, alignItems: 'center' }}>
                    <Chip
                      label={intervention.status}
                      size="small"
                      variant="outlined"
                      sx={CHIP_SX}
                      color={getInterventionStatusColor(intervention.status)}
                    />
                    {intervention.priority === 'URGENT' && (
                      <Chip
                        label={intervention.priority}
                        size="small"
                        variant="outlined"
                        sx={CHIP_SX}
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
