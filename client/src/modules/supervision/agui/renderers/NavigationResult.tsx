/* ============================================================
   NavigationResult — displayHint="navigation"

   Payload backend (suggest_navigation) : { path, label, reason }
   → carte cliquable qui route vers la page suggérée (react-router).
   ============================================================ */
import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { ArrowForward } from '../../../../icons';
import { SurfaceCard, Overline } from './shared';

interface NavigationData {
  path?: string;
  label?: string;
  reason?: string;
}

export const NavigationResult: React.FC<{
  data: NavigationData;
  onNavigate?: (path: string) => void;
}> = ({ data, onNavigate }) => (
  <SurfaceCard>
    <Overline sx={{ mb: 0.5 }}>Navigation suggérée</Overline>
    <Typography sx={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--ink)' }}>
      {data.label ?? 'Page suggérée'}
    </Typography>
    {data.reason && (
      <Typography sx={{ fontSize: '12px', color: 'var(--muted)', mt: 0.25, lineHeight: 1.5 }}>
        {data.reason}
      </Typography>
    )}
    {data.path && onNavigate && (
      <Box sx={{ mt: 1.25 }}>
        <Button
          size="small"
          variant="outlined"
          endIcon={<ArrowForward size={15} strokeWidth={1.85} />}
          onClick={() => onNavigate(data.path as string)}
          sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 600 }}
        >
          {data.label ? `Ouvrir ${data.label}` : 'Y aller'}
        </Button>
      </Box>
    )}
  </SurfaceCard>
);
