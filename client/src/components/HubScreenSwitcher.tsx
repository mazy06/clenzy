import React from 'react';
import { Box, Tooltip } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { useIconSize } from '../hooks/useResponsiveSize';
import {
  Home,
  EventNote,
  Build,
  Contacts,
  Mail,
  Description,
  Handshake,
  Payment,
  Euro,
  Hub,
  Public,
  StorefrontOutlined,
  Sync,
  Speed,
  CurrencyExchange,
  Storage,
  LocalOffer,
  Dashboard,
  Assessment,
  Settings,
  Security,
  AdminPanelSettings,
  CalendarViewWeek,
} from '../icons';
import { tabRoutePrefixes, type ScreenIdentity } from '../config/navigationHubs';

/** Icône d'identité du hub (pastille à gauche du switcher multi-écrans). */
const HUB_ICON: Record<string, React.ReactNode> = {
  exploitation: <Home />,
  contacts: <Contacts />,
  documents: <Description />,
  finances: <Euro />,
  distribution: <Hub />,
  'platform-tools': <Build />,
};

/** Icône par écran (onglet ou écran autonome), clé = route canonique. */
const SCREEN_ICON: Record<string, React.ReactNode> = {
  '/properties': <Home />,
  '/reservations': <EventNote />,
  '/interventions': <Build />,
  '/contact': <Mail />,
  '/directory': <Contacts />,
  '/documents': <Description />,
  '/contracts': <Handshake />,
  '/billing': <Payment />,
  '/tarification': <Euro />,
  '/channels': <Hub />,
  '/booking-engine': <Public />,
  '/shop': <StorefrontOutlined />,
  '/admin/sync': <Sync />,
  '/admin/kpi': <Speed />,
  '/admin/exchange-rates': <CurrencyExchange />,
  '/admin/database': <Storage />,
  '/admin/promo-codes': <LocalOffer />,
  // Écrans autonomes
  '/planning': <CalendarViewWeek />,
  '/dashboard': <Dashboard />,
  '/reports': <Assessment />,
  '/settings': <Settings />,
  '/permissions-test': <AdminPanelSettings />,
  '/admin/monitoring': <Security />,
};

function sizedIcon(node: React.ReactNode, size: number): React.ReactNode {
  return React.isValidElement(node)
    ? React.cloneElement(node as React.ReactElement<{ size?: number; strokeWidth?: number }>, {
        size,
        strokeWidth: 1.85,
      })
    : node;
}

const SEG_CONTAINER_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2px',
  p: '3px',
  borderRadius: '11px',
  bgcolor: 'var(--field)',
  border: '1px solid var(--line-2)',
  minWidth: 0,
  overflowX: 'auto',
  '&::-webkit-scrollbar': { display: 'none' },
  scrollbarWidth: 'none',
} as const;

const PILL_BASE_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  flexShrink: 0,
  border: 0,
  fontFamily: 'inherit',
  fontSize: '12.5px',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  px: '13px',
  py: '6px',
  borderRadius: '8px',
} as const;

interface HubScreenSwitcherProps {
  identity: ScreenIdentity;
}

/**
 * Barre d'identité d'écran « Direction A » (Signature). Signature visuelle
 * UNIQUE sur tous les menus : pastille d'icône + conteneur segmenté (`.s-seg`).
 *   - `switcher` : plusieurs écrans frères d'un hub, cliquables (niveau 1 de nav).
 *   - `single`   : écran autonome (ou hub à 1 écran), une pilule active non
 *      interactive — l'écran courant tient lieu de titre.
 * Visuellement DISTINCT des sous-onglets soulignés (niveau 2).
 */
export default function HubScreenSwitcher({ identity }: HubScreenSwitcherProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const badgeSize = useIconSize('badge');

  const badgeIcon =
    identity.kind === 'switcher' ? HUB_ICON[identity.hub.id] : SCREEN_ICON[identity.iconKey];
  const badgeLabel =
    identity.kind === 'switcher'
      ? t(identity.hub.translationKey, identity.hub.fallbackLabel)
      : t(identity.translationKey, identity.fallbackLabel);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <Tooltip title={badgeLabel} arrow placement="bottom-start">
        <Box
          aria-hidden
          sx={{
            width: 30, height: 30, borderRadius: '9px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: 'var(--accent-soft)', color: 'var(--accent)', flexShrink: 0,
          }}
        >
          {sizedIcon(badgeIcon, badgeSize)}
        </Box>
      </Tooltip>

      {identity.kind === 'single' ? (
        <Box sx={SEG_CONTAINER_SX}>
          <Box
            component="span"
            aria-current="page"
            sx={{
              ...PILL_BASE_SX,
              color: 'var(--ink)',
              bgcolor: 'var(--card)',
              boxShadow: '0 1px 3px color-mix(in srgb, var(--ink) 12%, transparent)',
            }}
          >
            {t(identity.translationKey, identity.fallbackLabel)}
          </Box>
        </Box>
      ) : (
        <Box role="tablist" aria-label={badgeLabel} sx={SEG_CONTAINER_SX}>
          {identity.tabs.map((tab) => {
            const active = tab.path === identity.activeTabPath;
            const handleClick = () => {
              const onSamePath = tabRoutePrefixes(tab).some((p) => p === location.pathname);
              if (!onSamePath) navigate(tab.path);
            };
            return (
              <Box
                key={tab.path}
                component="button"
                type="button"
                role="tab"
                aria-selected={active}
                onClick={handleClick}
                sx={{
                  ...PILL_BASE_SX,
                  cursor: 'pointer',
                  color: active ? 'var(--ink)' : 'var(--muted)',
                  bgcolor: active ? 'var(--card)' : 'transparent',
                  boxShadow: active ? '0 1px 3px color-mix(in srgb, var(--ink) 12%, transparent)' : 'none',
                  transition: 'background .14s var(--ease-out), color .14s var(--ease-out)',
                  '&:hover': { color: active ? 'var(--ink)' : 'var(--body)' },
                  '&:active': { transform: 'scale(.97)' },
                  '@media (prefers-reduced-motion: reduce)': {
                    transition: 'none',
                    '&:active': { transform: 'none' },
                  },
                  '& > svg': { color: active ? 'var(--accent)' : 'var(--faint)', flexShrink: 0 },
                }}
              >
                {sizedIcon(SCREEN_ICON[tab.path], 14)}
                {t(tab.translationKey, tab.fallbackLabel)}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
