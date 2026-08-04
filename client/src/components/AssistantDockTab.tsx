import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  const location = useLocation();
  const [open, setOpen] = useState(false);
  // Ancre du « clic exterieur » : remplace le ClickAwayListener de MUI.
  const dockRef = useRef<HTMLDivElement>(null);
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

  // ─── Fermeture au clic exterieur ────────────────────────────────────────
  // `pointerdown` plutot que `click` : le panneau contient des elements qui se
  // demontent au clic, et `contains()` serait alors deja faux au moment ou le
  // `click` remonte.
  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      const node = dockRef.current;
      if (node && !node.contains(event.target as Node)) handleClose();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open, handleClose]);

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
      {/* Conteneur fixe bas-droite : panneau (deploye) au-dessus, encoche
          en dessous, tous deux alignes sur le meme bord DROIT de l'ecran
          (l'encoche est un onglet qui depasse du bord, pas un flottant).
          `pointer-events-none` : le conteneur ne doit pas bloquer les clics a
          cote du panneau ; ses enfants les reprennent.
          Les deux z-index sont les valeurs du theme MUI par defaut, que ce
          projet ne surcharge pas : modal = 1300, drawer + 1 = 1201. Ecrits en
          litteraux car une classe Tailwind ne peut pas naitre d'une variable. */}
      <div
        ref={dockRef}
        className={cn(
          'fixed bottom-0 right-0 flex flex-col items-end pointer-events-none [&>*]:pointer-events-auto',
          open ? 'z-[1300]' : 'z-[1201]',
        )}
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
              peut pas naitre d'une constante JS.
              Le Grow de MUI (mountOnEnter/unmountOnExit) devient un montage
              conditionnel + l'animation d'entree de tw-animate-css : meme fondu,
              meme mise a l'echelle depuis le bas, meme duree. Seule la
              transition de SORTIE disparait, le panneau se demontant aussitot. */}
          {open && view === 'panel' && (
            <div
              className={cn(
                'w-screen max-w-[100vw] h-[100dvh] max-h-[100dvh] flex flex-col overflow-hidden bg-[var(--bg)]',
                'shadow-[0_20px_50px_-12px_color-mix(in_srgb,var(--mui-primary)_42%,transparent),0_6px_16px_-6px_color-mix(in_srgb,var(--mui-primary)_22%,transparent)]',
                'min-[600px]:w-[400px] min-[600px]:h-[min(70vh,600px)] min-[600px]:rounded-tl-[22px]',
                'min-[600px]:border-[0.5px] min-[600px]:border-solid min-[600px]:border-r-0 min-[600px]:border-b-0',
                'min-[600px]:border-[color-mix(in_srgb,var(--ink)_8%,transparent)]',
                'origin-bottom animate-in fade-in-0 zoom-in-75 duration-[220ms] motion-reduce:animate-none',
              )}
            >
              {/* Header — L2 panel teinte, meme grammaire que la bulle du FAB */}
              <div className="flex items-center gap-1.5 px-3 py-[7.5px] shrink-0 bg-[color-mix(in_srgb,var(--ink)_2.5%,transparent)]">
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
                    <div className="w-[48px] h-[48px] rounded-[50%] flex items-center justify-center bg-[color-mix(in_srgb,var(--mui-primary)_10%,transparent)] text-[var(--mui-primary)]">
                      <BaitlyMarkLogo variant="mark" size={26} />
                    </div>
                    <p className="cn-text-body2 font-semibold">
                      Pose ta question
                    </p>
                    <span className="cn-text-caption text-muted-foreground max-w-[280px]">
                      J&apos;utilise tes donnees Baitly en temps reel.
                    </span>
                    {/* Les puces de la projection : les phrases que le bandeau
                        fait defiler deviennent cliquables et lancent la
                        conversation d'un geste. La premiere est l'invite du
                        bandeau, pas une question — on l'ecarte. */}
                    <div className="mt-1 flex flex-wrap justify-center gap-1.5">
                      {DOCK_PHRASES.slice(1).map((phrase) => (
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

              {/* Error banner — `error.dark` n'a pas de jeton dans la table de
                  correspondance, mais c'est exactement le role de
                  --bui-destructive-ink : la variante ASSOMBRIE de --err reservee
                  au texte, deja utilisee ainsi ailleurs (--bui-warning-ink). */}
              {error && (
                <div className="mx-[9px] mb-1.5 px-[9px] py-1.5 text-[0.8125rem] font-medium rounded-[16px] bg-[color-mix(in_srgb,var(--err)_10%,transparent)] text-[var(--bui-destructive-ink)]">
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
                <div className="flex justify-center py-[3px] shrink-0 bg-[color-mix(in_srgb,var(--ink)_2.5%,transparent)]">
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
          )}

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
                rejoue a chaque phrase. Mobile : logo seul, pas de phrase — le
                `sm` MUI vaut 600px. */}
            <div className="hidden min-[600px]:block flex-1 min-w-0 overflow-hidden text-left">
              {/* Les keyframes maison dockPhraseIn etaient declarees par le `sx`
                  du Box supprime : tw-animate-css rend exactement le meme
                  mouvement (fondu + montee de 6px sur 420 ms). */}
              <p
                key={open ? 'open' : phraseIndex}
                className="cn-text-body1 truncate text-[0.8125rem] font-medium text-[var(--muted)] animate-in fade-in-0 slide-in-from-bottom-[6px] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none"
              >
                {open ? 'Assistant Baitly' : DOCK_PHRASES[phraseIndex]}
              </p>
            </div>

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
