import React, { useState } from 'react';
import { Box } from '@mui/material';
import { Home as HomeIcon } from '@mui/icons-material';
import { API_CONFIG } from '../config/api';

interface PropertyThumbnailProps {
  /** URL relative ou absolue. Si null/undefined → placeholder par defaut. */
  url?: string | null;
  /** Largeur en pixels (defaut 48). */
  size?: number;
  /** Texte alternatif. */
  alt?: string;
  /** Border-radius en pixels (defaut 8). */
  borderRadius?: number;
}

const DEFAULT_BG = 'linear-gradient(135deg, #E8EEF1 0%, #D0DCE4 100%)';

/**
 * Vignette de propriete : affiche la photo si dispo, sinon un placeholder.
 * Gere les URL relatives (ex: /api/properties/3/photos/12/data) en prefixant le BASE_URL.
 */
export function PropertyThumbnail({
  url,
  size = 48,
  alt = 'Photo de la propriete',
  borderRadius = 8,
}: PropertyThumbnailProps) {
  const [errored, setErrored] = useState(false);

  const resolvedUrl = url
    ? url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')
      ? url
      : `${API_CONFIG.BASE_URL}${url}`
    : null;

  const showPlaceholder = !resolvedUrl || errored;

  return (
    <Box
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: `${borderRadius}px`,
        overflow: 'hidden',
        background: showPlaceholder ? DEFAULT_BG : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {showPlaceholder ? (
        <HomeIcon sx={{ fontSize: size * 0.5, color: '#90A4AE' }} />
      ) : (
        <Box
          component="img"
          src={resolvedUrl as string}
          alt={alt}
          loading="lazy"
          onError={() => setErrored(true)}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      )}
    </Box>
  );
}
