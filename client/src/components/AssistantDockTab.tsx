import React, { useState, useCallback, useEffect } from 'react';
import { Box, IconButton, Paper, Grow, ClickAwayListener, Typography, useTheme, alpha, Tooltip } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { Close as CloseIcon, Fullscreen as FullscreenIcon, ChevronUp } from '../icons';
import BaitlyMarkLogo from './BaitlyMarkLogo';
import { useAgent } from '../hooks/useAgent';
import { MessageList } from '../modules/assistant/components/MessageList';
import { ChatInput } from '../modules/assistant/components/ChatInput';
import { ToolConfirmationDialog } from '../modules/assistant/components/ToolConfirmationDialog';
import AssistantExpandedDialog from '../modules/assistant/components/AssistantExpandedDialog';

const PANEL_WIDTH = 400;
const TAB_WIDTH = 248;
const PHRASE_INTERVAL_MS = 4200;

/**
 * Phrases d'invitation qui defilent dans l'encoche fermee. Courtes (l'encoche
 * est compacte), orientees usage concret du PMS — pas de marketing.
 */
const DOCK_PHRASES = [
  'Que veux-tu savoir ?',
  'Analyse tes réservations',
  'Quel est mon taux d’occupation ?',
  'Prépare les arrivées de la semaine',
  'Rédige un message voyageur',
  'Compare tes performances',
];

/**
 * Presentation alternative de l'assistant — « encoche » docquee en bas a
 * droite, comme un onglet de classeur qui depasse du bord de l'ecran.
 *
 * <p>Alternative a {@link AssistantWidget} (FAB draggable + bulle Popper) :
 * meme moteur ({@code useAgent}), memes primitives de chat ({@link MessageList},
 * {@link ChatInput}, {@link AssistantExpandedDialog}), seule la presentation
 * change. Les deux composants coexistent ; le choix se fait dans
 * {@code MainLayoutFull} (constante {@code ASSISTANT_PRESENTATION}).</p>
 *
 * <p><b>Comportement</b> :</p>
 * <ul>
 *   <li>Fermee : encoche collee au bord bas (coins hauts arrondis, pas de
 *       bordure basse) avec le mark Baitly, une phrase d'invitation qui change
 *       toutes les ~4s (fondu + glissement, fige si
 *       {@code prefers-reduced-motion}), et un chevron.</li>
 *   <li>Clic (ou Entree) : le panneau de discussion se deploie au-dessus de
 *       l'encoche ; le chevron pivote. Re-clic, clic exterieur ou bouton
 *       Fermer : le panneau se replie, l'encoche reste.</li>
 *   <li>Bouton « Agrandir » : bascule en plein ecran via
 *       {@link AssistantExpandedDialog} (meme conversation, sans rupture).</li>
 * </ul>
 */
