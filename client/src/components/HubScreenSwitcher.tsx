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
} from '../icons';
import { tabRoutePrefixes, type HubScreenContext } from '../config/navigationHubs';

/** Icône d'identité du hub (pastille à gauche du switcher). */
const HUB_ICON: Record<string, React.ReactNode> = {
  exploitation: <Home />,
  contacts: <Contacts />,
  documents: <Description />,
  finances: <Euro />,
  distribution: <Hub />,
  'platform-tools': <Build />,
};

/** Icône par écran (onglet du switcher), clé = route canonique. */
const TAB_ICON: Record<string, React.ReactNode> = {
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
};

function sizedIcon(node: React.ReactNode, size: number): React.ReactNode {
  return React.isValidElement(node)
    ? React.cloneElement(node as React.ReactElement<{ size?: number; strokeWidth?: number }>, {
        size,
        strokeWidth: 1.85,
      })
    : node;
}

interface HubScreenSwitcherProps {
  context: HubScreenContext;
}

/**
 * Switcher d'écran « Direction A » (Signature) : pastille d'identité du hub +
 * contrôle segmenté (`.s-seg`) des écrans frères. C'est le niveau 1 de
 * navigation — visuellement DISTINCT des sous-onglets soulignés (niveau 2),
 * ce qui supprime le doublon de barres à soulignement.
 *
 * Le segment actif (route courante) tient lieu de titre de page : pas de titre
 * répété, header dense. Rendu par PageHeader sur les pages-racines de hub.
 */
export default function HubScreenSwitcher({ context }: HubScreenSwitcherProps) {
  const { hub, tabs, activeTabPath } = context;
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const badgeSize = useIconSize('badge');

  const isActive = (tabPath: string) => tabPath === activeTabPath;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <Tooltip title={t(hub.translationKey, hub.fallbackLabel)} arrow placement="bottom-start">
        <Box
          aria-hidden
          sx={{
            width: 30, height: 30, borderRadius: '9px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: 'var(--accent-soft)', color: 'var(--accent)', flexShrink: 0,
          }}
        >
          {sizedIcon(HUB_ICON[hub.id], badgeSize)}
        </Box>
      </Tooltip>

      <Box
        role="tablist"
        aria-label={t(hub.translationKey, hub.fallbackLabel)}
        sx={{
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
        }}
      >
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          // Préserve les query (?tab=…) si on reclique l'écran déjà actif : on ne
          // navigue que vers un AUTRE écran (sinon no-op, on garde le sous-onglet).
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                flexShrink: 0,
                border: 0,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '12.5px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                px: '13px',
                py: '6px',
                borderRadius: '8px',
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
              {sizedIcon(TAB_ICON[tab.path], 14)}
              {t(tab.translationKey, tab.fallbackLabel)}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
