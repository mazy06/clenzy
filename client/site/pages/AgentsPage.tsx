import SiteAcquisitionLink from '../components/SiteAcquisitionLink';
import type { ComponentType, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  BanknoteIcon,
  BotIcon,
  CheckIcon,
  ConciergeBellIcon,
  EyeIcon,
  HandshakeIcon,
  MegaphoneIcon,
  MessageCircleIcon,
  ScaleIcon,
  Share2Icon,
  ShieldCheckIcon,
  SparklesIcon,
  StarIcon,
  TrendingUpIcon,
  WrenchIcon,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Progress,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../src/components/ui';
import BaitlyMarkLogo from '../../src/components/BaitlyMarkLogo';
import { cn } from '../../src/utils/cn';
import AnimatedHitlMockup from '../components/AnimatedHitlMockup';
import AnimatedAssistantMockup from '../components/AnimatedAssistantMockup';
import { useSiteLanguage } from '../lib/siteLanguage';
import { AGENTS_MESSAGES, type AgentsMessages } from '../lib/messages/agents';
import { PRICING_MESSAGES, type PricingMessages } from '../lib/messages/pricing';
import { AGENT_IDS } from '../../src/modules/supervision/constants';

/** Icone par agent — le jeton `icon` du PMS rendu en lucide, cote landing. */
const AGENT_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  rev: TrendingUpIcon,
  com: MessageCircleIcon,
  ops: WrenchIcon,
  sync: Share2Icon,
  fin: BanknoteIcon,
  cmp: ShieldCheckIcon,
  gst: ConciergeBellIcon,
  rep: StarIcon,
  own: HandshakeIcon,
  gro: MegaphoneIcon,
};

/* ─── Hero ─────────────────────────────────────────────────────────────────── */

