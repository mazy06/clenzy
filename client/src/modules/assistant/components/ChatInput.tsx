import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  Spinner,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../components/ui';
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
              {/* Scrim teinte encre (sur image) — pas de noir pur. */}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Retirer ${att.name ?? 'l\'image'}`}
                onClick={() => handleRemoveAttachment(idx)}
                className="absolute top-[2px] end-[2px] size-[18px] cursor-pointer rounded-full bg-[rgba(21,36,45,.55)] text-[#FDFDFC] hover:bg-[rgba(21,36,45,.75)] hover:text-[#FDFDFC]"
              >
                <XIcon size={12} />
              </Button>
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
        {/* Réf .mg-cbox textarea : la boîte porte le padding, champ nu.
            Le primitif pose `field-sizing: content` : la hauteur suit le contenu,
            bornee a 6 lignes (l'equivalent de l'ancien maxRows). */}
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          autoFocus={autoFocus}
          disabled={status === 'sending'}
          className="flex-1 min-h-[1lh] max-h-[6lh] resize-none border-0 bg-transparent p-0 py-[7px] text-[12.5px] leading-[1.5] text-[var(--body)] shadow-none placeholder:text-[var(--faint)] placeholder:opacity-100 focus-visible:ring-0"
        />

        {!isBusy && (
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Le span porte la ref de Radix et reste survolable quand le
                  bouton est desactive (limite atteinte / upload en cours). */}
              <span className="inline-flex">
                {/* Outil .mg-ctool : 30px r8, transparent, hover card+accent */}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleAttachClick}
                  disabled={!canAddAttachments || isUploading}
                  aria-label="Joindre une image"
                  className="size-[30px] rounded-[8px] p-0 bg-transparent text-[var(--muted)] transition-[background-color,color] duration-[140ms] hover:bg-[var(--card)] hover:text-[var(--accent)] disabled:opacity-45"
                >
                  {isUploading
                    ? <Spinner className="size-[15px] text-[var(--accent)]" />
                    : <AttachFile size={15} strokeWidth={1.75} />}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {attachments.length >= MAX_ATTACHMENTS
                ? `Maximum ${MAX_ATTACHMENTS} images`
                : 'Joindre une image'}
            </TooltipContent>
          </Tooltip>
        )}

        {isBusy && onAbort ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onAbort}
            aria-label="Annuler"
            className="size-9 shrink-0 rounded-[11px] p-0 bg-[var(--err-soft)] text-[var(--err)] transition-[background-color,transform] duration-[140ms] hover:bg-[var(--err-soft)] hover:brightness-[.96] active:scale-[.97] motion-reduce:transition-none"
          >
            {status === 'sending'
              ? <Spinner className="size-[15px] text-[var(--err)]" />
              : <XIcon size={15} strokeWidth={1.75} />}
          </Button>
        ) : (
          // Envoi .mg-send : 36px r11 accent PLEIN (exception validée messagerie)
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-label="Envoyer"
            className="size-9 shrink-0 rounded-[11px] p-0 bg-[var(--accent)] text-[var(--on-accent)] transition-[background-color,transform] duration-[140ms] hover:bg-[var(--accent-deep)] active:scale-[.97] disabled:opacity-45 motion-reduce:transition-none"
          >
            <SendIcon size={15} strokeWidth={1.75} />
          </Button>
        )}
      </div>
      </div>
    </div>
  );
};
