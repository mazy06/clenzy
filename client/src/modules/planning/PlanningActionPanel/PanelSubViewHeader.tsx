import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { ArrowBack } from '../../../icons';

interface PanelSubViewHeaderProps {
  title: string;
  onBack: () => void;
}

const PanelSubViewHeader: React.FC<PanelSubViewHeaderProps> = ({ title, onBack }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      minHeight: 40,
      px: 1,
      borderBottom: '1px solid',
      borderColor: 'divider',
    }}
  >
    <IconButton size="small" onClick={onBack} sx={{ p: 0.5 }}>
      <ArrowBack size={18} strokeWidth={1.75} />
    </IconButton>
    <Typography
      variant="subtitle2"
      sx={{
        fontWeight: 700,
        fontSize: '0.75rem',
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {title}
    </Typography>
  </Box>
);

export default PanelSubViewHeader;
