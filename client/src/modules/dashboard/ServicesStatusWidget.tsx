import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Skeleton,
} from '@mui/material';
import {
  VolumeUp,
  LockOutlined,
  VpnKey,
  ArrowForward,
  CheckCircle,
  RadioButtonUnchecked,
  BatteryFull,
  Sensors,
  Language as BookingIcon,
} from '../../icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { noiseDevicesApi } from '../../services/api/noiseApi';
import { smartLockApi } from '../../services/api/smartLockApi';
import { keyExchangeApi } from '../../services/api/keyExchangeApi';
import { bookingEngineApi } from '../../services/api/bookingEngineApi';

// ─── Couleurs (tokens Signature) ────────────────────────────────────────────

const C = {
  primary: 'var(--accent)',
  success: 'var(--ok)',
  noise:   'var(--info)',
  lock:    'var(--accent)',
  key:     'var(--warn)',
  booking: 'var(--ok)',
} as const;

const C_SOFT = {
  noise:   'var(--info-soft)',
  lock:    'var(--accent-soft)',
  key:     'var(--warn-soft)',
  booking: 'var(--ok-soft)',
} as const;

// ─── Types ──────────────────────────────────────────────────────────────────

interface ServiceStatus {
  configured: boolean;
  count: number;
  loading: boolean;
}

