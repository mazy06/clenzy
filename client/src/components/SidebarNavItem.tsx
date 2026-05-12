import React from 'react';
import {
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

  // ── État sélectionné : icône + texte dans la couleur primary (cohérent),
  //    fond teinté primary à 14 %, liseré gauche primary 3 px. Pas de noir.
  //    Active hover monte à 18 %.
  const content = (
    <ListItemButton
      onClick={() => onClick(item.path)}
      selected={isActive}
      sx={{
        minHeight: itemHeight,
        px: isCollapsed ? 2 : 1.5,
        py: isXl ? 0.5 : 0.25,
        mx: 0.75,
        borderRadius: '8px',
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        borderLeft: isActive ? '3px solid' : '3px solid transparent',
        borderLeftColor: isActive ? 'primary.main' : 'transparent',
        backgroundColor: isActive ? 'rgba(107, 138, 154, 0.14)' : 'transparent',
        '&:hover': {
          backgroundColor: isActive
            ? 'rgba(107, 138, 154, 0.18)'
            : 'rgba(107, 138, 154, 0.05)',
        },
        '&.Mui-selected': {
          backgroundColor: 'rgba(107, 138, 154, 0.14)',
          '&:hover': {
            backgroundColor: 'rgba(107, 138, 154, 0.18)',
          },
        },
        transition: 'background-color 150ms, border-color 150ms',
      }}
    >
      <ListItemIcon
        sx={{
          minWidth: 0,
          mr: isCollapsed ? 0 : 1.25,
          justifyContent: 'center',
          color: isActive ? 'primary.main' : 'text.secondary',
          '& svg': { width: iconSize, height: iconSize, flexShrink: 0 },
          transition: 'color 150ms',
        }}
      >
        {React.isValidElement(item.icon)
          ? React.cloneElement(item.icon as React.ReactElement<{ size?: number; strokeWidth?: number }>, {
              size: iconSize,
              strokeWidth: isActive ? 2 : 1.75,
            })
          : item.icon}
      </ListItemIcon>
      <ListItemText
        primary={item.text}
        primaryTypographyProps={{
          fontSize,
          fontWeight: isActive ? 600 : 500,
          color: isActive ? 'primary.main' : 'text.secondary',
          noWrap: true,
        }}
        sx={{
          opacity: isCollapsed ? 0 : 1,
          width: isCollapsed ? 0 : 'auto',
          transition: 'opacity 200ms, color 150ms',
          overflow: 'hidden',
        }}
      />
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
