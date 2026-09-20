import { CheckIcon } from 'lucide-react';
import { Badge } from '../../src/components/ui';
import Reveal from '../components/Reveal';
import { useSiteLanguage } from '../lib/siteLanguage';
import { PAGE_MESSAGES } from '../lib/messages/pages';

export default function StatusPage() {
  const { language } = useSiteLanguage();
  const m = PAGE_MESSAGES[language].status;
  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <div className="hero-grid absolute inset-x-0 top-0 h-56 -z-10" aria-hidden />
        <div className="mx-auto max-w-4xl px-4 pt-16 pb-10">
          <Reveal>
            <Badge variant="outline">{m.eyebrow}</Badge>
          </Reveal>
          <Reveal delay={1} className="mt-4 flex flex-wrap items-center gap-3">
            <span className="pulse-dot inline-flex size-3 rounded-full bg-success" />
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {m.title}
            </h1>
          </Reveal>
          <Reveal delay={2}>
            <p className="mt-3 text-muted-foreground">
              {m.intro}
            </p>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-12">
        <Reveal>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            {m.components.map((component) => (
              <div
                key={component}
                className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5 last:border-0"
              >
                <span className="text-sm font-medium">{component}</span>
                <Badge variant="success">
                  <CheckIcon /> {m.operational}
                </Badge>
              </div>
            ))}
          </div>
        </Reveal>
        <Reveal className="mt-4">
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center">
            <div className="shrink-0">
              <p className="text-2xl font-semibold tabular-nums">99,5 %</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{m.targetLabel}</p>
            </div>
            <div className="sm:border-s sm:border-border sm:ps-5">
              <p className="text-sm font-semibold">{m.measurementTitle}</p>
              <p className="mt-1 text-xs text-muted-foreground">{m.measurementCopy}</p>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-16">
        <Reveal>
          <h2 className="text-xl font-semibold tracking-tight">{m.incidentsTitle}</h2>
        </Reveal>
        <Reveal className="mt-4">
          <p className="rounded-xl border border-dashed border-border bg-card px-5 py-6 text-center text-sm text-muted-foreground">
            {m.noIncidents}
          </p>
        </Reveal>
        <Reveal className="mt-6">
          <p className="text-xs text-muted-foreground">
            {m.subscribe}
          </p>
        </Reveal>
      </section>
    </>
  );
}
