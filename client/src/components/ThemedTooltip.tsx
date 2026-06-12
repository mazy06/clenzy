import { Tooltip, tooltipClasses, styled } from '@mui/material';
import type { TooltipProps } from '@mui/material';

/**
 * Tooltip « riche » (contenu large) — peau popover Signature : panneau
 * hairline `--line`, r12, `--shadow-pop` (les tokens gèrent le dark mode).
 * Pour les tooltips texte courts, le MuiTooltip global (encre/fond inversés)
 * suffit — ce composant est réservé aux contenus composés.
 *
 * Usage: drop-in replacement for MUI <Tooltip>.
 */
const ThemedTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))({
  [`& .${tooltipClasses.tooltip}`]: {
    backgroundColor: 'var(--card)',
    color: 'var(--body)',
    border: '1px solid var(--line)',
    borderRadius: '12px',
    padding: '10px 12px',
    maxWidth: '360px',
    fontSize: '11.5px',
    fontWeight: 500,
    boxShadow: 'var(--shadow-pop)',
  },
  [`& .${tooltipClasses.arrow}`]: {
    color: 'var(--card)',
    '&::before': {
      border: '1px solid var(--line)',
    },
  },
});

export default ThemedTooltip;
