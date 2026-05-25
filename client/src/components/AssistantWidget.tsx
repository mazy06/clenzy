import React, { useState, useCallback } from 'react';
import { Box, IconButton, Drawer, Typography, useTheme, alpha, Tooltip } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { AutoAwesome as SparklesIcon, Close as CloseIcon, OpenInNew as OpenInNewIcon } from '../icons';
import { useAgent } from '../hooks/useAgent';
import { MessageList } from '../modules/assistant/components/MessageList';
import { ChatInput } from '../modules/assistant/components/ChatInput';
import { ToolConfirmationDialog } from '../modules/assistant/components/ToolConfirmationDialog';

const DRAWER_WIDTH = 420;
const FAB_SIZE = 56;
const FAB_OFFSET = 24;

/**
 * Widget assistant flottant accessible depuis toutes les pages.
 *
 * <p>Compose un FAB bottom-right + un Drawer slide-in qui ouvre une mini chat
 * UI reutilisant les memes primitives ({@link MessageList}, {@link ChatInput})
 * que la page dediee {@code /assistant}.</p>
 *
 * <p><b>Comportement</b> :</p>
 * <ul>
 *   <li>FAB hidden quand on est deja sur {@code /assistant} (eviter la
 *       redondance — l'UI complete est deja visible)</li>
 *   <li>Drawer en mode {@code temporary} (overlay sombre, ferme au clic
 *       exterieur) — non-bloquant pour la navigation</li>
 *   <li>Bouton "ouvrir en pleine page" qui ferme le drawer et navigue vers
 *       {@code /assistant} (continuera la conversation si on partage le state
 *       via Context dans une iteration future)</li>
 * </ul>
 *
 * <p>Le state d'assistant ici est INDEPENDANT de la page {@code /assistant} :
 * chaque instance de {@code useAgent()} a son propre conversation_id. Les
 * conversations restent persistees backend → l'utilisateur peut les retrouver
 * dans l'historique cote {@code /assistant}.</p>
 */
const AssistantWidget: React.FC = () => {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Hide FAB if already on /assistant (UI dediee deja visible)
  const isOnAssistantPage = location.pathname === '/assistant';

  const {
    messages,
    status,
    error,
    pendingConfirmation,
    sendMessage,
    confirmTool,
    abort,
    reset,
  } = useAgent({
    currentPage: location.pathname.replace(/^\//, '') || 'home',
  });

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);
  const handleOpenFullPage = useCallback(() => {
    setOpen(false);
    navigate('/assistant');
  }, [navigate]);

  if (isOnAssistantPage) return null;

  return (
    <>
      {/* ── FAB ─────────────────────────────────────────────────────── */}
      <Tooltip title="Assistant" placement="left">
        <IconButton
          onClick={handleOpen}
          aria-label="Ouvrir l'assistant"
          sx={{
            position: 'fixed',
            bottom: FAB_OFFSET,
            right: FAB_OFFSET,
            width: FAB_SIZE,
            height: FAB_SIZE,
            bgcolor: theme.palette.primary.main,
            color: theme.palette.primary.contrastText,
            boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.45)}`,
            cursor: 'pointer',
            zIndex: theme.zIndex.speedDial,
            transition: 'transform 200ms ease-out, box-shadow 200ms ease-out',
            '&:hover': {
              bgcolor: theme.palette.primary.dark,
              boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.55)}`,
              // Pas de scale (anti-pattern Impeccable). On joue sur shadow.
            },
            '&:active': {
              transform: 'translateY(1px)',
            },
            '@media (prefers-reduced-motion: reduce)': {
              transition: 'none',
            },
          }}
        >
          <SparklesIcon size={24} strokeWidth={1.75} />
        </IconButton>
      </Tooltip>

      {/* ── Drawer ──────────────────────────────────────────────────── */}
      <Drawer
        anchor="right"
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: { xs: '100vw', sm: DRAWER_WIDTH },
            display: 'flex',
            flexDirection: 'column',
            bgcolor: theme.palette.background.default,
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1.25,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
            bgcolor: theme.palette.background.paper,
            flexShrink: 0,
          }}
        >
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              color: theme.palette.primary.main,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SparklesIcon size={16} strokeWidth={1.75} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" sx={{ lineHeight: 1.2, fontWeight: 600 }}>
              Assistant
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
              {messages.length === 0 ? 'Que veux-tu savoir ?' : `${messages.length} message${messages.length > 1 ? 's' : ''}`}
            </Typography>
          </Box>
          <Tooltip title="Ouvrir en pleine page">
            <IconButton
              size="small"
              onClick={handleOpenFullPage}
              aria-label="Ouvrir en pleine page"
              sx={{ cursor: 'pointer' }}
            >
              <OpenInNewIcon size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Fermer">
            <IconButton
              size="small"
              onClick={handleClose}
              aria-label="Fermer"
              sx={{ cursor: 'pointer' }}
            >
              <CloseIcon size={16} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Messages */}
        <MessageList
          messages={messages}
          emptyState={
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
              py: 4,
              px: 3,
              height: '100%',
              textAlign: 'center',
            }}>
              <Box sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: theme.palette.primary.main,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <SparklesIcon size={22} strokeWidth={1.75} />
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Pose ta question
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 280 }}>
                J&apos;utilise tes donnees Clenzy en temps reel. Pour un historique
                complet, ouvre la page Assistant.
              </Typography>
            </Box>
          }
        />

        {/* Error banner */}
        {error && (
          <Box
            sx={{
              px: 2,
              py: 1,
              bgcolor: alpha(theme.palette.error.main, 0.08),
              color: theme.palette.error.main,
              fontSize: '0.8125rem',
              borderTop: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
            }}
          >
            {error}
          </Box>
        )}

        {/* Input */}
        <ChatInput
          status={status}
          onSend={sendMessage}
          onAbort={abort}
          placeholder="Demande-moi quelque chose..."
        />

        {/* Reset action visible only when there are messages */}
        {messages.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              py: 0.5,
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
              bgcolor: theme.palette.background.paper,
              flexShrink: 0,
            }}
          >
            <Typography
              component="button"
              variant="caption"
              onClick={reset}
              sx={{
                background: 'none',
                border: 'none',
                color: theme.palette.text.secondary,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '0.75rem',
                py: 0.5,
                px: 1.5,
                borderRadius: 1,
                '&:hover': {
                  color: theme.palette.primary.main,
                  bgcolor: alpha(theme.palette.primary.main, 0.06),
                },
              }}
            >
              Nouvelle conversation
            </Typography>
          </Box>
        )}
      </Drawer>

      {/* Tool confirmation dialog — meme primitive que la page dediee */}
      <ToolConfirmationDialog
        pending={pendingConfirmation}
        onConfirm={() => confirmTool(true)}
        onCancel={() => confirmTool(false)}
      />
    </>
  );
};

export default AssistantWidget;
