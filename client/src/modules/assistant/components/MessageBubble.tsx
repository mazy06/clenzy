import React, { useState } from 'react';
import { Box, Typography, useTheme, alpha, CircularProgress, Dialog, DialogContent } from '@mui/material';
import ClenzyMarkLogo from '../../../components/ClenzyMarkLogo';
import type { DisplayMessage } from '../../../hooks/useAgent';
import { ToolCallCard } from './ToolCallCard';
import { ToolResultWidget } from '../widgets/ToolResultWidget';
import { AssistantMarkdown } from './AssistantMarkdown';
import { isArabicHeavy, arabicTextSx, arabicDirProp } from '../../../utils/textDirection';

interface MessageBubbleProps {
  message: DisplayMessage;
}

/**
 * Rendu d'un message individuel — style Claude.ai / ChatGPT moderne (document
 * flow vs back-and-forth chat).
 *
 * <p><b>User</b> : aligne droite, dans une carte arrondie avec bg primary teinte.
 * Compact (max 78% largeur). Le user "soumet" — visuel input-like.</p>
 *
 * <p><b>Assistant</b> : aligne gauche, pleine largeur, PAS de bulle. Texte en
 * flow document, precede d'un avatar sparkles. Le LLM "parle" — visuel
 * narrateur / document.</p>
 *
 * <p>Les deux roles ont leur "cote" stable (user toujours droite, assistant
 * toujours gauche) : pas de zigzag, le flow est lineaire et lisible comme un
 * fil de discussion document.</p>
 */
export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const theme = useTheme();
  const isUser = message.role === 'user';
  const isStreaming = message.streaming === true;
  const [fullSizeUrl, setFullSizeUrl] = useState<string | null>(null);
  const [fullSizeAlt, setFullSizeAlt] = useState<string>('');

  // Tool messages (results) are hidden from the chat view — they live in ToolCallCard.
  if (message.role === 'tool') return null;

  // ── USER : carte alignee droite, max-width 78% ──────────────────────────
  if (isUser) {
    const attachments = message.attachments ?? [];
    return (
      <>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2.5 }}>
          <Box
            sx={{
              maxWidth: '78%',
              px: 1.75,
              py: 1.25,
              borderRadius: 2.5,
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              color: theme.palette.text.primary,
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
                      borderRadius: 1.5,
                      overflow: 'hidden',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      bgcolor: alpha(theme.palette.text.primary, 0.06),
                      transition: 'opacity 180ms ease-out',
                      '&:hover': { opacity: 0.85 },
                      '&:focus-visible': {
                        outline: `2px solid ${theme.palette.primary.main}`,
                        outlineOffset: 2,
                      },
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
                variant="body2"
                dir={arabicDirProp(message.content)}
                sx={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.55,
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
          <DialogContent sx={{ p: 1.5, bgcolor: theme.palette.background.default }}>
            <Typography
              id="attachment-fullsize-title"
              variant="caption"
              sx={{ display: 'block', mb: 1, color: theme.palette.text.secondary }}
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
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // ── ASSISTANT : pleine largeur a gauche, avatar + texte en flow document ─
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        alignItems: 'flex-start',
        mb: 3,
        // Streaming visual : opacity subtile uniquement avant tout contenu
        opacity: isStreaming && !message.content && !message.toolCalls?.length ? 0.85 : 1,
        transition: 'opacity 200ms ease-out',
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
        },
      }}
    >
      {/* Avatar sparkles — signature visuelle de l'assistant */}
      <Box
        sx={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: '50%',
          bgcolor: alpha(theme.palette.primary.main, 0.12),
          color: theme.palette.primary.main,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mt: 0.25, // align with first line of text
        }}
      >
        {/* disableAnimation : chaque message a son propre avatar => si on
            laisse le boot + idle scan jouer sur chaque bubble, ca cree un
            visual noise constant (8 nodes scannant en boucle sur 50 messages).
            Le mark reste statique mais brand-color, signature visuelle de
            l'assistant. L'animation joue uniquement dans le header de page. */}
        <ClenzyMarkLogo variant="mark" size={18} disableAnimation />
      </Box>

      {/* Contenu : tool calls + texte en flow document */}
      <Box sx={{ flex: 1, minWidth: 0, pt: 0.25 }}>
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
            Permet au LLM de proposer "[Settings](/settings?tab=ai)" cliquable inline. */}
        {message.content && <AssistantMarkdown text={message.content} />}

        {/* Streaming indicator quand le contenu est encore vide */}
        {isStreaming && !message.content && !message.toolCalls?.length && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
            <CircularProgress size={12} thickness={5} />
            <Typography variant="caption" color="text.secondary">
              Reflechit...
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};
