import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Skeleton,
  useTheme,
} from '@mui/material';
import {
  Handshake,
  ArrowForward,
  Close,
  AccountBalanceWallet,
  TrendingUp,
  PieChart,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';
import { managementContractsApi } from '../../services/api/managementContractsApi';
import { STORAGE_KEYS, getItem, setItem } from '../../services/storageService';

// ─── Couleurs Clenzy (brand) ───────────────────────────────────────────────
const C = {
  primary:      '#6B8A9A',
  success:      '#4A9B8E',
  warm:         '#D4A574',
  warmLight:    '#E8C9A8',
} as const;

// ─── Component ──────────────────────────────────────────────────────────────

const ContractCTABanner: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [dismissed, setDismissed] = useState(
    () => getItem(STORAGE_KEYS.CONTRACT_CTA_DISMISSED) === 'true',
  );
  const [hasActiveContracts, setHasActiveContracts] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Only show for SUPER_ADMIN / SUPER_MANAGER (concierge management roles)
  const isAdmin = user?.roles?.includes('SUPER_ADMIN') || false;
  const isManager = user?.roles?.includes('SUPER_MANAGER') || false;
  const canManageContracts = isAdmin || isManager;

  useEffect(() => {
    if (!canManageContracts || dismissed) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const contracts = await managementContractsApi.getAll({ status: 'ACTIVE' });
        if (!cancelled) {
          setHasActiveContracts(contracts.length > 0);
        }
      } catch {
        // On error, show the banner anyway
        if (!cancelled) setHasActiveContracts(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [canManageContracts, dismissed]);

  const handleDismiss = useCallback(() => {
    setItem(STORAGE_KEYS.CONTRACT_CTA_DISMISSED, 'true');
    setDismissed(true);
  }, []);

  // Don't show if: not authorized, dismissed, already has contracts, or loading
  if (!canManageContracts || dismissed || hasActiveContracts || loading) {
    if (loading && canManageContracts && !dismissed) {
      return (
        <Box sx={{ borderRadius: '12px', p: 2.5, bgcolor: 'background.paper' }}>
          <Skeleton variant="rectangular" height={100} sx={{ borderRadius: '8px' }} />
        </Box>
      );
    }
    return null;
  }

  const benefits = [
    {
      icon: <PieChart sx={{ fontSize: 16 }} />,
      label: t('dashboard.contractCta.benefit1'),
    },
    {
      icon: <AccountBalanceWallet sx={{ fontSize: 16 }} />,
      label: t('dashboard.contractCta.benefit2'),
    },
    {
      icon: <TrendingUp sx={{ fontSize: 16 }} />,
      label: t('dashboard.contractCta.benefit3'),
    },
  ];

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: '12px',
        borderLeft: `4px solid ${C.warm}`,
        boxShadow: isDark
          ? '0 2px 8px rgba(0,0,0,0.3)'
          : '0 2px 8px rgba(212,165,116,0.12)',
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        height: '100%',
      }}
    >
      {/* ── Header: title + dismiss ─────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 1.5, flex: 1, minWidth: 0 }}>
          {/* Icon */}
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '10px',
              background: isDark
                ? 'linear-gradient(135deg, rgba(212,165,116,0.15), rgba(74,155,142,0.10))'
                : 'linear-gradient(135deg, rgba(212,165,116,0.12), rgba(74,155,142,0.08))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Handshake sx={{ fontSize: 22, color: C.warm }} />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: '0.875rem',
                color: 'text.primary',
                lineHeight: 1.3,
                mb: 0.25,
              }}
            >
              {t('dashboard.contractCta.title')}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                fontSize: '0.75rem',
                lineHeight: 1.5,
              }}
            >
              {t('dashboard.contractCta.subtitle')}
            </Typography>
          </Box>
        </Box>

        <IconButton
          size="small"
          onClick={handleDismiss}
          sx={{
            color: 'text.disabled',
            ml: 0.5,
            '&:hover': { color: 'text.secondary' },
          }}
        >
          <Close sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* ── Benefits list ───────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {benefits.map((b, i) => (
          <Box
            key={i}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.25,
              py: 0.75,
              borderRadius: '6px',
              bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(212,165,116,0.04)',
            }}
          >
            <Box
              sx={{
                color: i === 0 ? C.warm : i === 1 ? C.success : C.primary,
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              {b.icon}
            </Box>
            <Typography
              sx={{
                fontSize: '0.7rem',
                fontWeight: 500,
                color: 'text.secondary',
                lineHeight: 1.3,
              }}
            >
              {b.label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* ── CTA Button ──────────────────────────────────────────────── */}
      <Button
        variant="contained"
        size="small"
        fullWidth
        onClick={() => navigate('/contracts')}
        endIcon={<ArrowForward sx={{ fontSize: 16 }} />}
        sx={{
          mt: 'auto',
          background: `linear-gradient(135deg, ${C.warm} 0%, ${C.success} 100%)`,
          color: '#fff',
          fontWeight: 600,
          textTransform: 'none',
          borderRadius: '8px',
          py: 0.9,
          fontSize: '0.8rem',
          boxShadow: isDark
            ? '0 2px 8px rgba(0,0,0,0.3)'
            : '0 2px 8px rgba(212,165,116,0.25)',
          '&:hover': {
            background: `linear-gradient(135deg, #C99560 0%, #3D8A7E 100%)`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          },
        }}
      >
        {t('dashboard.contractCta.cta')}
      </Button>
    </Box>
  );
});

ContractCTABanner.displayName = 'ContractCTABanner';

export default ContractCTABanner;
