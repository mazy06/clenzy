import React from 'react';
import { Box, Typography, Button } from '@mui/material';

interface PageHeaderProps {
  title: string;
  description: string;
  buttonText?: string;
  buttonIcon?: React.ReactNode;
  onButtonClick?: () => void;
  showButton?: boolean;
  buttonVariant?: 'contained' | 'outlined' | 'text';
  buttonColor?: 'primary' | 'secondary' | 'inherit' | 'error' | 'info' | 'success' | 'warning' | 'clenzy';
}

export default function PageHeader({
  title,
  description,
  buttonText,
  buttonIcon,
  onButtonClick,
  showButton = true,
  buttonVariant = 'contained',
  buttonColor = 'clenzy'
}: PageHeaderProps) {
  return (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      mb: 4 
    }}>
      <Box>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          {title}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {description}
        </Typography>
      </Box>
      
      {showButton && buttonText && onButtonClick && (
        <Button
          variant={buttonVariant}
          color={buttonColor}
          startIcon={buttonIcon}
          onClick={onButtonClick}
          sx={{ 
            borderRadius: 2,
            fontWeight: 600,
            textTransform: 'none',
            fontSize: '0.9rem',
            px: 3,
            py: 1.5,
            minHeight: '40px',
            '&:hover': {
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            },
            transition: 'all 0.2s ease-in-out'
          }}
        >
          {buttonText}
        </Button>
      )}
    </Box>
  );
}
