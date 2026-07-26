import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  BanknoteIcon,
  CheckIcon,
  ImageIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  SendIcon,
  SlidersHorizontalIcon,
  XIcon,
} from 'lucide-react';
import { Badge, Progress, Separator } from '../../src/components/ui';
import { Cursor, useReducedMotion, useScriptedCursor, useTimeline } from './mockupKit';
import { cn } from '../../src/utils/cn';

/**
 * Pile de cartes HITL animées (design des cartes de la projection Constellation).
 * Chaque carte joue son scénario UNE fois (curseur scripté), puis passe derrière
 * la pile comme un jeu de cartes et la suivante s'anime. Le conteneur a une
 * hauteur FIXE : les cartes peuvent grandir (panneau d'ajustement) sans jamais
 * décaler le reste de la page. prefers-reduced-motion → pile statique.
 */

/* ─── Éléments visuels communs (tailles compactes) ─────────────────────────── */

function ActionButton({
  primary,
  clicked,
  children,
  refEl,
}: {
  primary?: boolean;
  clicked?: boolean;
  children: ReactNode;
  refEl?: React.Ref<HTMLSpanElement>;
}) {
  return (
    <span
      ref={refEl}
      className={cn(
        'relative flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-transform duration-150',
        primary ? 'bg-primary text-primary-foreground' : 'border border-border',
        clicked && 'scale-95',
      )}
    >
      {children}
      {clicked && <span className="absolute inset-0 animate-ping rounded-md bg-primary/30" />}
    </span>
  );
}

interface CardChromeProps {
  agent: string;
  tag: string;
  done: boolean;
  doneLabel?: string;
  title: string;
  children: ReactNode;
}

