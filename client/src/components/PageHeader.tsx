import React, { useMemo } from 'react';
import { Box, Typography, Button, Tooltip, useTheme, useMediaQuery } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '../icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useIconSize } from '../hooks/useResponsiveSize';
import { useAuth } from '../hooks/useAuth';
import { getScreenIdentity, type HubAccess } from '../config/navigationHubs';
import HubScreenSwitcher from './HubScreenSwitcher';
import PageHeaderActions from './PageHeaderActions';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /**
   * Icone optionnelle affichee dans une pastille arrondie a gauche du titre.
   * Langage Signature : fond soft (var(--accent-soft)), icone var(--accent).
   */
  iconBadge?: React.ReactNode;
  /** Couleur du badge icone. Default : primary. */
  iconBadgeColor?: string;
  /**
   * Element optionnel rendu inline a droite du titre (meme ligne que le h1).
   * Typiquement une Chip de statut decrivant l'entite (Actif/Inactif, Brouillon, etc.).
   * Sert a separer ce que l'entite EST (titre + adornment) de ce qu'on peut FAIRE (actions).
   */
  titleAdornment?: React.ReactNode;
  backPath?: string;
  backLabel?: string;
  /** Callback invoked when the back button is clicked. Takes priority over backPath. */
  onBack?: () => void;
  actions?: React.ReactNode;
  /** Slot for search / filter elements rendered inline with actions on the title row */
  filters?: React.ReactNode;
  showBackButton?: boolean;
  showBackButtonWithActions?: boolean;
}

/**
 * Header de page standardise pour le PMS.
 *
 * Structure :
 *   [iconBadge] Titre h5 (responsive)        [filters] [actions] [backButton]
 *               Sous-titre body2 (responsive)
 *
 * Le titre/sous-titre heritent automatiquement de la typography responsive
 * du theme (3 paliers : sm/md/xl). L'icone badge passe par useIconSize('badge')
 * pour rester coherente avec les autres badges du PMS.
 *
 * Mode compact (md-) : les boutons textuels avec icone deviennent icon-only
 * + tooltip pour gagner de la place sur les laptops.
 */
export default function PageHeader({
  title,
  subtitle,
  iconBadge,
  iconBadgeColor,
  titleAdornment,
  backPath,
  backLabel = 'Retour',
  onBack,
  actions,
  filters,
  showBackButton = true,
  showBackButtonWithActions = false,
}: PageHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, isManager } = useAuth();
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));
  const badgeIconSize = useIconSize('badge');

  // Mode « identité » (Direction A) : sur tout écran-MENU (hub multi-écrans OU
  // écran autonome), le bloc titre est remplacé par la signature pastille +
  // pilule(s). Les pages de détail (/properties/123…) gardent le titre classique.
  const screenIdentity = useMemo(() => {
    const access: HubAccess = {
      permissions: user?.permissions ?? [],
      isAdmin: isAdmin(),
      isManager: isManager(),
    };
    return getScreenIdentity(location.pathname, access);
  }, [location.pathname, user?.permissions, isAdmin, isManager]);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (!backPath) {
      return;
    }
    // Retour contextuel : si on vient d'une autre page de l'app, on revient sur
    // l'entree d'historique precedente (qui porte deja l'onglet actif via ?tab=N
    // et la position de scroll) plutot que sur un chemin parent fige qui reset
    // l'onglet. React Router stocke l'index de l'entree courante dans
    // window.history.state.idx : > 0 => il existe une entree precedente DANS
    // l'app, donc navigate(-1) est sur. Sinon (acces direct, refresh, nouvel
    // onglet) on retombe sur le chemin parent.
    const historyIdx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (historyIdx > 0) {
      navigate(-1);
    } else {
      navigate(backPath);
    }
  };

  // Rendu partage du bouton « Retour » (utilise par showBackButton et
  // showBackButtonWithActions — meme comportement exact qu'avant factorisation).
  // Retour = icon-only à toute taille (libellé en tooltip), cohérent avec la
  // règle « actions du header en icônes seules ».
  const backButton = (
    <Tooltip title={backLabel} arrow>
      <Button
        variant="outlined"
        size="small"
        onClick={handleBack}
        aria-label={backLabel}
        sx={{
          height: 32,
          minWidth: 32,
          px: 0.75,
          borderRadius: '9px',
          color: 'var(--body)',
          borderColor: 'var(--line-2)',
          '&:hover': {
            borderColor: 'var(--line-2)',
            bgcolor: 'var(--faint)',
          },
        }}
      >
        <ArrowBackIcon size={badgeIconSize} strokeWidth={1.75} />
      </Button>
    </Tooltip>
  );

  return (
    <Box mb={1.5}>
      <Box display="flex" justifyContent="space-between" alignItems="center" gap={1} flexWrap="wrap">
        {screenIdentity ? (
          /* Mode identité : pastille + pilule(s) tiennent lieu de titre (Direction A).
             Plus de sous-titre/description (choix produit : header dense). */
          <Box sx={{ minWidth: 0, flex: 1, mr: 1 }}>
            <HubScreenSwitcher identity={screenIdentity} />
          </Box>
        ) : (
        /* Titre et sous-titre (avec optionally iconBadge) */
        <Box sx={{ minWidth: 0, flex: 1, mr: 1, display: 'flex', alignItems: 'center', gap: 0.875 }}>
          {iconBadge && (
            <Box
              sx={{
                width: 28, height: 28, borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: iconBadgeColor
                  ? `color-mix(in srgb, ${iconBadgeColor} 12%, transparent)`
                  : 'var(--accent-soft)',
                color: iconBadgeColor || 'var(--accent)',
                flexShrink: 0,
              }}
            >
              {React.isValidElement(iconBadge)
                ? React.cloneElement(iconBadge as React.ReactElement<{ size?: number; strokeWidth?: number }>, {
                    size: badgeIconSize,
                    strokeWidth: 1.75,
                  })
                : iconBadge}
            </Box>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <Typography
                variant="h5"
                component="h1"
                sx={{
                  fontFamily: 'var(--font-display)',
                  letterSpacing: '-0.01em',
                  color: 'var(--ink)',
                  lineHeight: 1.2,
                  ...(isCompact && {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }),
                }}
              >
                {title}
              </Typography>
              {titleAdornment && (
                <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  {titleAdornment}
                </Box>
              )}
            </Box>
            {subtitle && (
              <Typography
                variant="caption"
                sx={{
                  color: 'var(--muted)',
                  display: 'block',
                  fontSize: '11.5px',
                  lineHeight: 1.3,
                  ...(isCompact && {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }),
                }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
        )}

        {/* Filters + Actions a droite — icon-only à toute taille, repli overflow
            (un seul ⋯ + dropdown) en responsive. Cf. PageHeaderActions. */}
        <Box display="flex" gap={1} alignItems="center" sx={{ flexShrink: 0 }}>
          <PageHeaderActions filters={filters} actions={actions} narrow={isCompact} />

          {(showBackButton || showBackButtonWithActions) && backButton}
        </Box>
      </Box>
    </Box>
  );
}
