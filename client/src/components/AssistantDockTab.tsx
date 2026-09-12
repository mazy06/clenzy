import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from './ui';
import { cn } from '../utils/cn';
import { Add as AddIcon, Close as CloseIcon, Fullscreen as FullscreenIcon } from '../icons';
import { useAgent } from '../hooks/useAgent';
import { useBriefingNotice } from '../hooks/useBriefingNotice';
import { useTranslation } from '../hooks/useTranslation';
import { AssistantSurface } from '../modules/assistant/components/AssistantSurface';
import { ToolConfirmationDialog } from '../modules/assistant/components/ToolConfirmationDialog';
import AssistantExpandedDialog from '../modules/assistant/components/AssistantExpandedDialog';
import { ASSISTANT_QUICK_REPLY_EVENT } from '../modules/assistant/widgets/WorkflowWidget';
import {
  ASSISTANT_OPEN_EVENT,
  ASSISTANT_TOGGLE_EVENT,
  type AssistantOpenDetail,
} from './command-center/assistantBridge';

// La constante du lien profond vit dans son PROPRE module : l'importer d'ici
// depuis le graphe d'entree annulait le lazy de ce composant (cf. le commentaire
// de assistantDeepLink.ts). Re-exportee pour les appelants deja lazy.
export { ASSISTANT_CONVERSATION_PARAM } from './assistantDeepLink';
import { ASSISTANT_CONVERSATION_PARAM } from './assistantDeepLink';

