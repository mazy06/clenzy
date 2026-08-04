import React, { useState } from 'react';
import { Spinner } from '../../../components/ui';
import { Dialog, DialogContent, DialogTitle } from '../../../components/ui';
import { cn } from '../../../utils/cn';
import BaitlyMarkLogo from '../../../components/BaitlyMarkLogo';
import type { DisplayMessage } from '../../../hooks/useAgent';
import { ToolCallCard } from './ToolCallCard';
import { ToolResultWidget } from '../widgets/ToolResultWidget';
import { AssistantMarkdown } from './AssistantMarkdown';
import { isArabicHeavy, arabicTextSx, arabicDirProp } from '../../../utils/textDirection';

interface MessageBubbleProps {
  message: DisplayMessage;
}

/**
 * Rendu d'un message individuel — pattern bulles « Signature » (réf .mg-b,
 * messagerie unifiée).
 *
 * <p><b>User (out)</b> : aligné droite, bulle accent pleine (exception validée
 * messagerie), coin bas-droit 5px, max 74%.</p>
 *
 * <p><b>Assistant (in)</b> : aligné gauche, carte hairline coin bas-gauche 5px,
 * précédé de l'avatar mark. Les widgets riches (KPI, tables…) restent hors
 * bulle, pleine largeur.</p>
 */
export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isStreaming = message.streaming === true;
  const [fullSizeUrl, setFullSizeUrl] = useState<string | null>(null);
  const [fullSizeAlt, setFullSizeAlt] = useState<string>('');

  // Tool messages (results) are hidden from the chat view — they live in ToolCallCard.
  if (message.role === 'tool') return null;

  // ── USER : bulle .mg-b out (accent plein), alignée droite, max 74% ───────
  if (isUser) {
    const attachments = message.attachments ?? [];
    // arabicTextSx (taille +30 %, interligne, pile de polices arabes) reste une
    // constante partagee de utils/textDirection : posee en style inline, elle bat
    // les classes exactement comme le spread la faisait gagner dans le sx.
    const arabicHeavy = isArabicHeavy(message.content);
    return (
      <>
        <div className="flex justify-end mb-3">
          <div className="max-w-[74%] py-[11px] px-[14px] rounded-[15px] rounded-br-[5px] bg-[var(--accent)] text-[var(--on-accent)] flex flex-col gap-1.5">
            {/* Attachments thumbnails 100x100 — au-dessus du texte */}
            {attachments.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {attachments.map((att) => (
                  <button
                    key={att.storageKey}
                    onClick={() => {
                      setFullSizeUrl(att.url);
                      setFullSizeAlt(att.name ?? 'image jointe');
                    }}
                    aria-label={`Voir ${att.name ?? 'l\'image'} en grand`}
                    className="w-[100px] h-[100px] rounded-[10px] overflow-hidden border-none p-0 cursor-pointer bg-[rgba(255,255,255,.18)] transition-opacity duration-150 hover:opacity-[.85] focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-[var(--on-accent)] focus-visible:outline-offset-2 motion-reduce:transition-none"
                  >
                    <img className="w-full h-full object-cover block" src={att.url} alt={att.name ?? 'image jointe'} />
                  </button>
                ))}
              </div>
            )}

            {/* Si le message user est en arabe : agrandit + line-height adapte +
                font-family arabe-friendly. Sinon styles latins. */}
            {message.content && (
              <p
                dir={arabicDirProp(message.content)}
                className={cn(
                  'cn-text-body1 text-[13px] whitespace-pre-wrap [word-break:break-word] leading-[1.5]',
                  arabicHeavy && 'text-right',
                )}
                style={arabicHeavy ? arabicTextSx : undefined}
              >
                {message.content}
              </p>
            )}
          </div>
        </div>

        {/* Modal full-size — declenche par clic sur un thumbnail */}
        <Dialog
          open={fullSizeUrl !== null}
          onOpenChange={(next) => { if (!next) setFullSizeUrl(null); }}
        >
          {/* Le titre porte desormais lui-meme l'etiquetage de la modale : le
              aria-labelledby manuel du Dialog MUI n'a plus lieu d'etre. */}
          <DialogContent aria-describedby={undefined} className="max-w-[1200px] p-[9px]">
            <DialogTitle className="cn-text-caption block mb-1.5 text-[var(--muted)]">
              {fullSizeAlt}
            </DialogTitle>
            {fullSizeUrl && (
              <img className="max-w-full max-h-[80vh] block mx-auto rounded-[10px]" src={fullSizeUrl} alt={fullSizeAlt} />
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // ── ASSISTANT : avatar mark + bulle .mg-b in (carte hairline) ────────────
  return (
    <div
      className={cn(
        'flex gap-[9px] items-start mb-[15px] transition-opacity duration-200 motion-reduce:transition-none',
        // Streaming visual : opacity subtile uniquement avant tout contenu
        isStreaming && !message.content && !message.toolCalls?.length ? 'opacity-[.85]' : 'opacity-100',
      )}
    >
      {/* Avatar Baitly mark — signature visuelle de l'assistant.
          Pas de bg circulaire : le mark a son propre dessin (8 nodes +
          centre + lignes) qui se suffit a lui-meme. Container minimal
          pour aligner la taille avec le premier ligne de texte. */}
      <div className="shrink-0 w-[28px] h-[28px] flex items-center justify-center mt-0.5">
        {/* idleAnimation=false : pas de boot+scan+breathe sur chaque message
            (visual noise constant si 50 messages). active={isStreaming} :
            declenche l'animation hover-equivalent (lignes absorbees + centre
            pulse + nodes orbit) UNIQUEMENT pendant que l'IA est en train de
            generer cette reponse. Effet visuel "le mark s'illumine pendant
            que l'IA travaille, puis se calme une fois la reponse terminee". */}
        <BaitlyMarkLogo
          variant="mark"
          size={18}
          idleAnimation={false}
          active={isStreaming}
        />
      </div>

      {/* Contenu : tool calls + widgets pleine largeur, texte en bulle in */}
      <div className="flex-1 min-w-0">
        {/* Tool call cards : chip recap des outils utilises (compact) */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-1.5 flex flex-wrap">
            {message.toolCalls.map((tc) => (
              <ToolCallCard key={tc.toolCallId} call={tc} />
            ))}
          </div>
        )}

        {/* Rich widgets : KPI tiles, tables, etc. — rendus selon displayHint
            avant le texte de l'assistant (qui sert de commentaire/synthese) */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <>
            {message.toolCalls.map((tc) => (
              <ToolResultWidget key={`widget-${tc.toolCallId}`} call={tc} />
            ))}
          </>
        )}

        {/* Texte de la reponse rendu en MARKDOWN — supporte les liens internes
            [texte](/route) qui deviennent <RouterLink>, listes a puces, gras, etc.
            Permet au LLM de proposer "[Settings](/settings?tab=ai)" cliquable inline.
            Bulle in : carte hairline, coin bas-gauche 5px. */}
        {message.content && (
          <div className="inline-block max-w-full py-[11px] px-[14px] rounded-[15px] rounded-bl-[5px] bg-[var(--card)] border border-solid border-[var(--line)] text-[var(--body)]">
            <AssistantMarkdown text={message.content} />
          </div>
        )}

        {/* Streaming indicator quand le contenu est encore vide */}
        {isStreaming && !message.content && !message.toolCalls?.length && (
          <div className="flex items-center gap-1.5 py-0.5">
            <Spinner className="size-3 text-[var(--accent)]" />
            <p className="cn-text-body1 text-[11.5px] text-[var(--muted)]">
              Reflechit...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
