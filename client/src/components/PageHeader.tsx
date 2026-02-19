import React from 'react';
import { Box, Typography, Button, Tooltip, useTheme, useMediaQuery } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backPath: string;
  backLabel?: string;
  actions?: React.ReactNode;
  showBackButton?: boolean;
  showBackButtonWithActions?: boolean; // Nouvelle prop pour afficher retour + actions
}

export default function PageHeader({
  title,
  subtitle,
  backPath,
  backLabel = 'Retour',
  actions,
  showBackButton = true,
  showBackButtonWithActions = false
}: PageHeaderProps) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
      {/* Titre et sous-titre à gauche */}
      <Box sx={{ minWidth: 0, flex: 1, mr: 1 }}>
        <Typography
          variant="h5"
          component="h1"
          sx={{
            mb: 0.25,
            fontSize: '1rem',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: 'text.primary',
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
            variant="body2"
            sx={{
              fontSize: '0.75rem',
              color: 'text.secondary',
              fontWeight: 400,
              letterSpacing: '0.01em',
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
      
      {/* Actions à droite */}
      <Box
        display="flex"
        gap={1}
        alignItems="center"
        sx={{
          flexShrink: 0,
          // Force compact styling on ALL MuiButton children (including nested)
          '& .MuiButton-root': {
            fontSize: '0.8125rem',
            py: 0.5,
            px: 1.5,
            minHeight: 32,
            textTransform: 'none',
            borderWidth: 1.5,
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
          },
          '& .MuiButton-outlined': {
            borderWidth: 1.5,
            '&:hover': { borderWidth: 1.5 },
          },
          // Mode compact : masquer le texte des boutons avec icone, garder les icones
          ...(isCompact && {
            '& .MuiButton-root': {
              py: 0.5,
              px: 1,
              minHeight: 32,
              textTransform: 'none',
              borderWidth: 1.5,
              lineHeight: 1.4,
              whiteSpace: 'nowrap',
              fontSize: '0.75rem',
            },
            // Boutons AVEC icone : masquer le texte, garder uniquement l'icone
            '& .MuiButton-root:has(.MuiButton-startIcon), & .MuiButton-root:has(.MuiButton-endIcon)': {
              fontSize: 0,
              minWidth: 36,
              '& .MuiButton-startIcon': {
                margin: 0,
                fontSize: '1.125rem',
                '& > *': { fontSize: '1.125rem !important' },
              },
              '& .MuiButton-endIcon': {
                margin: 0,
                fontSize: '1.125rem',
                '& > *': { fontSize: '1.125rem !important' },
              },
              '& .MuiCircularProgress-root': {
                width: '16px !important',
                height: '16px !important',
              },
            },
            '& .MuiButton-outlined': {
              borderWidth: 1.5,
              '&:hover': { borderWidth: 1.5 },
            },
          }),
        }}
      >
        {/* Actions personnalisées (boutons, etc.) */}
        {actions}
        
        {/* Bouton retour (optionnel) */}
        {showBackButton && (
          <Tooltip title={isCompact ? backLabel : ''} arrow>
            <Button
              variant="outlined"
              size="small"
              startIcon={isCompact ? undefined : <ArrowBackIcon sx={{ fontSize: '18px' }} />}
              onClick={() => navigate(backPath)}
              title={backLabel}
              sx={{
                borderWidth: 1.5,
                fontSize: '0.8125rem',
                py: 0.5,
                ...(isCompact && { minWidth: 36, px: 1 }),
              }}
            >
              {isCompact ? <ArrowBackIcon sx={{ fontSize: '18px' }} /> : backLabel}
            </Button>
          </Tooltip>
        )}

        {/* Bouton retour avec actions (nouveau mode) */}
        {showBackButtonWithActions && (
          <Tooltip title={isCompact ? backLabel : ''} arrow>
            <Button
              variant="outlined"
              size="small"
              startIcon={isCompact ? undefined : <ArrowBackIcon sx={{ fontSize: '18px' }} />}
              onClick={() => navigate(backPath)}
              title={backLabel}
              sx={{
                borderWidth: 1.5,
                fontSize: '0.8125rem',
                py: 0.5,
                ...(isCompact && { minWidth: 36, px: 1 }),
              }}
            >
              {isCompact ? <ArrowBackIcon sx={{ fontSize: '18px' }} /> : backLabel}
            </Button>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}
