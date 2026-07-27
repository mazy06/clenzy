import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRightIcon, CheckIcon, Share2Icon, SparklesIcon } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
} from '../../src/components/ui';
import Reveal from '../components/Reveal';
import AnimatedIotMockup from '../components/AnimatedIotMockup';
import AnimatedOwnerMockup from '../components/AnimatedOwnerMockup';
import AnimatedOpsMockup from '../components/AnimatedOpsMockup';
import AnimatedPlanningMockup from '../components/AnimatedPlanningMockup';
import AdvantageDeck from '../components/AdvantageDeck';
import ScrollGuideSection from '../components/ScrollGuideSection';
import PartnerMarquee from '../components/PartnerMarquee';
import { MARKETPLACE_ROWS, MODULES } from '../data/catalog';
import AgentsPage from './AgentsPage';

/** Démos animées disponibles par module (projection réelle embarquée + curseur). */
const MODULE_DEMOS: Record<
  string,
  { Mockup: () => JSX.Element; title: string; copy: string; points: string[] }
> = {
  'pms-channel-manager': {
    Mockup: AnimatedPlanningMockup,
    title: 'Un planning qui refuse la double réservation.',
    copy: "L'écran Planning réel : toutes vos annonces sur une seule grille, quel que soit le canal. Déplacez un séjour, étirez-le, bloquez des nuits — le ménage suit, et un chevauchement est refusé avant d'exister.",
    points: [
      'Protection anti-surbooking en direct',
      'Le ménage se replanifie au nouveau départ',
      'Filtre par canal en un clic',
    ],
  },
  'objets-connectes': {
    Mockup: AnimatedIotMockup,
    title: 'Regardez-le fonctionner. Pour de vrai.',
    copy: "Ce n'est pas une image : c'est l'écran Objets connectés de l'application, piloté sous vos yeux — capteur de bruit, verrouillage à distance, mur de vidéosurveillance.",
    points: ['Seuils jour/nuit par logement', 'Codes bornés au séjour', 'Extérieurs uniquement — vie privée respectée'],
  },
  'portail-proprietaire': {
    Mockup: AnimatedOwnerMockup,
    title: 'Ce que voit votre propriétaire.',
    copy: "L'espace mandant réel de l'application : net à verser, occupation, revenus sur 12 mois, et les relevés mensuels qu'il télécharge en un clic — tenus à jour automatiquement.",
    points: ['Relevés mensuels téléchargeables', 'Versements et commission détaillés', 'Aucune ressaisie de votre côté'],
  },
  'operations-menage': {
    Mockup: AnimatedOpsMockup,
    title: 'Vos interventions, filtrées en un geste.',
    copy: "L'écran Interventions réel de l'application : chaque départ génère sa mission, filtrez par ménage, maintenance ou check-in — assignation, checklist et preuve photo suivent.",
    points: ['Missions générées au checkout', 'Filtres par type et statut', 'Payout gaté sur preuve photo'],
  },
};

/** Gabarit commun des pages produit (benchmark : hero + chiffre → features →
    segmentation → FAQ → CTA). La page Agents IA a sa version signature. */
