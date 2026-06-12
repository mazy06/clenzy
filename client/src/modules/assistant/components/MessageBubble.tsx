import React, { useState } from 'react';
import { Box, Typography, CircularProgress, Dialog, DialogContent } from '@mui/material';
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
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
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
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                {attachments.map((att, idx) => (
                  <Box
                    key={`${att.storageKey}-${idx}`}
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
                  </Box>
                ))}
              </Box>
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
        </Box>

        {/* Modal full-size — declenche par clic sur un thumbnail */}
        <Dialog
          open={fullSizeUrl !== null}
          onClose={() => setFullSizeUrl(null)}
          maxWidth="lg"
          aria-labelledby="attachment-fullsize-title"
        >
          <DialogContent sx={{ p: 1.5 }}>
            <Typography
              id="attachment-fullsize-title"
              variant="caption"
              sx={{ display: 'block', mb: 1, color: 'var(--muted)' }}
            >
              {fullSizeAlt}
            </Typography>
            {fullSizeUrl && (
              <Box
                component="img"
                src={fullSizeUrl}
                alt={fullSizeAlt}
                sx={{
                  maxWidth: '100%',
                  maxHeight: '80vh',
                  display: 'block',
                  mx: 'auto',
                  borderRadius: '10px',
                }}
              />
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
      <Box
        sx={{
          flexShrink: 0,
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mt: 0.5, // align with bubble first line
        }}
      >
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
      </Box>

      {/* Contenu : tool calls + widgets pleine largeur, texte en bulle in */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Tool call cards : chip recap des outils utilises (compact) */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <Box sx={{ mb: 1, display: 'flex', flexWrap: 'wrap' }}>
            {message.toolCalls.map((tc) => (
              <ToolCallCard key={tc.toolCallId} call={tc} />
            ))}
          </Box>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
            <CircularProgress size={12} thickness={5} sx={{ color: 'var(--accent)' }} />
            <Typography sx={{ fontSize: '11.5px', color: 'var(--muted)' }}>
              Reflechit...
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};
