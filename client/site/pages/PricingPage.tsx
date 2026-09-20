import { Link } from 'react-router-dom';
import { ArrowRightIcon, CheckIcon } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
} from '../../src/components/ui';
import { cn } from '../../src/utils/cn';
import Reveal from '../components/Reveal';
import { useSiteLanguage } from '../lib/siteLanguage';
import { PRICING_MESSAGES } from '../lib/messages/pricing';

export default function PricingPage() {
  const { language } = useSiteLanguage();
  const m = PRICING_MESSAGES[language];
  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <div className="hero-grid absolute inset-x-0 top-0 h-64 -z-10" aria-hidden />
        <div className="site-shell pt-16 pb-12 text-center">
          <Reveal>
            <Badge variant="outline">{m.eyebrow}</Badge>
          </Reveal>
          <Reveal delay={1}>
            <h1 className="mx-auto mt-4 max-w-3xl text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
              {m.title}
            </h1>
          </Reveal>
          <Reveal delay={2}>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              {m.intro}
            </p>
          </Reveal>
        </div>
      </section>

      <section className="site-shell py-16">
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
          {m.plans.map((plan, index) => (
            <Reveal key={plan.name} delay={(index + 1) as 1 | 2 | 3}>
              <div
                className={cn(
                  'flex h-full flex-col rounded-2xl border p-6',
                  plan.featured
                    ? 'border-primary bg-primary-soft shadow-brand'
                    : 'border-border bg-card',
                )}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">{plan.name}</h2>
                  {plan.featured && <Badge>{m.recommended}</Badge>}
                </div>
                <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">
                  {plan.price}
                  <span className="text-sm font-normal text-muted-foreground">{plan.unit}</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{plan.copy}</p>
                <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-success" /> {feature}
                    </li>
                  ))}
                </ul>
                <Button className="mt-6" variant={plan.featured ? 'default' : 'outline'} asChild>
                  <Link to="/demo">
                    {plan.quoteOnly ? m.ctaTalk : m.ctaStart}
                  </Link>
                </Button>
              </div>
            </Reveal>
          ))}
        </div>
        {m.subsidy && (
          <Reveal className="mt-4">
            <p className="text-center text-xs text-muted-foreground">
              {m.subsidy.copy}{' '}
              <Link to="/demo" className="font-medium text-foreground underline">
                {m.subsidy.link}
              </Link>
            </p>
          </Reveal>
        )}
      </section>

      <section className="border-y border-border bg-card">
        <div className="site-shell py-14">
          <Reveal>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {m.addonsTitle}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {m.addonsCopy}
            </p>
          </Reveal>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {m.addons.map((addon, index) => (
              <Reveal key={addon.name} delay={((index % 4) + 1) as 1 | 2 | 3 | 4}>
                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-sm font-semibold">{addon.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{addon.copy}</p>
                  <p className="mt-3 text-xs">
                    <span className="font-semibold tabular-nums">—</span>
                    <span className="text-muted-foreground"> {m.perMonth} · </span>
                    <Badge variant="outline">{m.addonsPending}</Badge>
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16">
        <Reveal>
          <h2 className="mb-6 text-xl font-semibold tracking-tight sm:text-2xl">
            {m.faqTitle}
          </h2>
        </Reveal>
        <Accordion type="single" collapsible className="w-full">
          {m.faq.map((item, index) => (
            <AccordionItem key={item.q} value={`faq-${index}`}>
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">{item.a}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <Reveal className="mt-8 text-center">
          <Button size="lg" asChild>
            <Link to="/demo">
              {m.ctaDemo} <ArrowRightIcon />
            </Link>
          </Button>
        </Reveal>
      </section>
    </>
  );
}
