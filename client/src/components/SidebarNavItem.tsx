import React from 'react';
import {
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from '@mui/material';
import type { MenuItem } from '../hooks/useNavigationMenu';

interface SidebarNavItemProps {
  item: MenuItem;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: (path: string) => void;
}

function SidebarNavItem({ item, isActive, isCollapsed, onClick }: SidebarNavItemProps) {
  const content = (
    <ListItemButton
      onClick={() => onClick(item.path)}
      selected={isActive}
      sx={{
        minHeight: 40,
        px: isCollapsed ? 2.5 : 2,
        py: 0.5,
        mx: 1,
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
          mr: isCollapsed ? 0 : 1.5,
          justifyContent: 'center',
          color: isActive ? 'primary.main' : 'text.secondary',
          '& .MuiSvgIcon-root': { fontSize: 20 },
          transition: 'color 150ms',
        }}
      >
        {item.icon}
      </ListItemIcon>
      <ListItemText
        primary={item.text}
        primaryTypographyProps={{
          fontSize: '0.8125rem',
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
