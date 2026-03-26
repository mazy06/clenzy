import React from 'react';
import { Box } from '@mui/material';

/**
 * Booking Engine Toggle — reusable switch component.
 *
 * Reproduces the Asterio/Safari Lodge toggle design:
 * - Container: 48×24px, pill shape
 * - Unchecked: bg = surfaceMuted (#F2F1EB), knob = primary (#B2974A), left
 * - Checked:   bg = primary (#B2974A), knob = white with checkmark icon, right
 * - Transition: 0.25s ease-in-out
 *
 * Themeable via `primaryColor` and `surfaceMutedColor` props.
 * Intégrateurs can replace `assets/default/icon-check.svg` for custom checkmark.
 */

interface BookingToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  primaryColor?: string;
  surfaceMutedColor?: string;
  disabled?: boolean;
  size?: 'default' | 'small';
}

const BookingToggle: React.FC<BookingToggleProps> = ({
  checked,
  onChange,
  primaryColor = '#B2974A',
  surfaceMutedColor = '#F2F1EB',
  disabled = false,
  size = 'default',
}) => {
  const w = size === 'small' ? 40 : 48;
  const h = size === 'small' ? 20 : 24;
  const knob = size === 'small' ? 14 : 16;
  const pad = (h - knob) / 2; // 4px
  const travel = w - knob - pad * 2; // 24px for default

  return (
    <Box
      role="switch"
      aria-checked={checked}
      onClick={(e: React.MouseEvent) => { e.preventDefault(); if (!disabled) onChange(!checked); }}
      sx={{
        position: 'relative',
        display: 'inline-block',
        width: w,
        height: h,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
      }}
    >
      {/* Hidden checkbox for a11y */}
      <Box
        component="input"
        type="checkbox"
        checked={checked}
        readOnly
        tabIndex={-1}
        sx={{
          position: 'absolute',
          width: 0,
          height: 0,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Track (slider) */}
      <Box
        sx={{
          width: w,
          height: h,
          borderRadius: `${h}px`,
          bgcolor: checked ? primaryColor : surfaceMutedColor,
          transition: 'background-color 0.25s ease-in-out',
          position: 'relative',
        }}
      >
        {/* Knob (circle) */}
        <Box
          sx={{
            width: knob,
            height: knob,
            borderRadius: '50%',
            bgcolor: checked ? '#FFFFFF' : primaryColor,
            position: 'absolute',
            top: `${pad}px`,
            left: `${pad}px`,
            transform: checked ? `translateX(${travel}px)` : 'none',
            transition: 'transform 0.25s ease-in-out, background-color 0.25s ease-in-out',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Checkmark icon — visible only when checked */}
          <Box
            component="svg"
            viewBox="0 0 56 56"
            sx={{
              width: size === 'small' ? 10 : 12,
              height: size === 'small' ? 10 : 12,
              opacity: checked ? 1 : 0,
              transition: 'opacity 0.2s ease-in-out',
            }}
          >
            <path
              d="M45.288 15.759C46.104 16.511 46.104 17.727 45.288 18.407L24.168 39.527C23.488 40.343 22.272 40.343 21.52 39.527L10.64 28.647C9.888 27.967 9.888 26.751 10.64 25.999C11.392 25.255 12.608 25.255 13.352 25.999L22.872 35.527L42.632 15.759C43.384 15.015 44.6 15.015 45.28 15.759Z"
              fill={primaryColor}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default BookingToggle;
