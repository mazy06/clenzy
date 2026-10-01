import { useEffect, useState } from 'react';
import { SiteMoneyText } from './SiteMoney';
import { CircleCheckIcon } from 'lucide-react';
import { useReducedMotion } from './mockupKit';
import { useSiteLanguage } from '../lib/siteLanguage';
import { HOME_MESSAGES } from '../lib/messages/home';
import { SITE_ACTION_ARTWORK } from '../data/actionArtwork';

/**
 * Actions des agents dans le visuel d'accueil : une scène concrète par scénario.
 * Les images appartiennent au site et les cartes conservent leur rythme de lecture.
 */

/** Une scène par action, dans l'ordre commun aux trois dictionnaires de l'accueil. */
const AGENT_ARTWORK = [
  SITE_ACTION_ARTWORK.messageSent,
  SITE_ACTION_ARTWORK.pricingOptimization,
  SITE_ACTION_ARTWORK.cleaning,
  SITE_ACTION_ARTWORK.travelerForm,
  SITE_ACTION_ARTWORK.channelSync,
  SITE_ACTION_ARTWORK.paymentConfirmed,
  SITE_ACTION_ARTWORK.lateCheckout,
  SITE_ACTION_ARTWORK.reviews,
  SITE_ACTION_ARTWORK.ownerReport,
  SITE_ACTION_ARTWORK.reservation,
  SITE_ACTION_ARTWORK.accessCode,
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
            <img
              className="baitly-note-image"
              src={AGENT_ARTWORK[index]}
              alt=""
              width={64}
              height={64}
              decoding="async"
            />
            <div>
              <span className="baitly-note-label">
                {m.noteLabel} · {card.agent}
              </span>
              <strong>{card.title}</strong>
              <p>
                <SiteMoneyText>{card.detail}</SiteMoneyText>
              </p>
            </div>
            <CircleCheckIcon className="baitly-note-check" />
          </article>
        );
      })}
    </div>
  );
}
