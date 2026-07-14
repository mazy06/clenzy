import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Box, IconButton, Popper, Paper, Grow, ClickAwayListener, Typography, useTheme, alpha, Tooltip } from '@mui/material';
import type { PopperPlacementType } from '@mui/material';
import type { Instance as PopperInstance } from '@popperjs/core';
import { useLocation } from 'react-router-dom';
import { Close as CloseIcon, Fullscreen as FullscreenIcon } from '../icons';
import BaitlyMarkLogo from './BaitlyMarkLogo';
import { useAgent } from '../hooks/useAgent';
import { MessageList } from '../modules/assistant/components/MessageList';
import { ChatInput } from '../modules/assistant/components/ChatInput';
import { ToolConfirmationDialog } from '../modules/assistant/components/ToolConfirmationDialog';
import AssistantExpandedDialog from '../modules/assistant/components/AssistantExpandedDialog';

const BUBBLE_WIDTH = 400;
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
        // Le bord HAUT n'est plus un ancrage valide (il chevauche le header/
        // toolbar fixe de l'app). Une position 'top' persistee est rejetee ici
        // → l'utilisateur bloque en haut repasse au defaut (bas-droite) au reload.
        ['right', 'bottom', 'left'].includes(parsed.edge) &&
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
  // Bord HAUT volontairement exclu : le FAB y recouvrirait le header/toolbar
  // fixe de l'app (barre Planning, AppBar). On ne dock qu'a gauche / droite / bas.
  const distances: Record<Exclude<FabEdge, 'top'>, number> = {
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
 * Sens d'ouverture de la bulle depuis le centre du logo (en px viewport) :
 * up = logo dans la moitie basse (bulle vers le haut), right = logo dans la
 * moitie droite (bulle a sa gauche). Recalcule en continu pendant le drag.
 */
function dirFromCenter(centerX: number, centerY: number): { up: boolean; right: boolean } {
  return {
    up: centerY > window.innerHeight / 2,
    right: centerX > window.innerWidth / 2,
  };
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
 * Widget assistant flottant — UNIQUE point d'entree de l'assistant (la page
 * dediee /assistant a ete supprimee, ce widget la remplace), present sur toutes
 * les pages.
 *
 * <p>Compose un FAB draggable (le logo Baitly) + une bulle (Popper) ancree a ce
 * logo (mini chat), agrandissable en plein ecran via {@link AssistantExpandedDialog}
 * qui ajoute l'historique des conversations. Reutilise les memes primitives
 * ({@link MessageList}, {@link ChatInput}).</p>
 *
 * <p><b>Comportement</b> :</p>
 * <ul>
 *   <li>Bulle ancree au COTE du logo (logo a droite -> a sa gauche, etc.),
 *       collee a l'orbe, suit le logo en temps reel quand on le deplace, fermee
 *       au clic exterieur. Hauteur bornee (~70vh), angles "bulle", ombre brand.</li>
 *   <li>Bouton "Agrandir" -> plein ecran (Dialog) avec sidebar historique +
 *       chat ; "Reduire" revient a la bulle. Meme {@code useAgent} -> la
 *       conversation se poursuit sans rupture.</li>
 * </ul>
 *
 * <p>Le {@code useAgent} a son propre conversation_id ; les conversations sont
 * persistees backend et listees dans l'historique du mode plein ecran.</p>
 */
const AssistantWidget: React.FC = () => {
  const theme = useTheme();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  // Mode d'affichage : bulle compacte ancree au logo, ou plein ecran (Dialog
  // avec sidebar historique). La meme instance useAgent alimente les deux : la
  // conversation se poursuit sans rupture quand on agrandit / reduit.
  const [view, setView] = useState<'bubble' | 'expanded'>('bubble');
  // Ancre de la bulle = le FAB (logo). Sens d'ouverture calcule a l'ouverture
  // depuis la position reelle du FAB : logo en bas -> bulle vers le haut, en
  // haut -> vers le bas ; a droite -> alignee a droite (s'etend vers le centre),
  // a gauche -> alignee a gauche.
  const fabRef = useRef<HTMLButtonElement | null>(null);
  // Instance Popper.js : permet de forcer un repositionnement (update) quand le
  // logo bouge, pour que la bulle suive l'orbe en temps reel.
  const popperRef = useRef<PopperInstance | null>(null);
  const [bubbleDir, setBubbleDir] = useState<{ up: boolean; right: boolean }>({ up: true, right: true });

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

  const handleOpen = useCallback(() => {
    const r = fabRef.current?.getBoundingClientRect();
    if (r) {
      setBubbleDir(dirFromCenter(r.left + r.width / 2, r.top + r.height / 2));
    }
    setOpen(true);
  }, []);
  // Fermeture complete : on repart en mode bulle au prochain ouvre.
  const handleClose = useCallback(() => {
    setOpen(false);
    setView('bubble');
  }, []);
  // Agrandir : bascule la bulle en plein ecran (meme conversation).
  const handleExpand = useCallback(() => setView('expanded'), []);
  // Reduire : revient a la bulle ancree au logo (meme conversation).
  const handleMinimize = useCallback(() => setView('bubble'), []);

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

  // La bulle suit l'orbe en temps reel : a chaque mouvement du logo (offset de
  // drag, snap au relache, ou bascule de cote/alignement), on force le Popper a
  // recalculer sa position. update() est no-op si la bulle n'est pas montee.
  useEffect(() => {
    popperRef.current?.update();
  }, [fabPosition, dragOffset, bubbleDir]);

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
      // Suivi temps reel : recalcule cote/alignement depuis la position courante
      // du logo (centre = depart + delta). Ne met a jour que si ca change, pour
      // limiter les re-renders. Le useEffect ci-dessus force ensuite le Popper a
      // suivre l'orbe.
      if (open) {
        const left = dragStateRef.current.startFabLeft + dx;
        const top = dragStateRef.current.startFabTop + dy;
        const next = dirFromCenter(left + FAB_SIZE / 2, top + FAB_SIZE / 2);
        setBubbleDir((prev) => (prev.up === next.up && prev.right === next.right ? prev : next));
      }
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
      // Au relache : fige le cote/alignement depuis la position de drop. Le snap
      // est instantane quand la bulle est ouverte (transition desactivee), donc
      // la bulle reste synchro avec l'orbe.
      if (open) {
        setBubbleDir(dirFromCenter(centerX, centerY));
      }
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
    if (open) {
      handleClose();
    } else {
      handleOpen();
    }
  };

  // La bulle se place TOUJOURS sur le COTE du logo : logo a droite -> bulle a
  // gauche du logo (donc sur le bord droit de l'ecran), logo a gauche -> bulle
  // a droite du logo. L'alignement vertical suit la moitie haute/basse (logo en
  // bas -> la bulle s'etend vers le haut, en haut -> vers le bas). L'origine du
  // Grow est le coin face au logo, pour que la bulle "sorte" du logo.
  const bubblePlacement: PopperPlacementType =
    `${bubbleDir.right ? 'left' : 'right'}-${bubbleDir.up ? 'end' : 'start'}`;
  const growOrigin = `${bubbleDir.right ? 'right' : 'left'} ${bubbleDir.up ? 'bottom' : 'top'}`;
  const bubbleBorder = alpha(theme.palette.text.primary, 0.08);

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
          ref={fabRef}
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
            // Au-dessus de la navbar (Drawer MUI = zIndex.drawer 1200) pour que
            // le logo ne passe jamais derriere la sidebar, ouverte ou fermee.
            // Reste sous les modales (1300) : un dialog ouvert recouvre le FAB.
            zIndex: theme.zIndex.drawer + 1,
            // Transform pour drag visuel (free), CSS transition seulement
            // hors drag (sinon snap n'est pas anime).
            transform: dragOffset ? `translate(${dragOffset.dx}px, ${dragOffset.dy}px)` : 'none',
            // Snap anime quand la bulle est FERMEE ; instantane quand elle est
            // OUVERTE (sinon la bulle, qui suit l'orbe via popperRef.update(),
            // courrait apres l'animation de snap et se desynchroniserait).
            transition: dragOffset || open
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
          {/* Le logo retrecit quand la fenetre est ouverte et reprend sa taille
              a la fermeture (effet inverse), pour lier visuellement le logo a la
              bulle qui "sort" de lui. Scale applique sur ce wrapper (pas sur le
              IconButton) pour ne pas entrer en conflit avec le translate du drag.
              Easing legerement elastique (overshoot) pour un "pop". */}
          <Box
            sx={{
              display: 'flex',
              transform: open ? 'scale(0.62)' : 'scale(1)',
              transition: 'transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1)',
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            }}
          >
            <BaitlyMarkLogo
              variant="mark"
              size={72}
              idleAnimation={false}
              active
            />
          </Box>
        </IconButton>
      </Tooltip>

      {/* ── Bulle ancree au logo (FAB) ─────────────────────────────────
          Remplace l'ancien Drawer pleine hauteur : un Popper ancre au FAB,
          place TOUJOURS sur le COTE du logo (logo a droite -> bulle a sa gauche
          = bord droit de l'ecran ; logo a gauche -> a sa droite), aligne en haut
          ou en bas selon la moitie, et colle tout pres de l'orbe (offset negatif).
          flip desactive pour rester coherent ; preventOverflow garde la bulle a
          l'ecran. */}
      <Popper
        open={open && view === 'bubble'}
        anchorEl={fabRef.current}
        popperRef={popperRef}
        placement={bubblePlacement}
        transition
        modifiers={[
          // Offset NEGATIF : le FAB fait 80px avec l'orbe (reduit) centre dedans
          // (~17px de vide jusqu'au bord). On "mord" dans ce vide pour coller la
          // fenetre tout pres de l'orbe au lieu du bord de la zone de clic.
          { name: 'offset', options: { offset: [0, -14] } },
          { name: 'preventOverflow', options: { boundary: 'viewport', padding: 8 } },
          { name: 'flip', enabled: false },
        ]}
        sx={{ zIndex: theme.zIndex.modal }}
      >
        {({ TransitionProps }) => (
          <Grow {...TransitionProps} timeout={220} style={{ transformOrigin: growOrigin }}>
            <Box sx={{ position: 'relative' }}>
              {/* Fleche retiree : la bulle est collee tout pres de l'orbe et
                  l'animation de retrecissement du logo suffit a les relier. */}
              <ClickAwayListener
                onClickAway={(e) => {
                  // Ne pas fermer si on reclique le FAB (il gere le toggle).
                  if (fabRef.current && fabRef.current.contains(e.target as Node)) return;
                  handleClose();
                }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    position: 'relative',
                    zIndex: 1,
                    width: { xs: 'calc(100vw - 32px)', sm: BUBBLE_WIDTH },
                    maxWidth: 'calc(100vw - 32px)',
                    height: { xs: 'calc(100dvh - 160px)', sm: 'min(70vh, 600px)' },
                    maxHeight: 'calc(100dvh - 32px)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    borderRadius: '22px',
                    border: `0.5px solid ${bubbleBorder}`,
                    bgcolor: theme.palette.background.default,
                    boxShadow: `0 20px 50px -12px ${alpha(theme.palette.primary.main, 0.42)}, 0 6px 16px -6px ${alpha(theme.palette.primary.main, 0.22)}`,
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
            <BaitlyMarkLogo
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
          <Tooltip title="Agrandir">
            <IconButton
              size="small"
              onClick={handleExpand}
              aria-label="Agrandir en plein ecran"
              sx={{ cursor: 'pointer' }}
            >
              <FullscreenIcon size={16} />
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
                <BaitlyMarkLogo variant="mark" size={26} />
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Pose ta question
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 280 }}>
                J&apos;utilise tes donnees Baitly en temps reel. Pour un historique
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
                </Paper>
              </ClickAwayListener>
            </Box>
          </Grow>
        )}
      </Popper>

      {/* ── Vue agrandie : plein ecran + historique des conversations ──────
          Montee uniquement en mode plein ecran (les hooks d'historique/usage
          ne fetchent donc pas sur chaque page). Memes valeurs useAgent que la
          bulle -> la conversation se poursuit sans rupture. Remplace l'ancienne
          page dediee /assistant (supprimee). */}
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
