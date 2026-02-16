import React, { useState } from 'react';
import {
  Box,
  Button,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  useTheme,
  useMediaQuery,
  IconButton,
  Divider,
  Typography,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { MenuItem as MenuItemType } from '../hooks/useNavigationMenu';
import { useTranslation } from '../hooks/useTranslation';

interface TopNavigationProps {
  menuItems: MenuItemType[];
}

export const TopNavigation: React.FC<TopNavigationProps> = ({ menuItems }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Menus à afficher directement dans la barre de navigation
  const directMenus = menuItems.filter(item =>
    ['/dashboard', '/properties', '/service-requests', '/interventions', '/teams', '/portfolios', '/contact', '/tarification', '/payments/history'].includes(item.path)
  );

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const handleMobileMenuOpen = () => {
    setMobileMenuOpen(true);
  };

  const handleMobileMenuClose = () => {
    setMobileMenuOpen(false);
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  // Menu mobile : Drawer plein écran
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
        <Drawer
          anchor="left"
          open={mobileMenuOpen}
          onClose={handleMobileMenuClose}
          sx={{
            '& .MuiDrawer-paper': {
              width: '100%',
              height: '100%',
              maxWidth: '100%',
              maxHeight: '100%',
            },
          }}
        >
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              bgcolor: 'background.paper',
            }}
          >
            {/* Header avec bouton fermer */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {t('navigation.menu')}
              </Typography>
              <IconButton
                onClick={handleMobileMenuClose}
                sx={{ color: 'text.primary' }}
              >
                <CloseIcon />
              </IconButton>
            </Box>

            {/* Liste des menus */}
            <List sx={{ flexGrow: 1, pt: 1 }}>
              {menuItems.map((item, index) => (
                <React.Fragment key={item.id}>
                  <ListItem disablePadding>
                    <ListItemButton
                      onClick={() => handleNavigation(item.path)}
                      selected={isActive(item.path)}
                      sx={{
                        py: 2,
                        px: 3,
                        '&.Mui-selected': {
                          backgroundColor: 'rgba(166, 192, 206, 0.1)',
                          borderLeft: '3px solid #A6C0CE',
                          '&:hover': {
                            backgroundColor: 'rgba(166, 192, 206, 0.15)',
                          },
                        },
                        '&:hover': {
                          backgroundColor: 'rgba(166, 192, 206, 0.05)',
                        },
                      }}
                    >
                      <ListItemText
                        primary={item.text}
                        primaryTypographyProps={{
                          fontSize: '1rem',
                          fontWeight: isActive(item.path) ? 600 : 400,
                          color: isActive(item.path) ? '#A6C0CE' : 'text.primary',
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                  {index < menuItems.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </Box>
        </Drawer>
      </>
    );
  }

  // Navigation desktop
  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      gap: 3, // Augmentation de l'espacement entre les boutons
      overflowX: 'auto', 
      minWidth: 0 
    }}>
      {/* Menus directs */}
      {directMenus.length > 0 ? (
        directMenus.map((item) => (
          <Button
            key={item.id}
            onClick={() => handleNavigation(item.path)}
            sx={{
              color: isActive(item.path) ? '#A6C0CE' : theme.palette.text.secondary,
              fontWeight: isActive(item.path) ? 600 : 500,
              textTransform: 'none',
              borderBottom: isActive(item.path) ? '2px solid #A6C0CE' : '2px solid transparent',
              borderRadius: 0,
              px: 2, // Augmentation du padding horizontal pour plus d'espace
              py: 0.75,
              minWidth: 'auto',
              whiteSpace: 'nowrap',
              fontSize: '0.8125rem',
              minHeight: 40,
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
        <Box sx={{ px: 2, color: 'text.disabled', fontSize: '0.875rem' }}>
          {t('navigation.noMenuAvailable')}
        </Box>
      )}
    </Box>
  );
};
