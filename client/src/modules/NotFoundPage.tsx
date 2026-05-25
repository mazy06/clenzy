import React from 'react';
import { Box, Typography, Button, useTheme, alpha } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home as HomeIcon, ArrowBack as ArrowLeftIcon } from '../icons';

/**
 * Page 404 affichee quand aucune route ne matche.
 *
 * <p>Affichee notamment quand l'utilisateur tape une URL avec une typo
 * (ex: /assitant au lieu de /assistant) — au lieu d'un ecran blanc silencieux.</p>
 */
const NotFoundPage: React.FC = () => {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        py: 8,
        px: 3,
        minHeight: 480,
        textAlign: 'center',
      }}
    >
      <Box
        sx={{
          fontSize: '5rem',
          fontWeight: 600,
          color: alpha(theme.palette.primary.main, 0.4),
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        404
      </Box>

      <Box>
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
          Page introuvable
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 480 }}>
          L&apos;adresse{' '}
          <Box component="code" sx={{
            px: 0.75,
            py: 0.25,
            borderRadius: 0.5,
            bgcolor: alpha(theme.palette.text.primary, 0.06),
            fontFamily: 'monospace',
            fontSize: '0.85em',
          }}>
            {location.pathname}
          </Box>{' '}
          ne correspond a aucune page. Verifie l&apos;orthographe ou retourne au dashboard.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mt: 1 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowLeftIcon size={16} />}
          onClick={() => navigate(-1)}
          sx={{ cursor: 'pointer' }}
        >
          Retour
        </Button>
        <Button
          variant="contained"
          startIcon={<HomeIcon size={16} />}
          onClick={() => navigate('/dashboard')}
          sx={{ cursor: 'pointer' }}
        >
          Aller au dashboard
        </Button>
      </Box>
    </Box>
  );
};

export default NotFoundPage;
