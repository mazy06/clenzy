import { Link } from 'react-router-dom';
import { ArrowRightIcon, CheckIcon, DatabaseIcon, FileSpreadsheetIcon, GlobeIcon, PlugIcon } from 'lucide-react';
import { Badge, Button } from '../../src/components/ui';
import Reveal from '../components/Reveal';
import { useSiteLanguage } from '../lib/siteLanguage';
import { PAGE_MESSAGES } from '../lib/messages/pages';

/** Les icones restent ici : elles ne se traduisent pas, l'ordre suit le dictionnaire. */
const CHANNEL_ICONS = [GlobeIcon, FileSpreadsheetIcon, PlugIcon, DatabaseIcon];

export default function MigrationPage() {
  const { language } = useSiteLanguage();
  const m = PAGE_MESSAGES[language].migration;
  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <div className="hero-grid absolute inset-x-0 top-0 h-64 -z-10" aria-hidden />
        <div className="site-shell pt-16 pb-12">
          <Reveal>
            <Badge variant="outline">{m.eyebrow}</Badge>
          </Reveal>
          <Reveal delay={1}>
            <h1 className="mt-4 max-w-3xl text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
              {m.title}
            </h1>
          </Reveal>
          <Reveal delay={2}>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              {m.intro}
            </p>
          </Reveal>
        </div>
      </section>

      <section className="site-shell py-16">
        <Reveal>
          <h2 className="mb-6 text-xl font-semibold tracking-tight sm:text-2xl">
            {m.channelsTitle}
          </h2>
        </Reveal>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {m.channels.map((channel, index) => {
            const Icon = CHANNEL_ICONS[index];
            return (
            <Reveal key={channel.name} delay={((index % 2) + 1) as 1 | 2}>
              <div className="flex h-full flex-col gap-2 rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <Icon className="size-4.5" />
                  </span>
                  <h3 className="text-sm font-semibold">{channel.name}</h3>
                  {channel.tag && (
                    <Badge variant="success" className="ms-auto">
                      {channel.tag}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{channel.copy}</p>
              </div>
            </Reveal>
            );
          })}
        </div>
      </section>

      <section className="border-y border-border bg-card">
        <div className="site-shell py-14">
          <Reveal>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {m.stepsTitle}
            </h2>
          </Reveal>
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-4">
            {m.steps.map((step, index) => (
              <Reveal key={step.title} delay={((index % 4) + 1) as 1 | 2 | 3 | 4}>
                <div className="relative">
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <h3 className="mt-3 text-sm font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{step.copy}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="site-shell py-16">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {m.guaranteesTitle}
            </h2>
            <ul className="mt-5 flex flex-col gap-3">
              {m.guarantees.map((guarantee) => (
                <li key={guarantee} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                    <CheckIcon className="size-3" />
                  </span>
                  {guarantee}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={2}>
            <div className="rounded-2xl bg-foreground p-8 text-background">
              <h3 className="text-lg font-semibold">{m.limitsTitle}</h3>
              <p className="mt-2 text-sm text-background/70">
                {m.limitsCopy}
              </p>
              <Button variant="secondary" className="mt-5" asChild>
                <Link to="/demo">
                  {m.cta} <ArrowRightIcon />
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
