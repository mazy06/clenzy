import React, { useState } from 'react';
import { Spinner } from '../../../components/ui';
import { Box, Typography, Dialog, DialogContent } from '@mui/material';
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
    return (
      <>
        <div className="flex justify-end mb-3">
          <Box
            sx={{
              maxWidth: '74%',
              p: '11px 14px',
              borderRadius: '15px',
              borderBottomRightRadius: '5px',
              bgcolor: 'var(--accent)',
              color: 'var(--on-accent)',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            {/* Attachments thumbnails 100x100 — au-dessus du texte */}
            {attachments.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {attachments.map((att) => (
                  <Box
                    key={att.storageKey}
                    component="button"
                    onClick={() => {
                      setFullSizeUrl(att.url);
                      setFullSizeAlt(att.name ?? 'image jointe');
                    }}
                    aria-label={`Voir ${att.name ?? 'l\'image'} en grand`}
                    sx={{
                      width: 100,
                      height: 100,
                      borderRadius: '10px',
                      overflow: 'hidden',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      bgcolor: 'rgba(255,255,255,.18)',
                      transition: 'opacity .15s',
                      '&:hover': { opacity: 0.85 },
                      '&:focus-visible': {
                        outline: '2px solid var(--on-accent)',
                        outlineOffset: 2,
                      },
                      '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                    }}
                  >
                    <img className="w-full h-full object-cover block" src={att.url} alt={att.name ?? 'image jointe'} />
                  </Box>
                ))}
              </div>
            )}

            {message.content && (
              <Typography
                dir={arabicDirProp(message.content)}
                sx={{
                  fontSize: 13,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.5,
                  // Si le message user est en arabe : agrandit + line-height
                  // adapte + font-family arabe-friendly. Sinon styles latins.
                  ...(isArabicHeavy(message.content) ? {
                    ...arabicTextSx,
                    textAlign: 'right',
                  } : {}),
                }}
              >
                {message.content}
              </Typography>
            )}
          </Box>
        </div>

        {/* Modal full-size — declenche par clic sur un thumbnail */}
        <Dialog
          open={fullSizeUrl !== null}
          onClose={() => setFullSizeUrl(null)}
          maxWidth="lg"
          aria-labelledby="attachment-fullsize-title"
        >
          <DialogContent sx={{ p: 1.5 }}>
            <span className="cn-text-caption block mb-1.5 text-[var(--muted)]" id="attachment-fullsize-title">
              {fullSizeAlt}
            </span>
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
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        alignItems: 'flex-start',
        mb: 2.5,
        // Streaming visual : opacity subtile uniquement avant tout contenu
        opacity: isStreaming && !message.content && !message.toolCalls?.length ? 0.85 : 1,
        transition: 'opacity .2s',
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
        },
      }}
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
          <Box
            sx={{
              display: 'inline-block',
              maxWidth: '100%',
              p: '11px 14px',
              borderRadius: '15px',
              borderBottomLeftRadius: '5px',
              bgcolor: 'var(--card)',
              border: '1px solid var(--line)',
              color: 'var(--body)',
            }}
          >
            <AssistantMarkdown text={message.content} />
          </Box>
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
    </Box>
  );
};
