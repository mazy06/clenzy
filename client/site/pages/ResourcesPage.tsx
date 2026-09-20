import { Badge } from '../../src/components/ui';
import Reveal from '../components/Reveal';
import { RESOURCES } from '../data/catalog';
import { useSiteLanguage } from '../lib/siteLanguage';
import { resourceText } from '../lib/messages/solutions';
import { PAGE_MESSAGES } from '../lib/messages/pages';

export default function ResourcesPage() {
  const { language } = useSiteLanguage();
  const m = PAGE_MESSAGES[language].resources;
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RESOURCES.map((resource, index) => {
            const text = resourceText(resource.id, language);
            return (
            <Reveal key={resource.id} delay={((index % 3) + 1) as 1 | 2 | 3}>
              <div className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-6">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <resource.icon className="size-4.5" />
                </span>
                <div className="flex-1">
                  <h2 className="text-base font-semibold">{text.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{text.copy}</p>
                </div>
                <Badge variant="outline" className="self-start">
                  {text.tag}
                </Badge>
              </div>
            </Reveal>
            );
          })}
        </div>
      </section>
    </>
  );
}
