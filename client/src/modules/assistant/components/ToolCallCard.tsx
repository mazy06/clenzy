import React from 'react';
import { Box, Typography, useTheme, alpha, Chip } from '@mui/material';
import { CheckCircle as CheckCircleIcon, ErrorOutline as AlertCircleIcon } from '../../../icons';
import type { ToolCallExecuted } from '../../../hooks/useAgent';

interface ToolCallCardProps {
  call: ToolCallExecuted;
}

/**
 * Carte representant l'execution d'un tool par l'assistant.
 *
 * <p>Affiche un recap discret : icone status + nom du tool. Le contenu complet
 * du resultat n'est PAS affiche ici (le LLM le synthetise dans le texte suivant).</p>
 */
export const ToolCallCard: React.FC<ToolCallCardProps> = ({ call }) => {
  const theme = useTheme();
  const errorColor = theme.palette.error.main;
  const successColor = theme.palette.success.main;

  return (
    <Box
      sx={{
        // L4 tool card : bg success/error teinte. Pas de border, on monte
        // legerement l'alpha (.12 au lieu de .08) pour la presence visuelle.
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1,
        py: 0.5,
        mr: 0.75,
        mb: 0.5,
        borderRadius: 1.25,
        bgcolor: alpha(call.toolError ? errorColor : successColor, 0.14),
      }}
    >
      {call.toolError ? (
        <AlertCircleIcon size={14} color={errorColor} />
      ) : (
        <CheckCircleIcon size={14} color={successColor} />
      )}
      <Typography
        variant="caption"
        sx={{
          fontFamily: 'monospace',
          fontSize: '0.72rem',
          color: theme.palette.text.secondary,
        }}
      >
        {call.toolName}
      </Typography>
      {call.toolError && (
        <Chip
          label="erreur"
          size="small"
          sx={{
            height: 18,
            fontSize: '0.65rem',
            fontWeight: 600,
            letterSpacing: 0.2,
            bgcolor: alpha(errorColor, 0.22),
            color: errorColor,
            border: 'none',
            '& .MuiChip-label': { px: 0.75 },
          }}
        />
      )}
    </Box>
  );
};
