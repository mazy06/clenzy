import type { ComponentType, ReactNode } from 'react';
import {
  ArrowRightIcon,
  BotIcon,
  CalendarDaysIcon,
  CheckIcon,
  EyeIcon,
  MessageCircleIcon,
  ScaleIcon,
  Share2Icon,
  ShieldCheckIcon,
  SparklesIcon,
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

/* ─── Hero ─────────────────────────────────────────────────────────────────── */

const HERO_METRICS = [
  { value: '15 h', label: 'rendues chaque semaine à votre équipe' },
  { value: '+12 %', label: 'de RevPAR visé par le yield automatique' },
  { value: '100 %', label: 'des décisions expliquées et traçables' },
];

function Hero() {
  return (
    <section className="site-shell pt-16 pb-12">
      {/* Deux colonnes : discours à gauche, assistant en action à droite. */}
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <Badge variant="outline" className="mb-4">
            <SparklesIcon /> Produit · Agents IA
          </Badge>
          <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            Une équipe d’agents IA qui travaille pour vos logements.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            La constellation Baitly surveille vos prix, vos séjours, vos équipes ménage et vos
            canaux — en continu. Chaque agent propose, simule et explique.{' '}
            <span className="font-medium text-foreground">Vous approuvez, ils exécutent.</span>
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button size="lg">
              Voir les agents en action <ArrowRightIcon />
            </Button>
            <Button size="lg" variant="outline">
              Essayer gratuitement
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Sans carte bancaire · Interface FR / AR
          </p>
          {/* Chiffres clés sous le discours : colonne plus étroite que la pleine
              largeur d'origine → séparateurs verticaux plutôt que cartes. */}
          <div className="mt-9 grid grid-cols-3 gap-px border-t border-border bg-border pt-px">
            {HERO_METRICS.map((metric) => (
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

const TRUST_ITEMS = [
  'Fiche police DGSN automatique',
  'Taxe de séjour par commune',
  'RGPD & Loi 09-08 (CNDP)',
  'Airbnb · Booking.com · Channex',
  'Paiements CMI / PayZone · Stripe',
];

function TrustBar() {
  return (
    <section className="border-y border-border bg-card">
      <div className="site-shell flex flex-wrap items-center justify-center gap-x-8 gap-y-2 py-4">
        {TRUST_ITEMS.map((item) => (
          <span key={item} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheckIcon className="size-3.5 text-success" /> {item}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ─── Les agents (nommés) ──────────────────────────────────────────────────── */

interface AgentDef {
  icon: ComponentType<{ className?: string }>;
  name: string;
  watches: string;
  proposes: string;
}

const AGENTS: AgentDef[] = [
  {
    icon: TrendingUpIcon,
    name: 'Agent Revenue',
    watches: 'Occupation par bloc de dates, pace de réservation, saisonnalité, prix du marché.',
    proposes: 'Ajustements tarifaires bornés (plancher garanti), simulés avant application.',
  },
  {
    icon: CalendarDaysIcon,
    name: 'Agent Séjours',
    watches: 'Arrivées et départs du jour, messages voyageurs, paniers abandonnés.',
    proposes: 'Réponses prêtes à envoyer, relances de panier, instructions d’arrivée.',
  },
  {
    icon: WrenchIcon,
    name: 'Agent Opérations',
    watches: 'Planning ménage, preuves photo, incidents et maintenances.',
    proposes: 'Missions assignées aux bonnes équipes, payouts gatés sur preuve.',
  },
  {
    icon: Share2Icon,
    name: 'Agent Distribution',
    watches: 'Synchronisation des canaux (ARI), conflits de calendrier, annonces.',
    proposes: 'Corrections de sync et alertes avant qu’un double booking n’arrive.',
  },
];

function AgentsSection() {
  return (
    <section className="site-shell py-16">
      <div className="mb-8 max-w-2xl">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Des agents nommés, chacun son métier.
        </h2>
        <p className="mt-2 text-muted-foreground">
          Pas une « fonctionnalité IA » diffuse : une équipe dont chaque membre a un périmètre, des
          garde-fous et un journal d’activité.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {AGENTS.map((agent) => (
          <div
            key={agent.name}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <agent.icon className="size-4.5" />
              </span>
              <span className="text-base font-semibold">{agent.name}</span>
              <Badge variant="secondary" className="ms-auto">
                Auto ou validation
              </Badge>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="font-medium text-muted-foreground">Surveille</dt>
              <dd className="text-foreground">{agent.watches}</dd>
              <dt className="font-medium text-muted-foreground">Propose</dt>
              <dd className="text-foreground">{agent.proposes}</dd>
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── HITL : vous gardez la main ───────────────────────────────────────────── */

function HitlCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Badge variant="info">
          <TrendingUpIcon /> Agent Revenue
        </Badge>
        <span className="text-xs text-muted-foreground">il y a 8 min</span>
        <Badge variant="warning" className="ms-auto">
          En attente
        </Badge>
      </div>
      <h3 className="mt-3 text-sm font-semibold">
        Occupation faible détectée — Riad Yasmine, 12–19 octobre
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        38 % de nuits vendues à J-45 (vs 55 % habituels). Proposition : −12 % sur les nuits creuses
        de la période, plancher 680 MAD respecté.
      </p>
      <div className="mt-4 rounded-lg bg-muted p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Simulation d’élasticité</span>
          <span className="font-medium tabular-nums">+9 nuits estimées · +5 400 MAD</span>
        </div>
        <Progress value={72} className="mt-2" />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Button size="sm">
          <CheckIcon /> Approuver
        </Button>
        <Button size="sm" variant="outline">
          Ajuster
        </Button>
        <Button size="sm" variant="ghost">
          Ignorer
        </Button>
      </div>
    </div>
  );
}

const HITL_POINTS = [
  'Chaque proposition arrive en carte à approuver — rien ne part sans vous.',
  'Passez un agent en automatique quand il a gagné votre confiance, agent par agent.',
  'Chaque décision est expliquée en langage clair : le pourquoi, les bornes, la simulation.',
  'Un journal d’audit conserve tout : qui a approuvé quoi, quand, avec quel effet.',
];

function HitlSection() {
  return (
    <section className="border-y border-border bg-card">
      <div className="site-shell grid grid-cols-1 items-center gap-10 py-16 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Vous gardez la main. Vraiment.
          </h2>
          <p className="mt-2 text-muted-foreground">
            L’autopilote total n’inspire pas confiance — et il a tort de le faire. Baitly est conçu
            humain-dans-la-boucle d’abord.
          </p>
          <ul className="mt-6 flex flex-col gap-3">
            {HITL_POINTS.map((point) => (
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

const TAB_PANELS = [
  {
    key: 'pricing',
    label: 'Pricing & yield',
    title: 'Un yield bloc par bloc, jamais aveugle',
    copy: 'Baisse ciblée sous 55 % d’occupation, hausse au-delà de 85 %, cooldown de 14 jours entre deux ajustements, plancher intouchable. Le tout simulé sur deux mois avant application.',
    rows: ['Prix par nuit sur le calendrier', 'Overrides par plage', 'Saisons et promotions', 'Market data par ville'],
  },
  {
    key: 'guests',
    label: 'Messages voyageurs',
    title: 'Des réponses prêtes, dans la langue du voyageur',
    copy: 'Brouillons générés depuis votre livret d’accueil et l’historique du séjour, envoi manuel ou automatique par modèle. WhatsApp, email et SMS unifiés.',
    rows: ['Boîte unifiée multi-canaux', 'Modèles par évènement', 'Traduction FR / EN / AR', 'Relance de panier direct'],
  },
  {
    key: 'ops',
    label: 'Opérations ménage',
    title: 'Le ménage assigné, prouvé, payé',
    copy: 'Chaque départ génère la mission, l’agent l’assigne selon les disponibilités, la preuve photo conditionne le payout du prestataire.',
    rows: ['Planning auto post-checkout', 'Checklists par logement', 'Preuve photo obligatoire', 'Payouts gatés'],
  },
  {
    key: 'watch',
    label: 'Supervision',
    title: 'Une constellation, un tableau de bord',
    copy: 'Le feed d’activité montre ce que chaque agent a fait, en auto ou après votre validation. Les compteurs de cartes en attente sont dans votre sidebar.',
    rows: ['Feed temps réel', 'File de cartes à traiter', 'Toggles Auto / HITL par agent', 'Journal d’audit exportable'],
  },
];

function CapabilitiesSection() {
  return (
    <section className="site-shell py-16">
      <h2 className="mb-8 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
        Tout ce que la constellation sait faire.
      </h2>
      <Tabs defaultValue="pricing">
        <TabsList>
          {TAB_PANELS.map((panel) => (
            <TabsTrigger key={panel.key} value={panel.key}>
              {panel.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TAB_PANELS.map((panel) => (
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

function TransparencySection() {
  return (
    <section className="bg-foreground text-background">
      <div className="site-shell py-16">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <Badge variant="outline" className="mb-4 border-background/25 text-background">
              <EyeIcon /> Pas de boîte noire
            </Badge>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Chaque décision est documentée. Publiquement.
            </h2>
            <p className="mt-3 max-w-xl text-background/70">
              Les règles du yield sont bornées et lisibles : seuils d’occupation, plancher de prix,
              périodes de repos, simulation d’élasticité. Nous publions comment nos agents décident
              — parce qu’un outil auquel on confie ses revenus doit pouvoir s’expliquer.
            </p>
            <Button variant="outline" className="mt-6 border-background/30 text-background hover:bg-background/10">
              Lire « Comment notre yield décide » <ArrowRightIcon />
            </Button>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { icon: ScaleIcon, text: 'Bornes explicites : jamais sous votre prix plancher, jamais plus d’un ajustement par bloc et par quinzaine.' },
              { icon: EyeIcon, text: 'Simulation avant action : impact estimé en nuits et en revenu, affiché sur chaque carte.' },
              { icon: BotIcon, text: 'Journal d’audit : chaque action d’agent est horodatée, attribuée et réversible.' },
            ].map((item) => (
              <div key={item.text} className="flex items-start gap-3 rounded-xl border border-background/15 p-4">
                <item.icon className="mt-0.5 size-4.5 shrink-0 text-background/60" />
                <p className="text-sm text-background/85">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Par taille de portefeuille ───────────────────────────────────────────── */

const SEGMENTS = [
  {
    range: '1 à 5 logements',
    title: 'L’autopilote simple',
    copy: 'Les agents gèrent messages et prix pendant que vous gardez votre emploi du temps. Validation sur mobile en deux gestes.',
  },
  {
    range: '5 à 50 logements',
    title: 'La conciergerie augmentée',
    copy: 'Cartes HITL par équipe, ménage gaté sur preuve photo, portail propriétaires alimenté automatiquement.',
  },
  {
    range: '50+ logements',
    title: 'Le portefeuille piloté',
    copy: 'Vue multi-organisations, agents par segment de biens, journal d’audit exportable pour vos mandants.',
  },
];

function SegmentsSection() {
  return (
    <section className="site-shell py-16">
      <h2 className="mb-8 text-2xl font-semibold tracking-tight sm:text-3xl">
        À chaque taille de portefeuille, son usage.
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {SEGMENTS.map((segment) => (
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

const PLANS = [
  { name: 'Essentiel', price: '290 MAD', unit: '/logement/mois', note: 'PMS + channel manager + booking engine', featured: false },
  { name: 'Pro', price: '490 MAD', unit: '/logement/mois', note: 'Tout Essentiel + agents IA + yield automatique', featured: true },
  { name: 'Sur mesure', price: 'Devis', unit: '', note: '50+ logements, multi-organisations, SLA dédié', featured: false },
];

function PricingSection() {
  return (
    <section className="border-y border-border bg-card">
      <div className="site-shell py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Des tarifs publics. En dirhams.
            </h2>
            <p className="mt-2 text-muted-foreground">
              Dégressif par logement, sans commission cachée. Aussi disponibles en euros.
            </p>
          </div>
          <Button variant="outline">
            Voir tous les tarifs <ArrowRightIcon />
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                'rounded-xl border p-5',
                plan.featured ? 'border-primary bg-primary-soft' : 'border-border bg-background',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{plan.name}</span>
                {plan.featured && <Badge>Recommandé</Badge>}
              </div>
              <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">
                {plan.price}
                <span className="text-sm font-normal text-muted-foreground">{plan.unit}</span>
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">{plan.note}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Éligible Go Siyaha : la digitalisation de votre établissement peut être subventionnée
          jusqu’à 90 %. <a href="#" className="font-medium text-foreground underline">Vérifier mon éligibilité</a>
        </p>
      </div>
    </section>
  );
}

/* ─── Témoignage ───────────────────────────────────────────────────────────── */

function TestimonialSection() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 text-center">
      <p className="text-xl leading-relaxed font-medium text-foreground sm:text-2xl">
        « L’Agent Revenue a rattrapé notre basse saison : 9 nuits de plus sur octobre, sans toucher
        au prix des week-ends. Et je vois pourquoi il propose chaque baisse — c’est ça qui m’a
        convaincue de passer en automatique. »
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Salma B.</span> · Médina Stays, 14 logements à
        Marrakech
      </p>
    </section>
  );
}

/* ─── FAQ ──────────────────────────────────────────────────────────────────── */

const FAQ_ITEMS = [
  {
    q: 'Les agents décident-ils seuls ?',
    a: 'Non par défaut. Chaque agent démarre en mode validation : il propose des cartes que vous approuvez, ajustez ou ignorez. Vous pouvez ensuite le passer en automatique, agent par agent, avec des bornes que vous fixez.',
  },
  {
    q: 'Que se passe-t-il si je refuse une proposition ?',
    a: 'Rien — la carte est archivée avec votre décision. L’agent respecte un délai de repos avant de reproposer sur le même sujet, et apprend de vos choix.',
  },
  {
    q: 'Mes données servent-elles à entraîner des modèles tiers ?',
    a: 'Non. Vos données restent dans votre organisation, hébergées en Europe, conformes RGPD et Loi 09-08 (CNDP). Les comparables de marché sont agrégés et anonymisés.',
  },
  {
    q: 'Ça fonctionne en arabe ?',
    a: 'Oui — l’interface existe en français et en arabe (RTL complet), et les agents répondent aux voyageurs dans leur langue.',
  },
  {
    q: 'Je viens d’un autre PMS, je dois tout reconfigurer ?',
    a: 'Non : l’import Baitly récupère logements, réservations passées et voyageurs depuis vos exports OTA (Airbnb, Booking), le fichier de votre ancien PMS ou votre Excel. Les données importées ne déclenchent aucune automatisation.',
  },
  {
    q: 'Combien ça coûte ?',
    a: 'Les agents IA sont inclus dans le plan Pro (dès 490 MAD/logement/mois, dégressif). Pas de commission sur vos réservations directes.',
  },
];

function FaqSection() {
  return (
    <section className="mx-auto max-w-3xl px-4 pb-16">
      <h2 className="mb-6 text-2xl font-semibold tracking-tight sm:text-3xl">Questions fréquentes</h2>
      <Accordion type="single" collapsible className="w-full">
        {FAQ_ITEMS.map((item, index) => (
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

function FinalCta() {
  return (
    <section className="site-shell pb-16">
      <div className="rounded-2xl bg-foreground px-6 py-12 text-center text-background sm:px-12">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Mettez une équipe d’agents sur vos logements.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-background/70">
          Démo en 30 minutes, en français ou en darija. Ou explorez par vous-même — sans carte
          bancaire.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" variant="secondary">
            Réserver une démo
          </Button>
          <Button size="lg" variant="outline" className="border-background/30 text-background hover:bg-background/10">
            <MessageCircleIcon /> Discuter sur WhatsApp
          </Button>
        </div>
      </div>
    </section>
  );
}


/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default function AgentsPage(): ReactNode {
  return (
    <>
        <Hero />
        <TrustBar />
        <AgentsSection />
        <HitlSection />
        <CapabilitiesSection />
        <TransparencySection />
        <SegmentsSection />
        <PricingSection />
        <TestimonialSection />
        <FaqSection />
        <FinalCta />
    </>
  );
}
