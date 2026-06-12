import React from 'react';
import { Box, Typography, Slide } from '@mui/material';
import { WifiOff as WifiOffIcon } from '../icons';
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
          // Alerte -soft hairline : fond opaque (card) + couche warn-soft plate
          backgroundColor: 'var(--card)',
          backgroundImage: 'linear-gradient(var(--warn-soft), var(--warn-soft))',
          borderBottom: '1px solid color-mix(in srgb, var(--warn) 30%, transparent)',
          color: 'var(--ink)',
          py: 1,
          px: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
        }}
      >
        <Box component="span" sx={{ display: 'inline-flex', color: 'var(--warn)' }}>
          <WifiOffIcon size={17} strokeWidth={1.75} />
        </Box>
        <Typography variant="body2" fontWeight={600} sx={{ fontSize: '12.5px' }}>
          {t('offline.banner', 'Vous \u00eates hors ligne. Certaines fonctionnalit\u00e9s peuvent ne pas \u00eatre disponibles.')}
        </Typography>
      </Box>
    </Slide>
  );
}
