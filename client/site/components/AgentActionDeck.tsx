import { useEffect, useState } from 'react';
import {
  BanknoteIcon,
  BotIcon,
  CalendarSyncIcon,
  CircleCheckIcon,
  ConciergeBellIcon,
  HandshakeIcon,
  KeyRoundIcon,
  MegaphoneIcon,
  MessageCircleIcon,
  MessageSquareQuoteIcon,
  ShieldCheckIcon,
  TrendingUpIcon,
  WrenchIcon,
  type LucideIcon,
} from 'lucide-react';
import { useReducedMotion } from './mockupKit';
import { useSiteLanguage } from '../lib/siteLanguage';
import { HOME_MESSAGES } from '../lib/messages/home';

/**
 * Pile de cartes d'actions d'agents, dans le visuel d'accueil.
 *
 * <p>Le hero montrait UNE note figee — « le prochain sejour se prepare » — et
 * n'en disait pas plus sur ce que la constellation fait d'une journee. Les
 * cartes defilent maintenant : chacune porte une action reelle du produit, et
 * la carte du dessus s'efface pour laisser monter la suivante.</p>
 *
 * <p>Chaque carte garde la forme de la note qu'elle remplace : le visuel du
 * hero est deja charge, un second dessin l'aurait encombre.</p>
 */

/** Une icone par carte, dans l'ordre du dictionnaire. */
const AGENT_ICONS: LucideIcon[] = [
  MessageCircleIcon,   // Communication
  TrendingUpIcon,      // Revenue
  WrenchIcon,          // Operations
  ShieldCheckIcon,     // Conformite
  CalendarSyncIcon,    // Synchronisation
  BanknoteIcon,        // Finance
  ConciergeBellIcon,   // Voyageur
  MessageSquareQuoteIcon, // Avis
  HandshakeIcon,       // Proprietaire
  MegaphoneIcon,       // Croissance
  KeyRoundIcon,        // Objets connectes
];

/** Temps de lecture d'une carte : deux lignes courtes, sans se sentir presse. */
const INTERVAL_MS = 4200;
const LEAVE_MS = 460;

export default function AgentActionDeck() {
  const { language } = useSiteLanguage();
  const m = HOME_MESSAGES[language].hero;
  const cards = m.agentDeck;
  const reduced = useReducedMotion();
  const [top, setTop] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const timer = window.setInterval(() => {
      setLeaving(true);
      window.setTimeout(() => {
        setTop((current) => (current + 1) % cards.length);
        setLeaving(false);
      }, LEAVE_MS);
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [reduced, cards.length]);

  return (
    <div className="baitly-agent-deck">
      {cards.map((card, index) => {
        /* Position dans la pile : 0 = dessus. Au-dela de deux cartes, plus
           rien n'est visible — les rendre couterait sans se voir. */
        const depth = (index - top + cards.length) % cards.length;
        if (depth > 2) return null;
        const isTop = depth === 0;
        const Icon = AGENT_ICONS[index] ?? BotIcon;
        return (
          <article
            key={card.title}
            className="baitly-agent-deck-card"
            aria-hidden={!isTop}
            style={{
              zIndex: 10 - depth,
              transform: `translateY(${depth * -10}px) scale(${1 - depth * 0.04})`,
              opacity: isTop && leaving ? 0 : 1 - depth * 0.35,
              transition: `transform ${LEAVE_MS}ms cubic-bezier(.22,1,.36,1), opacity ${LEAVE_MS}ms ease-out`,
            }}
          >
            <span className="baitly-note-icon">
              <Icon />
            </span>
            <div>
              <span className="baitly-note-label">
                {m.noteLabel} · {card.agent}
              </span>
              <strong>{card.title}</strong>
              <p>{card.detail}</p>
            </div>
            <CircleCheckIcon className="baitly-note-check" />
          </article>
        );
      })}

    </div>
  );
}