function Hero({ m }: { m: AgentsMessages }) {
  return (
    <section className="site-shell pt-16 pb-12">
      {/* Deux colonnes : discours à gauche, assistant en action à droite. */}
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <Badge variant="outline" className="mb-4">
            <SparklesIcon /> {m.hero.eyebrow}
          </Badge>
          <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            {m.hero.title}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            {m.hero.copyBefore}
            <span className="font-medium text-foreground">{m.hero.copyStrong}</span>
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button size="lg">
              {m.hero.ctaPrimary} <ArrowRightIcon />
            </Button>
            <Button size="lg" variant="outline">
              {m.hero.ctaSecondary}
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {m.hero.note}
          </p>
          {/* Chiffres clés sous le discours : colonne plus étroite que la pleine
              largeur d'origine → séparateurs verticaux plutôt que cartes. */}
          <div className="mt-9 grid grid-cols-3 gap-px border-t border-border bg-border pt-px">
            {[
              { value: String(AGENT_IDS.length), label: m.hero.metricAgentsLabel },
              { value: m.hero.metricBounded, label: m.hero.metricBoundedLabel },
              { value: m.hero.metricTraceable, label: m.hero.metricTraceableLabel },
            ].map((metric) => (
              <div key={metric.label} className="bg-background pt-5 pe-4">
                <p className="text-2xl font-semibold tracking-tight tabular-nums">{metric.value}</p>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>
        <AnimatedAssistantMockup />
      </div>
    </section>
  );
}

/* ─── Barre de confiance ───────────────────────────────────────────────────── */

function TrustBar({ m }: { m: AgentsMessages }) {
  return (
    <section className="border-y border-border bg-card">
      <div className="site-shell flex flex-wrap items-center justify-center gap-x-8 gap-y-2 py-4">
        {m.trust.map((item) => (
          <span key={item} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheckIcon className="size-3.5 text-success" /> {item}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ─── Les agents (nommés) ──────────────────────────────────────────────────── */

function AgentsSection({ m }: { m: AgentsMessages }) {
  return (
    <section className="site-shell py-16">
      <div className="mb-8 max-w-2xl">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {m.agentsTitle}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {m.agentsCopy}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {m.agents.map((agent) => {
          const Icon = AGENT_ICONS[agent.id] ?? BotIcon;
          return (
          <div
            key={agent.name}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Icon className="size-4.5" />
              </span>
              <span className="text-base font-semibold">{agent.name}</span>
              <Badge variant="secondary" className="ms-auto">
                {m.agentBadge}
              </Badge>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="font-medium text-muted-foreground">{m.watchesLabel}</dt>
              <dd className="text-foreground">{agent.watches}</dd>
              <dt className="font-medium text-muted-foreground">{m.proposesLabel}</dt>
              <dd className="text-foreground">{agent.proposes}</dd>
            </dl>
          </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── HITL : vous gardez la main ───────────────────────────────────────────── */

function HitlSection({ m }: { m: AgentsMessages }) {
  return (
    <section className="border-y border-border bg-card">
      <div className="site-shell grid grid-cols-1 items-center gap-10 py-16 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {m.hitl.title}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {m.hitl.copy}
          </p>
          <ul className="mt-6 flex flex-col gap-3">
            {m.hitl.points.map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                  <CheckIcon className="size-3" />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
        <AnimatedHitlMockup />
      </div>
    </section>
  );
}

/* ─── Capacités par onglets ────────────────────────────────────────────────── */

function CapabilitiesSection({ m }: { m: AgentsMessages }) {
  return (
    <section className="site-shell py-16">
      <h2 className="mb-8 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
        {m.capabilitiesTitle}
      </h2>
      <Tabs defaultValue="pricing">
        <TabsList>
          {m.tabs.map((panel) => (
            <TabsTrigger key={panel.key} value={panel.key}>
              {panel.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {m.tabs.map((panel) => (
          <TabsContent key={panel.key} value={panel.key}>
            <div className="mt-4 grid grid-cols-1 gap-6 rounded-xl border border-border bg-card p-6 lg:grid-cols-2">
              <div>
                <h3 className="text-lg font-semibold">{panel.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{panel.copy}</p>
              </div>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {panel.rows.map((row) => (
                  <li
                    key={row}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <CheckIcon className="size-3.5 shrink-0 text-success" /> {row}
                  </li>
                ))}
              </ul>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}

/* ─── Transparence (section sombre) ────────────────────────────────────────── */

function TransparencySection({ m }: { m: AgentsMessages }) {
  return (
    <section className="bg-foreground text-background">
      <div className="site-shell py-16">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <Badge variant="outline" className="mb-4 border-background/25 text-background">
              <EyeIcon /> {m.transparency.eyebrow}
            </Badge>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {m.transparency.title}
            </h2>
            <p className="mt-3 max-w-xl text-background/70">
              {m.transparency.copy}
            </p>
            <Button variant="outline" className="mt-6 border-background/30 text-background hover:bg-background/10">
              {m.transparency.cta} <ArrowRightIcon />
            </Button>
          </div>
          <div className="flex flex-col gap-3">
            {m.transparency.points.map((text, index) => {
              const Icon = [ScaleIcon, EyeIcon, BotIcon][index];
              return (
                <div key={text} className="flex items-start gap-3 rounded-xl border border-background/15 p-4">
                  <Icon className="mt-0.5 size-4.5 shrink-0 text-background/60" />
                  <p className="text-sm text-background/85">{text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Par taille de portefeuille ───────────────────────────────────────────── */

function SegmentsSection({ m }: { m: AgentsMessages }) {
  return (
    <section className="site-shell py-16">
      <h2 className="mb-8 text-2xl font-semibold tracking-tight sm:text-3xl">
        {m.segmentsTitle}
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {m.segments.map((segment) => (
          <div key={segment.range} className="rounded-xl border border-border bg-card p-5">
            <Badge variant="outline">{segment.range}</Badge>
            <h3 className="mt-3 text-base font-semibold">{segment.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{segment.copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Rappel pricing ───────────────────────────────────────────────────────── */

function PricingSection({ m, plans }: { m: AgentsMessages; plans: PricingMessages }) {
  return (
    <section className="border-y border-border bg-card">
      <div className="site-shell py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{m.pricingTitle}</h2>
            <p className="mt-2 text-muted-foreground">{m.pricingCopy}</p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/tarifs">
              {m.pricingCta} <ArrowRightIcon />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {plans.plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                'rounded-xl border p-5',
                plan.featured ? 'border-primary bg-primary-soft' : 'border-border bg-background',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{plan.name}</span>
                {plan.featured && <Badge>{plans.recommended}</Badge>}
              </div>
              <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">
                {plan.price}
                <span className="text-sm font-normal text-muted-foreground">{plan.unit}</span>
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">{plan.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ ──────────────────────────────────────────────────────────────────── */

function FaqSection({ m }: { m: AgentsMessages }) {
  return (
    <section className="mx-auto max-w-3xl px-4 pb-16">
      <h2 className="mb-6 text-2xl font-semibold tracking-tight sm:text-3xl">{m.faqTitle}</h2>
      <Accordion type="single" collapsible className="w-full">
        {m.faq.map((item, index) => (
          <AccordionItem key={item.q} value={`faq-${index}`}>
            <AccordionTrigger>{item.q}</AccordionTrigger>
            <AccordionContent>
              <p className="text-muted-foreground">{item.a}</p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

/* ─── CTA final ─────────────────────────────────────────────────────────────── */

function FinalCta({ m }: { m: AgentsMessages }) {
  return (
    <section className="site-shell pb-16">
      <div className="rounded-2xl bg-foreground px-6 py-12 text-center text-background sm:px-12">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {m.finalCta.title}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-background/70">
          {m.finalCta.copy}
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" variant="secondary" asChild>
            <SiteAcquisitionLink to="/demo">{m.finalCta.primary}</SiteAcquisitionLink>
          </Button>
          <Button size="lg" variant="outline" className="border-background/30 text-background hover:bg-background/10">
            <MessageCircleIcon /> {m.finalCta.secondary}
          </Button>
        </div>
      </div>
    </section>
  );
}


/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default function AgentsPage(): ReactNode {
  const { language } = useSiteLanguage();
  const m = AGENTS_MESSAGES[language];
  const plans = PRICING_MESSAGES[language];
  return (
    <>
        <Hero m={m} />
        <TrustBar m={m} />
        <AgentsSection m={m} />
        <HitlSection m={m} />
        <CapabilitiesSection m={m} />
        <TransparencySection m={m} />
        <SegmentsSection m={m} />
        <PricingSection m={m} plans={plans} />
        <FaqSection m={m} />
        <FinalCta m={m} />
    </>
  );
}
