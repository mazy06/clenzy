import React, { useCallback, useEffect, useState } from 'react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from './ui';
import { cn } from '../utils/cn';
import {
  SIDEBAR_FLYOUT_ALIGN_OFFSET,
  SIDEBAR_FLYOUT_SEAM_OFFSET,
  SidebarFlyoutGroup,
  sidebarFlyoutClass,
} from './SidebarFlyout';
import BaitlyMarkLogo from './BaitlyMarkLogo';
import { NavCornerCountBadge } from './NavCountBadge';
import { Check } from '../icons';
import { useTranslation } from '../hooks/useTranslation';
import { useBriefingNotice } from '../hooks/useBriefingNotice';
import { ASSISTANT_SUGGESTION_POOL } from '../modules/assistant/components/AssistantSuggestions';
import { openAssistant, toggleAssistant } from './command-center/assistantBridge';

/** Temps de lecture d'une question avant que la suivante prenne sa place. */
const ROTATION_MS = 3800;

/**
 * Ordre de defile : le reservoir melange (Fisher-Yates).
 *
 * <p>Melanger PUIS parcourir, plutot que tirer au sort a chaque pas : un tirage
 * independant ramene la meme question deux fois de suite une fois sur quinze, et
 * cette repetition se lit comme un bug.</p>
 */
