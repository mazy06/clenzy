import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, CheckIcon, MessageCircleIcon } from 'lucide-react';
import { Badge, Button } from '../../src/components/ui';
import Reveal from '../components/Reveal';
import AnimatedOpsMockup from '../components/AnimatedOpsMockup';
import {
  PROVIDER_BENEFITS,
  PROVIDER_CATEGORIES,
  PROVIDER_STEPS,
} from '../data/catalog';

const HERO_STATS = [
  { value: '48 h', label: 'Validation du profil' },
  { value: '0 €', label: 'Inscription & abonnement' },
  { value: '6', label: 'Métiers référencés' },
  { value: 'À la preuve', label: 'Déclenchement du paiement' },
];

export default function ProvidersPage() {
  return (
    <>
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="hero-grid absolute inset-x-0 top-0 h-80 -z-10" aria-hidden />
        <div className="site-shell grid items-center gap-12 pt-16 pb-14 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Reveal>
              <Badge variant="outline">Marketplace prestataires</Badge>
            </Reveal>
            <Reveal delay={1}>
              <h1 className="mt-4 max-w-xl text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
                Vous rendez les logements impeccables.{' '}
                <span className="text-primary">Baitly vous apporte les missions.</span>
              </h1>
            </Reveal>
            <Reveal delay={2}>
              <p className="mt-4 max-w-lg text-lg text-muted-foreground">
                Ménage, maintenance, blanchisserie, jardin, accueil : rejoignez le réseau de
                prestataires Baitly et recevez un flux régulier d’interventions près de chez vous —
                planning, preuves photo et paiement, tout au même endroit.
              </p>
            </Reveal>
            <Reveal delay={3}>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link to="/demo">
                    Devenir prestataire <ArrowRightIcon />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a href="https://wa.me/212600000000" target="_blank" rel="noreferrer">
                    <MessageCircleIcon /> En parler sur WhatsApp
                  </a>
                </Button>
              </div>
            </Reveal>
          </div>

          {/* Panneau stats */}
          <Reveal delay={2}>
            <div className="shadow-brand rounded-2xl border border-border bg-card p-6">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Rejoindre, en clair
              </p>
              <div className="mt-4 grid grid-cols-2 gap-4">
                {HERO_STATS.map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-border bg-background p-4">
                    <p className="text-2xl font-semibold tracking-tight tabular-nums">{stat.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-snug text-muted-foreground">
                Baitly prélève une commission de mise en relation uniquement sur les missions
                réalisées. Aucun frais tant que vous ne travaillez pas.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Catégories de services ───────────────────────────────────────── */}
      <section className="site-shell py-16">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Quel que soit votre métier, il a sa place.
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Vous proposez déjà un service autour de la location courte durée ? Publiez votre offre
            et laissez les hôtes et conciergeries venir à vous.
          </p>
        </Reveal>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROVIDER_CATEGORIES.map((category, index) => (
            <Reveal key={category.name} delay={((index % 3) + 1) as 1 | 2 | 3} className="flex">
              <article
                className="partner-card group flex w-full flex-col rounded-2xl border border-border bg-card p-5"
                style={{ '--brand': category.color } as CSSProperties}
              >
                <span
                  className="flex size-11 items-center justify-center rounded-xl"
                  style={{
                    color: category.color,
                    backgroundColor: `color-mix(in srgb, ${category.color} 13%, var(--bui-card))`,
                  }}
                >
                  <category.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold">{category.name}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{category.copy}</p>
                <ul className="mt-4 flex flex-col gap-1.5 border-t border-border pt-4">
                  {category.examples.map((example) => (
                    <li key={example} className="flex items-center gap-2 text-sm">
                      <CheckIcon className="size-3.5 shrink-0 text-success" /> {example}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─── Comment ça marche ────────────────────────────────────────────── */}
      <section className="border-y border-border bg-card">
        <div className="site-shell py-16">
          <Reveal>
            <Badge variant="secondary">Comment ça marche</Badge>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              De l’inscription au paiement, en quatre temps.
            </h2>
          </Reveal>
          <div className="relative mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Ligne de liaison desktop */}
            <div
              className="absolute top-5 right-0 left-0 hidden h-px bg-border lg:block"
              aria-hidden
            />
            {PROVIDER_STEPS.map((step, index) => (
              <Reveal key={step.title} delay={((index % 4) + 1) as 1 | 2 | 3 | 4}>
                <div className="relative">
                  <div className="flex items-center gap-3">
                    <span className="relative z-10 flex size-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground tabular-nums">
                      {index + 1}
                    </span>
                    <step.icon className="size-5 text-primary" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{step.copy}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Mockup : la vue prestataire (projection réelle Opérations) ───── */}
      <section className="site-shell py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <Badge variant="outline">L’application prestataire</Badge>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
              Vos missions, votre planning, vos preuves — en un écran.
            </h2>
            <p className="mt-3 max-w-md text-muted-foreground">
              Retrouvez vos interventions du jour, l’adresse et les consignes de chaque logement,
              la check-list à cocher et les photos avant / après à joindre. Une fois validé, le
              paiement part tout seul.
            </p>
            <ul className="mt-5 flex flex-col gap-2.5 text-sm">
              {[
                'Missions assignées automatiquement selon votre zone',
                'Check-list et preuve photo obligatoires par mission',
                'Itinéraire optimisé entre deux logements',
                'Historique et revenus consultables à tout moment',
              ].map((point) => (
                <li key={point} className="flex items-center gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                    <CheckIcon className="size-3" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={1}>
            <AnimatedOpsMockup />
          </Reveal>
        </div>
      </section>

      {/* ─── Avantages ────────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-card">
        <div className="site-shell py-16">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Pourquoi rejoindre le réseau Baitly.
            </h2>
          </Reveal>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PROVIDER_BENEFITS.map((benefit, index) => (
              <Reveal key={benefit.title} delay={((index % 4) + 1) as 1 | 2 | 3 | 4}>
                <div className="h-full rounded-2xl border border-border bg-background p-5">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <benefit.icon className="size-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold">{benefit.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{benefit.copy}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA final ────────────────────────────────────────────────────── */}
      <section className="site-shell py-20">
        <Reveal>
          <div className="shadow-brand relative overflow-hidden rounded-3xl border border-border bg-primary px-6 py-14 text-center text-primary-foreground">
            <div className="hero-grid absolute inset-0 opacity-20" aria-hidden />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
                Prêt à remplir votre carnet de missions ?
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-primary-foreground/85">
                Créez votre profil en quelques minutes. C’est gratuit, et vous ne payez que sur les
                interventions réalisées.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button size="lg" variant="secondary" asChild>
                  <Link to="/demo">
                    Devenir prestataire <ArrowRightIcon />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                  asChild
                >
                  <a href="https://wa.me/212600000000" target="_blank" rel="noreferrer">
                    <MessageCircleIcon /> Poser une question
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
