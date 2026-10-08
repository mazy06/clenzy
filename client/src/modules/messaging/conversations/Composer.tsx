import React, { useEffect, useRef } from 'react';
import { NotebookPen, SendHorizontal } from '../../../icons/glyphs';
import { Spinner } from '../../../components/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { cn } from '../../../utils/cn';

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  placeholder: string;
  disabled?: boolean;
  /** Bandeau au-dessus de la boîte (fenêtre WhatsApp dépassée…). */
  notice?: React.ReactNode;
  /** Chips de fichiers joints, dans la boîte. */
  extra?: React.ReactNode;
  /** Outils à gauche de la barre du bas : trombone, template, suggestion IA. */
  tools?: React.ReactNode;
  /** Fournis uniquement quand le serveur sait consigner une note sans la transmettre. */
  internalNote?: boolean;
  onInternalNoteChange?: (value: boolean) => void;
}

/** Hauteur maximale de la zone de saisie avant qu'elle ne défile (en lignes). */
const MAX_LINES = 8;

/**
 * Boîte de composition.
 *
 * <p>« Répondre » et « Note interne » sont deux ONGLETS de la même boîte, pas
 * un interrupteur perdu au-dessus : le mode est le premier choix qu'on fait en
 * écrivant, et il doit se lire sans avoir à le chercher. La note teinte toute la
 * boîte d'ambre — c'est le seul rappel que le message ne partira PAS vers le
 * voyageur.</p>
 *
 * <p>La saisie grandit avec le texte (jusqu'à {MAX_LINES} lignes) ; Entrée envoie,
 * Maj + Entrée saute une ligne.</p>
 */
export default function Composer({
  value,
  onChange,
  onSend,
  sending,
  placeholder,
  disabled = false,
  notice,
  extra,
  tools,
  internalNote = false,
  onInternalNoteChange,
}: ComposerProps) {
  const { t } = useTranslation();
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0 && !sending && !disabled;

  // Auto-ajustement de la hauteur : on repart de `auto` pour que la boîte puisse
  // aussi RÉTRÉCIR quand on efface.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    el.style.height = `${Math.min(el.scrollHeight, lineHeight * MAX_LINES)}px`;
  }, [value]);

  const send = () => {
    if (canSend) onSend();
  };

  return (
    <div className="shrink-0">
      {notice}
      <div
        className={cn(
          'rounded-2xl border bg-card shadow-xs transition-colors duration-150 focus-within:border-ring/60 focus-within:ring-[3px] focus-within:ring-ring/20 motion-reduce:transition-none',
          internalNote ? 'border-dashed border-warning/60 bg-warning-soft' : 'border-border',
        )}
      >
        {onInternalNoteChange && (
          <div role="tablist" aria-label={t('messagingHub.composerMode', 'Type de message')} className="flex items-center gap-1 px-2 pt-2">
            {([false, true] as const).map((isNote) => {
              const selected = internalNote === isNote;
              return (
                <button
                  key={String(isNote)}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => onInternalNoteChange(isNote)}
                  className={cn(
                    'inline-flex cursor-pointer items-center gap-1 rounded-full border-0 px-2.5 py-1 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none',
                    selected
                      ? isNote
                        ? 'bg-warning/20 text-warning-ink'
                        : 'bg-primary-soft text-foreground'
                      : 'bg-transparent text-muted-foreground hover:bg-muted',
                  )}
                >
                  {isNote && <NotebookPen className="size-3.5" aria-hidden />}
                  {isNote ? t('messagingHub.tabNote', 'Note interne') : t('messagingHub.tabReply', 'Répondre')}
                </button>
              );
            })}
            {internalNote && (
              <span className="ms-auto pe-1 text-2xs text-warning-ink">
                {t('messagingHub.noteHint', 'Visible par l’équipe uniquement')}
              </span>
            )}
          </div>
        )}

        <textarea
          ref={areaRef}
          rows={2}
          dir="auto"
          value={value}
          disabled={disabled}
          placeholder={
            internalNote ? t('messagingHub.internalNotePlaceholder', 'Note pour l’équipe…') : placeholder
          }
          aria-label={internalNote ? t('messagingHub.tabNote', 'Note interne') : placeholder}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            // `isComposing` : valider une saisie IME (arabe, japonais…) ne doit pas envoyer.
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send();
            }
          }}
          className="block w-full resize-none border-0 bg-transparent px-3.5 py-2.5 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
        />

        {extra && <div className="px-3 pb-1">{extra}</div>}

        <div className="flex items-center gap-0.5 px-2 pb-2">
          {tools}
          <span className="ms-auto hidden pe-2 text-2xs text-faint min-[1100px]:inline">
            {t('messagingHub.composerHint', 'Entrée pour envoyer · Maj + Entrée pour un saut de ligne')}
          </span>
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            aria-label={internalNote ? t('messagingHub.saveNote', 'Enregistrer la note') : t('messagingHub.send', 'Envoyer')}
            className={cn(
              'ms-auto inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 transition-colors duration-150 motion-reduce:transition-none min-[1100px]:ms-0',
              canSend
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'cursor-default bg-muted text-faint',
            )}
          >
            {sending ? <Spinner className="size-4" /> : <SendHorizontal className="size-4 rtl:-scale-x-100" aria-hidden />}
          </button>
        </div>
      </div>
    </div>
  );
}
