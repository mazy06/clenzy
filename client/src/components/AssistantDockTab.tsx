import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from './ui';
import { cn } from '../utils/cn';
import { Add as AddIcon, Close as CloseIcon, Fullscreen as FullscreenIcon, ChevronUp } from '../icons';
import BaitlyMarkLogo from './BaitlyMarkLogo';
import { useAgent } from '../hooks/useAgent';
import { useTranslation } from '../hooks/useTranslation';
import { AssistantSurface } from '../modules/assistant/components/AssistantSurface';
import { ASSISTANT_SUGGESTION_KEYS } from '../modules/assistant/components/AssistantSuggestions';
import { ToolConfirmationDialog } from '../modules/assistant/components/ToolConfirmationDialog';
import AssistantExpandedDialog from '../modules/assistant/components/AssistantExpandedDialog';
import { ASSISTANT_QUICK_REPLY_EVENT } from '../modules/assistant/widgets/WorkflowWidget';

const PHRASE_INTERVAL_MS = 4200;

/**
 * Paramètre d'URL qui ouvre l'assistant sur une conversation précise
 * (ex. {@code /dashboard?assistantConversation=42}).
 *
 * <p>C'est la cible du lien profond porté par les notifications et les emails
 * de briefing : la page dédiée `/assistant` n'existe plus, mais le CTA
 * « Ouvrir dans l'assistant » doit continuer à mener à la bonne conversation.
 * Le paramètre est retiré de l'URL une fois consommé, pour que le panneau ne se
 * rouvre pas à chaque retour en arrière.</p>
 */
export const ASSISTANT_CONVERSATION_PARAM = 'assistantConversation';

/**
 * Clés des phrases d'invitation qui défilent dans l'encoche fermée : l'invite
 * générique puis les amorces de l'état vide — ce qu'on lit en passant est
 * exactement ce qu'on peut lancer d'un clic une fois ouvert.
 */
const DOCK_PHRASE_KEYS = [
  'assistant.tagline',
  ...ASSISTANT_SUGGESTION_KEYS.map((key) => `assistant.suggestions.${key}`),
];

/**
 * Point d'entree unique de l'assistant — « encoche » docquee en bas a droite,
 * comme un onglet de classeur qui depasse du bord de l'ecran.
 *
 * <p>Coquille mince : elle porte l'ancrage a l'ecran et l'etat ouvert/ferme, la
 * conversation elle-meme vivant dans {@link AssistantSurface}.</p>
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
 *       {@link AssistantExpandedDialog} — meme {@code useAgent}, donc meme
 *       conversation, plus l'historique a droite.</li>
 * </ul>
 */
