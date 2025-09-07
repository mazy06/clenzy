import React from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Drawer,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { MenuItem } from '../hooks/useNavigationMenu';
import clenzyLogo from '../assets/Clenzy_logo.png';

interface NavigationDrawerProps {
  menuItems: MenuItem[];
  mobileOpen: boolean;
  onDrawerToggle: () => void;
  drawerWidth: number;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  menuItems,
  mobileOpen,
  onDrawerToggle,
  drawerWidth
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      onDrawerToggle();
    }
  };

  const drawerContent = (
    <Box>
      {/* Header avec logo */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        p: 3, 
        mb: 3,
        backgroundColor: 'rgba(166, 192, 206, 0.08)',
        border: '1px solid rgba(166, 192, 206, 0.15)'
      }}>
        <img 
          src={clenzyLogo} 
          alt="Clenzy Logo" 
          style={{ 
            height: '60px', 
            width: 'auto',
            maxWidth: '200px',
            marginBottom: '8px'
          }} 
        />
        <Typography 
          variant="caption" 
          color="text.secondary"
          sx={{ 
            textTransform: 'uppercase',
            letterSpacing: '1px',
            fontWeight: 600,
            textAlign: 'center'
          }}
        >
          Propreté & Multiservices
        </Typography>
      </Box>

      {/* Menu items */}
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.id} disablePadding>
            <ListItemButton
              onClick={() => handleNavigation(item.path)}
              selected={location.pathname === item.path}
              sx={{
                borderRadius: 2,
                mx: 1,
                mb: 0.5,
                '&.Mui-selected': {
                  backgroundColor: '#A6C0CE',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: '#8BA3B3',
                  },
                },
                '&:hover': {
                  backgroundColor: 'rgba(166, 192, 206, 0.1)',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: location.pathname === item.path ? 'inherit' : '#666666',
                  minWidth: 40,
                  '& .MuiSvgIcon-root': {
                    color: location.pathname === item.path ? 'inherit' : '#666666',
                  },
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.text} 
                primaryTypographyProps={{
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  color: location.pathname === item.path ? 'inherit' : '#666666',
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box
      component="nav"
      sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
    >
      {/* Drawer mobile */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onDrawerToggle}
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { 
            boxSizing: 'border-box', 
            width: drawerWidth,
            borderRadius: 0
          },
        }}
      >
        {drawerContent}
      </Drawer>
      
      {/* Drawer desktop */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': { 
            boxSizing: 'border-box', 
            width: drawerWidth,
            borderRadius: 0
          },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </Box>
  );
};
