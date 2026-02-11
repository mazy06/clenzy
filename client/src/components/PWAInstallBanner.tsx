import React, { useState, useEffect } from 'react';
import { Paper, Typography, Button, Box, Slide, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import GetAppIcon from '@mui/icons-material/GetApp';
import { usePWA } from '../hooks/usePWA';

const DISMISS_KEY = 'pwa-banner-dismissed-at';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export default function PWAInstallBanner() {
  const { canInstall, install } = usePWA();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!canInstall) {
      setVisible(false);
      return;
    }

    // Check if user dismissed the banner recently
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - Number(dismissedAt);
      if (elapsed < DISMISS_DURATION_MS) {
        return;
      }
    }

    setVisible(true);
  }, [canInstall]);

  const handleInstall = async () => {
    await install();
    setVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  return (
    <Slide direction="up" in={visible} mountOnEnter unmountOnExit>
      <Paper
        elevation={6}
        sx={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          right: 16,
          zIndex: 1300,
          p: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          borderRadius: 2,
          backgroundColor: '#6B8A9A',
          color: 'white',
          maxWidth: 600,
          mx: 'auto',
        }}
      >
        <GetAppIcon sx={{ fontSize: 32, flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={600} noWrap>
            Installer Clenzy PMS
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            Installez l'application sur votre appareil pour un acc&egrave;s rapide.
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="small"
          onClick={handleInstall}
          sx={{
            backgroundColor: 'white',
            color: '#6B8A9A',
            fontWeight: 600,
            textTransform: 'none',
            flexShrink: 0,
            '&:hover': {
              backgroundColor: 'rgba(255,255,255,0.9)',
            },
          }}
        >
          Installer
        </Button>
        <IconButton
          size="small"
          onClick={handleDismiss}
          sx={{ color: 'white', flexShrink: 0 }}
          aria-label="Fermer"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Paper>
    </Slide>
  );
}
