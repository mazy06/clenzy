import React, { useState, useEffect, useRef } from 'react';
import { Paper, Typography, Button, Box, Slide, IconButton } from '@mui/material';
import { Close as CloseIcon, GetApp as GetAppIcon } from '../icons';
import { usePWA } from '../hooks/usePWA';
import { useUserPreference } from '../hooks/useUserPreference';

const LEGACY_DISMISS_KEY = 'pwa-banner-dismissed-at';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export default function PWAInstallBanner() {
  const { canInstall, install } = usePWA();
  // Persiste backend (user_ui_preferences) — la decision "ne pas reproposer
  // l'installation PWA pendant 7j" suit l'utilisateur cross-devices. Note :
  // `canInstall` reste device-specific (depend du browser + manifest), donc
  // si le banner est dismissed sur device A et que l'user ouvre l'app sur
  // device B PWA-capable, on respecte le delai de 7j la aussi.
  const [dismissedAt, setDismissedAt, { isLoaded }] = useUserPreference<number | null>(
    'pwa.installBannerDismissedAt',
    null,
  );
  const [visible, setVisible] = useState(false);

  // Migration legacy (BUG-4) : recupere le timestamp dismissed depuis
  // l'ancienne cle localStorage et le pousse vers backend une seule fois.
  // Gate sur `isLoaded` pour eviter d'ecraser une valeur backend existante
  // (dismissed=null explicite signifiant "re-proposer maintenant").
  const migrationDoneRef = useRef(false);
  useEffect(() => {
    if (migrationDoneRef.current || !isLoaded) return;
    if (dismissedAt !== null) {
      migrationDoneRef.current = true;
      try { localStorage.removeItem(LEGACY_DISMISS_KEY); } catch { /* noop */ }
      return;
    }
    try {
      const legacy = localStorage.getItem(LEGACY_DISMISS_KEY);
      if (legacy) {
        const ts = Number(legacy);
        if (Number.isFinite(ts)) {
          migrationDoneRef.current = true;
          setDismissedAt(ts);
          localStorage.removeItem(LEGACY_DISMISS_KEY);
          return;
        }
      }
      migrationDoneRef.current = true;
    } catch {
      migrationDoneRef.current = true;
    }
  }, [isLoaded, dismissedAt, setDismissedAt]);

  useEffect(() => {
    if (!canInstall) {
      setVisible(false);
      return;
    }

    // Check if user dismissed the banner recently
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_DURATION_MS) {
      return;
    }

    setVisible(true);
  }, [canInstall, dismissedAt]);

  const handleInstall = async () => {
    await install();
    setVisible(false);
  };

  const handleDismiss = () => {
    setDismissedAt(Date.now());
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
        <Box component="span" sx={{ display: 'inline-flex', flexShrink: 0 }}><GetAppIcon size={32} strokeWidth={1.75} /></Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={600} noWrap>
            Installer Baitly PMS
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
          <CloseIcon size={20} strokeWidth={1.75} />
        </IconButton>
      </Paper>
    </Slide>
  );
}
