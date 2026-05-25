import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, IconButton, TextField, useTheme, alpha, CircularProgress, keyframes } from '@mui/material';
import { Send as SendIcon, Close as XIcon, Mic as MicIcon, MicOff as MicOffIcon } from '../../../icons';
import type { AgentStatus } from '../../../hooks/useAgent';
import { useVoiceInput } from '../../../hooks/useVoiceInput';
import { useTranslation } from '../../../hooks/useTranslation';
import { useNotification } from '../../../hooks/useNotification';

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
 *   - Dictee vocale (Web Speech API) si supportee par le browser.
 */

// Pulse rouge subtle pendant l'ecoute (desactive si prefers-reduced-motion).
// On anime opacity + box-shadow (cheap GPU) — pas de scale-transform pour
// eviter les layout shifts.
const micPulse = keyframes`
  0%   { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.55); }
  70%  { box-shadow: 0 0 0 8px rgba(220, 38, 38, 0); }
  100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
`;

// Map i18n.language (fr/en/ar) vers les codes BCP-47 attendus par
// SpeechRecognition. Defaut fr-FR si langue inconnue.
function toSpeechLang(i18nLang: string): string {
  const base = (i18nLang || 'fr').toLowerCase().slice(0, 2);
  switch (base) {
    case 'fr': return 'fr-FR';
    case 'en': return 'en-US';
    case 'ar': return 'ar-MA';
    default:   return 'fr-FR';
  }
}

export const ChatInput: React.FC<ChatInputProps> = ({
  status,
  onSend,
  onAbort,
  placeholder = "Demande quelque chose a l'assistant... (Entree pour envoyer)",
  autoFocus = false,
}) => {
  const theme = useTheme();
  const { notify } = useNotification();
  const { currentLanguage } = useTranslation();
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  // Base du champ au moment ou la dictee commence : on appendra le transcript
  // a cette base pour ne pas ecraser un texte deja saisi a la main.
  const dictationBaseRef = useRef<string>('');

  const isBusy = status === 'sending' || status === 'streaming';

  const voice = useVoiceInput({
    language: toSpeechLang(currentLanguage),
    continuous: false,
    interimResults: true,
    onResult: (transcript) => {
      // Append au texte deja present quand la dictee a demarre
      const base = dictationBaseRef.current;
      setValue(base.length > 0 ? `${base.trim()} ${transcript}`.trim() : transcript);
    },
  });

  // Surface les erreurs micro a l'utilisateur (permission, network, ...).
  useEffect(() => {
    if (!voice.error) return;
    if (voice.error.code === 'aborted' || voice.error.code === 'no-speech') {
      // Ces erreurs sont attendues (user a stoppe ou silence prolonge) — pas de toast
      return;
    }
    const message = voice.error.code === 'not-allowed' || voice.error.code === 'service-not-allowed'
      ? "Acces au micro refuse. Autorise le micro dans les parametres du navigateur pour utiliser la dictee."
      : voice.error.code === 'audio-capture'
        ? "Aucun micro detecte. Branche un micro et reessaie."
        : voice.error.code === 'network'
          ? "Probleme reseau pendant la reconnaissance vocale. Reessaie."
          : "La dictee vocale a echoue. Reessaie.";
    notify.error(message);
  }, [voice.error, notify]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isBusy) return;
    if (voice.isListening) voice.stop();
    onSend(trimmed);
    setValue('');
  }, [value, isBusy, onSend, voice]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setValue('');
    }
  }, [handleSubmit]);

  const handleMicClick = useCallback(() => {
    if (voice.isListening) {
      voice.stop();
      return;
    }
    // Memorise le texte courant pour ne pas l'ecraser avec le transcript
    dictationBaseRef.current = value;
    voice.start();
  }, [voice, value]);

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

      {voice.isSupported && !isBusy && (
        <IconButton
          onClick={handleMicClick}
          aria-label={voice.isListening
            ? 'Arreter la dictee vocale'
            : 'Activer la dictee vocale'}
          aria-pressed={voice.isListening}
          sx={{
            bgcolor: voice.isListening
              ? alpha(theme.palette.error.main, 0.15)
              : alpha(theme.palette.text.primary, 0.06),
            color: voice.isListening
              ? theme.palette.error.main
              : theme.palette.text.secondary,
            '&:hover': {
              bgcolor: voice.isListening
                ? alpha(theme.palette.error.main, 0.22)
                : alpha(theme.palette.text.primary, 0.1),
            },
            cursor: 'pointer',
            transition: 'background-color 200ms ease-out, color 200ms ease-out',
            // Pulse uniquement quand on ecoute ET si l'user n'a pas demande
            // reduce-motion. La rule media est interpretee a runtime par MUI.
            animation: voice.isListening
              ? `${micPulse} 1.6s ease-out infinite`
              : 'none',
            '@media (prefers-reduced-motion: reduce)': {
              animation: 'none',
            },
          }}
        >
          {voice.isListening ? <MicOffIcon size={18} /> : <MicIcon size={18} />}
        </IconButton>
      )}

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

      {/* aria-live polite : annonce le transcript reconnu aux lecteurs d'ecran
          sans interrompre le flux. Visuellement cache mais audible.
          Ne s'active que pendant l'ecoute pour ne pas re-annoncer entre dictees. */}
      {voice.isListening && voice.transcript && (
        <Box
          role="status"
          aria-live="polite"
          sx={{
            position: 'absolute',
            width: 1,
            height: 1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
          }}
        >
          {voice.transcript}
        </Box>
      )}
    </Box>
  );
};
