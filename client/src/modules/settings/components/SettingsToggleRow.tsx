import React from 'react';
import { Box, Switch, Typography } from '@mui/material';
import type { LucideIcon } from 'lucide-react';

interface SettingsToggleRowProps {
  icon?: LucideIcon;
  iconColor?: string;
  /** Title text or a custom node (e.g. label + inline status chips) */
  title: React.ReactNode;
  /** Description text or a custom node */
  description?: React.ReactNode;
  /** Right-hand control: Switch (default), TextField, or any node */
  control?: React.ReactNode;
  /** Convenience for switches — when set, builds a Switch with these props */
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  /** Render a divider underneath (defaults to true; pass false for the last row) */
  divider?: boolean;
  disabled?: boolean;
}

const SettingsToggleRow: React.FC<SettingsToggleRowProps> = ({
  icon: Icon,
  iconColor = 'var(--muted)',
  title,
  description,
  control,
  checked,
  onChange,
  divider = true,
  disabled,
}) => {
  const renderedControl =
    control ??
    (typeof checked === 'boolean' ? (
      <Switch
        size="small"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        disabled={disabled}
      />
    ) : null);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 1.25,
        ...(divider && {
          borderBottom: '1px solid',
          borderColor: 'divider',
        }),
        '&:last-of-type': {
          borderBottom: 'none',
        },
      }}
    >
      {Icon && (
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: '7px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: iconColor,
            backgroundColor: `color-mix(in srgb, ${iconColor} 7%, transparent)`,
            border: `1px solid color-mix(in srgb, ${iconColor} 15%, transparent)`,
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          <Icon size={14} strokeWidth={1.75} />
        </Box>
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {typeof title === 'string' ? (
          <Typography
            fontWeight={600}
            sx={{
              fontSize: '0.8125rem',
              lineHeight: 1.3,
              color: disabled ? 'text.disabled' : 'text.primary',
            }}
          >
            {title}
          </Typography>
        ) : (
          <Box
            sx={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              lineHeight: 1.3,
              color: disabled ? 'text.disabled' : 'text.primary',
            }}
          >
            {title}
          </Box>
        )}
        {description && (
          typeof description === 'string' ? (
            <Typography
              sx={{
                fontSize: '0.72rem',
                lineHeight: 1.4,
                color: 'text.secondary',
                mt: 0.125,
              }}
            >
              {description}
            </Typography>
          ) : (
            <Box sx={{ fontSize: '0.72rem', lineHeight: 1.4, color: 'text.secondary', mt: 0.125 }}>
              {description}
            </Box>
          )
        )}
      </Box>
      {renderedControl && (
        <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{renderedControl}</Box>
      )}
    </Box>
  );
};

export default SettingsToggleRow;
