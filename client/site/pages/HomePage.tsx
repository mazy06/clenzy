import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  BotIcon,
  CheckIcon,
  MapPinIcon,
  MessageCircleIcon,
  ShieldCheckIcon,
  TrendingUpIcon,
} from 'lucide-react';
import { Badge, Button } from '../../src/components/ui';
import Reveal from '../components/Reveal';
import AnimatedHitlMockup from '../components/AnimatedHitlMockup';
import { BRANDS } from '../components/BrandLogos';
import PartnerMarquee from '../components/PartnerMarquee';
import { MODULES } from '../data/catalog';

/* ─── Hero ─────────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 pt-16 pb-16 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <Reveal>
            <Badge variant="outline">Le PMS conçu pour le Maroc et la France</Badge>
          </Reveal>
          <Reveal delay={1}>
            <h1 className="mt-4 text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
              Gérez vos locations.
              <br />
              <span className="text-primary-deep">Vos agents IA font le reste.</span>
            </h1>
          </Reveal>
          <Reveal delay={2}>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              Réservations, prix, ménage, conformité : Baitly réunit tout — et une équipe d'agents
              IA le fait tourner. Vous approuvez, ils exécutent.
            </p>
          </Reveal>
          <Reveal delay={3}>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <Link to="/demo">
                  Réserver une démo <ArrowRightIcon />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/produit/agents-ia">Découvrir les agents</Link>
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Essai sans carte bancaire · Interface FR / AR · Tarifs publics en dirhams
            </p>
          </Reveal>
        </div>
        <Reveal delay={2}>
          <AnimatedHitlMockup />
        </Reveal>
      </div>
    </section>
  );
}

/* ─── Canaux & partenaires ─────────────────────────────────────────────────── */

/** Écosystème réparti en 3 lignes défilantes, groupées par famille. */
const ECOSYSTEM_ROWS = [
  ['Canaux', 'Channel manager', 'Activités'],
  ['Paiements', 'Versements', 'Comptabilité', 'Conformité'],
  ['Messagerie', 'Serrures', 'Capteurs', 'IA', 'Plateforme'],
].map((families) => BRANDS.filter((brand) => families.includes(brand.category)));

function ChannelsBar() {
  return (
    /* Le mur est volontairement HORS du conteneur centré : il occupe toute la
       largeur de l'écran, quelle qu'elle soit — un marquee borné à 1152 px
       laisserait des marges vides sur grand écran. */
    <section className="overflow-hidden border-y border-border bg-card py-10">
      <p className="text-center text-xs tracking-wide text-muted-foreground uppercase">
        Connecté à tout votre écosystème
      </p>
      <div className="mt-6">
        <PartnerMarquee rows={ECOSYSTEM_ROWS} />
      </div>
    </section>
  );
}

/* ─── Bento modules ────────────────────────────────────────────────────────── */

