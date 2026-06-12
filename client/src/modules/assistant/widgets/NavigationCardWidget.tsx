import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  ArrowForward as ArrowRightIcon,
  Settings as SettingsIcon,
  Home as HomeIcon,
  Assessment as ChartIcon,
  Euro as EuroIcon,
  Build as BuildIcon,
  Mail as MailIcon,
  Description as DocsIcon,
  Hub as HubIcon,
  Payment as PaymentIcon,
} from '../../../icons';

interface NavigationData {
  path?: string;
  label?: string;
  reason?: string;
  /** Nom Lucide optionnel : Settings, Home, ChartBar, Euro, Build, Mail, Description */
  icon?: string;
}

interface NavigationCardWidgetProps {
  data: NavigationData;
}

/**
 * Widget de rendu pour {@code displayHint="navigation"} — CTA card avec
 * bouton qui amene l'utilisateur vers une page du PMS.
 *
 * <p>Navigation via React Router ({@code useNavigate}) → SPA, pas de
 * full reload. Le path est valide cote backend (whitelist dans
 * {@code SuggestNavigationTool}), donc on peut faire confiance ici.</p>
 *
 * <p>Design : carte primary-tinted avec icone semantique a gauche, label/
 * reason au milieu, bouton fleche a droite. Toute la carte est cliquable
 * (cursor pointer + hover).</p>
 */
export const NavigationCardWidget: React.FC<NavigationCardWidgetProps> = ({ data }) => {
  const navigate = useNavigate();

  if (!data.path || !data.label) return null;

  const handleClick = () => navigate(data.path!);
  const Icon = pickIcon(data.icon, data.path);

  return (
    <Box
      sx={{
        mt: 1, mb: 1.5,
        p: 1.5,
        borderRadius: '12px',
        bgcolor: 'var(--accent-soft)',
        cursor: 'pointer',
        transition: 'background-color .15s',
        '&:hover': {
          bgcolor: 'color-mix(in srgb, var(--accent-soft) 80%, var(--accent) 14%)',
        },
        '&:focus-visible': {
          outline: '2px solid var(--accent)',
          outlineOffset: 2,
        },
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
        },
      }}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`Aller vers ${data.label}`}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {/* Icone semantique */}
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '9px',
            bgcolor: 'var(--card)',
            color: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={18} strokeWidth={1.75} />
        </Box>

        {/* Contenu */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{
            fontSize: '13.5px',
            fontWeight: 600,
            color: 'var(--ink)',
            lineHeight: 1.3,
          }}>
            {data.label}
          </Typography>
          {data.reason && (
            <Typography sx={{
              display: 'block',
              fontSize: '11.5px',
              color: 'var(--muted)',
              lineHeight: 1.4,
              mt: 0.125,
            }}>
              {data.reason}
            </Typography>
          )}
        </Box>

        {/* Bouton fleche (cosmetic — toute la carte est cliquable) */}
        <Button
          variant="text"
          size="small"
          onClick={(e) => { e.stopPropagation(); handleClick(); }}
          sx={{
            minWidth: 'auto',
            color: 'var(--accent)',
            cursor: 'pointer',
            '&:hover': { bgcolor: 'transparent' },
          }}
          aria-hidden="true"
        >
          <ArrowRightIcon size={18} strokeWidth={2} />
        </Button>
      </Box>
    </Box>
  );
};

// ─── Icon mapping ────────────────────────────────────────────────────────────

/** Type permissif — Lucide icons accept size + strokeWidth as number | string. */
type LucideIconComponent = React.ComponentType<{
  size?: number | string;
  strokeWidth?: number | string;
}>;

const ICON_BY_NAME: Record<string, LucideIconComponent> = {
  Settings: SettingsIcon,
  Home: HomeIcon,
  ChartBar: ChartIcon,
  Assessment: ChartIcon,
  Euro: EuroIcon,
  Build: BuildIcon,
  Mail: MailIcon,
  Description: DocsIcon,
  Hub: HubIcon,
  Payment: PaymentIcon,
};

const ICON_BY_PATH: Record<string, LucideIconComponent> = {
  '/settings': SettingsIcon,
  '/properties': HomeIcon,
  '/reports': ChartIcon,
  '/tarification': EuroIcon,
  '/interventions': BuildIcon,
  '/contact': MailIcon,
  '/documents': DocsIcon,
  '/channels': HubIcon,
  '/billing': PaymentIcon,
  '/booking-engine': HubIcon,
};

function pickIcon(
  name: string | undefined,
  path: string | undefined,
): LucideIconComponent {
  if (name && ICON_BY_NAME[name]) return ICON_BY_NAME[name];
  if (path) {
    // Strip query string for matching
    const basePath = path.split('?')[0];
    if (ICON_BY_PATH[basePath]) return ICON_BY_PATH[basePath];
  }
  return ArrowRightIcon;
}
