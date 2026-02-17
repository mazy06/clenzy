import { Tooltip, tooltipClasses, styled } from '@mui/material';
import type { TooltipProps } from '@mui/material';

/**
 * Theme-aware Tooltip:
 *  - Light mode → white background, subtle shadow
 *  - Dark mode  → dark grey background, deeper shadow
 *
 * Usage: drop-in replacement for MUI <Tooltip>.
 */
const ThemedTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    backgroundColor: theme.palette.mode === 'light' ? '#fff' : theme.palette.grey[800],
    color: theme.palette.text.primary,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 10,
    padding: '10px 12px',
    maxWidth: 360,
    boxShadow:
      theme.palette.mode === 'light'
        ? '0 4px 16px rgba(0,0,0,0.10)'
        : '0 4px 16px rgba(0,0,0,0.35)',
  },
  [`& .${tooltipClasses.arrow}`]: {
    color: theme.palette.mode === 'light' ? '#fff' : theme.palette.grey[800],
    '&::before': {
      border: `1px solid ${theme.palette.divider}`,
    },
  },
}));

export default ThemedTooltip;
