import React, { useState, useCallback, useEffect } from 'react';
// Restent MUI, faute d'equivalent dans le kit : Grow (transition d'entree),
// ClickAwayListener (fermeture au clic exterieur), et le Box de la phrase, dont
// le `sx` DECLARE les keyframes `dockPhraseIn` consommees par le <p> interne.
// `useTheme`/`alpha` restent pour le meme motif (zIndex du theme, `error.dark`
// qui n'a pas de jeton CSS equivalent).
import { Box, Grow, ClickAwayListener, useTheme, alpha } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from './ui';
import { cn } from '../utils/cn';
import { Close as CloseIcon, Fullscreen as FullscreenIcon, ChevronUp } from '../icons';
import BaitlyMarkLogo from './BaitlyMarkLogo';
import { useAgent } from '../hooks/useAgent';
import { MessageList } from '../modules/assistant/components/MessageList';
import { ChatInput } from '../modules/assistant/components/ChatInput';
import { ToolConfirmationDialog } from '../modules/assistant/components/ToolConfirmationDialog';
import AssistantExpandedDialog from '../modules/assistant/components/AssistantExpandedDialog';

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

  return (
    <>
      <ClickAwayListener
        onClickAway={() => {
          if (open) handleClose();
        }}
      >
        {/* Conteneur fixe bas-droite : panneau (deploye) au-dessus, encoche
            en dessous, tous deux alignes sur le meme bord DROIT de l'ecran
            (l'encoche est un onglet qui depasse du bord, pas un flottant).
            `pointer-events-none` : le conteneur ne doit pas bloquer les clics a
            cote du panneau ; ses enfants les reprennent.
            Le z-index vient du theme (valeur runtime) : il reste en style. */}
        <div
          className="fixed bottom-0 right-0 flex flex-col items-end pointer-events-none [&>*]:pointer-events-auto"
          style={{ zIndex: open ? theme.zIndex.modal : theme.zIndex.drawer + 1 }}
        >
          {/* ── Panneau de discussion (deploye au-dessus de l'encoche) ────
              Colle DIRECTEMENT sur l'encoche (pas d'espace, pas de radius bas,
              pas de bordure basse) : panneau + encoche forment une seule carte
              continue docquee au bord de l'ecran. L'encoche s'elargit a la
              largeur du panneau a l'ouverture (transition width ci-dessous).

              Le panneau : mobile plein ecran (l'encoche est masquee, la fermeture
              se fait via le bouton X du header) ; desktop docke au bord droit, ou
              seul le coin haut-GAUCHE est arrondi. Ruptures ecrites en pixels :
              le `sm` MUI vaut 600px, pas les 640px de Tailwind.
              Largeur du panneau ecrite en dur (400px) : une classe Tailwind ne
              peut pas naitre d'une constante JS. */}
          <Grow
            in={open && view === 'panel'}
            mountOnEnter
            unmountOnExit
            timeout={220}
            style={{ transformOrigin: 'bottom center' }}
          >
            <div
              className={cn(
                'w-screen max-w-[100vw] h-[100dvh] max-h-[100dvh] flex flex-col overflow-hidden bg-[var(--bg)]',
                'shadow-[0_20px_50px_-12px_color-mix(in_srgb,var(--mui-primary)_42%,transparent),0_6px_16px_-6px_color-mix(in_srgb,var(--mui-primary)_22%,transparent)]',
                'min-[600px]:w-[400px] min-[600px]:h-[min(70vh,600px)] min-[600px]:rounded-tl-[22px]',
                'min-[600px]:border-[0.5px] min-[600px]:border-solid min-[600px]:border-r-0 min-[600px]:border-b-0',
                'min-[600px]:border-[color-mix(in_srgb,var(--ink)_8%,transparent)]',
              )}
            >
              {/* Header — L2 panel teinte, meme grammaire que la bulle du FAB */}
              <div className="flex items-center gap-1.5 px-3 py-[7.5px] shrink-0" style={{ backgroundColor: alpha(theme.palette.text.primary, 0.025) }}>
                <div className="w-[28px] h-[28px] flex items-center justify-center">
                  <BaitlyMarkLogo variant="mark" size={18} idleAnimation={false} active={isWorking} />
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
                  {/* Le trigger enveloppe un <span> (element hote) : Radix y pose
                      sa ref d'ancrage, ce qu'un composant fonction React 18 ne
                      peut pas recevoir. */}
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button variant="ghost" size="icon-sm" onClick={handleExpand} aria-label="Agrandir en plein ecran">
                        <FullscreenIcon size={16} />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Agrandir</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button variant="ghost" size="icon-sm" onClick={handleClose} aria-label="Fermer">
                        <CloseIcon size={16} />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Fermer</TooltipContent>
                </Tooltip>
              </div>

              {/* Messages */}
              <MessageList
                messages={messages}
                emptyState={
                  <div className="flex flex-col items-center justify-center gap-2 py-6 px-4 h-full text-center">
                    <div className="w-[48px] h-[48px] rounded-[50%] flex items-center justify-center" style={{ backgroundColor: alpha(theme.palette.primary.main, 0.1), color: theme.palette.primary.main }}>
                      <BaitlyMarkLogo variant="mark" size={26} />
                    </div>
                    <p className="cn-text-body2 font-semibold">
                      Pose ta question
                    </p>
                    <span className="cn-text-caption text-muted-foreground max-w-[280px]">
                      J&apos;utilise tes donnees Baitly en temps reel.
                    </span>
                  </div>
                }
              />

              {/* Error banner */}
              {error && (
                <div className="mx-[9px] mb-1.5 px-[9px] py-1.5 text-[0.8125rem] font-medium rounded-[16px]" style={{ backgroundColor: alpha(theme.palette.error.main, 0.10), color: theme.palette.error.dark }}>
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

              {messages.length > 0 && (
                <div className="flex justify-center py-[3px] shrink-0" style={{ backgroundColor: alpha(theme.palette.text.primary, 0.025) }}>
                  {/* color-mix(... 6%, transparent) est l'exact equivalent CSS de
                      alpha(primary.main, 0.06) : un survol ne peut pas vivre en
                      style inline. */}
                  <button
                    onClick={reset}
                    className="cn-text-caption bg-transparent border-none [font-family:inherit] text-[0.75rem] text-[var(--muted)] cursor-pointer py-[3px] px-[9px] rounded-[8px] hover:text-[var(--mui-primary)] hover:bg-[color-mix(in_srgb,var(--mui-primary)_6%,transparent)]"
                  >
                    Nouvelle conversation
                  </button>
                </div>
              )}
            </div>
          </Grow>

          {/* ── Encoche « classeur » collee au bord bas ───────────────────
              Fermee : onglet compact docke au bord droit, seul le coin haut-
              GAUCHE arrondi, la base et le flanc droit se fondant dans les bords
              de l'ecran. Ouverte : elle s'elargit a la largeur du panneau, perd
              son arrondi et son ombre propre, et devient la barre de base du
              panneau (une seule carte, fond aligne sur le sien, bordure haute
              faisant hairline). Mobile ouvert : l'encoche disparait, le panneau
              plein ecran a son propre bouton Fermer ; mobile ferme : logo seul.
              Au survol, fermee seulement : leger soulevement en `transform`
              (aucun layout shift). Largeurs en dur — 400px = largeur du panneau,
              248px = largeur de l'onglet : une classe Tailwind ne peut pas naitre
              d'une constante JS. Ruptures a 600px = le `sm` de MUI. Marges et
              arrondis restent PHYSIQUES, comme l'ancrage `right-0` du conteneur :
              l'encoche est un bord d'ecran, pas un flux de lecture. */}
          <button
            type="button"
            onClick={handleToggle}
            aria-expanded={open}
            aria-label={open ? 'Replier l’assistant' : 'Déplier l’assistant'}
            className={cn(
              'items-center justify-center min-[600px]:justify-start gap-1.5 h-[44px] max-w-[100vw]',
              'pl-0 pr-0 min-[600px]:pl-[9px] min-[600px]:pr-[7.5px]',
              'border-[0.5px] border-solid border-[color-mix(in_srgb,var(--ink)_8%,transparent)] border-r-0 border-b-0',
              'cursor-pointer [font-family:inherit] translate-y-0',
              '[transition:width_220ms_cubic-bezier(0.22,1,0.36,1),border-radius_220ms_ease-out,background-color_220ms_ease-out,transform_200ms_cubic-bezier(0.22,1,0.36,1),box-shadow_200ms_ease-out]',
              'motion-reduce:[transition:none]',
              'focus-visible:[outline:2px_solid_var(--mui-primary)] focus-visible:[outline-offset:-2px]',
              open
                ? cn(
                    'hidden min-[600px]:flex w-[400px] rounded-none bg-[var(--bg)]',
                    'shadow-[0_20px_50px_-12px_color-mix(in_srgb,var(--mui-primary)_42%,transparent)]',
                    'hover:bg-[color-mix(in_srgb,var(--ink)_2.5%,transparent)]',
                  )
                : cn(
                    'flex w-[52px] min-[600px]:w-[248px] rounded-tl-[14px] bg-[var(--card)]',
                    'shadow-[0_-6px_18px_-8px_color-mix(in_srgb,var(--mui-primary)_35%,transparent)]',
                    'hover:-translate-y-[3px] hover:shadow-[0_-10px_24px_-8px_color-mix(in_srgb,var(--mui-primary)_45%,transparent)]',
                  ),
            )}
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
              {/* Les keyframes dockPhraseIn restent declarees par le sx du Box
                  parent, qui n'est pas touche. */}
              <p
                key={open ? 'open' : phraseIndex}
                className="cn-text-body1 truncate text-[0.8125rem] font-medium text-[var(--muted)] animate-[dockPhraseIn_420ms_cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none"
              >
                {open ? 'Assistant Baitly' : DOCK_PHRASES[phraseIndex]}
              </p>
            </Box>

            {/* Chevron : pointe vers le haut (deplier), pivote a l'ouverture.
                Mobile : logo seul, pas de chevron. */}
            {/* Rupture ecrite en pixels : le `sm` MUI vaut 600px, pas les 640px de Tailwind. */}
            <div
              className={cn(
                'hidden text-[var(--muted)] transition-transform duration-[220ms]',
                'ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none min-[600px]:flex',
                open ? 'rotate-180' : 'rotate-0',
              )}
            >
              <ChevronUp size={16} />
            </div>
          </button>
        </div>
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
