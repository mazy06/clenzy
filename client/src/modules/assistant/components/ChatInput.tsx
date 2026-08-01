import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Spinner } from '../../../components/ui';
import { IconButton, InputBase, Tooltip } from '@mui/material';
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
 * Boîte de composition de l'assistant — pattern « Signature » .mg-cbox
 * (réf messagerie unifiée) : conteneur `--field` r13, outils .mg-ctool,
 * bouton envoi 36px r11 accent plein (exception validée).
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

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setValue('');
    }
  }, [handleSubmit]);

  const canSubmit = (value.trim().length > 0 || attachments.length > 0) && !isBusy && !isUploading;

  return (
    <div className="bg-[var(--card)] py-3.5" style={{ borderTop: '1px solid var(--line)' }}>
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
      <div className="max-w-[760px] mx-auto px-3 min-[900px]:px-[18px] flex flex-col gap-1.5">
      {/* Thumbnails preview au-dessus du textarea — uniquement si attachments */}
      {attachments.length > 0 && (
        <div className="flex gap-1 flex-wrap items-center">
          {attachments.map((att, idx) => (
            <div className="relative w-[64px] h-[64px] rounded-[10px] overflow-hidden border border-[var(--line)] bg-[var(--field)]" key={att.storageKey}>
              <img className="w-full h-full object-cover block" src={att.url} alt={att.name ?? 'image jointe'} />
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
                  // Scrim teinte encre (sur image) — pas de noir pur.
                  bgcolor: 'rgba(21,36,45,.55)',
                  color: '#FDFDFC',
                  '&:hover': { bgcolor: 'rgba(21,36,45,.75)' },
                  cursor: 'pointer',
                }}
              >
                <XIcon size={12} />
              </IconButton>
            </div>
          ))}
          {isUploading && (
            <Spinner className="size-5 ms-0.5 text-[var(--accent)]" />
          )}
        </div>
      )}

      {/* Boîte .mg-cbox : champ + outils + envoi */}
      <div
        className="flex items-end gap-[7.5px] bg-[var(--field)] border border-solid border-[var(--field-line)] rounded-[13px] pt-2 pr-2 pb-2 pl-[14px] focus-within:border-[var(--accent)]"
        style={{ transition: 'border-color .14s' }}
      >
        <InputBase
          inputRef={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          multiline
          maxRows={6}
          fullWidth
          autoFocus={autoFocus}
          disabled={status === 'sending'}
          // Réf .mg-cbox textarea : la boîte porte le padding, champ nu.
          sx={{
            flex: 1,
            fontSize: '12.5px',
            color: 'var(--body)',
            lineHeight: 1.5,
            py: '7px',
            '& textarea': { p: 0 },
            '& textarea::placeholder': { color: 'var(--faint)', opacity: 1 },
          }}
        />

        {!isBusy && (
          <Tooltip title={attachments.length >= MAX_ATTACHMENTS
            ? `Maximum ${MAX_ATTACHMENTS} images`
            : 'Joindre une image'}>
            <span>
              {/* Outil .mg-ctool : 30px r8, transparent, hover card+accent */}
              <IconButton
                onClick={handleAttachClick}
                disabled={!canAddAttachments || isUploading}
                aria-label="Joindre une image"
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: '8px',
                  color: 'var(--muted)',
                  bgcolor: 'transparent',
                  transition: 'background .14s, color .14s',
                  '&:hover': { bgcolor: 'var(--card)', color: 'var(--accent)' },
                  cursor: canAddAttachments ? 'pointer' : 'not-allowed',
                  '&.Mui-disabled': { opacity: 0.45 },
                }}
              >
                {isUploading
                  ? <Spinner className="size-[15px] text-[var(--accent)]" />
                  : <AttachFile size={15} strokeWidth={1.75} />}
              </IconButton>
            </span>
          </Tooltip>
        )}

        {isBusy && onAbort ? (
          <IconButton
            onClick={onAbort}
            aria-label="Annuler"
            sx={{
              width: 36,
              height: 36,
              borderRadius: '11px',
              bgcolor: 'var(--err-soft)',
              color: 'var(--err)',
              flexShrink: 0,
              transition: 'background .14s, transform .12s',
              '&:hover': { bgcolor: 'var(--err-soft)', filter: 'brightness(.96)' },
              '&:active': { transform: 'scale(.97)' },
              cursor: 'pointer',
            }}
          >
            {status === 'sending'
              ? <Spinner className="size-[15px] text-[var(--err)]" />
              : <XIcon size={15} strokeWidth={1.75} />}
          </IconButton>
        ) : (
          // Envoi .mg-send : 36px r11 accent PLEIN (exception validée messagerie)
          <IconButton
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-label="Envoyer"
            sx={{
              width: 36,
              height: 36,
              borderRadius: '11px',
              bgcolor: 'var(--accent)',
              color: 'var(--on-accent)',
              flexShrink: 0,
              transition: 'background .14s, transform .12s',
              '&:hover': { bgcolor: 'var(--accent-deep)' },
              '&:active': { transform: 'scale(.97)' },
              '&.Mui-disabled': { bgcolor: 'var(--accent)', color: 'var(--on-accent)', opacity: 0.45 },
              cursor: 'pointer',
            }}
          >
            <SendIcon size={15} strokeWidth={1.75} />
          </IconButton>
        )}
      </div>
      </div>
    </div>
  );
};
