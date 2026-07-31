import React from 'react';
import { Box, Button, useTheme, alpha } from '@mui/material';
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
    <div className="flex flex-col items-center justify-center gap-4 py-12 px-4 min-h-[480px] text-center">
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

      <div>
        <h6 className="cn-text-h6 mb-1.5 font-semibold">
          Page introuvable
        </h6>
        <p className="cn-text-body2 text-muted-foreground max-w-[480px]">
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
        </p>
      </div>

      <div className="flex gap-2 mt-1.5">
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
      </div>
    </div>
  );
};

export default NotFoundPage;
