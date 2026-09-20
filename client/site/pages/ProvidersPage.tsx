import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, CheckIcon, MapPinIcon, MessageCircleIcon, ShieldCheckIcon } from 'lucide-react';
import { Badge, Button } from '../../src/components/ui';
import Reveal from '../components/Reveal';
import AnimatedOpsMockup from '../components/AnimatedOpsMockup';
import portrait1 from '../assets/people/provider-1.jpg';
import portrait2 from '../assets/people/provider-2.jpg';
import portrait3 from '../assets/people/provider-3.jpg';
import portrait4 from '../assets/people/provider-4.jpg';
import portrait5 from '../assets/people/provider-5.jpg';
import portrait6 from '../assets/people/provider-6.jpg';

/** Portraits des profils d'illustration, dans l'ordre du dictionnaire. */
const PORTRAITS = [portrait1, portrait2, portrait3, portrait4, portrait5, portrait6];
import {
  PROVIDER_BENEFIT_ICONS,
  PROVIDER_CATEGORIES,
  PROVIDER_STEP_ICONS,
} from '../data/catalog';
import { cn } from '../../src/utils/cn';
import { useSiteLanguage } from '../lib/siteLanguage';
import { PROVIDERS_MESSAGES } from '../lib/messages/providers';

export default function ProvidersPage() {
  const { language } = useSiteLanguage();
  const m = PROVIDERS_MESSAGES[language];
  return (
    <>
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="hero-grid absolute inset-x-0 top-0 h-80 -z-10" aria-hidden />
        <div className="site-shell grid items-center gap-12 pt-16 pb-14 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Reveal>
              <Badge variant="outline">{m.eyebrow}</Badge>
            </Reveal>
            <Reveal delay={1}>
              <h1 className="mt-4 max-w-xl text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
                {m.titleBefore}
                <span className="text-primary">{m.titleAccent}</span>
              </h1>
            </Reveal>
            <Reveal delay={2}>
              <p className="mt-4 max-w-lg text-lg text-muted-foreground">
                {m.intro}
              </p>
            </Reveal>
            <Reveal delay={3}>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link to="/prestataires/inscription">
                    {m.ctaJoin} <ArrowRightIcon />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a href="https://wa.me/212600000000" target="_blank" rel="noreferrer">
                    <MessageCircleIcon /> {m.ctaWhatsapp}
                  </a>
                </Button>
              </div>
            </Reveal>
          </div>

          {/* Panneau stats */}
          <Reveal delay={2}>
            <div className="shadow-brand rounded-2xl border border-border bg-card p-6">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {m.statsTitle}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-4">
                {m.stats.map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-border bg-background p-4">
                    <p className="text-2xl font-semibold tracking-tight tabular-nums">{stat.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-snug text-muted-foreground">
                {m.statsNote}
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Profils : la place de marche n'etait montree par personne ────── */}
      <section className="site-shell py-16">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{m.showcaseTitle}</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">{m.showcaseCopy}</p>
        </Reveal>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {m.profiles.map((profile, index) => {
            const color = PROVIDER_CATEGORIES[index]?.color ?? '#4A9B8E';
            return (
              <Reveal key={profile.name} delay={((index % 4) + 1) as 1 | 2 | 3 | 4} className="flex">
                <article className="flex w-full flex-col rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center gap-3">
                    {/* Monogramme teinte au metier : pas de portrait invente
                        pour un profil qui n'existe pas encore. */}
                    <img
                      src={PORTRAITS[index]}
                      alt=""
                      width="44"
                      height="44"
                      loading="lazy"
                      className="size-11 shrink-0 rounded-xl object-cover"
                      style={{ outline: `2px solid color-mix(in srgb, ${color} 35%, transparent)`, outlineOffset: -2 }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{profile.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{profile.kind}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm font-medium" style={{ color }}>{profile.trade}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPinIcon className="size-3.5 shrink-0" /> {profile.city}
                  </p>
                  <ul className="mt-3 flex flex-1 flex-col gap-1.5 border-t border-border pt-3">
                    {profile.services.map((service) => (
                      <li key={service} className="flex items-start gap-1.5 text-xs">
                        <CheckIcon className="mt-0.5 size-3 shrink-0 text-success" /> {service}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground">{m.from}</span>
                    <span className="text-base font-semibold tabular-nums">{profile.price}</span>
                    <span className="text-xs text-muted-foreground">{profile.unit}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-2xs">
                      <ShieldCheckIcon className="size-3" /> {m.verified}
                    </Badge>
                    <Badge variant="outline" className="text-2xs">{m.insured}</Badge>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
        <Reveal className="mt-4">
          <p className="text-xs text-muted-foreground">{m.sampleNotice}</p>
        </Reveal>
      </section>

      {/* ─── Les plus actifs : des RANGEES, pas une troisieme grille ──────── */}
      <section className="border-y border-border bg-card">
        <div className="site-shell py-16">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{m.activeTitle}</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">{m.activeCopy}</p>
          </Reveal>
          <Reveal className="mt-6">
            <div className="overflow-x-auto rounded-xl border border-border bg-background">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-3 text-start font-medium text-muted-foreground">
                      {m.activeColumns.provider}
                    </th>
                    <th className="p-3 text-start font-medium text-muted-foreground">
                      {m.activeColumns.trade}
                    </th>
                    <th className="p-3 text-start font-medium text-muted-foreground">
                      {m.activeColumns.area}
                    </th>
                    <th className="p-3 text-end font-medium text-muted-foreground">
                      {m.activeColumns.missions}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {m.activeProfiles.map((profile, index) => {
                    const color = PROVIDER_CATEGORIES[index % PROVIDER_CATEGORIES.length].color;
                    return (
                      <tr key={profile.name} className="border-b border-border last:border-0">
                        <td className="p-3">
                          <span className="flex items-center gap-2.5">
                            <img
                              src={PORTRAITS[index]}
                              alt=""
                              width="32"
                              height="32"
                              loading="lazy"
                              className="size-8 shrink-0 rounded-lg object-cover"
                              style={{ outline: `2px solid color-mix(in srgb, ${color} 35%, transparent)`, outlineOffset: -2 }}
                            />
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{profile.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {profile.kind}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">{profile.trade}</td>
                        <td className="p-3 text-muted-foreground">{profile.area}</td>
                        <td className="p-3 text-end font-semibold tabular-nums">{profile.missions}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Reveal>
          <Reveal className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-xs text-muted-foreground">{m.sampleNotice}</p>
            <Button size="sm" className="ms-auto" asChild>
              <Link to="/prestataires/inscription">
                {m.ctaJoin} <ArrowRightIcon />
              </Link>
            </Button>
          </Reveal>
        </div>
      </section>

      {/* ─── Catégories de services ───────────────────────────────────────── */}
      <section className="site-shell py-16">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {m.categoriesTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {m.categoriesCopy}
          </p>
        </Reveal>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {m.categories.map((category, index) => {
            const { photo, color } = PROVIDER_CATEGORIES[index];
            /* Deux ancres en diagonale — la premiere famille et la derniere —
               s'etendent sur deux colonnes : huit cellules, deux rangees
               pleines, et une grille qui ne se repete pas a l'identique. */
            const wide = index === 0 || index === PROVIDER_CATEGORIES.length - 1;
            return (
            <Reveal
              key={category.name}
              delay={((index % 4) + 1) as 1 | 2 | 3 | 4}
              className={cn('flex', wide && 'xl:col-span-2')}
            >
              <article
                className={cn(
                  'partner-card service-tile group flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-card',
                  wide && 'xl:flex-row',
                )}
                style={{ '--brand': color } as CSSProperties}
              >
                <div
                  className={cn(
                    'relative shrink-0 overflow-hidden',
                    wide ? 'aspect-[16/9] xl:aspect-auto xl:w-[44%]' : 'aspect-[16/9]',
                  )}
                >
                  <img
                    src={photo}
                    alt=""
                    width="1000"
                    height="560"
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover"
                  />
                  {/* Le titre vit sur la photo pour les tuiles compactes — c'est
                      l'image qui porte l'identite du metier. Les deux ancres le
                      gardent dans leur colonne de texte : leur photo est a cote,
                      pas au-dessus. */}
                  {!wide && (
                    <h3 className="service-tile-title absolute inset-x-0 bottom-0 px-4 pt-10 pb-3.5 text-base font-semibold text-white">
                      {category.name}
                    </h3>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  {wide && (
                    <h3 className="text-lg font-semibold">{category.name}</h3>
                  )}
                  <p className={cn('text-sm text-muted-foreground', wide && 'mt-1.5')}>
                    {category.copy}
                  </p>
                  {/* Pastilles plutot que liste a coches : le fond porte la
                      teinte du domaine, le texte garde l'encre sourde — une
                      teinte vive en texte plafonne a 2,2:1 de contraste. */}
                  <ul className="mt-4 flex flex-wrap gap-1.5">
                    {category.examples.map((example) => (
                      <li
                        key={example}
                        className="rounded-full px-2.5 py-1 text-xs text-muted-foreground"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${color} 15%, var(--bui-card))`,
                        }}
                      >
                        {example}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            </Reveal>
            );
          })}
        </div>
      </section>

      {/* ─── Comment ça marche ────────────────────────────────────────────── */}
      <section className="border-y border-border bg-card">
        <div className="site-shell py-16">
          <Reveal>
            <Badge variant="secondary">{m.howBadge}</Badge>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              {m.howTitle}
            </h2>
          </Reveal>
          <div className="relative mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Ligne de liaison desktop */}
            <div
              className="absolute top-5 right-0 left-0 hidden h-px bg-border lg:block"
              aria-hidden
            />
            {m.steps.map((step, index) => {
              const StepIcon = PROVIDER_STEP_ICONS[index];
              return (
              <Reveal key={step.title} delay={((index % 4) + 1) as 1 | 2 | 3 | 4}>
                <div className="relative">
                  <div className="flex items-center gap-3">
                    <span className="relative z-10 flex size-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground tabular-nums">
                      {index + 1}
                    </span>
                    <StepIcon className="size-5 text-primary" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{step.copy}</p>
                </div>
              </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Mockup : la vue prestataire (projection réelle Opérations) ───── */}
      <section className="site-shell py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <Badge variant="outline">{m.appEyebrow}</Badge>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
              {m.appTitle}
            </h2>
            <p className="mt-3 max-w-md text-muted-foreground">
              {m.appCopy}
            </p>
            <ul className="mt-5 flex flex-col gap-2.5 text-sm">
              {m.appPoints.map((point) => (
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
              {m.benefitsTitle}
            </h2>
          </Reveal>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {m.benefits.map((benefit, index) => {
              const BenefitIcon = PROVIDER_BENEFIT_ICONS[index];
              return (
              <Reveal key={benefit.title} delay={((index % 4) + 1) as 1 | 2 | 3 | 4}>
                <div className="h-full rounded-2xl border border-border bg-background p-5">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <BenefitIcon className="size-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold">{benefit.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{benefit.copy}</p>
                </div>
              </Reveal>
              );
            })}
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
                {m.finalTitle}
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-primary-foreground/85">
                {m.finalCopy}
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button size="lg" variant="secondary" asChild>
                  <Link to="/prestataires/inscription">
                    {m.ctaJoin} <ArrowRightIcon />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                  asChild
                >
                  <a href="https://wa.me/212600000000" target="_blank" rel="noreferrer">
                    <MessageCircleIcon /> {m.finalQuestion}
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
