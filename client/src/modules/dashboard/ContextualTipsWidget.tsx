import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  useTheme,
} from '@mui/material';
import {
  Lightbulb,
  NavigateNext,
  NavigateBefore,
  AutoAwesome,
  Handshake,
  CalendarMonth,
  Campaign,
  VolumeUp,
  LockOutlined,
  TrendingUp,
  Groups,
  Receipt,
} from '../../icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useAuth } from '../../hooks/useAuth';

// ─── Brand colors ───────────────────────────────────────────────────────────
const C = {
  primary: '#6B8A9A',
  success: '#4A9B8E',
  warm:    '#D4A574',
} as const;

// ─── Tip definition ─────────────────────────────────────────────────────────

interface Tip {
  id: string;
  icon: React.ReactNode;
  color: string;
  titleKey: string;
  descKey: string;
  actionKey: string;
  path: string;
  roles: string[]; // empty = all roles
}

const ALL_TIPS: Tip[] = [
  {
    id: 'automate-cleaning',
    icon: <AutoAwesome size={18} strokeWidth={1.75} />,
    color: C.success,
    titleKey: 'dashboard.tips.automateCleaning.title',
    descKey: 'dashboard.tips.automateCleaning.desc',
    actionKey: 'dashboard.tips.automateCleaning.action',
    path: '/interventions',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER'],
  },
  {
    id: 'contracts-commission',
    icon: <Handshake size={18} strokeWidth={1.75} />,
    color: C.warm,
    titleKey: 'dashboard.tips.contracts.title',
    descKey: 'dashboard.tips.contracts.desc',
    actionKey: 'dashboard.tips.contracts.action',
    path: '/contracts',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER'],
  },
  {
    id: 'planning-ical',
    icon: <CalendarMonth size={18} strokeWidth={1.75} />,
    color: C.primary,
    titleKey: 'dashboard.tips.planning.title',
    descKey: 'dashboard.tips.planning.desc',
    actionKey: 'dashboard.tips.planning.action',
    path: '/planning',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST'],
  },
  {
    id: 'channels-sync',
    icon: <Campaign size={18} strokeWidth={1.75} />,
    color: '#FF5A5F',
    titleKey: 'dashboard.tips.channels.title',
    descKey: 'dashboard.tips.channels.desc',
    actionKey: 'dashboard.tips.channels.action',
    path: '/channels',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER'],
  },
  {
    id: 'noise-monitoring',
    icon: <VolumeUp size={18} strokeWidth={1.75} />,
    color: '#4FC3F7',
    titleKey: 'dashboard.tips.noise.title',
    descKey: 'dashboard.tips.noise.desc',
    actionKey: 'dashboard.tips.noise.action',
    path: '/dashboard',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST'],
  },
  {
    id: 'smart-locks',
    icon: <LockOutlined size={18} strokeWidth={1.75} />,
    color: '#AB47BC',
    titleKey: 'dashboard.tips.smartLocks.title',
    descKey: 'dashboard.tips.smartLocks.desc',
    actionKey: 'dashboard.tips.smartLocks.action',
    path: '/dashboard',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST'],
  },
  {
    id: 'reports-analytics',
    icon: <TrendingUp size={18} strokeWidth={1.75} />,
    color: C.success,
    titleKey: 'dashboard.tips.reports.title',
    descKey: 'dashboard.tips.reports.desc',
    actionKey: 'dashboard.tips.reports.action',
    path: '/reports',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER'],
  },
  {
    id: 'team-management',
    icon: <Groups size={18} strokeWidth={1.75} />,
    color: C.primary,
    titleKey: 'dashboard.tips.teams.title',
    descKey: 'dashboard.tips.teams.desc',
    actionKey: 'dashboard.tips.teams.action',
    path: '/directory',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER'],
  },
  {
    id: 'billing-invoices',
    icon: <Receipt size={18} strokeWidth={1.75} />,
    color: C.warm,
    titleKey: 'dashboard.tips.billing.title',
    descKey: 'dashboard.tips.billing.desc',
    actionKey: 'dashboard.tips.billing.action',
    path: '/billing',
    roles: ['SUPER_ADMIN', 'SUPER_MANAGER', 'HOST'],
  },
];

// ─── Component ──────────────────────────────────────────────────────────────

/** Auto-rotate interval in ms. */
const AUTO_ROTATE_MS = 6_000;

