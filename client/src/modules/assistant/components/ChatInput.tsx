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
        // L2 input panel : bg subtilement teinte par rapport au L1 Paper pour
        // separer la zone d'input du flux de messages, SANS border-top.
        // Le contraste tonal joue le role du divider.
        bgcolor: alpha(theme.palette.text.primary, 0.025),
        py: 1.5,
      }}
    >
      {/* Conteneur centre, meme contrainte que MessageList (760px) pour
          aligner visuellement input <-> messages. */}
      <Box
        sx={{
          maxWidth: 760,
          mx: 'auto',
          px: { xs: 2, md: 3 },
          display: 'flex',
          alignItems: 'flex-end',
          gap: 1,
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
          // TextField : retire l'outline MUI par defaut, utilise un bg blanc
          // (Paper) pour ressortir sur le panel L2. Focus = anneau primary subtil.
          '& .MuiOutlinedInput-root': {
            borderRadius: 2,
            fontSize: '0.875rem',
            bgcolor: theme.palette.background.paper,
            transition: 'box-shadow 180ms ease-out',
            '& fieldset': { border: 'none' },
            '&:hover fieldset': { border: 'none' },
            '&.Mui-focused fieldset': { border: 'none' },
            '&.Mui-focused': {
              boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.35)}`,
            },
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
    </Box>
  );
};
