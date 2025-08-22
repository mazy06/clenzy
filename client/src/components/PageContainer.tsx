import React from 'react';
import { Box, BoxProps } from '@mui/material';
import { createSpacing } from '../theme/spacing';

interface PageContainerProps extends BoxProps {
  children: React.ReactNode;
  variant?: 'page' | 'section' | 'card' | 'form';
}

/**
 * Composant de conteneur de page qui uniformise la disposition
 * Utilise les constantes d'espacement prédéfinies pour assurer la cohérence
 */
const PageContainer: React.FC<PageContainerProps> = ({ 
  children, 
  variant = 'page',
  sx,
  ...props 
}) => {
  const getSpacingStyle = () => {
    switch (variant) {
      case 'page':
        return createSpacing.page();
      case 'section':
        return createSpacing.section();
      case 'card':
        return createSpacing.card();
      case 'form':
        return createSpacing.form();
      default:
        return createSpacing.page();
    }
  };

  return (
    <Box
      sx={{
        ...getSpacingStyle(),
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
};

export default PageContainer;
