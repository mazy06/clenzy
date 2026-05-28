import React, { useState, useCallback } from 'react';
import { Box, IconButton, Drawer, Typography, useTheme, alpha, Tooltip } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { Close as CloseIcon, OpenInNew as OpenInNewIcon } from '../icons';
import ClenzyMarkLogo from './ClenzyMarkLogo';
import { useAgent } from '../hooks/useAgent';
import { MessageList } from '../modules/assistant/components/MessageList';
import { ChatInput } from '../modules/assistant/components/ChatInput';
import { ToolConfirmationDialog } from '../modules/assistant/components/ToolConfirmationDialog';

const DRAWER_WIDTH = 420;
const FAB_SIZE = 80;
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

  // "Working" = l'IA est en train de generer une reponse (sending = envoi
  // initial, streaming = reponse en cours). Pilote l'animation active du mark.
  const isWorking = status === 'sending' || status === 'streaming';

  if (isOnAssistantPage) return null;

  return (
    <>
      {/* ── FAB ─────────────────────────────────────────────────────── */}
      {/* Plus de bg color : le mark seul fait l'affordance visuelle.
          Plus de shadow : on laisse le mark anime "respirer" sur le fond
          de page. Plus de hover bg/shadow : l'animation permanente du
          mark suffit a indiquer l'interactivite. La zone de clic reste
          le 80x80 du IconButton (capture les clics meme dans les zones
          "vides" entre les nodes). */}
      <Tooltip title="Assistant" placement="left">
        <IconButton
          onClick={handleOpen}
          aria-label="Ouvrir l'assistant"
          disableRipple
          sx={{
            position: 'fixed',
            bottom: FAB_OFFSET,
            right: FAB_OFFSET,
            width: FAB_SIZE,
            height: FAB_SIZE,
            bgcolor: 'transparent',
            cursor: 'pointer',
            zIndex: theme.zIndex.speedDial,
            transition: 'transform 200ms ease-out',
            '&:hover': {
              bgcolor: 'transparent', // empeche le hover MUI par defaut
            },
            '&:active': {
              transform: 'translateY(1px)',
            },
            '@media (prefers-reduced-motion: reduce)': {
              transition: 'none',
            },
          }}
        >
          {/* tone="auto" : couleur brand (#6B8A9A) sur le fond page clair.
              size=72 : maximise le mark dans le FAB 80px (4px de padding
              visuel). active permanent : le mark est constamment dans son
              etat hover-equivalent (lines absorbees, centre pulsant avec
              glow, nodes orbitant) — c'est la "signature vivante" du
              widget assistant, comme l'orb de Siri/Copilot. */}
          <ClenzyMarkLogo
            variant="mark"
            size={72}
            idleAnimation={false}
            active
          />
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
        {/* Header — L2 panel teinte, pas de border-bottom (le contraste bg-vs-flux
            de messages cree la separation visuelle) */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1.25,
            bgcolor: alpha(theme.palette.text.primary, 0.025),
            flexShrink: 0,
          }}
        >
          <Box
            sx={{
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Header du drawer : pas de bg circulaire (le mark se suffit
                a lui-meme). active={isWorking} declenche l'animation
                hover-equivalent quand l'IA travaille. */}
            <ClenzyMarkLogo
              variant="mark"
              size={18}
              idleAnimation={false}
              active={isWorking}
            />
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
                {/* Empty state du drawer : pas d'active (pas de conversation
                    en cours), mais animation idle gardee pour le wow d'arrivee. */}
                <ClenzyMarkLogo variant="mark" size={26} />
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

        {/* Error banner — bg solide, pas de border */}
        {error && (
          <Box
            sx={{
              mx: 1.5,
              mb: 1,
              px: 1.5,
              py: 1,
              bgcolor: alpha(theme.palette.error.main, 0.10),
              color: theme.palette.error.dark,
              fontSize: '0.8125rem',
              fontWeight: 500,
              borderRadius: 2,
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

        {/* Reset action visible only when there are messages — pas de border,
            le bg L2 + l'input panel L2 se touchent (pas besoin de separation) */}
        {messages.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              py: 0.5,
              bgcolor: alpha(theme.palette.text.primary, 0.025),
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
