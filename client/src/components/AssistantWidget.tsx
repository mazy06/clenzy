import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from './ui';
import { cn } from '../utils/cn';
import { useLocation } from 'react-router-dom';
import { Close as CloseIcon, Fullscreen as FullscreenIcon } from '../icons';
import BaitlyMarkLogo from './BaitlyMarkLogo';
import { useAgent } from '../hooks/useAgent';
import { MessageList } from '../modules/assistant/components/MessageList';
import { ChatInput } from '../modules/assistant/components/ChatInput';
import { ToolConfirmationDialog } from '../modules/assistant/components/ToolConfirmationDialog';
import AssistantExpandedDialog from '../modules/assistant/components/AssistantExpandedDialog';

/** Marge minimale entre la bulle et le bord de l'ecran. */
const MARGE_ECRAN = 8;
/** De combien la bulle mord dans le vide qui entoure l'orbe (cf. l'effet ci-dessous). */
const MORSURE = 14;
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

const FAB_POSITION_KEY = 'clenzy_assistant_fab_position:v1';
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
 * <p>Compose un FAB draggable (le logo Baitly) + une bulle ancree a ce
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
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  // Boite de la bulle en coordonnees viewport, recalculee des que le logo bouge.
  const [bubbleBox, setBubbleBox] = useState<React.CSSProperties>({});
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

  // La bulle suit l'orbe en temps reel : a chaque mouvement du logo (glisser,
  // retour au bord, ou bascule de cote) on recalcule sa boite depuis celle du
  // logo. Le logo est en `fixed` et sa boite est connue, si bien qu'un moteur
  // de positionnement generique n'apportait rien ici — c'est d'ailleurs pour
  // cela que la version precedente devait lui reclamer un recalcul manuel a
  // chaque image du geste.
  useEffect(() => {
    if (!open || view !== 'bubble') return;
    const logo = fabRef.current?.getBoundingClientRect();
    if (!logo) return;
    const boite: React.CSSProperties = {};
    // La bulle « mord » de 14px dans le vide qui entoure l'orbe a l'interieur
    // de la zone cliquable de 80px, pour se coller a lui plutot qu'au bord.
    if (bubbleDir.right) boite.right = Math.max(MARGE_ECRAN, window.innerWidth - logo.left - MORSURE);
    else boite.left = Math.max(MARGE_ECRAN, logo.right - MORSURE);
    if (bubbleDir.up) boite.bottom = Math.max(MARGE_ECRAN, window.innerHeight - logo.bottom);
    else boite.top = Math.max(MARGE_ECRAN, logo.top);
    setBubbleBox(boite);
  }, [open, view, fabPosition, dragOffset, bubbleDir]);

  // Fermeture au clic hors de la bulle. Le logo est exclu : c'est lui qui porte
  // la bascule ouvrir/fermer, et le laisser passer ici la declencherait deux fois.
  useEffect(() => {
    if (!open || view !== 'bubble') return;
    const surClicExterieur = (e: PointerEvent) => {
      const cible = e.target as Node;
      if (bubbleRef.current?.contains(cible)) return;
      if (fabRef.current?.contains(cible)) return;
      handleClose();
    };
    document.addEventListener('pointerdown', surClicExterieur);
    return () => document.removeEventListener('pointerdown', surClicExterieur);
  }, [open, view, handleClose]);

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
      // limiter les re-renders. Le useEffect ci-dessus force ensuite la bulle a
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
  // L'origine de l'animation est le coin face au logo, pour que la bulle
  // "sorte" du logo.
  const growOrigin = `${bubbleDir.right ? 'right' : 'left'} ${bubbleDir.up ? 'bottom' : 'top'}`;

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
          de page. La zone de clic reste le 80x80 du bouton. */}
      <Tooltip>
        <TooltipTrigger asChild>
        <button
          type="button"
          ref={fabRef}
          onClick={handleFabClick}
          onPointerDown={handleFabPointerDown}
          onPointerMove={handleFabPointerMove}
          onPointerUp={handleFabPointerUp}
          aria-label="Ouvrir l'assistant"
          className={cn(
            'fixed flex items-center justify-center border-none bg-transparent p-0',
            // `grab` hors glisser, `grabbing` pendant.
            dragOffset ? 'cursor-grabbing' : 'cursor-grab',
            // `touch-none` empeche le navigateur de prendre le geste pour un
            // defilement sur mobile.
            'touch-none',
            // Au-dessus de la barre laterale (1200) pour que le logo ne passe
            // jamais derriere, mais sous les modales (1300) qui le recouvrent.
            'z-[1201]',
            // Le retour au bord est anime quand la bulle est FERMEE, instantane
            // quand elle est OUVERTE : sinon la bulle, qui suit l'orbe, courrait
            // apres l'animation et se desynchroniserait.
            dragOffset || open
              ? 'transition-none'
              : 'transition-[top,right,bottom,left,transform] duration-[280ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none',
          )}
          style={{
            ...positionToStyle(fabPosition),
            width: FAB_SIZE,
            height: FAB_SIZE,
            transform: dragOffset ? `translate(${dragOffset.dx}px, ${dragOffset.dy}px)` : 'none',
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
              bouton) pour ne pas entrer en conflit avec le translate du drag.
              Easing legerement elastique (overshoot) pour un "pop". */}
          <div
            className={cn(
              'flex transition-transform duration-[260ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none',
              open ? 'scale-[0.62]' : 'scale-100',
            )}
          >
            <BaitlyMarkLogo
              variant="mark"
              size={72}
              idleAnimation={false}
              active
            />
          </div>
        </button>
        </TooltipTrigger>
        {/* Pas d'infobulle pendant le glisser : elle suivrait le curseur au
            milieu du geste. */}
        {!dragOffset && <TooltipContent side="left">Assistant</TooltipContent>}
      </Tooltip>

      {/* ── Bulle ancree au logo (FAB) ─────────────────────────────────
          Remplace l'ancien Drawer pleine hauteur : une bulle ancree au FAB,
          place TOUJOURS sur le COTE du logo (logo a droite -> bulle a sa gauche
          = bord droit de l'ecran ; logo a gauche -> a sa droite), aligne en haut
          ou en bas selon la moitie, et colle tout pres de l'orbe (offset negatif).
          flip desactive pour rester coherent ; preventOverflow garde la bulle a
          l'ecran. */}
      {open && view === 'bubble' && (
        <div
          ref={bubbleRef}
          className={cn(
            'fixed z-[1300] flex flex-col overflow-hidden',
            'w-[calc(100vw-32px)] min-[600px]:w-[400px] max-w-[calc(100vw-32px)]',
            'h-[calc(100dvh-160px)] min-[600px]:h-[min(70vh,600px)] max-h-[calc(100dvh-32px)]',
            'rounded-[22px] border-[0.5px] border-solid border-[color-mix(in_srgb,var(--ink)_8%,transparent)]',
            'bg-[var(--bg)]',
            'shadow-[0_20px_50px_-12px_color-mix(in_srgb,var(--mui-primary)_42%,transparent),0_6px_16px_-6px_color-mix(in_srgb,var(--mui-primary)_22%,transparent)]',
            // Remplace la transition `Grow` : meme duree, meme point d'origine
            // — la bulle « sort » du coin qui fait face au logo.
            'animate-in fade-in zoom-in-95 duration-[220ms] motion-reduce:animate-none',
          )}
          style={{ ...bubbleBox, transformOrigin: growOrigin }}
        >
        {/* Header — L2 panel teinte, pas de border-bottom (le contraste bg-vs-flux
            de messages cree la separation visuelle) */}
        <div className="flex items-center gap-1.5 px-3 py-[7.5px] shrink-0 bg-[color-mix(in_srgb,var(--ink)_2.5%,transparent)]">
          <div className="w-[28px] h-[28px] flex items-center justify-center">
            {/* Header du drawer : pas de bg circulaire (le mark se suffit
                a lui-meme). active={isWorking} declenche l'animation
                hover-equivalent quand l'IA travaille. */}
            <BaitlyMarkLogo
              variant="mark"
              size={18}
              idleAnimation={false}
              active={isWorking}
            />
          </div>
          <div className="flex-1">
            <h6 className="cn-text-subtitle2 leading-[1.2] font-semibold">
              Assistant
            </h6>
            <span className="cn-text-caption text-muted-foreground leading-[1]">
              {messages.length === 0 ? 'Que veux-tu savoir ?' : `${messages.length} message${messages.length > 1 ? 's' : ''}`}
            </span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={handleExpand} aria-label="Agrandir en plein ecran">
                <FullscreenIcon size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Agrandir</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={handleClose} aria-label="Fermer">
                <CloseIcon size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fermer</TooltipContent>
          </Tooltip>
        </div>

        {/* Messages */}
        <MessageList
          messages={messages}
          emptyState={
            <div className="flex flex-col items-center justify-center gap-2 py-6 px-4 h-full text-center">
              <div className="w-[48px] h-[48px] rounded-[50%] flex items-center justify-center bg-[color-mix(in_srgb,var(--mui-primary)_10%,transparent)] text-[var(--mui-primary)]">
                {/* Empty state du drawer : pas d'active (pas de conversation
                    en cours), mais animation idle gardee pour le wow d'arrivee. */}
                <BaitlyMarkLogo variant="mark" size={26} />
              </div>
              <p className="cn-text-body2 font-semibold">
                Pose ta question
              </p>
              <span className="cn-text-caption text-muted-foreground max-w-[280px]">
                J&apos;utilise tes donnees Baitly en temps reel. Pour un historique
                complet, ouvre la page Assistant.
              </span>
              {/* Les puces de la projection — memes amorces que le dock. */}
              <div className="mt-1 flex flex-wrap justify-center gap-1.5">
                {[
                  'Analyse tes réservations',
                  'Quel est mon taux d’occupation ?',
                  'Prépare les arrivées de la semaine',
                ].map((phrase) => (
                  <Button
                    key={phrase}
                    size="xs"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => sendMessage(phrase)}
                  >
                    {phrase}
                  </Button>
                ))}
              </div>
            </div>
          }
        />

        {/* Error banner — bg solide, pas de border */}
        {error && (
          <div className="mx-[9px] mb-1.5 px-[9px] py-1.5 text-[0.8125rem] font-medium rounded-[16px] bg-[color-mix(in_srgb,var(--err)_10%,transparent)] text-[var(--err)]">
            {error}
          </div>
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
          <div className="flex justify-center py-[3px] shrink-0 bg-[color-mix(in_srgb,var(--ink)_2.5%,transparent)]">
            {/* color-mix(... 6%, transparent) est l'exact equivalent CSS de
                l'ancien alpha(primary.main, 0.06) : un survol ne peut pas
                vivre en style inline. */}
            <button
              onClick={reset}
              className="cn-text-caption bg-transparent border-none [font-family:inherit] text-[0.75rem] text-[var(--muted)] cursor-pointer py-[3px] px-[9px] rounded-[8px] hover:text-[var(--mui-primary)] hover:bg-[color-mix(in_srgb,var(--mui-primary)_6%,transparent)]"
            >
              Nouvelle conversation
            </button>
          </div>
        )}
        </div>
      )}

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
