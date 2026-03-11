import React from 'react';
import { Box, Card, CardContent, Typography, Button, useTheme } from '@mui/material';
import { Home, Add } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';

// ─── Component ──────────────────────────────────────────────────────────────

const DashboardEmptyState: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Card
      sx={{
        textAlign: 'center',
        borderRadius: '12px',
        border: 'none',
        boxShadow: isDark
          ? '0 2px 12px rgba(0,0,0,0.3)'
          : '0 2px 12px rgba(107,138,154,0.10)',
        overflow: 'visible',
      }}
    >
      <CardContent sx={{ py: 5, px: 3 }}>
        {/* Gradient circle icon */}
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6B8A9A 0%, #8BA3B3 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2.5,
            boxShadow: '0 4px 16px rgba(107,138,154,0.25)',
          }}
        >
          <Home sx={{ fontSize: 32, color: '#fff' }} />
        </Box>

        {/* Title */}
        <Typography
          variant="h6"
          sx={{
            fontSize: '1.125rem',
            fontWeight: 700,
            color: 'text.primary',
            mb: 1,
            lineHeight: 1.3,
          }}
        >
          {t('dashboard.emptyState.title')}
        </Typography>

        {/* Description */}
        <Typography
          variant="body2"
          sx={{
            fontSize: '0.875rem',
            color: 'text.secondary',
            lineHeight: 1.6,
            maxWidth: 420,
            mx: 'auto',
            mb: 3,
          }}
        >
          {t('dashboard.emptyState.description')}
        </Typography>

        {/* CTA button with gradient */}
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/properties/new')}
          sx={{
            background: 'linear-gradient(135deg, #6B8A9A 0%, #8BA3B3 100%)',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.875rem',
            textTransform: 'none',
            borderRadius: '8px',
            px: 3,
            py: 1,
            boxShadow: isDark
              ? '0 2px 8px rgba(0,0,0,0.3)'
              : '0 2px 8px rgba(107,138,154,0.25)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              background: 'linear-gradient(135deg, #5A7684 0%, #7B9CAC 100%)',
              boxShadow: '0 4px 16px rgba(107,138,154,0.35)',
              transform: 'translateY(-1px)',
            },
          }}
        >
          {t('dashboard.emptyState.cta')}
        </Button>
      </CardContent>
    </Card>
  );
});

DashboardEmptyState.displayName = 'DashboardEmptyState';

export default DashboardEmptyState;