function CardChrome({ agent, tag, done, doneLabel = 'Validé', title, children }: CardChromeProps) {
  return (
    <div
      className={cn(
        'shadow-brand rounded-xl border bg-card p-4 transition-colors duration-300',
        done ? 'border-success/50' : 'border-warning/50',
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{agent}</Badge>
        <Badge variant="outline">{tag}</Badge>
        {done ? (
          <Badge variant="success" className="ms-auto">
            <CheckIcon /> {doneLabel}
          </Badge>
        ) : (
          <Badge variant="warning" className="ms-auto">
            En attente
          </Badge>
        )}
      </div>
      <h3 className="mt-2.5 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

/* ─── Carte 1 — Agent Revenue (ajustement de prix + validation) ────────────── */

const BASE_PRICE = 70;

function RevenueCard({ active, reduced, onDone }: { active: boolean; reduced: boolean; onDone: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const adjustRef = useRef<HTMLSpanElement>(null);
  const plusRef = useRef<HTMLSpanElement>(null);
  const applyRef = useRef<HTMLSpanElement>(null);
  const [phase, setPhase] = useState('idle');
  const [delta, setDelta] = useState(0);
  const { cursor, moveTo, park, hide } = useScriptedCursor(containerRef);

  useEffect(() => {
    if (!active) {
      setPhase('idle');
      setDelta(0);
      hide();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useTimeline(active && !reduced, (at) => {
    at(4400, park);
    at(5200, () => {
      setPhase('toAdjust');
      moveTo(adjustRef.current, -4, 1);
    });
    at(6050, () => setPhase('clickAdjust'));
    at(6300, () => setPhase('adjustOpen'));
    at(6750, () => moveTo(plusRef.current, 0, 1));
    at(7500, () => {
      setPhase('clickPlus1');
      setDelta(1);
    });
    at(7750, () => setPhase('adjustOpen'));
    at(8250, () => {
      setPhase('clickPlus2');
      setDelta(2);
    });
    at(8500, () => setPhase('adjustOpen'));
    at(9000, () => {
      setPhase('toApply');
      moveTo(applyRef.current, -6, 1);
    });
    at(9850, () => setPhase('clickApply'));
    at(10100, () => setPhase('applied'));
    at(15000, () => hide());
    at(15800, onDone);
  });

  const price = BASE_PRICE + delta;
  const revenue = 680 - delta * 34;
  const probability = 74 - delta * 2;
  const done = phase === 'applied' || reduced;
  const adjustVisible =
    !done && ['adjustOpen', 'clickPlus1', 'clickPlus2', 'toApply', 'clickApply'].includes(phase);

  return (
    <div className="relative" ref={containerRef}>
      <CardChrome agent="Agent Revenue" tag="Expire dans 22 h" done={done} title="Baisse tarifaire proposée — Riad Yasmine">
        <p className="mt-1 text-xs text-muted-foreground">
          9 nuits invendues du 18 au 27 août (block-aware). Proposition :{' '}
          <span className="font-semibold text-foreground">−12 %</span>, plancher respecté (68 €).
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-muted p-2.5 text-center">
          {[
            { label: 'Prix actuel', value: '80 €' },
            { label: 'Prix proposé', value: `${reduced ? BASE_PRICE + 2 : price} €`, accent: delta > 0 && !done },
            { label: 'Revenu estimé', value: `+${reduced ? 612 : revenue} €`, success: true },
          ].map((cell) => (
            <div key={cell.label}>
              <p className="text-[10px] text-muted-foreground">{cell.label}</p>
              <p
                className={cn(
                  'text-sm font-semibold tabular-nums',
                  cell.success && 'text-success',
                  cell.accent && 'text-primary-deep',
                )}
              >
                {cell.value}
              </p>
            </div>
          ))}
        </div>

        {/* Panneau d'ajustement : hauteur ANIMÉE à l'intérieur de la carte —
            le conteneur de la pile est à hauteur fixe, la page ne bouge pas. */}
        <div
          aria-hidden={!adjustVisible}
          className={cn(
            'grid transition-all duration-300',
            adjustVisible ? 'mt-2.5 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="overflow-hidden">
            <div className="flex h-8 items-center justify-between rounded-md border border-border px-2.5">
              <span className="text-[11px] text-muted-foreground">Ajuster le prix proposé</span>
              <span className="flex items-center gap-1">
                <span className="flex size-5 items-center justify-center rounded border border-border">
                  <MinusIcon className="size-3" />
                </span>
                <span className="w-10 text-center text-xs font-semibold tabular-nums">{price} €</span>
                <span
                  ref={plusRef}
                  className={cn(
                    'relative flex size-5 items-center justify-center rounded border border-border transition-transform duration-150',
                    (phase === 'clickPlus1' || phase === 'clickPlus2') && 'scale-90 border-primary',
                  )}
                >
                  <PlusIcon className="size-3" />
                  {(phase === 'clickPlus1' || phase === 'clickPlus2') && (
                    <span className="absolute inset-0 animate-ping rounded bg-primary/30" />
                  )}
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Probabilité de remplissage (élasticité)</span>
          <span className="text-xs font-semibold tabular-nums">{done ? 100 : probability} %</span>
        </div>
        <Progress value={done ? 100 : probability} className="mt-1" />

        <Separator className="my-3" />

        {done ? (
          <p className="flex h-7 items-center gap-1.5 truncate text-xs text-success">
            <CheckIcon className="size-3.5 shrink-0" />
            Validé à {reduced ? 72 : price} € — poussé vers Airbnb & Booking, audit à jour.
          </p>
        ) : (
          <div className="flex h-7 items-center gap-1.5">
            <ActionButton primary refEl={applyRef} clicked={phase === 'clickApply'}>
              <CheckIcon className="size-3" /> Appliquer
            </ActionButton>
            <ActionButton refEl={adjustRef} clicked={phase === 'clickAdjust'}>
              <SlidersHorizontalIcon className="size-3" /> Ajuster
            </ActionButton>
            <span className="ms-auto flex items-center gap-1 text-xs text-muted-foreground">
              <XIcon className="size-3" /> Refuser
            </span>
          </div>
        )}
      </CardChrome>
      {active && !reduced && <Cursor cursor={cursor} />}
    </div>
  );
}

/* ─── Carte 2 — Agent Séjours (relance panier abandonné) ───────────────────── */

function MessagingCard({ active, reduced, onDone }: { active: boolean; reduced: boolean; onDone: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sendRef = useRef<HTMLSpanElement>(null);
  const [phase, setPhase] = useState('idle');
  const { cursor, moveTo, park, hide } = useScriptedCursor(containerRef);

  useEffect(() => {
    if (!active) {
      setPhase('idle');
      hide();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useTimeline(active && !reduced, (at) => {
    at(4400, park);
    at(5300, () => moveTo(sendRef.current, -4, 1));
    at(6200, () => setPhase('clickSend'));
    at(6450, () => setPhase('sent'));
    at(11200, () => hide());
    at(12000, onDone);
  });

  const done = phase === 'sent' || reduced;

  return (
    <div className="relative" ref={containerRef}>
      <CardChrome agent="Agent Séjours" tag="Relance S1" done={done} doneLabel="Envoyé" title="Relance panier abandonné — Karim El Fassi">
        <p className="mt-1 text-xs text-muted-foreground">
          Panier de 2 nuits (Duplex Guéliz, 940 €) abandonné il y a 26 h. Message proposé :
        </p>
        <p className="mt-2.5 rounded-lg border-s-2 border-border bg-muted p-2.5 text-xs italic">
          « Bonjour Karim, votre séjour du 14 au 16 août au Duplex Guéliz est toujours disponible.
          Réservez avant ce soir et profitez du petit-déjeuner offert. »
        </p>
        <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Canal : WhatsApp · langue détectée : FR</span>
          <span className="tabular-nums">Conversion relances : 31 %</span>
        </div>

        <Separator className="my-3" />

        {done ? (
          <p className="flex h-7 items-center gap-1.5 truncate text-xs text-success">
            <CheckIcon className="size-3.5 shrink-0" />
            Envoyé sur WhatsApp — relance de suivi programmée demain 19 h.
          </p>
        ) : (
          <div className="flex h-7 items-center gap-1.5">
            <ActionButton primary refEl={sendRef} clicked={phase === 'clickSend'}>
              <SendIcon className="size-3" /> Envoyer
            </ActionButton>
            <ActionButton>
              <PencilIcon className="size-3" /> Modifier
            </ActionButton>
            <span className="ms-auto flex items-center gap-1 text-xs text-muted-foreground">
              <XIcon className="size-3" /> Ignorer
            </span>
          </div>
        )}
      </CardChrome>
      {active && !reduced && <Cursor cursor={cursor} />}
    </div>
  );
}

/* ─── Carte 3 — Agent Opérations (payout ménage gaté preuve photo) ─────────── */

function OpsCard({ active, reduced, onDone }: { active: boolean; reduced: boolean; onDone: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const payRef = useRef<HTMLSpanElement>(null);
  const [phase, setPhase] = useState('idle');
  const { cursor, moveTo, park, hide } = useScriptedCursor(containerRef);

  useEffect(() => {
    if (!active) {
      setPhase('idle');
      hide();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useTimeline(active && !reduced, (at) => {
    at(4400, park);
    at(5300, () => moveTo(payRef.current, -4, 1));
    at(6200, () => setPhase('clickPay'));
    at(6450, () => setPhase('paid'));
    at(11200, () => hide());
    at(12000, onDone);
  });

  const done = phase === 'paid' || reduced;

  return (
    <div className="relative" ref={containerRef}>
      <CardChrome agent="Agent Opérations" tag="Preuve photo" done={done} doneLabel="Débloqué" title="Payout ménage à débloquer — Villa Palmeraie">
        <p className="mt-1 text-xs text-muted-foreground">
          Mission terminée à 14 h 20 par Fatima — checklist complète, 8 photos de preuve reçues.
        </p>
        <div className="mt-2.5 flex items-center gap-1.5">
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className="flex size-9 items-center justify-center rounded-md border border-border bg-muted"
            >
              <ImageIcon className="size-3.5 text-muted-foreground" />
            </span>
          ))}
          <span className="text-[11px] text-muted-foreground">+4</span>
          <Badge variant="success" className="ms-auto">
            Checklist 12/12
          </Badge>
        </div>

        <Separator className="my-3" />

        {done ? (
          <p className="flex h-7 items-center gap-1.5 truncate text-xs text-success">
            <CheckIcon className="size-3.5 shrink-0" />
            Payout de 45 € débloqué — versé à Fatima vendredi.
          </p>
        ) : (
          <div className="flex h-7 items-center gap-1.5">
            <ActionButton primary refEl={payRef} clicked={phase === 'clickPay'}>
              <BanknoteIcon className="size-3" /> Débloquer 45 €
            </ActionButton>
            <ActionButton>
              <ImageIcon className="size-3" /> Voir les photos
            </ActionButton>
            <span className="ms-auto flex items-center gap-1 text-xs text-muted-foreground">
              <XIcon className="size-3" /> Signaler
            </span>
          </div>
        )}
      </CardChrome>
      {active && !reduced && <Cursor cursor={cursor} />}
    </div>
  );
}

/* ─── La pile ──────────────────────────────────────────────────────────────── */

const CARDS = [RevenueCard, MessagingCard, OpsCard];

export default function AnimatedHitlMockup() {
  const reduced = useReducedMotion();
  const [order, setOrder] = useState([0, 1, 2]);

  const rotate = () => setOrder(([front, ...rest]) => [...rest, front]);

  return (
    <div className="relative">
      <div className="hero-grid absolute -inset-8 -z-10" aria-hidden />
      {/* Hauteur FIXE : les cartes vivent en absolu à l'intérieur — leurs
          animations (panneau d'ajustement, rotation de pile) ne décalent
          jamais le reste de la page. */}
      <div className="relative h-[360px]">
        {CARDS.map((Card, index) => {
          const position = order.indexOf(index);
          return (
            <div
              key={index}
              className="absolute inset-x-0 top-0"
              style={{
                zIndex: 30 - position,
                transform: `translateY(${position * 12}px) scale(${1 - position * 0.045})`,
                opacity: position > 2 ? 0 : 1 - position * 0.12,
                transition: 'transform 600ms cubic-bezier(0.22, 1, 0.36, 1), opacity 400ms ease-out',
                transformOrigin: 'top center',
              }}
            >
              <Card active={position === 0} reduced={reduced} onDone={rotate} />
            </div>
          );
        })}
      </div>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <PencilIcon className="size-3" />
        Vous ajustez, vous approuvez — les agents exécutent et journalisent.
      </p>
    </div>
  );
}