function ModulesBento() {
  const agents = MODULES.find((module) => module.slug === 'agents-ia')!;
  const others = MODULES.filter((module) => module.slug !== 'agents-ia');
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Un seul outil. Huit métiers couverts.
          </h2>
          <p className="mt-2 text-muted-foreground">
            Chaque module a sa page dédiée — voici la carte.
          </p>
        </div>
      </Reveal>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Cellule signature : Agents IA, sombre, double largeur */}
        <Reveal className="sm:col-span-2">
          <Link
            to="/produit/agents-ia"
            className="group flex h-full flex-col justify-between gap-6 rounded-xl bg-foreground p-6 text-background transition-colors hover:bg-primary-deep"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-background/10">
                <BotIcon className="size-5" />
              </span>
              <Badge variant="outline" className="border-background/25 text-background">
                La différence Baitly
              </Badge>
            </div>
            <div>
              <h3 className="text-xl font-semibold">{agents.name}</h3>
              <p className="mt-1.5 max-w-md text-sm text-background/70">
                Quatre agents nommés surveillent prix, séjours, opérations et canaux. Vous
                approuvez, ils exécutent — chaque décision expliquée.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium">
                Voir la page <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        </Reveal>
        {others.map((module, index) => (
          <Reveal key={module.slug} delay={((index % 3) + 1) as 1 | 2 | 3}>
            <Link
              to={`/produit/${module.slug}`}
              className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <module.icon className="size-4.5" />
              </span>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">{module.name}</h3>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{module.menuCopy}</p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                En savoir plus
                <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ─── Conformité Maroc ─────────────────────────────────────────────────────── */

const COMPLIANCE_POINTS = [
  'Fiche de police au format DGSN, générée à chaque arrivée',
  'Taxe de séjour calculée par commune, barème par logement possible',
  'Encaissement en dirhams : CMI / PayZone, YouCan Pay',
  'Factures à numérotation inaltérable, mentions légales complètes',
];

function ComplianceSection() {
  return (
    <section className="border-y border-border bg-card">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-16 lg:grid-cols-2">
        <Reveal>
          <Badge variant="success">
            <MapPinIcon /> Conçu pour le Maroc
          </Badge>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
            La conformité n'est pas une option. C'est le produit.
          </h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Les PMS internationaux ignorent la réglementation marocaine ; les outils locaux
            s'arrêtent à la fiche police. Baitly fait les deux — et le reste.
          </p>
          <ul className="mt-6 flex flex-col gap-3">
            {COMPLIANCE_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                  <CheckIcon className="size-3" />
                </span>
                {point}
              </li>
            ))}
          </ul>
          <Button variant="outline" className="mt-6" asChild>
            <Link to="/solutions#maroc">
              La page conformité Maroc <ArrowRightIcon />
            </Link>
          </Button>
        </Reveal>
        <Reveal delay={2}>
          <div className="rounded-xl border border-border bg-background p-5">
            <div className="flex items-center gap-2">
              <ShieldCheckIcon className="size-4 text-success" />
              <span className="text-sm font-semibold">Go Siyaha — jusqu'à 90 % subventionné</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Le programme national de digitalisation du tourisme peut financer votre première année
              Baitly. Le test d'éligibilité prend deux minutes.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                { value: '90 %', label: 'de subvention max' },
                { value: '15 min', label: 'pour déposer' },
                { value: '48 h', label: 'pour déployer' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border border-border p-2.5">
                  <p className="text-lg font-semibold tabular-nums">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
            <Button className="mt-4 w-full" asChild>
              <Link to="/demo">Suis-je éligible ?</Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── Preuve + témoignage ──────────────────────────────────────────────────── */

function OutcomesSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
        {[
          { value: '15 h', label: 'rendues chaque semaine à votre équipe' },
          { value: '+12 %', label: 'de RevPAR visé par le yield automatique' },
          { value: '0', label: 'double booking par conception' },
        ].map((metric, index) => (
          <Reveal key={metric.label} delay={(index + 1) as 1 | 2 | 3} className="bg-card p-6">
            <p className="flex items-center gap-2 text-3xl font-semibold tracking-tight tabular-nums">
              <TrendingUpIcon className="size-5 text-success" /> {metric.value}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{metric.label}</p>
          </Reveal>
        ))}
      </div>
      <Reveal className="mx-auto mt-14 max-w-3xl text-center">
        <p className="text-xl leading-relaxed font-medium sm:text-2xl">
          « L'Agent Revenue a rattrapé notre basse saison : 9 nuits de plus sur octobre, sans
          toucher au prix des week-ends. Et je vois pourquoi il propose chaque baisse. »
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Salma B.</span> · Médina Stays, 14 logements
          à Marrakech
        </p>
      </Reveal>
    </section>
  );
}

/* ─── CTA final ────────────────────────────────────────────────────────────── */

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16">
      <Reveal>
        <div className="rounded-2xl bg-foreground px-6 py-12 text-center text-background sm:px-12">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Voyez Baitly tourner sur vos logements.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-background/70">
            Démo en 30 minutes, en français ou en darija. Ou explorez par vous-même — sans carte
            bancaire.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" variant="secondary" asChild>
              <Link to="/demo">Réserver une démo</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-background/30 text-background hover:bg-background/10"
              asChild
            >
              <a href="https://wa.me/212600000000" target="_blank" rel="noreferrer">
                <MessageCircleIcon /> Discuter sur WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <ChannelsBar />
      <ModulesBento />
      <ComplianceSection />
      <OutcomesSection />
      <FinalCta />
    </>
  );
}