interface ServicesStatusWidgetProps {
  onReady?: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

const ServicesStatusWidget: React.FC<ServicesStatusWidgetProps> = React.memo(({ onReady }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [noise, setNoise] = useState<ServiceStatus>({ configured: false, count: 0, loading: true });
  const [locks, setLocks] = useState<ServiceStatus>({ configured: false, count: 0, loading: true });
  const [keys, setKeys] = useState<ServiceStatus>({ configured: false, count: 0, loading: true });
  const [booking, setBooking] = useState<ServiceStatus>({ configured: false, count: 0, loading: true });

  useEffect(() => {
    let cancelled = false;

    // Noise devices
    (async () => {
      try {
        const devices = await noiseDevicesApi.getAll();
        if (!cancelled) setNoise({ configured: devices.length > 0, count: devices.length, loading: false });
      } catch {
        if (!cancelled) setNoise((prev) => ({ ...prev, loading: false }));
      }
    })();

    // Smart locks
    (async () => {
      try {
        const devices = await smartLockApi.getAll();
        if (!cancelled) setLocks({ configured: devices.length > 0, count: devices.length, loading: false });
      } catch {
        if (!cancelled) setLocks((prev) => ({ ...prev, loading: false }));
      }
    })();

    // Key exchange points
    (async () => {
      try {
        const points = await keyExchangeApi.getPoints();
        if (!cancelled) setKeys({ configured: points.length > 0, count: points.length, loading: false });
      } catch {
        if (!cancelled) setKeys((prev) => ({ ...prev, loading: false }));
      }
    })();

    // Booking engine
    (async () => {
      try {
        const status = await bookingEngineApi.getStatus();
        if (!cancelled) setBooking({ configured: status.configured && status.enabled, count: status.configured ? 1 : 0, loading: false });
      } catch {
        if (!cancelled) setBooking((prev) => ({ ...prev, loading: false }));
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Les services IoT pointent vers l'onglet unifié Objets connectés ; booking vers son module.
  const services = [
    {
      key: 'noise',
      icon: <VolumeUp size={18} strokeWidth={1.75} />,
      color: C.noise,
      soft: C_SOFT.noise,
      label: t('dashboard.services.noise'),
      status: noise,
      route: '/properties?tab=connected-objects',
      ctaKey: 'dashboard.services.noiseCta',
      activeIcon: <Box component="span" sx={{ display: 'inline-flex', color: C.noise }}><Sensors size={12} strokeWidth={1.75} /></Box>,
    },
    {
      key: 'locks',
      icon: <LockOutlined size={18} strokeWidth={1.75} />,
      color: C.lock,
      soft: C_SOFT.lock,
      label: t('dashboard.services.locks'),
      status: locks,
      route: '/properties?tab=connected-objects',
      ctaKey: 'dashboard.services.locksCta',
      activeIcon: <Box component="span" sx={{ display: 'inline-flex', color: C.lock }}><BatteryFull size={12} strokeWidth={1.75} /></Box>,
    },
    {
      key: 'keys',
      icon: <VpnKey size={18} strokeWidth={1.75} />,
      color: C.key,
      soft: C_SOFT.key,
      label: t('dashboard.services.keys'),
      status: keys,
      route: '/properties?tab=connected-objects',
      ctaKey: 'dashboard.services.keysCta',
      activeIcon: <Box component="span" sx={{ display: 'inline-flex', color: C.key }}><VpnKey size={12} strokeWidth={1.75} /></Box>,
    },
    {
      key: 'booking',
      icon: <BookingIcon size={18} strokeWidth={1.75} />,
      color: C.booking,
      soft: C_SOFT.booking,
      label: t('dashboard.services.booking', 'Booking Engine'),
      status: booking,
      route: '/booking-engine',
      ctaKey: 'dashboard.services.bookingCta',
      activeIcon: <Box component="span" sx={{ display: 'inline-flex', color: C.booking }}><BookingIcon size={12} strokeWidth={1.75} /></Box>,
    },
  ];

  const isLoading = noise.loading || locks.loading || keys.loading || booking.loading;
  const readyFired = useRef(false);
  useEffect(() => {
    if (!isLoading && !readyFired.current) {
      readyFired.current = true;
      onReady?.();
    }
  }, [isLoading, onReady]);

  const handleServiceClick = (svc: typeof services[number]) => {
    navigate(svc.route);
  };

  // Loading is handled by parent DashboardSkeleton
  if (isLoading) return null;

  return (
    <Box
      sx={{
        bgcolor: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        p: 1.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{
          fontSize: '10.5px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--faint)',
        }}>
          {t('dashboard.services.title')}
        </Typography>
        <Chip
          size="small"
          label={`${services.filter((s) => s.status.configured).length}/${services.length}`}
          sx={{
            height: 18,
            fontSize: '0.6rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            bgcolor: 'var(--ok-soft)',
            color: C.success,
            '& .MuiChip-label': { px: 0.6 },
          }}
        />
      </Box>

      {/* ── Service cards row ────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        {services.map((svc) => (
          <Box
            key={svc.key}
            onClick={() => handleServiceClick(svc)}
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.75,
              px: 1.25,
              py: 1.25,
              borderRadius: 'var(--radius-md)',
              border: '1px solid',
              borderColor: svc.status.configured
                ? `color-mix(in srgb, ${svc.color} 25%, transparent)`
                : 'var(--line)',
              bgcolor: svc.status.configured ? svc.soft : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              '&:hover': {
                borderColor: svc.color,
                transform: 'translateY(-1px)',
                bgcolor: svc.status.configured ? svc.soft : 'var(--hover)',
              },
              '@media (prefers-reduced-motion: reduce)': {
                transition: 'none',
                '&:hover': { transform: 'none' },
              },
            }}
          >
            {/* Icon circle */}
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: 'var(--radius-md)',
                bgcolor: svc.soft,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: svc.color,
              }}
            >
              {svc.icon}
            </Box>

            {/* Label */}
            <Typography
              sx={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'text.primary',
                textAlign: 'center',
                lineHeight: 1.3,
              }}
              noWrap
            >
              {svc.label}
            </Typography>

            {/* Status */}
            {svc.status.configured ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <Box component="span" sx={{ display: 'inline-flex', color: C.success }}><CheckCircle size={13} strokeWidth={1.75} /></Box>
                <Typography sx={{ fontSize: '0.65rem', color: C.success, fontWeight: 600 }}>
                  {svc.status.count} {t('dashboard.services.active')}
                </Typography>
              </Box>
            ) : (
              <Button
                size="small"
                endIcon={<ArrowForward size={12} strokeWidth={1.75} />}
                sx={{
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  color: svc.color,
                  p: 0,
                  minWidth: 0,
                  minHeight: 0,
                  lineHeight: 1,
                  '& .MuiButton-endIcon': { ml: 0.25 },
                  '&:hover': { bgcolor: 'transparent' },
                }}
              >
                {t(svc.ctaKey)}
              </Button>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
});

ServicesStatusWidget.displayName = 'ServicesStatusWidget';

export default ServicesStatusWidget;
