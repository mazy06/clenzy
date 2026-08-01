import React from 'react';
import { useTheme, alpha } from '@mui/material';
import { Button } from '../components/ui';
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
      <div className="text-[5rem] font-semibold tabular-nums leading-[1]" style={{ color: alpha(theme.palette.primary.main, 0.4) }}>
        404
      </div>

      <div>
        <h6 className="cn-text-h6 mb-1.5 font-semibold">
          Page introuvable
        </h6>
        <p className="cn-text-body2 text-muted-foreground max-w-[480px]">
          L&apos;adresse{' '}
          <code className="px-[4.5px] py-[1.5px] rounded-[4px] text-[0.85em]" style={{ backgroundColor: alpha(theme.palette.text.primary, 0.06), fontFamily: 'monospace' }}>
            {location.pathname}
          </code>{' '}
          ne correspond a aucune page. Verifie l&apos;orthographe ou retourne au dashboard.
        </p>
      </div>

      <div className="flex gap-2 mt-1.5">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeftIcon size={16} />
          Retour
        </Button>
        <Button onClick={() => navigate('/dashboard')}>
          <HomeIcon size={16} />
          Aller au dashboard
        </Button>
      </div>
    </div>
  );
};

export default NotFoundPage;
