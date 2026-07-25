import { useEffect, useState } from 'react';
import {
  BanknoteIcon,
  BotIcon,
  CalendarCheckIcon,
  LandmarkIcon,
  ShieldCheckIcon,
  type LucideIcon,
} from 'lucide-react';
import { useReducedMotion } from './mockupKit';

/**
 * Jeu de cartes empilées présentant ce que le PMS sait faire, et ce qu'il fait
 * mieux que le marché. La carte du dessus part sur le côté et repasse en
 * dernière position — les suivantes remontent d'un cran.
 *
 * Chaque carte porte une capacité RÉELLE du produit (rien de prospectif) :
 * les points « mieux que le marché » sont ceux où les PMS internationaux sont
 * effectivement absents au Maroc.
 */

interface Advantage {
  icon: LucideIcon;
  tag: string;
  title: string;
  copy: string;
  edge?: string;
}

const CARDS: Advantage[] = [
  {
    icon: ShieldCheckIcon,
    tag: 'Anti-surbooking',
    title: 'Le double booking est refusé avant d’exister.',
    copy: 'Chaque déplacement ou étirement de séjour est vérifié en direct contre les autres réservations et les ménages liés.',
    edge: 'Refus au geste, pas après coup',
  },
  {
    icon: LandmarkIcon,
    tag: 'Conformité Maroc',
    title: 'Fiche police et taxe de séjour intégrées.',
    copy: 'Déclaration DGSN, taxe par commune et facturation conforme sont dans le produit, pas dans un tableur à côté.',
    edge: 'Absent des PMS internationaux',
  },
  {
    icon: BanknoteIcon,
    tag: 'Encaissement local',
    title: 'CMI, PayZone, YouCan Pay — et Stripe.',
    copy: 'Vous encaissez en dirhams avec les moyens de paiement que vos voyageurs utilisent réellement.',
    edge: 'Là où Stripe seul ne suffit pas',
  },
  {
    icon: CalendarCheckIcon,
    tag: 'Multi-canal',
    title: 'Airbnb, Booking, Expedia, Agoda sur une grille.',
    copy: 'Connecteurs directs et Channex en repli : disponibilités, tarifs et restrictions poussés en continu.',
  },
  {
    icon: BotIcon,
    tag: 'Agents IA',
    title: 'Ils proposent, vous validez, ils exécutent.',
    copy: 'Prix, séjours, ménage et canaux surveillés en continu — chaque décision est expliquée et traçable.',
    edge: 'Validation humaine par défaut',
  },
];

/** Temps d'affichage d'une carte : assez long pour lire les trois lignes de
    corps sans se sentir pressé (~2 s de lecture + une pause). */
const INTERVAL_MS = 8000;

export default function AdvantageDeck() {
  const reduced = useReducedMotion();
  const [top, setTop] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const timer = window.setInterval(() => {
      setLeaving(true);
      window.setTimeout(() => {
        setTop((current) => (current + 1) % CARDS.length);
        setLeaving(false);
      }, 420);
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [reduced]);

  return (
    <div className="relative mx-auto h-[326px] w-full max-w-md">
      {CARDS.map((card, index) => {
        /* Position dans la pile : 0 = dessus. */
        const depth = (index - top + CARDS.length) % CARDS.length;
        if (depth > 2) return null;
        const isTop = depth === 0;
        return (
          <article
            key={card.title}
            className="absolute inset-x-0 top-0 rounded-2xl border border-border bg-card p-6"
            style={{
              zIndex: 10 - depth,
              transform: `translateY(${depth * 14}px) scale(${1 - depth * 0.04}) ${
                isTop && leaving ? 'translateX(-18px) rotate(-3deg)' : ''
              }`,
              opacity: isTop && leaving ? 0 : 1 - depth * 0.15,
              boxShadow:
                depth === 0
                  ? '0 18px 40px -20px color-mix(in srgb, var(--bui-primary) 40%, transparent)'
                  : 'none',
              transition: 'transform .42s cubic-bezier(.22,1,.36,1), opacity .42s ease-out',
            }}
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <card.icon className="size-4" />
            </span>
            <p className="mt-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {card.tag}
            </p>
            <h3 className="mt-1 text-lg leading-snug font-semibold tracking-tight">{card.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{card.copy}</p>
            {card.edge && (
              <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-success">
                <ShieldCheckIcon className="size-3.5" /> {card.edge}
              </p>
            )}
          </article>
        );
      })}

      {/* Indicateur de position dans la pile */}
      <div className="absolute -bottom-6 left-0 flex gap-1.5">
        {CARDS.map((card, index) => (
          <span
            key={card.title}
            className="h-1 rounded-full transition-all duration-300"
            style={{
              width: index === top ? 18 : 6,
              background: index === top ? 'var(--bui-primary)' : 'var(--bui-border)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
