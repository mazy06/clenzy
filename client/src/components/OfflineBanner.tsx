import React from 'react';
import { Box, Typography, Slide } from '@mui/material';
import { WifiOff as WifiOffIcon } from '@mui/icons-material';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useTranslation } from 'react-i18next';

/**
 * Bannière fixe affichée en haut de l'écran lorsque l'utilisateur est hors ligne.
 * Utilise une transition Slide pour apparaître/disparaître.
 * Se masque automatiquement lorsque la connexion est rétablie.
 */
export default function OfflineBanner() {
  const { isOnline } = useOnlineStatus();
  const { t } = useTranslation();

  return (
    <Slide direction="down" in={!isOnline} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          backgroundColor: '#f59e0b',
          color: '#1e293b',
          py: 1,
          px: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <WifiOffIcon sx={{ fontSize: 20 }} />
        <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8125rem' }}>
          {t('offline.banner', 'Vous \u00eates hors ligne. Certaines fonctionnalit\u00e9s peuvent ne pas \u00eatre disponibles.')}
        </Typography>
      </Box>
    </Slide>
  );
}
