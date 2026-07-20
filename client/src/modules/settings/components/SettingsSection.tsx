import React from 'react';
import { Avatar, Box, Paper, Typography } from '@mui/material';
import type { LucideIcon } from 'lucide-react';

export type SettingsSectionAccent = 'primary' | 'accent' | 'info' | 'warm' | 'danger' | 'neutral';

const ACCENT_HEX: Record<SettingsSectionAccent, string> = {
  primary: 'var(--accent)',
  accent: 'var(--ok)',
  info: 'var(--info)',
  warm: 'var(--warn)',
  danger: 'var(--err)',
  neutral: 'var(--muted)',
};

interface SettingsSectionProps {
  title: string;
  /** Icone fallback (utilise si `avatar` non fourni ou que l'image ne charge pas). */
  icon: LucideIcon;
  accent?: SettingsSectionAccent;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  /**
   * Alternative a l'icone : affiche une photo de profil en haut a gauche de la
   * section. Si `src` est absent ou que l'image fail a charger, MUI Avatar
   * fallback automatiquement sur `initials` (puis sur `icon` si initials vides).
   * Utile pour la section "Mon compte" qui doit montrer la photo de l'utilisateur
   * connecte plutot qu'une icone generique.
   */
  avatar?: {
    src?: string;
    initials?: string;
    alt?: string;
  };
}

const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  icon: Icon,
  accent = 'primary',
  description,
  action,
  children,
  avatar,
}) => {
  const color = ACCENT_HEX[accent];

  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: 'none',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        '&:hover': {
          borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
        },
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0, flex: 1 }}>
          {avatar ? (
            <Avatar
              src={avatar.src}
              alt={avatar.alt ?? title}
              sx={{
                width: 32,
                height: 32,
                fontSize: '0.75rem',
                fontWeight: 600,
                bgcolor: `color-mix(in srgb, ${color} 8%, transparent)`,
                color,
                border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
                flexShrink: 0,
              }}
            >
              {avatar.initials || <Icon size={16} strokeWidth={1.75} />}
            </Avatar>
          ) : (
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: `color-mix(in srgb, ${color} 8%, transparent)`,
                color,
                border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              <Icon size={16} strokeWidth={1.75} />
            </Box>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography
              fontWeight={600}
              sx={{
                fontSize: '0.9rem',
                lineHeight: 1.25,
                color: 'text.primary',
                letterSpacing: '-0.005em',
              }}
            >
              {title}
            </Typography>
            {description && (
              <Typography
                sx={{
                  fontSize: '0.72rem',
                  color: 'text.secondary',
                  lineHeight: 1.35,
                  mt: 0.125,
                }}
              >
                {description}
              </Typography>
            )}
          </Box>
        </Box>
        {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
      </Box>

      <Box sx={{ flex: 1, p: 2 }}>{children}</Box>
    </Paper>
  );
};

export default SettingsSection;