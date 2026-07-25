import { Link } from 'react-router-dom';
import { ArrowRightIcon, CheckIcon } from 'lucide-react';
import { Badge, Button } from '../../src/components/ui';
import Reveal from '../components/Reveal';
import { SOLUTIONS } from '../data/catalog';

export default function SolutionsPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <div className="hero-grid absolute inset-x-0 top-0 h-64 -z-10" aria-hidden />
        <div className="mx-auto max-w-6xl px-4 pt-16 pb-12">
          <Reveal>
            <Badge variant="outline">Solutions</Badge>
          </Reveal>
          <Reveal delay={1}>
            <h1 className="mt-4 max-w-3xl text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
              Le même moteur. Votre façon de travailler.
            </h1>
          </Reveal>
          <Reveal delay={2}>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              Conciergerie, hôte indépendant, riad ou portefeuille multi-propriétaires : Baitly
              s'adapte au périmètre, aux rôles et à la réglementation de chacun.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex flex-col gap-6">
          {SOLUTIONS.map((solution, index) => (
            <Reveal key={solution.slug}>
              <article
                id={solution.slug}
                className={`grid scroll-mt-24 grid-cols-1 items-center gap-8 rounded-2xl border border-border bg-card p-8 lg:grid-cols-2 ${
                  index % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : ''
                }`}
              >
                <div>
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <solution.icon className="size-5" />
                  </span>
                  <h2 className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">
                    {solution.name}
                  </h2>
                  <p className="mt-2 text-muted-foreground">{solution.copy}</p>
                  <Button className="mt-5" variant="outline" asChild>
                    <Link to="/demo">
                      En parler avec nous <ArrowRightIcon />
                    </Link>
                  </Button>
                </div>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {solution.points.map((point) => (
                    <li
                      key={point}
                      className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                    >
                      <CheckIcon className="size-3.5 shrink-0 text-success" /> {point}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
