import React, { useCallback, useRef, useState } from 'react';
import { Box, IconButton, TextField, useTheme, alpha, CircularProgress } from '@mui/material';
import { Send as SendIcon, Close as XIcon } from '../../../icons';
import type { AgentStatus } from '../../../hooks/useAgent';

interface ChatInputProps {
  status: AgentStatus;
  onSend: (text: string) => void;
  onAbort?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

/**
 * Input multilignes pour saisir un message a l'assistant.
 *
 * Comportements :
 *   - Enter envoie ; Shift+Enter ajoute un saut de ligne.
 *   - Disabled pendant l'envoi/streaming (le bouton mute en "stop").
 *   - Cmd/Ctrl+K vide le champ.
 */
export const ChatInput: React.FC<ChatInputProps> = ({
  status,
  onSend,
  onAbort,
  placeholder = "Demande quelque chose a l'assistant... (Entree pour envoyer)",
  autoFocus = false,
}) => {
  const theme = useTheme();
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const isBusy = status === 'sending' || status === 'streaming';

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isBusy) return;
    onSend(trimmed);
    setValue('');
  }, [value, isBusy, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setValue('');
    }
  }, [handleSubmit]);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 1,
        p: 1.5,
        borderTop: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
        bgcolor: theme.palette.background.paper,
      }}
    >
      <TextField
        inputRef={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        multiline
        maxRows={6}
        fullWidth
        autoFocus={autoFocus}
        size="small"
        disabled={status === 'sending'}
        sx={{
          '& .MuiInputBase-root': {
            borderRadius: 2,
            fontSize: '0.875rem',
          },
        }}
      />

      {isBusy && onAbort ? (
        <IconButton
          onClick={onAbort}
          aria-label="Annuler"
          sx={{
            bgcolor: alpha(theme.palette.error.main, 0.1),
            color: theme.palette.error.main,
            '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.18) },
            cursor: 'pointer',
            transition: 'background-color 200ms ease-out',
          }}
        >
          {status === 'sending' ? <CircularProgress size={16} /> : <XIcon size={18} />}
        </IconButton>
      ) : (
        <IconButton
          onClick={handleSubmit}
          disabled={!value.trim() || isBusy}
          aria-label="Envoyer"
          sx={{
            bgcolor: value.trim() && !isBusy
              ? theme.palette.primary.main
              : alpha(theme.palette.primary.main, 0.15),
            color: value.trim() && !isBusy
              ? theme.palette.primary.contrastText
              : theme.palette.text.disabled,
            '&:hover': {
              bgcolor: value.trim() && !isBusy
                ? theme.palette.primary.dark
                : alpha(theme.palette.primary.main, 0.15),
            },
            cursor: value.trim() && !isBusy ? 'pointer' : 'default',
            transition: 'background-color 200ms ease-out',
          }}
        >
          <SendIcon size={18} />
        </IconButton>
      )}
    </Box>
  );
};