function shuffledPool(): string[] {
  const order = [...ASSISTANT_SUGGESTION_POOL];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

interface SidebarAssistantLauncherProps {
  /** Côté d'ouverture de la bulle : opposé au bord où la barre est ancrée. */
  side: 'left' | 'right';
}

/**
 * Le logo Baitly, en tête de la barre latérale, EST le point d'entrée de
 * l'assistant.
 *
 * <p>Il a remplacé l'encoche docquée en bas à droite : celle-ci flottait par
 * dessus le contenu de chaque écran, mangeait le coin où les listes posent leur
 * pagination, et se rappelait au souvenir toutes les quatre secondes en changeant
 * de phrase. L'assistant se demande, il ne s'impose pas.</p>
 *
 * <p><b>Deux gestes</b> : le clic bascule le panneau ; le survol (ou la prise de
 * focus clavier) déplie une bulle où l'assistant s'adresse à l'utilisateur et lui
 * propose <b>une seule</b> question à la fois, tirée de
 * {@link ASSISTANT_SUGGESTION_POOL}. Quatre d'un coup se lisaient comme un menu de
 * commandes ; une phrase unique se lit comme une parole. Les questions défilent
 * toutes les {@link ROTATION_MS} ms — c'est ce qui fait découvrir l'étendue du
 * produit sans transformer la bulle en catalogue.</p>
 *
 * <p><b>Le défilé s'arrête sous le curseur.</b> Sans cette pause, la question
 * changeait entre le moment où on la vise et celui où on clique : on en aurait
 * envoyé une autre que celle qu'on avait lue. Il est aussi désactivé sous
 * {@code prefers-reduced-motion}, où la bulle garde la question du tirage.</p>
 *
 * <p><b>Grammaire empruntée au fil de discussion</b>
 * ({@code AssistantMessage}) : la phrase de l'assistant en clair, puis la
 * question dans une bulle d'opérateur ({@code bg-primary-soft}, coin bas-fin
 * redressé). On voit donc littéralement le message qu'on s'apprête à envoyer,
 * et la pastille de validation dit qu'un clic l'envoie.</p>
 *
 * <p><b>La question validée ouvre un fil NEUF</b>
 * ({@code newConversation}) : elle lance un sujet, elle ne répond pas à la
 * discussion en cours — l'empiler à la suite d'un échange sans rapport aurait
 * brouillé le contexte des deux.</p>
 *
 * <p>La bulle n'est pas atteignable au clavier (contrat Radix du HoverCard),
 * mais rien n'y est exclusif : les mêmes amorces vivent dans la rangée du
 * panneau, elle, entièrement navigable.</p>
 */
const SidebarAssistantLauncher: React.FC<SidebarAssistantLauncherProps> = ({ side }) => {
  const { t } = useTranslation();
  const { isMobile } = useSidebar();
  const { notice } = useBriefingNotice();
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState<string[]>(shuffledPool);
  const [index, setIndex] = useState(0);
  // Le curseur est sur la question : elle ne doit plus bouger, on est en train
  // de la viser.
  const [held, setHeld] = useState(false);

  // Nouveau mélange à chaque ouverture : deux survols de suite ne doivent pas
  // rejouer la même séquence.
  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (next) {
      setOrder(shuffledPool());
      setIndex(0);
      setHeld(false);
    }
  }, []);

  useEffect(() => {
    if (!open || held) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % order.length),
      ROTATION_MS,
    );
    return () => window.clearInterval(id);
  }, [open, held, order.length]);

  const pick = order[index];

  return (
    <SidebarMenuItem>
      <HoverCard open={open} openDelay={200} closeDelay={140} onOpenChange={handleOpenChange}>
        {/* Le trigger enveloppe un <span> (élément HÔTE) et non directement le
            bouton : Radix pose sur son enfant la ref qui sert d'ancre à la
            bulle, et `SidebarMenuButton` est un composant fonction sans
            `forwardRef` — en React 18 la ref se perd en silence, Radix n'a plus
            d'ancre et la bulle ne s'ouvre jamais. Même contournement que les
            Tooltip du panneau d'assistant. `block w-full` : un span est inline,
            il aurait rétréci le bouton au lieu de le laisser pleine largeur. */}
        <HoverCardTrigger asChild>
          <span className="block w-full">
            <SidebarMenuButton
              size="lg"
              aria-label={
                notice
                  ? `${t('assistant.dockLabel')} — ${t('assistant.briefingWaiting', 'une revue vous attend')}`
                  : t('assistant.dockLabel')
              }
              // `data-assistant-launcher` : le panneau ferme au clic extérieur, et
              // sans cette marque il se refermerait sur le pointerdown avant que
              // le clic n'arrive ici — la bascule n'aurait jamais l'air de marcher.
              data-assistant-launcher=""
              onClick={toggleAssistant}
            >
              {/* ⚠️ `SidebarMenuButton` force TOUS ses SVG descendants à 16 px
                  (`[&_svg]:size-4`) : le `!` rétablit la taille voulue, réduite en
                  mode icônes où le bouton n'est plus qu'un carré de 32 px. */}
              <span className="relative flex size-10 shrink-0 items-center justify-center [&_svg]:size-10! group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:[&_svg]:size-8!">
                <BaitlyMarkLogo variant="mark" size={40} />
                {notice && <NavCornerCountBadge count={1} tone="primary" />}
              </span>
              <span className="grid flex-1 text-start leading-tight">
                <span className="truncate text-sm font-semibold">Baitly</span>
                {/* L'ancienne seconde ligne annonçait le produit (« Property
                    Management ») ; le bouton ne mène plus au tableau de bord mais
                    à l'assistant, elle annonce donc ce qu'il fait. */}
                <span className="truncate text-xs text-muted-foreground">
                  {t('assistant.tagline')}
                </span>
              </span>
            </SidebarMenuButton>
          </span>
        </HoverCardTrigger>

        {/* La bulle est un VOLET de la barre (cf. `SidebarFlyout`) : posée au
            ras de sa ligne, deux congés concaves emmenant cette ligne dans la
            bordure de la bulle. La parole sort du logo au lieu de flotter à côté
            de lui — et le coin redressé du côté de l'interlocuteur, grammaire des
            bulles du fil, devient ce raccord.

            Son contenu suit la même structure que le volet des préférences et
            que les rubriques de la barre : un groupe, son intitulé, sa liste.
            L'amorce de l'assistant EST cet intitulé — « Demande-moi, par
            exemple : » annonce ce que la rubrique contient, exactement comme
            « Administration » annonce les siennes. `gap-0 p-0` : le rythme vient
            du groupe, pas de la coquille.

            `alignOffset` : les congés débordent de la bulle. Alignée au ras du
            haut du bouton du logo — à 8 px du haut de l'écran — elle aurait vu
            celui du haut passer sous le bord de la fenêtre.

            En feuille latérale (< 1024 px) il n'y a pas de cloison à raccorder,
            et une bulle de 296 px ouverte sur le côté sortirait de l'écran : on
            garde alors la bulle flottante d'origine.

            `data-assistant-launcher` : la bulle est portalisée hors du panneau,
            un clic sur la question compterait sinon comme un clic extérieur et
            refermerait le panneau juste avant de le rouvrir. */}
        <HoverCardContent
          side={side}
          align="start"
          sideOffset={isMobile ? 10 : SIDEBAR_FLYOUT_SEAM_OFFSET}
          alignOffset={isMobile ? 0 : SIDEBAR_FLYOUT_ALIGN_OFFSET}
          data-assistant-launcher=""
          className={cn(
            'w-[18.5rem] gap-0 p-0',
            isMobile
              ? 'rounded-2xl rounded-ss-md p-1'
              : sidebarFlyoutClass,
          )}
        >
          {/* Pas d'avatar : le logo qui ouvre la bulle est juste à côté, le
              redoubler dans la bulle n'ajoutait qu'une redondance. */}
          <SidebarFlyoutGroup label={t('assistant.launcher.hint')}>
            {/* ── La question, dans une bulle d'opérateur ──────────────────────
                C'est le message qu'on s'apprête à envoyer : autant le montrer tel
                qu'il apparaîtra dans le fil. Le remontage à chaque question
                rejoue l'animation d'entrée — le défilé se lit comme une parole
                qui se pose, pas comme un texte qui se remplace.
                Survol : le défilé se fige, et un liseré de marque remplace le
                changement de fond (aucun décalage, la bulle garde sa teinte de
                locuteur). Hauteur MINIMALE réservée pour deux lignes : sans elle
                la bulle sautait d'une taille à l'autre au fil des questions.

                La pastille de validation vit DANS le bouton, pas à côté : la
                question défile, un second bouton aurait demandé de viser une
                cible de 24 px pendant qu'elle bouge. Toute la bulle valide ; la
                pastille dit simplement où l'on s'apprête à cliquer, et se remplit
                au survol pour le confirmer. */}
            <SidebarMenuItem className="flex min-h-[3.75rem] items-start justify-end">
              <button
                type="button"
                onPointerEnter={() => setHeld(true)}
                onPointerLeave={() => setHeld(false)}
                onFocus={() => setHeld(true)}
                onBlur={() => setHeld(false)}
                aria-label={`${t('assistant.launcher.ask')} : ${t(`assistant.suggestions.${pick}`)}`}
                onClick={() => openAssistant(t(`assistant.suggestions.${pick}`), { newConversation: true })}
                className="group/ask flex w-fit max-w-[92%] items-end gap-2 rounded-2xl rounded-ee-md border-0 bg-primary-soft px-3 py-2 text-start text-sm font-medium text-pretty text-foreground [font-family:inherit] ring-1 ring-transparent transition-[box-shadow] duration-200 ease-out hover:ring-primary/40 focus-visible:[outline:2px_solid_var(--bui-primary)] focus-visible:[outline-offset:2px] motion-reduce:transition-none"
              >
                {/* Le `key` vit sur le TEXTE, pas sur le bouton : `duration-*`
                    pilote à la fois `transition-duration` et la durée de
                    `animate-in`, les deux se seraient écrasées sur le même
                    élément. Ici le bouton garde ses 200 ms de liseré, la phrase
                    ses 420 ms d'entrée. */}
                <span
                  key={pick}
                  className="min-w-0 flex-1 animate-in fade-in-0 slide-in-from-bottom-1 duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none"
                >
                  {t(`assistant.suggestions.${pick}`)}
                </span>
                <span
                  aria-hidden
                  className="mb-px flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary transition-colors duration-200 ease-out group-hover/ask:bg-primary group-hover/ask:text-primary-foreground group-focus-visible/ask:bg-primary group-focus-visible/ask:text-primary-foreground motion-reduce:transition-none"
                >
                  <Check size={12} strokeWidth={3} />
                </span>
              </button>
            </SidebarMenuItem>
          </SidebarFlyoutGroup>
        </HoverCardContent>
      </HoverCard>
    </SidebarMenuItem>
  );
};

export default SidebarAssistantLauncher;
