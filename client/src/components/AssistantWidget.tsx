import React, { useState, useCallback, useRef, useEffect } from 'react';
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

// ─── FAB position : draggable avec snap aux bords ─────────────────────────

type FabEdge = 'top' | 'right' | 'bottom' | 'left';

interface FabPosition {
  /** Bord auquel le FAB est attache. */
  edge: FabEdge;
  /** Position normalisee le long du bord (0..1).
   *  - top/bottom : 0 = gauche, 1 = droite
   *  - left/right : 0 = haut, 1 = bas */
  offsetPct: number;
}

const FAB_POSITION_KEY = 'clenzy_assistant_fab_position';
const DRAG_THRESHOLD_PX = 5; // pour distinguer click de drag

const DEFAULT_POSITION: FabPosition = { edge: 'right', offsetPct: 1 }; // bottom-right corner

/**
 * Charge la position du FAB depuis localStorage. Per-device preference :
 * suit la decision tree de CLAUDE.md section 3 (preferences UI per-device).
 * Lecture synchrone au mount pour eviter le FOUC.
 */
function loadFabPosition(): FabPosition {
  try {
    const raw = localStorage.getItem(FAB_POSITION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        ['top', 'right', 'bottom', 'left'].includes(parsed.edge) &&
        typeof parsed.offsetPct === 'number' &&
        parsed.offsetPct >= 0 &&
        parsed.offsetPct <= 1
      ) {
        return parsed;
      }
    }
  } catch {
    // localStorage indispo ou JSON malforme : on retombe sur le defaut
  }
  return DEFAULT_POSITION;
}

function saveFabPosition(pos: FabPosition): void {
  try {
    localStorage.setItem(FAB_POSITION_KEY, JSON.stringify(pos));
  } catch {
    // Stockage plein / refuse : on accepte de perdre la prefs au reload
  }
}

/**
 * Detecte le bord le plus proche d'un point (x, y) dans le viewport.
 * Garantit que le FAB termine toujours colle a un bord (pas au milieu).
 */
function closestEdge(x: number, y: number): FabEdge {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const distances: Record<FabEdge, number> = {
    top: y,
    right: w - x - FAB_SIZE,
    bottom: h - y - FAB_SIZE,
    left: x,
  };
  let minEdge: FabEdge = 'right';
  let minDist = Infinity;
  (Object.entries(distances) as [FabEdge, number][]).forEach(([edge, d]) => {
    if (d < minDist) {
      minDist = d;
      minEdge = edge;
    }
  });
  return minEdge;
}

/**
 * Calcule la position normalisee (0..1) le long du bord snappe pour un
 * point (x, y) dans le viewport, en tenant compte de la marge FAB_OFFSET.
 */
function edgeOffsetPct(edge: FabEdge, x: number, y: number): number {
  const w = window.innerWidth;
  const h = window.innerHeight;
  let coord: number;
  let span: number;
  if (edge === 'top' || edge === 'bottom') {
    coord = x - FAB_OFFSET;
    span = w - FAB_SIZE - 2 * FAB_OFFSET;
  } else {
    coord = y - FAB_OFFSET;
    span = h - FAB_SIZE - 2 * FAB_OFFSET;
  }
  if (span <= 0) return 0;
  return Math.max(0, Math.min(1, coord / span));
}

/**
 * Convertit {edge, offsetPct} en proprietes CSS top/right/bottom/left.
 * Le FAB est position:fixed donc ces proprietes positionnent par rapport
 * au viewport.
 */
