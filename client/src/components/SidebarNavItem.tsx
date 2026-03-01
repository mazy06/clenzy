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
  const isXl = useMediaQuery(theme.breakpoints.up('xl'));

  // Responsive sizes: slightly tighter on lg, comfortable on xl+
  const itemHeight = isXl ? 40 : 36;
  const iconSize = isXl ? 20 : 18;
  const fontSize = isXl ? '0.8125rem' : '0.75rem';

  const content = (
    <ListItemButton
      onClick={() => onClick(item.path)}
      selected={isActive}
      sx={{
        minHeight: itemHeight,
        px: isCollapsed ? 2 : 1.5,
        py: isXl ? 0.5 : 0.25,
        mx: 0.75,
        borderRadius: '6px',
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        borderLeft: isActive ? '3px solid' : '3px solid transparent',
        borderLeftColor: isActive ? 'primary.main' : 'transparent',
        backgroundColor: isActive ? 'rgba(107, 138, 154, 0.08)' : 'transparent',
        '&:hover': {
          backgroundColor: isActive
            ? 'rgba(107, 138, 154, 0.12)'
            : 'rgba(107, 138, 154, 0.04)',
        },
        '&.Mui-selected': {
          backgroundColor: 'rgba(107, 138, 154, 0.08)',
          '&:hover': {
            backgroundColor: 'rgba(107, 138, 154, 0.12)',
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
          '& .MuiSvgIcon-root': { fontSize: iconSize },
          transition: 'color 150ms',
        }}
      >
        {item.icon}
      </ListItemIcon>
      <ListItemText
        primary={item.text}
        primaryTypographyProps={{
          fontSize,
          fontWeight: isActive ? 600 : 400,
          color: isActive ? 'text.primary' : 'text.secondary',
          noWrap: true,
        }}
        sx={{
          opacity: isCollapsed ? 0 : 1,
          width: isCollapsed ? 0 : 'auto',
          transition: 'opacity 200ms',
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
