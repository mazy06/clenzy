import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, IconButton, TextField, useTheme, alpha, CircularProgress, Tooltip } from '@mui/material';
import {
  Send as SendIcon,
  Close as XIcon,
  AttachFile,
} from '../../../icons';
import type { AgentStatus, DisplayMessage } from '../../../hooks/useAgent';
import { useNotification } from '../../../hooks/useNotification';
import { useImageUpload } from '../../../hooks/useImageUpload';

type Attachment = NonNullable<DisplayMessage['attachments']>[number];

interface ChatInputProps {
  status: AgentStatus;
  /** {@code attachments} contient les images uploadees prealablement (vision). */
  onSend: (text: string, attachments?: Attachment[]) => void;
  onAbort?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

const MAX_ATTACHMENTS = 3;

/**
 * Input multilignes pour saisir un message a l'assistant.
 *
 * Comportements :
 *   - Enter envoie ; Shift+Enter ajoute un saut de ligne.
 *   - Disabled pendant l'envoi/streaming (le bouton mute en "stop").
 *   - Cmd/Ctrl+K vide le champ.
 *   - Upload images (jusqu'a 3) pour vision Claude.
 */
export const ChatInput: React.FC<ChatInputProps> = ({
  status,
  onSend,
  onAbort,
  placeholder = "Demande quelque chose a l'assistant... (Entree pour envoyer)",
  autoFocus = false,
}) => {
  const theme = useTheme();
  const { notify } = useNotification();
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { uploadImage, isUploading, error: uploadError, clearError } = useImageUpload();

  const isBusy = status === 'sending' || status === 'streaming';
  const canAddAttachments = attachments.length < MAX_ATTACHMENTS && !isBusy;

  // Surface les erreurs d'upload via Notification
  useEffect(() => {
    if (uploadError) {
      notify.error(uploadError);
      clearError();
    }
  }, [uploadError, notify, clearError]);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    // Permet d'envoyer un message qui contient SEULEMENT des attachments
    // (ex: l'user veut juste qu'on commente une photo).
    if ((!trimmed && attachments.length === 0) || isBusy || isUploading) return;
    onSend(trimmed, attachments.length > 0 ? attachments : undefined);
    setValue('');
    setAttachments([]);
  }, [value, attachments, isBusy, isUploading, onSend]);

  const handleFilesSelected = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remainingSlots = MAX_ATTACHMENTS - attachments.length;
    if (remainingSlots <= 0) {
      notify.warning(`Maximum ${MAX_ATTACHMENTS} images par message.`);
      return;
    }
    const toProcess = Array.from(files).slice(0, remainingSlots);
    if (files.length > toProcess.length) {
      notify.info(`Seules les ${toProcess.length} premieres images seront envoyees (limite ${MAX_ATTACHMENTS}).`);
    }

    // Upload sequentiel pour avoir un feedback clair en cas d'echec partiel
    for (const file of toProcess) {
      try {
        const ref = await uploadImage(file);
        setAttachments((prev) => [...prev, ref]);
      } catch {
        // useImageUpload a deja setError → useEffect surface via notify
        break;
      }
    }
  }, [attachments.length, notify, uploadImage]);

  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

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
      {/* Input file cache — pilote par le bouton Paperclip */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        hidden
        onChange={(e) => {
          handleFilesSelected(e.target.files);
          // Reset pour permettre de re-selectionner le meme fichier apres remove
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
      />

      {/* Conteneur centre, meme contrainte que MessageList (760px) pour
          aligner visuellement input <-> messages. */}
      <Box
        sx={{
          maxWidth: 760,
          mx: 'auto',
          px: { xs: 2, md: 3 },
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
      {/* Thumbnails preview au-dessus du textarea — uniquement si attachments */}
      {attachments.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            gap: 0.75,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          {attachments.map((att, idx) => (
            <Box
              key={`${att.storageKey}-${idx}`}
              sx={{
                position: 'relative',
                width: 64,
                height: 64,
                borderRadius: 1.5,
                overflow: 'hidden',
                bgcolor: alpha(theme.palette.text.primary, 0.06),
              }}
            >
              <Box
                component="img"
                src={att.url}
                alt={att.name ?? 'image jointe'}
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
              <IconButton
                aria-label={`Retirer ${att.name ?? 'l\'image'}`}
                size="small"
                onClick={() => handleRemoveAttachment(idx)}
                sx={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  width: 18,
                  height: 18,
                  bgcolor: alpha(theme.palette.common.black, 0.55),
                  color: theme.palette.common.white,
                  '&:hover': { bgcolor: alpha(theme.palette.common.black, 0.75) },
                  cursor: 'pointer',
                }}
              >
                <XIcon size={12} />
              </IconButton>
            </Box>
          ))}
          {isUploading && (
            <CircularProgress size={20} sx={{ ml: 0.5 }} />
          )}
        </Box>
      )}

      <Box
        sx={{
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

      {!isBusy && (
        <Tooltip title={attachments.length >= MAX_ATTACHMENTS
          ? `Maximum ${MAX_ATTACHMENTS} images`
          : 'Joindre une image'}>
          <span>
            <IconButton
              onClick={handleAttachClick}
              disabled={!canAddAttachments || isUploading}
              aria-label="Joindre une image"
              sx={{
                bgcolor: alpha(theme.palette.text.primary, 0.06),
                color: theme.palette.text.secondary,
                '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.1) },
                cursor: canAddAttachments ? 'pointer' : 'not-allowed',
                transition: 'background-color 200ms ease-out',
              }}
            >
              {isUploading ? <CircularProgress size={16} /> : <AttachFile size={18} />}
            </IconButton>
          </span>
        </Tooltip>
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
      ) : (() => {
        // Le bouton Send est actif si on a du texte OU des attachments — et qu'on
        // n'est pas en cours d'upload (eviter d'envoyer une liste partielle).
        const canSubmit = (value.trim().length > 0 || attachments.length > 0) && !isBusy && !isUploading;
        return (
          <IconButton
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-label="Envoyer"
            sx={{
              bgcolor: canSubmit
                ? theme.palette.primary.main
                : alpha(theme.palette.primary.main, 0.15),
              color: canSubmit
                ? theme.palette.primary.contrastText
                : theme.palette.text.disabled,
              '&:hover': {
                bgcolor: canSubmit
                  ? theme.palette.primary.dark
                  : alpha(theme.palette.primary.main, 0.15),
              },
              cursor: canSubmit ? 'pointer' : 'default',
              transition: 'background-color 200ms ease-out',
            }}
          >
            <SendIcon size={18} />
          </IconButton>
        );
      })()}
      </Box>
      </Box>
    </Box>
  );
};
