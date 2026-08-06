import React, { useCallback, useState } from 'react';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
  Spinner,
} from '../../../components/ui';
import { cn } from '../../../utils/cn';
import { Send as SendIcon, Close as XIcon } from '../../../icons';
import { useTranslation } from '../../../hooks/useTranslation';
import type { AgentStatus } from '../../../hooks/useAgent';

interface AssistantComposerProps {
  status: AgentStatus;
  onSend: (text: string) => void;
  onAbort?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Ligne de réassurance sous le champ — rappelle que rien ne part sans validation. */
  hint?: string;
}

/**
 * Boîte de composition — {@code InputGroup} de la bibliothèque Baitly UI, avec
 * la ligne de réassurance et le bouton d'envoi dans le bandeau bas, comme la
 * projection « Assistant Baitly ».
 *
 * <p>Comportements : Entrée envoie, Maj+Entrée insère un saut de ligne,
 * Cmd/Ctrl+K vide le champ ; pendant la génération le bouton d'envoi mute en
 * bouton d'arrêt.</p>
 *
 * <p><b>Texte uniquement.</b> L'envoi de pièces jointes (images analysées par
 * Claude Vision) n'est pas proposé pour l'instant. Le chemin serveur reste en
 * place — {@code useAgent.sendMessage} accepte toujours des pièces jointes et
 * les messages qui en portent continuent de les afficher dans le fil — seule
 * l'entrée est retirée de l'interface.</p>
 */
export const AssistantComposer: React.FC<AssistantComposerProps> = ({
  status,
  onSend,
  onAbort,
  placeholder,
  autoFocus = false,
  hint,
}) => {
  const { t } = useTranslation();
  const [value, setValue] = useState('');

  const isBusy = status === 'sending' || status === 'streaming';
  const canSubmit = value.trim().length > 0 && !isBusy;

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isBusy) return;
    onSend(trimmed);
    setValue('');
  }, [value, isBusy, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setValue('');
    }
  }, [handleSubmit]);

  return (
    <InputGroup>
      <InputGroupTextarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? t('assistant.composer.placeholder')}
        rows={2}
        autoFocus={autoFocus}
        disabled={status === 'sending'}
        className="max-h-[8lh]"
      />

      <InputGroupAddon align="block-end">
        {hint && <span className="text-2xs text-faint">{hint}</span>}

        {/* Pastille RONDE : le gabarit `icon-xs` pose un rayon calcule sur
            --radius, qui donnait un carre a peine adouci. `rounded-full` le
            remplace — l'envoi et l'arret partagent la meme forme pour que la
            bascule entre les deux ne fasse pas sauter le bouton. */}
        {isBusy && onAbort ? (
          <InputGroupButton
            size="icon-xs"
            aria-label={t('assistant.composer.stop')}
            onClick={onAbort}
            className="ms-auto rounded-full bg-destructive-soft text-destructive-ink hover:brightness-95"
          >
            {status === 'sending' ? <Spinner className="size-3.5" /> : <XIcon size={14} strokeWidth={1.75} />}
          </InputGroupButton>
        ) : (
          <InputGroupButton
            size="icon-xs"
            aria-label={t('assistant.composer.send')}
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              'ms-auto rounded-full',
              canSubmit && 'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            {/* Correction OPTIQUE. L'avion de papier de lucide est un triangle
                dont la pointe monte a droite et dont la masse retombe en bas a
                gauche : centre geometriquement, il se lit decale vers le bas et
                la gauche du cercle. Un demi-pixel vers le haut-droite ramene son
                centre de gravite sur celui du bouton. Le decalage horizontal
                s'inverse en RTL, ou toute la boite de composition est miroir. */}
            <SendIcon
              size={14}
              strokeWidth={1.75}
              className="translate-x-[0.5px] -translate-y-[0.5px] rtl:-translate-x-[0.5px]"
            />
          </InputGroupButton>
        )}
      </InputGroupAddon>
    </InputGroup>
  );
};
