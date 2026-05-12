import React from 'react';
import { Box, Typography, Button, Tooltip, useTheme, useMediaQuery } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '../icons';
import { useNavigate } from 'react-router-dom';
import { useIconSize } from '../hooks/useResponsiveSize';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /**
   * Icone optionnelle affichee dans un badge carre arrondi a gauche du titre.
   * Conserve les memes proportions que les autres badges (32x32, primary bg).
   */
  iconBadge?: React.ReactNode;
  /** Couleur du badge icone. Default : primary. */
  iconBadgeColor?: string;
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
  backPath,
  backLabel = 'Retour',
  onBack,
  actions,
  filters,
  showBackButton = true,
  showBackButtonWithActions = false,
}: PageHeaderProps) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));
  const badgeIconSize = useIconSize('badge');

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backPath) {
      navigate(backPath);
    }
  };

  return (
    <Box mb={1}>
      <Box display="flex" justifyContent="space-between" alignItems="center" gap={1.5} flexWrap="wrap">
        {/* Titre et sous-titre (avec optionally iconBadge) */}
        <Box sx={{ minWidth: 0, flex: 1, mr: 1, display: 'flex', alignItems: 'center', gap: 1.25 }}>
          {iconBadge && (
            <Box
              sx={{
                width: 32, height: 32, borderRadius: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: iconBadgeColor || 'primary.main',
                color: 'primary.contrastText',
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
            <Typography
              variant="h5"
              component="h1"
              sx={{
                letterSpacing: '-0.01em',
                color: 'text.primary',
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
            {subtitle && (
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  display: 'block',
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

        {/* Filters + Actions a droite */}
        <Box
          display="flex"
          gap={1}
          alignItems="center"
          sx={{
            flexShrink: 0,
            // En mode compact, les boutons avec icone deviennent icon-only + tooltip.
            ...(isCompact && {
              '& .MuiButton-root:has(.MuiButton-startIcon), & .MuiButton-root:has(.MuiButton-endIcon)': {
                fontSize: 0,
                minWidth: 36,
                '& .MuiButton-startIcon': { margin: 0 },
                '& .MuiButton-endIcon':   { margin: 0 },
              },
            }),
          }}
        >
          {filters}
          {actions}

          {showBackButton && (
            <Tooltip title={isCompact ? backLabel : ''} arrow>
              <Button
                variant="outlined"
                size="small"
                startIcon={isCompact ? undefined : <ArrowBackIcon size={badgeIconSize} strokeWidth={1.75} />}
                onClick={handleBack}
                title={backLabel}
                sx={{
                  ...(isCompact && { minWidth: 36, px: 1 }),
                }}
              >
                {isCompact ? <ArrowBackIcon size={badgeIconSize} strokeWidth={1.75} /> : backLabel}
              </Button>
            </Tooltip>
          )}

          {showBackButtonWithActions && (
            <Tooltip title={isCompact ? backLabel : ''} arrow>
              <Button
                variant="outlined"
                size="small"
                startIcon={isCompact ? undefined : <ArrowBackIcon size={badgeIconSize} strokeWidth={1.75} />}
                onClick={handleBack}
                title={backLabel}
                sx={{
                  ...(isCompact && { minWidth: 36, px: 1 }),
                }}
              >
                {isCompact ? <ArrowBackIcon size={badgeIconSize} strokeWidth={1.75} /> : backLabel}
              </Button>
            </Tooltip>
          )}
        </Box>
      </Box>
    </Box>
  );
}
