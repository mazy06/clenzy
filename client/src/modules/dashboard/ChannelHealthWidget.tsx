import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Skeleton,
  Chip,
  Button,
  Tooltip,
} from '@mui/material';
import {
  Wifi,
  SyncProblem,
  ArrowForward,
  CheckCircle,
  RadioButtonUnchecked,
} from '../../icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { airbnbApi, type AirbnbConnectionStatus } from '../../services/api/airbnbApi';
import { channelConnectionApi, type ChannelConnectionStatus } from '../../services/api/channelConnectionApi';

// ─── Couleurs (tokens Signature) ────────────────────────────────────────────
const C = {
  primary: 'var(--accent)',
  success: 'var(--ok)',
  error:   'var(--err)',
} as const;

// ─── All available OTAs (implemented in backend) ────────────────────────────

interface OtaDef {
  key: string;
  label: string;
  color: string;
  type: 'oauth' | 'credentials';
}

// Pastilles canal : tokens dédiés pour Airbnb/Booking ; les OTA sans token de
// marque retombent sur la palette sémantique la plus proche de leur teinte.
const ALL_OTAS: OtaDef[] = [
  { key: 'AIRBNB',       label: 'Airbnb',           color: 'var(--airbnb)',      type: 'oauth' },
  { key: 'BOOKING',      label: 'Booking.com',      color: 'var(--booking)',     type: 'credentials' },
  { key: 'EXPEDIA',      label: 'Expedia',          color: 'var(--warn)',        type: 'credentials' },
  { key: 'HOTELS_COM',   label: 'Hotels.com',       color: 'var(--err)',         type: 'credentials' },
  { key: 'AGODA',        label: 'Agoda',            color: 'var(--accent)',      type: 'credentials' },
  { key: 'HOMEAWAY',     label: 'Vrbo',             color: 'var(--booking-ink)', type: 'credentials' },
  { key: 'HOMEAWAY_2',   label: 'Abritel',          color: 'var(--info)',        type: 'credentials' },
];

interface ChannelItem {
  key: string;
  label: string;
  color: string;
  connected: boolean;
  hasError: boolean;
  lastSync: string | null;
}

// ─── Component ──────────────────────────────────────────────────────────────

