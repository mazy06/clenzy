import React from 'react';
import { Box, Typography, Button } from '@mui/material';
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

  return (
    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
      {/* Titre et sous-titre à gauche */}
      <Box>
        <Typography variant="h4" component="h1" gutterBottom>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body1" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
      
      {/* Actions à droite */}
      <Box display="flex" gap={2} alignItems="center">
        {/* Actions personnalisées (boutons, etc.) */}
        {actions}
        
        {/* Bouton retour (optionnel) */}
        {showBackButton && (
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(backPath)}
            sx={{ borderWidth: 2 }}
          >
            {backLabel}
          </Button>
        )}
        
        {/* Bouton retour avec actions (nouveau mode) */}
        {showBackButtonWithActions && (
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(backPath)}
            sx={{ borderWidth: 2 }}
          >
            {backLabel}
          </Button>
        )}
      </Box>
    </Box>
  );
}
