import { SiteAgentPortrait, SiteDemoStatus } from './SiteProductVisuals';
import { SITE_ACTION_ARTWORK } from '../data/actionArtwork';
import type { AgentId } from '../../src/modules/supervision/types';
import SiteMoney, { SiteMoneyText } from './SiteMoney';
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
import {
  Cursor,
  useReducedMotion,
  useScriptedCursor,
  useTimeline,
} from './mockupKit';
import { cn } from '../../src/utils/cn';
import { useSiteLanguage } from '../lib/siteLanguage';
import { MOCKUP_MESSAGES } from '../lib/messages/mockups';

/** Raccourci : le bloc `hitl` de la langue courante. */
function useHitlText() {
  const { language } = useSiteLanguage();
  return MOCKUP_MESSAGES[language].hitl;
}

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
      {clicked && (
        <span className="absolute inset-0 animate-ping rounded-md bg-primary/30" />
      )}
    </span>
  );
}

interface CardChromeProps {
  agent: string;
  agentId: AgentId;
  artwork: string;
  tag: string;
  done: boolean;
  doneLabel?: string;
  title: string;
  children: ReactNode;
}

function CardChrome({
  agent,
  agentId,
  artwork,
  tag,
  done,
  doneLabel,
  title,
  children,
}: CardChromeProps) {
  const m = useHitlText();
  return (
    <div
      className={cn(
        'shadow-brand rounded-xl border bg-card p-4 transition-colors duration-300',
        done ? 'border-success/50' : 'border-primary/30',
      )}
    >
      <div className="site-hitl-agent">
        <SiteAgentPortrait agent={agentId} size={30} />
        <span>{agent} · {tag}</span>
        <SiteDemoStatus done={done} label={done ? (doneLabel ?? m.approved) : m.waiting} />
      </div>
      <div className="site-hitl-heading"><img src={artwork} alt="" width={52} height={52} /><h3>{title}</h3></div>
      {children}
    </div>
  );
}

/* ─── Carte 1 — Agent Revenue (ajustement de prix + validation) ────────────── */

