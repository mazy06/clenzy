import React, { useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  useTheme,
  alpha,
} from '@mui/material';
import { Warning as AlertIcon } from '../../../icons';
import type { PendingToolConfirmation } from '../../../hooks/useAgent';

interface ToolConfirmationDialogProps {
  pending: PendingToolConfirmation | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Dialog modal qui s'affiche quand l'assistant veut executer un tool d'ecriture.
 *
 * <p>Recap les arguments JSON proposes par le LLM en table cle/valeur pour que
 * l'utilisateur valide explicitement avant execution. Pas de "auto-confirm" :
 * c'est l'engagement Impeccable que les operations d'ecriture passent par
 * confirmation utilisateur, garantie cote backend ET cote UI.</p>
 */
export const ToolConfirmationDialog: React.FC<ToolConfirmationDialogProps> = ({
  pending,
  onConfirm,
  onCancel,
}) => {
  const theme = useTheme();

  const parsedArgs = useMemo(() => {
    if (!pending) return null;
    try {
      return JSON.parse(pending.toolArgs) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [pending]);

  if (!pending) return null;

  return (
    <Dialog
      open
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, pb: 1 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(theme.palette.warning.main, 0.15),
            color: theme.palette.warning.dark,
            flexShrink: 0,
          }}
        >
          <AlertIcon size={18} strokeWidth={2} />
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            Confirmer l&apos;action
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: theme.palette.text.secondary, fontFamily: 'monospace' }}
          >
            {pending.toolName}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 1, pb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {pending.toolDescription}
        </Typography>

        {parsedArgs && Object.keys(parsedArgs).length > 0 && (
          <Box
            sx={{
              // L2 container args — bg tonal subtil sans border
              borderRadius: 2,
              overflow: 'hidden',
              bgcolor: alpha(theme.palette.text.primary, 0.04),
            }}
          >
            {Object.entries(parsedArgs).map(([key, value], index) => (
              <Box
                key={key}
                sx={{
                  // Rangees alternees : alpha legerement different pour separer
                  // les lignes sans utiliser de border.
                  display: 'flex',
                  gap: 1.5,
                  px: 1.5,
                  py: 1,
                  bgcolor:
                    index % 2 === 1
                      ? alpha(theme.palette.text.primary, 0.025)
                      : 'transparent',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    minWidth: 100,
                    fontFamily: 'monospace',
                    color: theme.palette.text.secondary,
                    fontSize: '0.78rem',
                  }}
                >
                  {key}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 500,
                    wordBreak: 'break-word',
                    flex: 1,
                  }}
                >
                  {formatArgValue(value)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {!parsedArgs && (
          <Typography variant="caption" color="text.secondary">
            Pas d&apos;argument structure (le LLM execute sans parametre).
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 0 }}>
        <Button
          variant="text"
          onClick={onCancel}
          sx={{ cursor: 'pointer', color: theme.palette.text.secondary }}
        >
          Refuser
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          sx={{ cursor: 'pointer' }}
        >
          Executer
        </Button>
      </DialogActions>
    </Dialog>
  );
};

function formatArgValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