export default function ModulePage() {
  const { slug } = useParams();
  if (slug === 'agents-ia') return <AgentsPage />;

  const module = MODULES.find((entry) => entry.slug === slug);
  if (!module) return <Navigate to="/" replace />;

  const siblings = MODULES.filter((entry) => entry.slug !== slug).slice(0, 4);
  const demo = slug ? MODULE_DEMOS[slug] : undefined;

  return (
    <>
      {/* Hero — deux colonnes : discours à gauche, panneau récap à droite */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="hero-grid absolute inset-x-0 top-0 h-80 -z-10" aria-hidden />
        <div className="site-shell grid grid-cols-1 items-center gap-10 pt-16 pb-16 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Reveal>
              <Badge variant="outline">
                <module.icon /> Produit · {module.name}
              </Badge>
            </Reveal>
            <Reveal delay={1}>
              <h1 className="mt-4 text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
                {module.heroTitle}
              </h1>
            </Reveal>
            <Reveal delay={2}>
              <p className="mt-4 max-w-xl text-lg text-muted-foreground">{module.heroCopy}</p>
            </Reveal>
            <Reveal delay={3} className="mt-7 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild>
                <Link to="/demo">
                  Réserver une démo <ArrowRightIcon />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/tarifs">Voir les tarifs</Link>
              </Button>
            </Reveal>
          </div>

          {/* Jeu de cartes : ce que le PMS sait faire, et fait mieux que le marché */}
          <Reveal delay={2} className="pb-8">
            <AdvantageDeck />
          </Reveal>
        </div>
      </section>

      {/* Livret d'accueil : section mobile pilotée par le scroll de la page */}
      {module.slug === 'livret-accueil' && <ScrollGuideSection />}

      {/* Démo animée (modules qui en disposent) — projection réelle pilotée */}
      {demo && (
        <section className="site-shell pt-16">
          <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{demo.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{demo.copy}</p>
            </div>
            <ul className="flex flex-col gap-1.5 text-sm">
              {demo.points.map((point) => (
                <li key={point} className="flex items-center gap-2">
                  <CheckIcon className="size-3.5 shrink-0 text-success" /> {point}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={1}>
            <demo.Mockup />
          </Reveal>
        </section>
      )}

      {/* Features — 2×2 en tablette, une seule rangée de 4 en grand écran */}
      <section className="site-shell py-16">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {module.features.map((feature, index) => (
            <Reveal key={feature.title} delay={((index % 2) + 1) as 1 | 2}>
              <div className="flex h-full flex-col gap-2 rounded-xl border border-border bg-card p-6">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <CheckIcon className="size-4" />
                </span>
                <h2 className="text-base font-semibold">{feature.title}</h2>
                <p className="text-sm text-muted-foreground">{feature.copy}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Partenaires marketplace (module livret d'accueil) */}
      {module.slug === 'livret-accueil' && (
        <section className="relative overflow-hidden border-y border-border bg-card">
          <div className="hero-grid absolute inset-x-0 top-0 h-48 -z-10" aria-hidden />
          <div className="site-shell pt-16">
            {/* En-tête + commission mise en avant */}
            <div className="grid grid-cols-1 items-end gap-6 lg:grid-cols-[1.6fr_1fr]">
              <Reveal>
                <Badge variant="outline">Écosystème de partenaires</Badge>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                  Une marketplace connectée aux leaders de l'expérience.
                </h2>
                <p className="mt-2 max-w-xl text-muted-foreground">
                  Deux sources de revenu depuis le même livret : une{' '}
                  <span className="font-medium text-foreground">commission d'affiliation</span> sur
                  les partenaires externes, et vos{' '}
                  <span className="font-medium text-foreground">propres prestations</span>, vendues
                  à la marge que vous fixez.
                </p>
              </Reveal>
              <Reveal delay={2}>
                <div className="rounded-2xl border border-border bg-background p-5 text-center">
                  <p className="text-3xl font-semibold tracking-tight tabular-nums">8 – 20 %</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    de commission par réservation, selon le partenaire
                  </p>
                </div>
              </Reveal>
            </div>
          </div>

          {/* Mur de logos — pleine largeur d'écran, hors conteneur centré */}
          <Reveal className="mt-12">
            <PartnerMarquee rows={MARKETPLACE_ROWS} />
          </Reveal>

          <div className="site-shell pb-16">
            {/* Une seule unité, scindée par un filet : à gauche ce qu'on
                encaisse via un tiers, à droite ce qu'on vend soi-même. Pas de
                tarifs — le prix se fixe dans le produit, pas sur la page. */}
            <Reveal className="mt-10">
              <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-border bg-background md:grid-cols-2">
                <div className="flex flex-col gap-4 p-6 md:border-e md:border-border">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Share2Icon className="size-4" />
                    </span>
                    <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Ce que réservent vos voyageurs
                    </span>
                  </div>
                  <ul className="flex flex-wrap gap-1.5">
                    {['Activités & excursions', 'Billetterie musées', 'Transferts privés', 'Livraison de repas', 'Courses & épicerie'].map((item) => (
                      <li key={item} className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground/75">
                        {item}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-auto flex items-baseline gap-2 border-t border-border pt-4">
                    <span className="text-sm font-semibold">Commission d'affiliation</span>
                    <span className="text-xs text-muted-foreground">— vous n'opérez rien</span>
                  </p>
                </div>

                <div className="flex flex-col gap-4 bg-primary-soft/35 p-6">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <SparklesIcon className="size-4" />
                    </span>
                    <span className="text-xs font-semibold tracking-wide text-primary uppercase">
                      Ce que vous vendez vous-même
                    </span>
                  </div>
                  <ul className="flex flex-wrap gap-1.5">
                    {['Départ tardif', 'Arrivée anticipée', 'Panier d’arrivée', 'Transfert aéroport', 'Ménage en cours de séjour', 'Location de vélos', 'Garde-bagages', 'Petit-déjeuner livré'].map((item) => (
                      <li key={item} className="rounded-full bg-card px-3 py-1.5 text-xs font-medium shadow-sm">
                        {item}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-auto flex items-baseline gap-2 border-t border-primary/15 pt-4">
                    <span className="text-sm font-semibold">Votre prix, votre marge</span>
                    <span className="text-xs text-muted-foreground">— aucune commission prélevée</span>
                  </p>
                </div>
              </div>
            </Reveal>

            <Reveal className="mt-6">
              <p className="text-xs text-muted-foreground">
                Chaque partenaire est activable et configurable (commission, mise en avant,
                catalogue).
              </p>
            </Reveal>
          </div>
        </section>
      )}

      {/* Segmentation par taille (pattern Hostaway) */}
      <section className="border-y border-border bg-card">
        <div className="site-shell py-14">
          <Reveal>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Pensé pour votre taille de portefeuille
            </h2>
          </Reveal>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { range: '1–5 logements', copy: 'Configuration guidée, automatisations simples, validation mobile.' },
              { range: '5–50 logements', copy: 'Équipes, portail propriétaires, règles par segment de biens.' },
              { range: '50+ logements', copy: 'Multi-organisations, permissions fines, journal d’audit exportable.' },
            ].map((segment, index) => (
              <Reveal key={segment.range} delay={(index + 1) as 1 | 2 | 3}>
                <div className="rounded-xl border border-border bg-background p-5">
                  <Badge variant="outline">{segment.range}</Badge>
                  <p className="mt-3 text-sm text-muted-foreground">{segment.copy}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      {module.faq.length > 0 && (
        <section className="mx-auto max-w-3xl px-4 py-16">
          <Reveal>
            <h2 className="mb-6 text-xl font-semibold tracking-tight sm:text-2xl">
              Questions fréquentes
            </h2>
          </Reveal>
          <Accordion type="single" collapsible className="w-full">
            {module.faq.map((item, index) => (
              <AccordionItem key={item.q} value={`faq-${index}`}>
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionContent>
                  <p className="text-muted-foreground">{item.a}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      )}

      {/* Autres modules */}
      <section className="site-shell pb-16">
        <Reveal>
          <p className="mb-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Explorer les autres modules
          </p>
        </Reveal>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {siblings.map((sibling) => (
            <Link
              key={sibling.slug}
              to={`/produit/${sibling.slug}`}
              className="group flex items-center gap-2.5 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40"
            >
              <sibling.icon className="size-4 shrink-0 text-primary" />
              <span className="flex-1 text-sm font-medium">{sibling.name}</span>
              <ArrowRightIcon className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
