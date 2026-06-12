import React, { useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
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
 * <p>Skin porte par le theme global Signature (MuiDialog r18, Title display,
 * Actions surface-2). Recap les arguments JSON proposes par le LLM en table
 * cle/valeur pour que l'utilisateur valide explicitement avant execution.
 * Pas de "auto-confirm" : les operations d'ecriture passent par confirmation
 * utilisateur, garantie cote backend ET cote UI.</p>
 */
export const ToolConfirmationDialog: React.FC<ToolConfirmationDialogProps> = ({
  pending,
  onConfirm,
  onCancel,
}) => {
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
    <Dialog open onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '9px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'var(--warn-soft)',
            color: 'var(--warn)',
            flexShrink: 0,
          }}
        >
          <AlertIcon size={16} strokeWidth={2} />
        </Box>
        <Box>
          <Box component="span" sx={{ display: 'block', lineHeight: 1.2 }}>
            Confirmer l&apos;action
          </Box>
          <Typography
            component="span"
            sx={{ color: 'var(--muted)', fontFamily: 'monospace', fontSize: '11px', fontWeight: 500 }}
          >
            {pending.toolName}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography sx={{ mb: 2, fontSize: 13, lineHeight: 1.55, color: 'var(--muted)' }}>
          {pending.toolDescription}
        </Typography>

        {parsedArgs && Object.keys(parsedArgs).length > 0 && (
          <Box
            sx={{
              // Table cle/valeur : carte hairline, rangees au filet --line.
              borderRadius: '10px',
              overflow: 'hidden',
              border: '1px solid var(--line)',
              bgcolor: 'var(--field)',
            }}
          >
            {Object.entries(parsedArgs).map(([key, value], index) => (
              <Box
                key={key}
                sx={{
                  display: 'flex',
                  gap: 1.5,
                  px: 1.5,
                  py: 1,
                  borderTop: index > 0 ? '1px solid var(--line)' : 'none',
                }}
              >
                <Typography
                  component="span"
                  sx={{
                    minWidth: 100,
                    fontFamily: 'monospace',
                    color: 'var(--muted)',
                    fontSize: '11.5px',
                    lineHeight: 1.6,
                  }}
                >
                  {key}
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    fontSize: '12.5px',
                    fontWeight: 500,
                    color: 'var(--body)',
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
          <Typography sx={{ fontSize: '11.5px', color: 'var(--muted)' }}>
            Pas d&apos;argument structure (le LLM execute sans parametre).
          </Typography>
        )}
      </DialogContent>

      <DialogActions>
        <Button variant="text" onClick={onCancel}>
          Refuser
        </Button>
        <Button variant="contained" onClick={onConfirm}>
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