function positionToStyle(pos: FabPosition): Pick<React.CSSProperties, 'top' | 'right' | 'bottom' | 'left'> {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const horizontalSpan = Math.max(0, w - FAB_SIZE - 2 * FAB_OFFSET);
  const verticalSpan = Math.max(0, h - FAB_SIZE - 2 * FAB_OFFSET);
  switch (pos.edge) {
    case 'top':
      return { top: FAB_OFFSET, left: FAB_OFFSET + pos.offsetPct * horizontalSpan };
    case 'right':
      return { right: FAB_OFFSET, top: FAB_OFFSET + pos.offsetPct * verticalSpan };
    case 'bottom':
      return { bottom: FAB_OFFSET, left: FAB_OFFSET + pos.offsetPct * horizontalSpan };
    case 'left':
      return { left: FAB_OFFSET, top: FAB_OFFSET + pos.offsetPct * verticalSpan };
  }
}

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

  // ─── FAB draggable avec snap aux bords ──────────────────────────────────
  const [fabPosition, setFabPosition] = useState<FabPosition>(loadFabPosition);
  // Offset visuel pendant le drag (transform translate). Null = pas en drag.
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null);
  // Ref pour tracker l'etat du drag sans re-render (start coords, moved flag).
  const dragStateRef = useRef<{
    startMouseX: number;
    startMouseY: number;
    startFabLeft: number;
    startFabTop: number;
    moved: boolean;
  } | null>(null);

  // Si la fenetre est resize a une taille plus petite que la position
  // sauvee, le FAB peut etre hors-ecran. Clamp pour le ramener visible.
  useEffect(() => {
    const handleResize = () => {
      // offsetPct etant normalise [0..1], le positionToStyle clamp
      // automatiquement. Mais on force un re-render via setState pour
      // recalculer la position absolue avec la nouvelle taille viewport.
      setFabPosition((p) => ({ ...p }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleFabPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    dragStateRef.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startFabLeft: rect.left,
      startFabTop: rect.top,
      moved: false,
    };
    // setPointerCapture : tous les pointermove/up suivants seront livres
    // a cet element meme si le pointer sort de ses bounds. Indispensable
    // pour un drag fluide qui ne casse pas au bord du FAB.
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleFabPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStateRef.current) return;
    const dx = e.clientX - dragStateRef.current.startMouseX;
    const dy = e.clientY - dragStateRef.current.startMouseY;
    // Threshold 5px pour distinguer click (mouvement involontaire) de drag.
    if (
      !dragStateRef.current.moved
      && (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX)
    ) {
      dragStateRef.current.moved = true;
    }
    if (dragStateRef.current.moved) {
      setDragOffset({ dx, dy });
    }
  };

  const handleFabPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStateRef.current) return;
    const wasMoved = dragStateRef.current.moved;
    if (wasMoved) {
      // Calcule la position finale absolue (au centre du FAB pour la
      // detection edge, plus naturel que le coin haut-gauche).
      const finalLeft = dragStateRef.current.startFabLeft + (e.clientX - dragStateRef.current.startMouseX);
      const finalTop = dragStateRef.current.startFabTop + (e.clientY - dragStateRef.current.startMouseY);
      const centerX = finalLeft + FAB_SIZE / 2;
      const centerY = finalTop + FAB_SIZE / 2;
      const edge = closestEdge(finalLeft, finalTop);
      const offsetPct = edgeOffsetPct(edge, centerX - FAB_SIZE / 2, centerY - FAB_SIZE / 2);
      const newPos: FabPosition = { edge, offsetPct };
      setFabPosition(newPos);
      saveFabPosition(newPos);
    }
    setDragOffset(null);
    // Garde le moved flag jusqu'au click handler pour qu'il puisse l'inspecter.
    // Reset dans un setTimeout pour laisser le onClick fire d'abord.
    const movedSnapshot = dragStateRef.current.moved;
    setTimeout(() => {
      if (dragStateRef.current?.moved === movedSnapshot) {
        dragStateRef.current = null;
      }
    }, 0);
  };

  const handleFabClick = () => {
    // Si on a drag, on ne traite pas comme un click (l'user voulait deplacer).
    if (dragStateRef.current?.moved) {
      dragStateRef.current = null;
      return;
    }
    dragStateRef.current = null;
    handleOpen();
  };

  if (isOnAssistantPage) return null;

  return (
    <>
      {/* ── FAB ─────────────────────────────────────────────────────── */}
      {/* Draggable avec snap aux bords (top/right/bottom/left). L'user
          peut maintenir + deplacer le FAB librement, mais au release il
          snap automatiquement au bord le plus proche (jamais positionne
          au milieu de l'ecran). Position persistee en localStorage,
          restauree au mount. Drag distingue de click via threshold 5px.

          Pas de bg color : le mark seul fait l'affordance visuelle.
          Pas de shadow : on laisse le mark anime "respirer" sur le fond
          de page. La zone de clic reste le 80x80 du IconButton. */}
      <Tooltip title={dragOffset ? '' : 'Assistant'} placement="left">
        <IconButton
          onClick={handleFabClick}
          onPointerDown={handleFabPointerDown}
          onPointerMove={handleFabPointerMove}
          onPointerUp={handleFabPointerUp}
          aria-label="Ouvrir l'assistant"
          disableRipple
          sx={{
            position: 'fixed',
            ...positionToStyle(fabPosition),
            width: FAB_SIZE,
            height: FAB_SIZE,
            bgcolor: 'transparent',
            // grab quand pas en drag, grabbing pendant, sinon pointer
            cursor: dragOffset ? 'grabbing' : 'grab',
            // touchAction: none empeche le browser de scroller pendant le drag
            // tactile (sinon iOS/Android prennent le geste pour un scroll).
            touchAction: 'none',
            zIndex: theme.zIndex.speedDial,
            // Transform pour drag visuel (free), CSS transition seulement
            // hors drag (sinon snap n'est pas anime).
            transform: dragOffset ? `translate(${dragOffset.dx}px, ${dragOffset.dy}px)` : 'none',
            transition: dragOffset
              ? 'none'
              : 'top 280ms cubic-bezier(0.4, 0, 0.2, 1), right 280ms cubic-bezier(0.4, 0, 0.2, 1), bottom 280ms cubic-bezier(0.4, 0, 0.2, 1), left 280ms cubic-bezier(0.4, 0, 0.2, 1), transform 200ms ease-out',
            '&:hover': {
              bgcolor: 'transparent', // empeche le hover MUI par defaut
            },
            '@media (prefers-reduced-motion: reduce)': {
              transition: dragOffset ? 'none' : 'top 0ms, right 0ms, bottom 0ms, left 0ms',
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