const ChannelHealthWidget: React.FC<{ onReady?: () => void }> = React.memo(({ onReady }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const readyFired = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Build a map of connected channels from API
        const connectedMap = new Map<string, { connected: boolean; hasError: boolean; lastSync: string | null }>();

        // Fetch Airbnb (OAuth)
        try {
          const airbnb: AirbnbConnectionStatus = await airbnbApi.getConnectionStatus();
          connectedMap.set('AIRBNB', {
            connected: airbnb.connected,
            hasError: !!airbnb.errorMessage,
            lastSync: airbnb.lastSyncAt,
          });
        } catch {
          // Not configured
        }

        // Fetch generic channel connections
        try {
          const connections: ChannelConnectionStatus[] = await channelConnectionApi.getAll();
          for (const conn of connections) {
            connectedMap.set(conn.channel, {
              connected: conn.connected,
              hasError: !!conn.lastError,
              lastSync: conn.lastSyncAt,
            });
          }
        } catch {
          // Not available
        }

        // Merge all OTAs with connection status
        if (!cancelled) {
          const items: ChannelItem[] = ALL_OTAS.map((ota) => {
            // Abritel shares HOMEAWAY backend key with Vrbo
            const lookupKey = ota.key === 'HOMEAWAY_2' ? 'HOMEAWAY' : ota.key;
            const status = connectedMap.get(lookupKey);
            return {
              key: ota.key,
              label: ota.label,
              color: ota.color,
              connected: status?.connected ?? false,
              hasError: status?.hasError ?? false,
              lastSync: status?.lastSync ?? null,
            };
          });
          setChannels(items);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          if (!readyFired.current) { readyFired.current = true; onReady?.(); }
        }
      }
    })();
    return () => { cancelled = true; };
  }, [onReady]);

  const connectedCount = channels.filter((c) => c.connected).length;
  const totalCount = channels.length;
  const errorCount = channels.filter((c) => c.hasError).length;

  // Loading is handled by parent DashboardSkeleton
  if (loading) return null;

  return (
    <Box
      sx={{
        bgcolor: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        height: '100%',
      }}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box component="span" sx={{ display: 'inline-flex', color: connectedCount > 0 ? C.success : 'text.disabled' }}><Wifi size={16} strokeWidth={1.75} /></Box>
          <Typography sx={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--faint)' }}>
            {t('dashboard.channelHealth.title')}
          </Typography>
        </Box>
        <Chip
          size="small"
          label={`${connectedCount}/${totalCount}`}
          sx={{
            height: 20,
            fontSize: '0.65rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            bgcolor: errorCount > 0
              ? 'var(--err-soft)'
              : connectedCount > 0
                ? 'var(--ok-soft)'
                : 'var(--hover)',
            color: errorCount > 0 ? C.error : connectedCount > 0 ? C.success : 'text.disabled',
            '& .MuiChip-label': { px: 0.75 },
          }}
        />
      </Box>

      {/* ── Channel list ─────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {channels.map((ch) => (
          <Tooltip
            key={ch.key}
            title={
              ch.hasError
                ? t('dashboard.channelHealth.syncError')
                : ch.connected
                  ? `${t('dashboard.channelHealth.connected')}${ch.lastSync ? ` — ${t('dashboard.channelHealth.lastSync')}: ${new Date(ch.lastSync).toLocaleDateString()}` : ''}`
                  : t('dashboard.channelHealth.notConnected')
            }
            arrow
            placement="left"
          >
            <Box
              onClick={() => navigate('/channels')}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1,
                py: 0.5,
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
                bgcolor: ch.hasError ? 'var(--err-soft)' : 'transparent',
                '&:hover': {
                  bgcolor: 'var(--hover)',
                },
              }}
            >
              {/* Color dot */}
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  bgcolor: ch.connected ? ch.color : 'action.disabled',
                  opacity: ch.connected ? 1 : 0.4,
                  flexShrink: 0,
                }}
              />
              {/* Name */}
              <Typography
                sx={{
                  fontSize: '0.68rem',
                  fontWeight: ch.connected ? 600 : 500,
                  flex: 1,
                  minWidth: 0,
                  color: ch.connected ? 'text.primary' : 'text.disabled',
                }}
              >
                {ch.label}
              </Typography>
              {/* Status icon */}
              {ch.hasError ? (
                <Box component="span" sx={{ display: 'inline-flex', color: C.error }}><SyncProblem size={13} strokeWidth={1.75} /></Box>
              ) : ch.connected ? (
                <Box component="span" sx={{ display: 'inline-flex', color: C.success }}><CheckCircle size={13} strokeWidth={1.75} /></Box>
              ) : (
                <Box component="span" sx={{ display: 'inline-flex', color: 'action.disabled' }}><RadioButtonUnchecked size={13} strokeWidth={1.75} /></Box>
              )}
            </Box>
          </Tooltip>
        ))}
      </Box>

      {/* ── Error summary ────────────────────────────────────────── */}
      {errorCount > 0 && (
        <Typography sx={{ fontSize: '0.62rem', color: C.error, fontWeight: 500, lineHeight: 1.4, px: 0.5 }}>
          {t('dashboard.channelHealth.errorCount', { count: errorCount })}
        </Typography>
      )}

      {/* ── Footer link ──────────────────────────────────────────── */}
      <Button
        size="small"
        onClick={() => navigate('/channels')}
        endIcon={<ArrowForward size={14} strokeWidth={1.75} />}
        sx={{
          mt: 'auto',
          fontSize: '0.68rem',
          fontWeight: 600,
          textTransform: 'none',
          color: C.primary,
          justifyContent: 'flex-start',
          p: 0,
          minWidth: 0,
          '&:hover': { bgcolor: 'transparent', color: 'var(--accent-deep)' },
        }}
      >
        {t('dashboard.channelHealth.manage')}
      </Button>
    </Box>
  );
});

ChannelHealthWidget.displayName = 'ChannelHealthWidget';

export default ChannelHealthWidget;
