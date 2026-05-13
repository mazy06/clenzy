import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { Info } from '../icons';

interface AutoSelectionInfoProps {
  fieldName: string;
  isAutoSelected: boolean;
  userRole?: string;
  userEmail?: string;
}

const AutoSelectionInfo: React.FC<AutoSelectionInfoProps> = ({ 
  fieldName, 
  isAutoSelected, 
  userRole, 
  userEmail 
}) => {
  if (!isAutoSelected) return null;

  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 1, 
      mt: 1, 
      p: 1, 
      bgcolor: 'info.50', 
      borderRadius: 1,
      border: '1px solid',
      borderColor: 'info.200'
    }}>
      <Box component="span" sx={{ display: 'inline-flex', color: 'info.main' }}><Info size={14} strokeWidth={1.75} /></Box>
      <Typography variant="caption" color="info.main">
        {fieldName} automatiquement sélectionné : {userEmail} ({userRole})
      </Typography>
      <Chip 
        label="Auto" 
        size="small" 
        color="info" 
        variant="outlined"
        sx={{ height: '20px', fontSize: '0.7rem' }}
      />
    </Box>
  );
};

export default AutoSelectionInfo;