const AssistantDockTab: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // Ancre du « clic exterieur » : remplace le ClickAwayListener de MUI.
  const dockRef = useRef<HTMLDivElement>(null);
  // Panneau docke au-dessus de l'encoche, ou plein ecran (+ historique).
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

  // ─── Lien profond « ouvrir cette conversation » ─────────────────────────
  // Cible des notifications et emails de briefing. On ouvre le panneau, on
  // charge la conversation, puis on retire le parametre de l'URL : sans ce
  // nettoyage, un retour arriere ou un rechargement rouvrirait l'assistant.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get(ASSISTANT_CONVERSATION_PARAM);
    if (!raw) return;
    const id = Number(raw);
    params.delete(ASSISTANT_CONVERSATION_PARAM);
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true });
    if (!Number.isFinite(id) || id <= 0) return;
    setOpen(true);
    setView('panel');
    void loadConversation(id);
  }, [location.search, location.pathname, navigate, loadConversation]);

  // Reponses rapides emises par les widgets du fil (ex. les chips Oui/Non du
  // WorkflowWidget). L'ecouteur vivait dans la vue plein ecran ; il vit ici
  // depuis sa suppression, sans quoi ces chips seraient devenues inertes.
  useEffect(() => {
    const handler = (event: Event) => {
      const text = (event as CustomEvent<{ text?: string }>).detail?.text;
      if (text && text.trim()) void sendMessage(text);
    };
    window.addEventListener(ASSISTANT_QUICK_REPLY_EVENT, handler);
    return () => window.removeEventListener(ASSISTANT_QUICK_REPLY_EVENT, handler);
  }, [sendMessage]);

  // ─── Fermeture au clic exterieur ────────────────────────────────────────
  // `pointerdown` plutot que `click` : le panneau contient des elements qui se
  // demontent au clic, et `contains()` serait alors deja faux au moment ou le
  // `click` remonte.
  //
  // UNIQUEMENT en vue dockee. En plein ecran, la modale est portee hors de
  // `dockRef` : le moindre clic dans la conversation tombait « a l'exterieur »
  // et fermait tout l'assistant. Le plein ecran a ses propres sorties (Reduire,
  // Fermer, Echap, clic sur le voile), gerees par le gabarit de modale.
  useEffect(() => {
    if (!open || view !== 'panel') return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      const node = dockRef.current;
      if (node && !node.contains(event.target as Node)) handleClose();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open, view, handleClose]);

  // ─── Rotation des phrases de l'encoche ──────────────────────────────────
  const [phraseIndex, setPhraseIndex] = useState(0);
  useEffect(() => {
    // Panneau ouvert : l'encoche affiche un libelle fixe, pas besoin de cycler.
    if (open) return undefined;
    // prefers-reduced-motion : phrase statique, aucun defilement.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = window.setInterval(
      () => setPhraseIndex((i) => (i + 1) % DOCK_PHRASE_KEYS.length),
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
          litteraux car une classe Tailwind ne peut pas naitre d'une variable.

          Demonte entierement en plein ecran : son z-index (1300) passait par
          dessus la modale, et l'encoche « Assistant Baitly » restait collee en
          bas de l'ecran par dessus la conversation agrandie. La vue plein ecran
          porte ses propres commandes, l'encoche n'y a rien a faire. */}
      {view === 'panel' && (
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
              Largeur du panneau ecrite en dur (560px) : une classe Tailwind ne
              peut pas naitre d'une constante JS. 560 et non 400 — en dessous,
              l'en-tete se serrait, les amorces s'empilaient une par ligne et les
              tableaux/graphiques rendus dans le fil n'avaient plus de place.
              Le Grow de MUI (mountOnEnter/unmountOnExit) devient un montage
              conditionnel + l'animation d'entree de tw-animate-css : meme fondu,
              meme mise a l'echelle depuis le bas, meme duree. Seule la
              transition de SORTIE disparait, le panneau se demontant aussitot. */}
          {open && view === 'panel' && (
            <div
              className={cn(
                'w-screen max-w-[100vw] h-[100dvh] max-h-[100dvh] flex flex-col overflow-hidden bg-background',
                'shadow-[0_20px_50px_-12px_color-mix(in_srgb,var(--bui-primary)_28%,transparent)]',
                // Pleine hauteur de l'ecran MOINS l'encoche (44 px) sur laquelle
                // le panneau vient s'asseoir : les deux forment une colonne qui
                // occupe exactement le viewport, sans debordement ni vide.
                'min-[600px]:w-[560px] min-[600px]:h-[calc(100dvh-44px)] min-[600px]:rounded-tl-[22px]',
                'min-[600px]:border min-[600px]:border-e-0 min-[600px]:border-b-0 min-[600px]:border-border',
                'origin-bottom animate-in fade-in-0 zoom-in-75 duration-[220ms] motion-reduce:animate-none',
              )}
            >
              <AssistantSurface
                compact
                messages={messages}
                status={status}
                error={error}
                onSend={sendMessage}
                onAbort={abort}
                headerActions={
                  <>
                    {messages.length > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <Button variant="ghost" size="icon-sm" className="cursor-pointer" onClick={reset} aria-label={t('assistant.newConversation')}>
                              <AddIcon size={16} />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{t('assistant.newConversation')}</TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      {/* Le trigger enveloppe un <span> (element hote) : Radix y pose
                          sa ref d'ancrage, ce qu'un composant fonction React 18 ne
                          peut pas recevoir. */}
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button variant="ghost" size="icon-sm" className="cursor-pointer" onClick={handleExpand} aria-label={t('assistant.expand')}>
                            <FullscreenIcon size={16} />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{t('assistant.expand')}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button variant="ghost" size="icon-sm" className="cursor-pointer" onClick={handleClose} aria-label={t('assistant.close')}>
                            <CloseIcon size={16} />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{t('assistant.close')}</TooltipContent>
                    </Tooltip>
                  </>
                }
              />
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
              (aucun layout shift). Largeurs en dur — 560px = largeur du panneau,
              300px = largeur de l'onglet : une classe Tailwind ne peut pas naitre
              d'une constante JS. Ruptures a 600px = le `sm` de MUI. Marges et
              arrondis restent PHYSIQUES, comme l'ancrage `right-0` du conteneur :
              l'encoche est un bord d'ecran, pas un flux de lecture.

              Vocabulaire Baitly UI : surface `card` sur filet `border`, pastille
              d'icone `rounded-lg bg-primary-soft` (la meme que l'en-tete du
              panneau et l'avatar des messages), libelle `text-sm`, chevron
              `text-muted-foreground`. */}
          <button
            type="button"
            onClick={handleToggle}
            aria-expanded={open}
            aria-label={open ? t('assistant.closeDock') : t('assistant.openDock')}
            className={cn(
              'items-center justify-center min-[600px]:justify-start gap-2 h-[44px] max-w-[100vw]',
              'px-0 min-[600px]:ps-2.5 min-[600px]:pe-2',
              'border border-solid border-border border-r-0 border-b-0',
              'cursor-pointer [font-family:inherit] translate-y-0 bg-card',
              '[transition:width_220ms_cubic-bezier(0.22,1,0.36,1),border-radius_220ms_ease-out,background-color_220ms_ease-out,transform_200ms_cubic-bezier(0.22,1,0.36,1),box-shadow_200ms_ease-out]',
              'motion-reduce:[transition:none]',
              'focus-visible:[outline:2px_solid_var(--bui-primary)] focus-visible:[outline-offset:-2px]',
              open
                ? cn(
                    'hidden min-[600px]:flex w-[560px] rounded-none',
                    'shadow-[0_20px_50px_-12px_color-mix(in_srgb,var(--bui-primary)_28%,transparent)]',
                    'hover:bg-accent',
                  )
                : cn(
                    'flex w-[56px] min-[600px]:w-[300px] rounded-tl-xl',
                    'shadow-[0_-6px_18px_-8px_color-mix(in_srgb,var(--bui-primary)_24%,transparent)]',
                    'hover:bg-accent hover:-translate-y-[3px] hover:shadow-[0_-10px_24px_-8px_color-mix(in_srgb,var(--bui-primary)_32%,transparent)]',
                  ),
            )}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
              <BaitlyMarkLogo variant="mark" size={16} idleAnimation={!open} active={isWorking} />
            </span>

            {/* Phrase animee — flex:1 pour occuper la largeur disponible (fermee
                comme ouverte). key force le remontage → l'animation d'entree
                rejoue a chaque phrase. Mobile : logo seul, pas de phrase — le
                `sm` MUI vaut 600px. */}
            <div className="hidden min-[600px]:block flex-1 min-w-0 overflow-hidden text-start">
              {/* Les keyframes maison dockPhraseIn etaient declarees par le `sx`
                  du Box supprime : tw-animate-css rend exactement le meme
                  mouvement (fondu + montee de 6px sur 420 ms). */}
              <p
                key={open ? 'open' : phraseIndex}
                className="truncate text-sm font-medium text-foreground animate-in fade-in-0 slide-in-from-bottom-[6px] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none"
              >
                {open ? t('assistant.dockLabel') : t(DOCK_PHRASE_KEYS[phraseIndex])}
              </p>
            </div>

            {/* Chevron : pointe vers le haut (deplier), pivote a l'ouverture.
                Mobile : logo seul, pas de chevron. */}
            {/* Rupture ecrite en pixels : le `sm` MUI vaut 600px, pas les 640px de Tailwind. */}
            <div
              className={cn(
                'hidden text-muted-foreground transition-transform duration-[220ms]',
                'ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none min-[600px]:flex',
                open ? 'rotate-180' : 'rotate-0',
              )}
            >
              <ChevronUp size={16} />
            </div>
          </button>
      </div>
      )}

      {/* ── Vue plein ecran : meme surface + historique des conversations ── */}
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

      {/* Confirmation d'un outil d'ecriture */}
      <ToolConfirmationDialog
        pending={pendingConfirmation}
        onConfirm={() => confirmTool(true)}
        onCancel={() => confirmTool(false)}
      />
    </>
  );
};

export default AssistantDockTab;