const AssistantDockTab: React.FC = () => {
  const theme = useTheme();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  // bulle compacte au-dessus de l'encoche, ou plein ecran (Dialog + historique)
  const [view, setView] = useState<'panel' | 'expanded'>('panel');

  const {
    conversationId,
    messages,
    status,
    error,
    pendingConfirmation,
    sendMessage,
    confirmTool,
    abort,
    reset,
    loadConversation,
  } = useAgent({
    currentPage: location.pathname.replace(/^\//, '') || 'home',
  });

  const handleToggle = useCallback(() => setOpen((o) => !o), []);
  const handleClose = useCallback(() => {
    setOpen(false);
    setView('panel');
  }, []);
  const handleExpand = useCallback(() => setView('expanded'), []);
  const handleMinimize = useCallback(() => setView('panel'), []);

  const isWorking = status === 'sending' || status === 'streaming';

  // ─── Rotation des phrases de l'encoche ──────────────────────────────────
  const [phraseIndex, setPhraseIndex] = useState(0);
  useEffect(() => {
    // Panneau ouvert : l'encoche affiche un libelle fixe, pas besoin de cycler.
    if (open) return undefined;
    // prefers-reduced-motion : phrase statique, aucun defilement.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = window.setInterval(
      () => setPhraseIndex((i) => (i + 1) % DOCK_PHRASES.length),
      PHRASE_INTERVAL_MS,
    );
    return () => window.clearInterval(id);
  }, [open]);

  const tabBorder = alpha(theme.palette.text.primary, 0.08);

  return (
    <>
      <ClickAwayListener
        onClickAway={() => {
          if (open) handleClose();
        }}
      >
        {/* Conteneur fixe bas-droite : panneau (deploye) au-dessus, encoche
            en dessous, tous deux alignes sur le meme bord droit. */}
        <Box
          sx={{
            position: 'fixed',
            bottom: 0,
            // Collee au bord DROIT de l'ecran : l'encoche est un onglet qui
            // depasse du bord, pas un element flottant.
            right: 0,
            zIndex: open ? theme.zIndex.modal : theme.zIndex.drawer + 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            // Le conteneur ne doit pas bloquer les clics a cote du panneau
            pointerEvents: 'none',
            '& > *': { pointerEvents: 'auto' },
          }}
        >
          {/* ── Panneau de discussion (deploye au-dessus de l'encoche) ────
              Colle DIRECTEMENT sur l'encoche (pas d'espace, pas de radius bas,
              pas de bordure basse) : panneau + encoche forment une seule carte
              continue docquee au bord de l'ecran. L'encoche s'elargit a la
              largeur du panneau a l'ouverture (transition width ci-dessous). */}
          <Grow
            in={open && view === 'panel'}
            mountOnEnter
            unmountOnExit
            timeout={220}
            style={{ transformOrigin: 'bottom center' }}
          >
            <Paper
              elevation={0}
              sx={{
                // Mobile : plein ecran (l'encoche est masquee, la fermeture se
                // fait via le bouton X du header). Desktop : panneau docke au
                // bord droit — seul le coin haut-GAUCHE est arrondi.
                width: { xs: '100vw', sm: PANEL_WIDTH },
                maxWidth: '100vw',
                height: { xs: '100dvh', sm: 'min(70vh, 600px)' },
                maxHeight: '100dvh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                borderRadius: { xs: 0, sm: '22px 0 0 0' },
                border: { xs: 'none', sm: `0.5px solid ${tabBorder}` },
                borderRight: 'none',
                borderBottom: 'none',
                bgcolor: theme.palette.background.default,
                boxShadow: `0 20px 50px -12px ${alpha(theme.palette.primary.main, 0.42)}, 0 6px 16px -6px ${alpha(theme.palette.primary.main, 0.22)}`,
              }}
            >
              {/* Header — L2 panel teinte, meme grammaire que la bulle du FAB */}
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
                <Box sx={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BaitlyMarkLogo variant="mark" size={18} idleAnimation={false} active={isWorking} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ lineHeight: 1.2, fontWeight: 600 }}>
                    Assistant
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
                    {messages.length === 0 ? 'Que veux-tu savoir ?' : `${messages.length} message${messages.length > 1 ? 's' : ''}`}
                  </Typography>
                </Box>
                <Tooltip title="Agrandir">
                  <IconButton size="small" onClick={handleExpand} aria-label="Agrandir en plein ecran" sx={{ cursor: 'pointer' }}>
                    <FullscreenIcon size={16} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Fermer">
                  <IconButton size="small" onClick={handleClose} aria-label="Fermer" sx={{ cursor: 'pointer' }}>
                    <CloseIcon size={16} />
                  </IconButton>
                </Tooltip>
              </Box>

              {/* Messages */}
              <MessageList
                messages={messages}
                emptyState={
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1.5,
                      py: 4,
                      px: 3,
                      height: '100%',
                      textAlign: 'center',
                    }}
                  >
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: theme.palette.primary.main,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BaitlyMarkLogo variant="mark" size={26} />
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Pose ta question
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 280 }}>
                      J&apos;utilise tes donnees Baitly en temps reel.
                    </Typography>
                  </Box>
                }
              />

              {/* Error banner */}
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
            </Paper>
          </Grow>

          {/* ── Encoche « classeur » collee au bord bas ───────────────────
              Fermee : onglet compact aux coins hauts arrondis. Ouverte : elle
              s'elargit a la largeur du panneau, perd son arrondi et son ombre
              propre, et devient la barre de base du panneau (une seule carte). */}
          <Box
            component="button"
            type="button"
            onClick={handleToggle}
            aria-expanded={open}
            aria-label={open ? 'Replier l’assistant' : 'Déplier l’assistant'}
            sx={{
              // Mobile ouvert : l'encoche disparait, le panneau plein ecran a
              // son propre bouton Fermer. Mobile ferme : logo seul, compact.
              display: { xs: open ? 'none' : 'flex', sm: 'flex' },
              alignItems: 'center',
              justifyContent: { xs: 'center', sm: 'flex-start' },
              gap: 1,
              height: 44,
              width: open ? PANEL_WIDTH : { xs: 52, sm: TAB_WIDTH },
              maxWidth: '100vw',
              pl: { xs: 0, sm: 1.5 },
              pr: { xs: 0, sm: 1.25 },
              // Onglet de classeur docke au bord droit : seul le coin haut-
              // GAUCHE est arrondi, la base et le flanc droit se fondent dans
              // les bords de l'ecran. Ouvert : plus d'arrondi du tout,
              // l'encoche se fond dans le panneau.
              borderRadius: open ? 0 : '14px 0 0 0',
              border: `0.5px solid ${tabBorder}`,
              borderRight: 'none',
              borderBottom: 'none',
              // Ouvert : la bordure haute devient le hairline qui separe le
              // panneau de sa base ; le fond s'aligne sur celui du panneau.
              bgcolor: open ? theme.palette.background.default : theme.palette.background.paper,
              boxShadow: open
                ? `0 20px 50px -12px ${alpha(theme.palette.primary.main, 0.42)}`
                : `0 -6px 18px -8px ${alpha(theme.palette.primary.main, 0.35)}`,
              cursor: 'pointer',
              fontFamily: 'inherit',
              // Leger soulevement au survol (transform, pas de layout shift) —
              // uniquement fermee : ouverte, l'encoche fait corps avec le panneau.
              transform: 'translateY(0)',
              transition: 'width 220ms cubic-bezier(0.22, 1, 0.36, 1), border-radius 220ms ease-out, background-color 220ms ease-out, transform 200ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms ease-out',
              '&:hover': open
                ? { bgcolor: alpha(theme.palette.text.primary, 0.025) }
                : {
                    transform: 'translateY(-3px)',
                    boxShadow: `0 -10px 24px -8px ${alpha(theme.palette.primary.main, 0.45)}`,
                  },
              '&:focus-visible': {
                outline: `2px solid ${theme.palette.primary.main}`,
                outlineOffset: -2,
              },
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            }}
          >
            <BaitlyMarkLogo variant="mark" size={18} idleAnimation={!open} active={isWorking} />

            {/* Phrase animee — flex:1 pour occuper la largeur disponible (fermee
                comme ouverte). key force le remontage → l'animation d'entree
                rejoue a chaque phrase. */}
            <Box
              sx={{
                // Mobile : logo seul, pas de phrase
                display: { xs: 'none', sm: 'block' },
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textAlign: 'left',
                '@keyframes dockPhraseIn': {
                  from: { opacity: 0, transform: 'translateY(6px)' },
                  to: { opacity: 1, transform: 'translateY(0)' },
                },
              }}
            >
              <Typography
                key={open ? 'open' : phraseIndex}
                noWrap
                sx={{
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: theme.palette.text.secondary,
                  animation: 'dockPhraseIn 420ms cubic-bezier(0.22, 1, 0.36, 1)',
                  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                }}
              >
                {open ? 'Assistant Baitly' : DOCK_PHRASES[phraseIndex]}
              </Typography>
            </Box>

            {/* Chevron : pointe vers le haut (deplier), pivote a l'ouverture.
                Mobile : logo seul, pas de chevron. */}
            <Box
              sx={{
                display: { xs: 'none', sm: 'flex' },
                color: theme.palette.text.secondary,
                transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
              }}
            >
              <ChevronUp size={16} />
            </Box>
          </Box>
        </Box>
      </ClickAwayListener>

      {/* ── Vue agrandie : plein ecran + historique des conversations ────── */}
      {open && view === 'expanded' && (
        <AssistantExpandedDialog
          open
          onMinimize={handleMinimize}
          onClose={handleClose}
          conversationId={conversationId}
          messages={messages}
          status={status}
          error={error}
          sendMessage={sendMessage}
          abort={abort}
          reset={reset}
          loadConversation={loadConversation}
        />
      )}

      {/* Tool confirmation dialog — meme primitive que le widget FAB */}
      <ToolConfirmationDialog
        pending={pendingConfirmation}
        onConfirm={() => confirmTool(true)}
        onCancel={() => confirmTool(false)}
      />
    </>
  );
};

export default AssistantDockTab;