const ContextualTipsWidget: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Filter tips by user role
  const filteredTips = useMemo(() => {
    const userRoles = user?.roles || [];
    return ALL_TIPS.filter((tip) =>
      tip.roles.length === 0 || tip.roles.some((r) => userRoles.includes(r)),
    );
  }, [user?.roles]);

  // Rotate through tips — start at random position to vary experience
  const [index, setIndex] = useState(() => Math.floor(Math.random() * Math.max(filteredTips.length, 1)));
  const [fade, setFade] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentTip = filteredTips[index % filteredTips.length];

  // ── Transition helper: fade out → change index → fade in ──────────────────
  const transitionTo = useCallback((nextIndex: number) => {
    setFade(false);
    setTimeout(() => {
      setIndex(nextIndex);
      setFade(true);
    }, 200);
  }, []);

  const goNext = useCallback(() => {
    transitionTo((index + 1) % filteredTips.length);
  }, [index, filteredTips.length, transitionTo]);

  const goPrev = useCallback(() => {
    transitionTo((index - 1 + filteredTips.length) % filteredTips.length);
  }, [index, filteredTips.length, transitionTo]);

  // ── Auto-rotate — reset timer on manual navigation ────────────────────────
  useEffect(() => {
    if (filteredTips.length <= 1) return;

    timerRef.current = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % filteredTips.length);
        setFade(true);
      }, 200);
    }, AUTO_ROTATE_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [filteredTips.length, index]); // reset timer when index changes (manual nav)

  if (!currentTip || filteredTips.length === 0) return null;

  const activeIdx = index % filteredTips.length;

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: '12px',
        boxShadow: isDark
          ? '0 2px 8px rgba(0,0,0,0.3)'
          : '0 2px 8px rgba(107,138,154,0.08)',
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
          <Box component="span" sx={{ display: 'inline-flex', color: C.warm }}><Lightbulb size={16} strokeWidth={1.75} /></Box>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary' }}>
            {t('dashboard.tips.title')}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {activeIdx + 1}/{filteredTips.length}
        </Typography>
      </Box>

      {/* ── Tip content — fixed height so all steps are uniform ── */}
      <Box
        sx={{
          display: 'flex',
          gap: 1.5,
          flex: 1,
          minHeight: 64,
          opacity: fade ? 1 : 0,
          transition: 'opacity 0.2s ease',
          alignItems: 'flex-start',
        }}
      >
        {/* Icon */}
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            bgcolor: isDark
              ? `${currentTip.color}18`
              : `${currentTip.color}10`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: currentTip.color,
          }}
        >
          {currentTip.icon}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: '0.8rem',
              fontWeight: 700,
              color: 'text.primary',
              lineHeight: 1.3,
              mb: 0.25,
            }}
          >
            {t(currentTip.titleKey)}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.7rem',
              color: 'text.secondary',
              lineHeight: 1.5,
            }}
          >
            {t(currentTip.descKey)}
          </Typography>
        </Box>
      </Box>

      {/* ── Footer: nav + action ─────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 'auto' }}>
        {/* Navigation */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          <IconButton size="small" onClick={goPrev} sx={{ color: 'text.disabled', p: 0.25, '&:hover': { color: 'text.secondary' } }}>
            <NavigateBefore size={18} strokeWidth={1.75} />
          </IconButton>
          {/* Dots */}
          <Box sx={{ display: 'flex', gap: 0.5, mx: 0.5 }}>
            {filteredTips.slice(0, Math.min(filteredTips.length, 5)).map((_, i) => (
              <Box
                key={i}
                sx={{
                  width: activeIdx === i ? 12 : 5,
                  height: 5,
                  borderRadius: activeIdx === i ? '2.5px' : '50%',
                  bgcolor: activeIdx === i ? C.primary : 'action.disabled',
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
            {filteredTips.length > 5 && (
              <Typography sx={{ fontSize: '0.5rem', color: 'text.disabled', lineHeight: 1 }}>...</Typography>
            )}
          </Box>
          <IconButton size="small" onClick={goNext} sx={{ color: 'text.disabled', p: 0.25, '&:hover': { color: 'text.secondary' } }}>
            <NavigateNext size={18} strokeWidth={1.75} />
          </IconButton>
        </Box>

        {/* Action button */}
        <Button
          size="small"
          onClick={() => navigate(currentTip.path)}
          sx={{
            fontSize: '0.68rem',
            fontWeight: 600,
            textTransform: 'none',
            color: currentTip.color,
            px: 1,
            py: 0.25,
            minWidth: 0,
            borderRadius: '6px',
            opacity: fade ? 1 : 0,
            transition: 'opacity 0.2s ease',
            '&:hover': {
              bgcolor: `${currentTip.color}08`,
            },
          }}
        >
          {t(currentTip.actionKey)}
        </Button>
      </Box>
    </Box>
  );
});

ContextualTipsWidget.displayName = 'ContextualTipsWidget';

export default ContextualTipsWidget;
