import SiteAcquisitionLink from '../components/SiteAcquisitionLink';
import { ArrowRightIcon, CheckIcon, MinusIcon } from 'lucide-react';
import { Badge, Button } from '../../src/components/ui';
import Reveal from '../components/Reveal';
import { useSiteLanguage } from '../lib/siteLanguage';
import { PAGE_MESSAGES } from '../lib/messages/pages';

/**
 * Qui coche quoi, ligne par ligne — l'ordre suit `compare.matrix` du
 * dictionnaire. Les libelles sont traduits, les verdicts ne le sont pas.
 */
const MARKS: Array<{ baitly: boolean; intl: boolean; local: boolean }> = [
  { baitly: true, intl: false, local: false },
  { baitly: true, intl: false, local: true },
  { baitly: true, intl: false, local: false },
  { baitly: true, intl: true, local: false },
  { baitly: true, intl: true, local: false },
  { baitly: true, intl: false, local: false },
  { baitly: true, intl: false, local: false },
];

function Mark({ on }: { on: boolean }) {
  return on ? (
    <CheckIcon className="mx-auto size-4 text-success" />
  ) : (
    <MinusIcon className="mx-auto size-4 text-muted-foreground/50" />
  );
}

export default function ComparePage() {
  const { language } = useSiteLanguage();
  const m = PAGE_MESSAGES[language].compare;
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
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full border-collapse bg-card text-sm">
              <thead>
                <tr className="border-b border-border text-start">
                  <th className="p-4 text-start font-medium text-muted-foreground">
                    {m.columns.capability}
                  </th>
                  <th className="p-4 font-semibold">{m.columns.baitly}</th>
                  <th className="p-4 font-medium text-muted-foreground">{m.columns.intl}</th>
                  <th className="p-4 font-medium text-muted-foreground">{m.columns.local}</th>
                </tr>
              </thead>
              <tbody>
                {m.matrix.map((label, index) => (
                  <tr key={label} className="border-b border-border last:border-0">
                    <td className="p-4">{label}</td>
                    <td className="p-4 text-center">
                      <Mark on={MARKS[index].baitly} />
                    </td>
                    <td className="p-4 text-center">
                      <Mark on={MARKS[index].intl} />
                    </td>
                    <td className="p-4 text-center">
                      <Mark on={MARKS[index].local} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
        <Reveal className="mt-2">
          <p className="text-xs text-muted-foreground">
            {m.footnote}
          </p>
        </Reveal>
      </section>

      <section className="border-y border-border bg-card">
        <div className="site-shell py-14">
          <Reveal>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {m.matrixTitle}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {m.matrixCopy}
            </p>
          </Reveal>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {m.competitors.map((competitor, index) => (
              <Reveal key={competitor.name} delay={((index % 3) + 1) as 1 | 2 | 3}>
                <div className="flex h-full flex-col gap-2 rounded-xl border border-border bg-background p-5">
                  <h3 className="text-sm font-semibold">{competitor.name}</h3>
                  <p className="flex-1 text-xs text-muted-foreground">{competitor.copy}</p>
                  <Badge variant="outline" className="self-start">
                    {m.soon}
                  </Badge>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <Reveal>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {m.closingTitle}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
            {m.closingCopy}
          </p>
          <Button size="lg" className="mt-6" asChild>
            <SiteAcquisitionLink to="/demo">
              {m.cta} <ArrowRightIcon />
            </SiteAcquisitionLink>
          </Button>
        </Reveal>
      </section>
    </>
  );
}
