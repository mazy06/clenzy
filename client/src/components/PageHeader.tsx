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
    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}> {/* mb: 3 → 2 */}
      {/* Titre et sous-titre à gauche */}
      <Box>
        <Typography variant="h5" component="h1" sx={{ mb: 0.5, fontSize: '1.125rem', fontWeight: 600 }}> {/* h4 → h5, mb réduit */}
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}> {/* body1 → body2 */}
            {subtitle}
          </Typography>
        )}
      </Box>
      
      {/* Actions à droite */}
      <Box display="flex" gap={1.5} alignItems="center"> {/* gap: 2 → 1.5 */}
        {/* Actions personnalisées (boutons, etc.) */}
        {actions}
        
        {/* Bouton retour (optionnel) */}
        {showBackButton && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<ArrowBackIcon sx={{ fontSize: '18px' }} />}
            onClick={() => navigate(backPath)}
            sx={{ 
              borderWidth: 1.5,
              fontSize: '0.8125rem',
              py: 0.5
            }}
          >
            {backLabel}
          </Button>
        )}
        
        {/* Bouton retour avec actions (nouveau mode) */}
        {showBackButtonWithActions && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<ArrowBackIcon sx={{ fontSize: '18px' }} />}
            onClick={() => navigate(backPath)}
            sx={{ 
              borderWidth: 1.5,
              fontSize: '0.8125rem',
              py: 0.5
            }}
          >
            {backLabel}
          </Button>
        )}
      </Box>
    </Box>
  );
}
