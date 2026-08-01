import React from 'react';
import { Tooltip } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../utils/cn';
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
  Bolt,
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
  '/automation-rules': <Bolt />,
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

const SEG_CONTAINER_CLS =
  'inline-flex items-center gap-[2px] p-[3px] rounded-[11px] bg-[var(--field)] ' +
  'border border-solid border-[var(--line-2)] min-w-0 overflow-x-auto ' +
  '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

const PILL_BASE_CLS =
  'inline-flex items-center gap-[6px] shrink-0 border-0 [font-family:inherit] ' +
  'text-[12.5px] font-semibold whitespace-nowrap px-[13px] py-[6px] rounded-[8px]';

const PILL_ACTIVE_CLS =
  'text-[var(--ink)] bg-[var(--card)] shadow-[0_1px_3px_color-mix(in_srgb,var(--ink)_12%,transparent)]';

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
    <div className="flex items-center gap-1.5 min-w-0">
      <Tooltip title={badgeLabel} arrow placement="bottom-start">
        <div className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center bg-[var(--accent-soft)] text-[var(--accent)] shrink-0" aria-hidden>
          {sizedIcon(badgeIcon, badgeSize)}
        </div>
      </Tooltip>

      {identity.kind === 'single' ? (
        <div className={SEG_CONTAINER_CLS}>
          <span aria-current="page" className={cn(PILL_BASE_CLS, PILL_ACTIVE_CLS)}>
            {t(identity.translationKey, identity.fallbackLabel)}
          </span>
        </div>
      ) : (
        <div role="tablist" aria-label={badgeLabel} className={SEG_CONTAINER_CLS}>
          {identity.tabs.map((tab) => {
            const active = tab.path === identity.activeTabPath;
            const handleClick = () => {
              const onSamePath = tabRoutePrefixes(tab).some((p) => p === location.pathname);
              if (!onSamePath) navigate(tab.path);
            };
            return (
              <button
                key={tab.path}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={handleClick}
                className={cn(
                  PILL_BASE_CLS,
                  'cursor-pointer transition-[background,color] duration-[140ms] ease-[var(--ease-out)]',
                  'active:scale-[.97] motion-reduce:transition-none motion-reduce:active:scale-100',
                  '[&>svg]:shrink-0',
                  active
                    ? `${PILL_ACTIVE_CLS} [&>svg]:text-[var(--accent)]`
                    : 'text-[var(--muted)] bg-transparent shadow-none hover:text-[var(--body)] [&>svg]:text-[var(--faint)]',
                )}
              >
                {sizedIcon(SCREEN_ICON[tab.path], 14)}
                {t(tab.translationKey, tab.fallbackLabel)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
