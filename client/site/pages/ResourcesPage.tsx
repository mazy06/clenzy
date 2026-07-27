import { Badge } from '../../src/components/ui';
import Reveal from '../components/Reveal';
import { RESOURCES } from '../data/catalog';

export default function ResourcesPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <div className="hero-grid absolute inset-x-0 top-0 h-64 -z-10" aria-hidden />
        <div className="site-shell pt-16 pb-12">
          <Reveal>
            <Badge variant="outline">Ressources</Badge>
          </Reveal>
          <Reveal delay={1}>
            <h1 className="mt-4 max-w-3xl text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
              La donnée et le savoir-faire, en accès libre.
            </h1>
          </Reveal>
          <Reveal delay={2}>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              Baromètre de marché, calculateurs, guides réglementaires : ce que nous apprenons en
              opérant Baitly, nous le partageons.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="site-shell py-16">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RESOURCES.map((resource, index) => (
            <Reveal key={resource.name} delay={((index % 3) + 1) as 1 | 2 | 3}>
              <div className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-6">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <resource.icon className="size-4.5" />
                </span>
                <div className="flex-1">
                  <h2 className="text-base font-semibold">{resource.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{resource.copy}</p>
                </div>
                <Badge variant="outline" className="self-start">
                  {resource.tag}
                </Badge>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
