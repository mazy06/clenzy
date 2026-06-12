import React from 'react';
import { Box, Typography } from '@mui/material';
import { CheckCircle as CheckCircleIcon, ErrorOutline as AlertCircleIcon } from '../../../icons';
import type { ToolCallExecuted } from '../../../hooks/useAgent';

interface ToolCallCardProps {
  call: ToolCallExecuted;
}

/**
 * Chip representant l'execution d'un tool par l'assistant — pattern statut
 * « Signature » : pilule fond `-soft` + texte/icone couleur semantique.
 *
 * <p>Affiche un recap discret : icone status + nom du tool. Le contenu complet
 * du resultat n'est PAS affiche ici (le LLM le synthetise dans le texte suivant).</p>
 */
export const ToolCallCard: React.FC<ToolCallCardProps> = ({ call }) => {
  const isError = Boolean(call.toolError);

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        height: 22,
        px: '10px',
        mr: 0.75,
        mb: 0.5,
        borderRadius: 999,
        bgcolor: isError ? 'var(--err-soft)' : 'var(--ok-soft)',
        color: isError ? 'var(--err)' : 'var(--ok)',
      }}
    >
      {isError ? (
        <AlertCircleIcon size={12} strokeWidth={1.75} />
      ) : (
        <CheckCircleIcon size={12} strokeWidth={1.75} />
      )}
      <Typography
        component="span"
        sx={{
          fontFamily: 'monospace',
          fontSize: '10.5px',
          fontWeight: 700,
          letterSpacing: '.02em',
          color: 'inherit',
        }}
      >
        {call.toolName}
      </Typography>
      {isError && (
        <Typography
          component="span"
          sx={{
            fontSize: '10.5px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '.05em',
            color: 'var(--err)',
          }}
        >
          erreur
        </Typography>
      )}
    </Box>
  );
};
