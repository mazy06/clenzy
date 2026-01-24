import React, { useState } from 'react';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  useTheme,
  useMediaQuery,
  IconButton,
} from '@mui/material';
import {
  Menu as MenuIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { MenuItem as MenuItemType } from '../hooks/useNavigationMenu';

interface TopNavigationProps {
  menuItems: MenuItemType[];
}

export const TopNavigation: React.FC<TopNavigationProps> = ({ menuItems }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState<HTMLElement | null>(null);

  // Menus à afficher directement dans la barre : Tableau de bord, Propriétés, Demandes de service, Interventions, Équipes
  const directMenus = menuItems.filter(item => 
    ['/dashboard', '/properties', '/service-requests', '/interventions', '/teams'].includes(item.path)
  );

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileMenuAnchor(null);
  };

  const handleMobileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMobileMenuAnchor(event.currentTarget);
  };

  const handleMobileMenuClose = () => {
    setMobileMenuAnchor(null);
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  // Menu mobile : tous les éléments dans un menu déroulant
  if (isMobile) {
    return (
      <>
        <IconButton
          color="inherit"
          onClick={handleMobileMenuOpen}
          sx={{ mr: 1 }}
        >
          <MenuIcon />
        </IconButton>
        <Menu
          anchorEl={mobileMenuAnchor}
          open={Boolean(mobileMenuAnchor)}
          onClose={handleMobileMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
        >
          {menuItems.map((item) => (
            <MenuItem
              key={item.id}
              onClick={() => handleNavigation(item.path)}
              selected={isActive(item.path)}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {item.icon}
                {item.text}
              </Box>
            </MenuItem>
          ))}
        </Menu>
      </>
    );
  }

  // Navigation desktop
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexGrow: 1, overflowX: 'auto', minWidth: 0 }}>
      {/* Menus directs */}
      {directMenus.length > 0 ? (
        directMenus.map((item) => (
          <Button
            key={item.id}
            onClick={() => handleNavigation(item.path)}
            startIcon={item.icon}
            sx={{
              color: isActive(item.path) ? '#A6C0CE' : '#666666',
              fontWeight: isActive(item.path) ? 600 : 500,
              textTransform: 'none',
              borderBottom: isActive(item.path) ? '2px solid #A6C0CE' : '2px solid transparent',
              borderRadius: 0,
              px: 1.5,
              py: 1,
              minWidth: 'auto',
              whiteSpace: 'nowrap',
              fontSize: '0.875rem',
              '&:hover': {
                backgroundColor: 'rgba(166, 192, 206, 0.1)',
                borderBottom: '2px solid #A6C0CE',
              },
            }}
          >
            {item.text}
          </Button>
        ))
      ) : (
        <Box sx={{ px: 2, color: '#999', fontSize: '0.875rem' }}>
          Aucun menu disponible
        </Box>
      )}
    </Box>
  );
};