function RevenueCard({
  active,
  reduced,
  onDone,
}: {
  active: boolean;
  reduced: boolean;
  onDone: () => void;
}) {
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

  const m = useHitlText();
  const t = m.revenue;
  const price = m.basePrice + delta;
  const revenue = m.baseRevenue - delta * 34;
  const probability = 74 - delta * 2;
  const done = phase === 'applied' || reduced;
  const adjustVisible =
    !done &&
    [
      'adjustOpen',
      'clickPlus1',
      'clickPlus2',
      'toApply',
      'clickApply',
    ].includes(phase);

  return (
    <div className="relative" ref={containerRef}>
      <CardChrome agentId="rev" artwork={SITE_ACTION_ARTWORK.pricingOptimization} agent={t.agent} tag={t.tag} done={done} title={t.title}>
        <p className="mt-1 text-xs text-muted-foreground">
          {t.copyBefore}
          <span className="font-semibold text-foreground">{t.copyDelta}</span>
          {t.copyAfter} (
          <SiteMoney
            value={m.floorPrice}
            from={m.currency === '€' ? 'EUR' : 'SAR'}
          />
          ).
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-muted p-2.5 text-center">
          {[
            { label: t.currentLabel, value: `${m.basePrice} ${m.currency}` },
            {
              label: t.proposedLabel,
              value: `${reduced ? m.basePrice + 2 : price} ${m.currency}`,
              accent: delta > 0 && !done,
            },
            {
              label: t.revenueLabel,
              value: `+${reduced ? m.baseRevenue - 68 : revenue} ${m.currency}`,
              success: true,
            },
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
                <SiteMoneyText>{cell.value}</SiteMoneyText>
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
            adjustVisible
              ? 'mt-2.5 grid-rows-[1fr] opacity-100'
              : 'grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="overflow-hidden">
            <div className="flex h-8 items-center justify-between rounded-md border border-border px-2.5">
              <span className="text-[11px] text-muted-foreground">
                {t.adjustLabel}
              </span>
              <span className="flex items-center gap-1">
                <span className="flex size-5 items-center justify-center rounded border border-border">
                  <MinusIcon className="size-3" />
                </span>
                <span className="w-10 text-center text-xs font-semibold tabular-nums">
                  <SiteMoney
                    value={price}
                    from={m.currency === '€' ? 'EUR' : 'SAR'}
                  />
                </span>
                <span
                  ref={plusRef}
                  className={cn(
                    'relative flex size-5 items-center justify-center rounded border border-border transition-transform duration-150',
                    (phase === 'clickPlus1' || phase === 'clickPlus2') &&
                      'scale-90 border-primary',
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
          <span className="text-muted-foreground">{t.probabilityLabel}</span>
          <span className="text-xs font-semibold tabular-nums">
            {done ? 100 : probability} %
          </span>
        </div>
        <Progress value={done ? 100 : probability} className="mt-1" />

        <Separator className="my-3" />

        {done ? (
          <p className="flex h-7 items-center gap-1.5 truncate text-xs text-success">
            <CheckIcon className="size-3.5 shrink-0" />
            {t.doneBefore}
            <SiteMoney
              value={reduced ? m.basePrice - 8 : price}
              from={m.currency === '€' ? 'EUR' : 'SAR'}
            />
            {t.doneAfter}
          </p>
        ) : (
          <div className="flex h-7 items-center gap-1.5">
            <ActionButton
              primary
              refEl={applyRef}
              clicked={phase === 'clickApply'}
            >
              <CheckIcon className="size-3" /> {t.apply}
            </ActionButton>
            <ActionButton refEl={adjustRef} clicked={phase === 'clickAdjust'}>
              <SlidersHorizontalIcon className="size-3" /> {t.adjust}
            </ActionButton>
            <span className="ms-auto flex items-center gap-1 text-xs text-muted-foreground">
              <XIcon className="size-3" /> {t.refuse}
            </span>
          </div>
        )}
      </CardChrome>
      {active && !reduced && <Cursor cursor={cursor} />}
    </div>
  );
}

/* ─── Carte 2 — Agent Séjours (relance panier abandonné) ───────────────────── */

function MessagingCard({
  active,
  reduced,
  onDone,
}: {
  active: boolean;
  reduced: boolean;
  onDone: () => void;
}) {
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

  const m = useHitlText();
  const t = m.messaging;
  const done = phase === 'sent' || reduced;

  return (
    <div className="relative" ref={containerRef}>
      <CardChrome
        agentId="com" artwork={SITE_ACTION_ARTWORK.messageSent}
        agent={t.agent}
        tag={t.tag}
        done={done}
        doneLabel={t.doneLabel}
        title={t.title}
      >
        <p className="mt-1 text-xs text-muted-foreground">
          <SiteMoneyText>
            {t.copy.replace('{value}', m.cartValue)}
          </SiteMoneyText>
        </p>
        <p className="mt-2.5 rounded-lg border-s-2 border-border bg-muted p-2.5 text-xs italic">
          {t.quote}
        </p>
        <div className="mt-2.5 text-[11px] text-muted-foreground">
          <span>{t.channel}</span>
        </div>

        <Separator className="my-3" />

        {done ? (
          <p className="flex h-7 items-center gap-1.5 truncate text-xs text-success">
            <CheckIcon className="size-3.5 shrink-0" />
            {t.done}
          </p>
        ) : (
          <div className="flex h-7 items-center gap-1.5">
            <ActionButton
              primary
              refEl={sendRef}
              clicked={phase === 'clickSend'}
            >
              <SendIcon className="size-3" /> {t.send}
            </ActionButton>
            <ActionButton>
              <PencilIcon className="size-3" /> {t.edit}
            </ActionButton>
            <span className="ms-auto flex items-center gap-1 text-xs text-muted-foreground">
              <XIcon className="size-3" /> {t.dismiss}
            </span>
          </div>
        )}
      </CardChrome>
      {active && !reduced && <Cursor cursor={cursor} />}
    </div>
  );
}

/* ─── Carte 3 — Agent Opérations (payout ménage gaté preuve photo) ─────────── */

function OpsCard({
  active,
  reduced,
  onDone,
}: {
  active: boolean;
  reduced: boolean;
  onDone: () => void;
}) {
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

  const m = useHitlText();
  const t = m.ops;
  const done = phase === 'paid' || reduced;

  return (
    <div className="relative" ref={containerRef}>
      <CardChrome
        agentId="ops" artwork={SITE_ACTION_ARTWORK.cleaning}
        agent={t.agent}
        tag={t.tag}
        done={done}
        doneLabel={t.doneLabel}
        title={t.title}
      >
        <p className="mt-1 text-xs text-muted-foreground">{t.copy}</p>
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
            {t.checklist}
          </Badge>
        </div>

        <Separator className="my-3" />

        {done ? (
          <p className="flex h-7 items-center gap-1.5 truncate text-xs text-success">
            <CheckIcon className="size-3.5 shrink-0" />
            {t.doneBefore}
            <SiteMoney
              value={m.payout}
              from={m.currency === '€' ? 'EUR' : 'SAR'}
            />
            {t.doneAfter}
          </p>
        ) : (
          <div className="flex h-7 items-center gap-1.5">
            <ActionButton primary refEl={payRef} clicked={phase === 'clickPay'}>
              <BanknoteIcon className="size-3" /> {t.release}{' '}
              <SiteMoney
                value={m.payout}
                from={m.currency === '€' ? 'EUR' : 'SAR'}
              />
            </ActionButton>
            <ActionButton>
              <ImageIcon className="size-3" /> {t.seePhotos}
            </ActionButton>
            <span className="ms-auto flex items-center gap-1 text-xs text-muted-foreground">
              <XIcon className="size-3" /> {t.report}
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
  const m = useHitlText();
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
                transition:
                  'transform 600ms cubic-bezier(0.22, 1, 0.36, 1), opacity 400ms ease-out',
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
        {m.caption}
      </p>
    </div>
  );
}
