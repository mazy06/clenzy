import React from 'react';
import {
  Badge,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import type { MenuItem } from '../hooks/useNavigationMenu';

interface SidebarNavItemProps {
  item: MenuItem;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: (path: string) => void;
}

function SidebarNavItem({ item, isActive, isCollapsed, onClick }: SidebarNavItemProps) {
  const theme = useTheme();
  // 4 tiers : sm (< md), md (900-1200), lg (1200-1536), xl (1536+)
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  const isLg = useMediaQuery(theme.breakpoints.up('lg'));
  const isXl = useMediaQuery(theme.breakpoints.up('xl'));

  // Échelles progressives — icônes restent ~1.3x la hauteur du texte
  const itemHeight = isXl ? 34 : isLg ? 30 : isMd ? 28 : 26;
  const iconSize = isXl ? 15 : isLg ? 14 : isMd ? 13 : 12;
  const fontSize = isXl ? '0.75rem' : isLg ? '0.6875rem' : isMd ? '0.625rem' : '0.5625rem';

  // ── État sélectionné « Signature » (refonte 2026-06, maquette _dash) :
  //    pilule PLEINE à la couleur d'accent (var(--accent), suit data-accent),
  //    texte/icône en --on-accent. Hover non-actif = --hover (token).
  //    Pas de side-stripe (Impeccable absolute ban).
  const content = (
    <ListItemButton
      onClick={() => onClick(item.path)}
      selected={isActive}
      sx={{
        minHeight: itemHeight,
        px: isCollapsed ? 2 : 1.5,
        py: isXl ? 0.5 : 0.25,
        mx: 0.75,
        borderRadius: '10px',
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        backgroundColor: isActive ? 'var(--accent)' : 'transparent',
        '&:hover': {
          backgroundColor: isActive ? 'var(--accent-deep)' : 'var(--hover)',
        },
        '&.Mui-selected': {
          backgroundColor: 'var(--accent)',
          '&:hover': {
            backgroundColor: 'var(--accent-deep)',
          },
        },
        transition: 'background-color 150ms',
      }}
    >
      <ListItemIcon
        sx={{
          minWidth: 0,
          mr: isCollapsed ? 0 : 1.25,
          justifyContent: 'center',
          color: isActive ? 'var(--on-accent)' : 'var(--muted)',
          '& svg': { width: iconSize, height: iconSize, flexShrink: 0 },
          transition: 'color 150ms',
        }}
      >
        {/* Wrap l'icone dans un Badge si un compteur est defini.
             Position decalee (top-right) pour ne pas couvrir l'icone. */}
        {item.badge != null && item.badge > 0 ? (
          <Badge
            badgeContent={item.badge}
            color={item.badgeColor ?? 'warning'}
            max={99}
            overlap="circular"
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            sx={{
              '& .MuiBadge-badge': {
                fontSize: '0.5625rem',
                fontWeight: 700,
                height: 14,
                minWidth: 14,
                padding: '0 4px',
                borderRadius: '7px',
                top: -2,
                right: -2,
                boxShadow: (theme) => `0 0 0 1.5px ${theme.palette.background.paper}`,
              },
            }}
          >
            {React.isValidElement(item.icon)
              ? React.cloneElement(item.icon as React.ReactElement<{ size?: number; strokeWidth?: number }>, {
                  size: iconSize,
                  strokeWidth: isActive ? 2 : 1.75,
                })
              : item.icon}
          </Badge>
        ) : (
          React.isValidElement(item.icon)
            ? React.cloneElement(item.icon as React.ReactElement<{ size?: number; strokeWidth?: number }>, {
                size: iconSize,
                strokeWidth: isActive ? 2 : 1.75,
              })
            : item.icon
        )}
      </ListItemIcon>
      {!isCollapsed && (
        <ListItemText
          primary={item.text}
          primaryTypographyProps={{
            fontSize,
            fontWeight: isActive ? 600 : 500,
            color: isActive ? 'var(--on-accent)' : 'var(--body)',
            noWrap: true,
          }}
          sx={{
            transition: 'color 150ms',
            overflow: 'hidden',
          }}
        />
      )}
    </ListItemButton>
  );

  if (isCollapsed) {
    return (
      <Tooltip title={item.text} placement="right" arrow>
        {content}
      </Tooltip>
    );
  }

  return content;
}

export default React.memo(SidebarNavItem);
