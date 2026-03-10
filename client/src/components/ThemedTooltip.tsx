import { Tooltip, tooltipClasses, styled } from '@mui/material';
import type { TooltipProps } from '@mui/material';

/**
 * Theme-aware Tooltip:
 *  - Light mode → white background, subtle shadow
 *  - Dark mode  → bleu-gris profond (#1D2B3D), deeper shadow
 *
 * Usage: drop-in replacement for MUI <Tooltip>.
 */
const ThemedTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => {
  const isLight = theme.palette.mode === 'light';
  const bg = isLight ? '#fff' : '#1D2B3D';
  const border = isLight
    ? theme.palette.divider
    : 'rgba(138, 170, 196, 0.12)';

  return {
    [`& .${tooltipClasses.tooltip}`]: {
      backgroundColor: `${bg} !important`,
      color: `${theme.palette.text.primary} !important`,
      border: `1px solid ${border} !important`,
      borderRadius: '10px !important',
      padding: '10px 12px !important',
      maxWidth: '360px !important',
      boxShadow: isLight
        ? '0 4px 16px rgba(0,0,0,0.10) !important'
        : '0 4px 16px rgba(0,0,0,0.40) !important',
    },
    [`& .${tooltipClasses.arrow}`]: {
      color: `${bg} !important`,
      '&::before': {
        border: `1px solid ${border} !important`,
      },
    },
  };
});

export default ThemedTooltip;