/**
 * Panneau de discussion de l'assistant, docke au bord droit de l'ecran.
 *
 * <p>Coquille mince : elle porte l'ancrage a l'ecran et l'etat ouvert/ferme, la
 * conversation elle-meme vivant dans {@link AssistantSurface}.</p>
 *
 * <p><b>Rien ne s'affiche tant que l'assistant est ferme.</b> Il portait avant
 * une « encoche » docquee en bas a droite : un onglet permanent qui flottait par
 * dessus chaque ecran, mangeait le coin ou les listes posent leur pagination, et
 * changeait de phrase toutes les quatre secondes. Le point d'entree est desormais
 * le logo Baitly de la barre laterale
 * ({@code SidebarAssistantLauncher}), qui propose au survol quelques questions
 * tirees au sort.</p>
 *
 * <p><b>Comportement</b> :</p>
 * <ul>
 *   <li>Le panneau s'ouvre sur bascule du logo, sur demande du centre de
 *       commande (⌘K), ou sur un lien profond de notification. Une amorce peut
 *       accompagner l'ouverture : elle part aussitot dans la conversation.</li>
 *   <li>Nouvelle bascule du logo, clic exterieur ou bouton Fermer : le panneau
 *       se replie et ne laisse rien derriere lui.</li>
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

  // Revue en attente : porte la pastille de l'encoche, et la conversation a
  // charger quand le panneau s'ouvre.
  const { notice, dismiss } = useBriefingNotice();
  // Le chargement automatique n'a lieu QU'UNE fois par montage : sans ce garde,
  // refermer puis rouvrir l'encoche rechargerait la revue par-dessus ce que
  // l'utilisateur vient d'ecrire.
  const autoLoadedRef = useRef(false);

  const handleClose = useCallback(() => {
    setOpen(false);
    setView('panel');
  }, []);
  const handleExpand = useCallback(() => setView('expanded'), []);
  const handleMinimize = useCallback(() => setView('panel'), []);

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

  // ─── Chargement automatique de la revue ────────────────────────────────
  // A l'ouverture du panneau, si une revue attend et qu'aucune conversation
  // n'est en cours, on l'ouvre directement — la pastille disait qu'il y avait
  // quelque chose a lire, on evite de le faire chercher. Rien ne se deploie
  // tout seul : l'utilisateur garde l'initiative de l'ouverture.
  //
  // Le lien profond l'emporte : quand l'URL designe une conversation, c'est
  // elle qu'on veut, pas la derniere revue.
  useEffect(() => {
    if (!open || autoLoadedRef.current) return;
    if (new URLSearchParams(location.search).has(ASSISTANT_CONVERSATION_PARAM)) return;
    const target = notice?.conversationId;
    if (!target || conversationId) return;
    autoLoadedRef.current = true;
    void loadConversation(target);
    void dismiss();
  }, [open, location.search, notice, conversationId, loadConversation, dismiss]);

  // Ouverture demandee de l'exterieur : le centre de commande (⌘K → « Ouvrir
  // l'assistant ») et les amorces de la bulle du logo, qui joignent la question
  // a poser. L'etat ouvert/ferme vit ici : un evenement evite de le hisser dans
  // un contexte global pour deux appelants.
  useEffect(() => {
    const handler = (event: Event) => {
      setOpen(true);
      setView('panel');
      const detail = (event as CustomEvent<AssistantOpenDetail>).detail;
      const prompt = detail?.prompt;
      // `newConversation` est un drapeau d'ENVOI, pas un `reset()` prealable :
      // `sendMessage` capture `conversationId` dans sa fermeture, un reset juste
      // avant laisserait la question atterrir dans l'ancien fil.
      if (prompt && prompt.trim()) {
        void sendMessage(prompt, undefined, { newConversation: detail?.newConversation === true });
      }
    };
    window.addEventListener(ASSISTANT_OPEN_EVENT, handler);
    return () => window.removeEventListener(ASSISTANT_OPEN_EVENT, handler);
  }, [sendMessage]);

  // Bascule demandee par le logo de la barre laterale : c'est le point d'entree
  // unique de l'assistant, il doit aussi savoir le refermer.
  useEffect(() => {
    const handler = () => {
      setOpen((wasOpen) => !wasOpen);
      setView('panel');
    };
    window.addEventListener(ASSISTANT_TOGGLE_EVENT, handler);
    return () => window.removeEventListener(ASSISTANT_TOGGLE_EVENT, handler);
  }, []);

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
  //
  // Le logo de la barre laterale est exclu : il porte la bascule, et sans cette
  // exception il fermerait le panneau au `pointerdown` juste avant que son
  // propre `click` ne le rouvre — la fermeture par le logo n'aurait jamais eu
  // l'air de marcher.
  useEffect(() => {
    if (!open || view !== 'panel') return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest?.('[data-assistant-launcher]')) return;
      const node = dockRef.current;
      if (node && !node.contains(event.target as Node)) handleClose();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open, view, handleClose]);

  return (
    <>
      {/* Conteneur fixe bas-droite, monte UNIQUEMENT panneau ouvert : ferme,
          l'assistant ne laisse plus rien a l'ecran (le point d'entree est le
          logo de la barre laterale).
          `pointer-events-none` : le conteneur ne doit pas bloquer les clics a
          cote du panneau ; ses enfants les reprennent.
          z-index = la valeur `modal` du theme MUI par defaut, que ce projet ne
          surcharge pas (1300). Ecrit en litteral car une classe Tailwind ne peut
          pas naitre d'une variable.

          Demonte entierement en plein ecran : son z-index passait par dessus la
          modale, et le panneau docke restait visible par dessus la conversation
          agrandie. */}
      {open && view === 'panel' && (
      <div
        ref={dockRef}
        className="fixed bottom-0 right-0 z-[1300] flex flex-col items-end pointer-events-none [&>*]:pointer-events-auto"
      >
          {/* ── Panneau de discussion ─────────────────────────────────────
              Mobile plein ecran ; desktop docke au bord droit sur toute la
              hauteur, ou seul le coin haut-GAUCHE est arrondi. Ruptures ecrites
              en pixels : le `sm` MUI vaut 600px, pas les 640px de Tailwind.
              Largeur du panneau ecrite en dur (560px) : une classe Tailwind ne
              peut pas naitre d'une constante JS. 560 et non 400 — en dessous,
              l'en-tete se serrait, les amorces s'empilaient une par ligne et les
              tableaux/graphiques rendus dans le fil n'avaient plus de place.
              Le Grow de MUI (mountOnEnter/unmountOnExit) devient un montage
              conditionnel + l'animation d'entree de tw-animate-css : meme fondu,
              meme mise a l'echelle depuis le bas, meme duree. Seule la
              transition de SORTIE disparait, le panneau se demontant aussitot. */}
            <div
              className={cn(
                'w-screen max-w-[100vw] h-[100dvh] max-h-[100dvh] flex flex-col overflow-hidden bg-background',
                'shadow-[0_20px_50px_-12px_color-mix(in_srgb,var(--bui-primary)_28%,transparent)]',
                'min-[600px]:w-[560px] min-[600px]:rounded-tl-[22px]',
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
