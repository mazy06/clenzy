import SiteAcquisitionLink from '../components/SiteAcquisitionLink';
import { ArrowRightIcon, CheckIcon } from 'lucide-react';
import { Badge, Button } from '../../src/components/ui';
import Reveal from '../components/Reveal';
import { SOLUTIONS } from '../data/catalog';
import { SOLUTION_PHOTO } from '../data/navVisuals';
import { cn } from '../../src/utils/cn';
import { useSiteLanguage } from '../lib/siteLanguage';
import { solutionText } from '../lib/messages/solutions';
import { PAGE_MESSAGES } from '../lib/messages/pages';

export default function SolutionsPage() {
  const { language } = useSiteLanguage();
  const m = PAGE_MESSAGES[language].solutions;
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
        <div className="flex flex-col gap-6">
          {SOLUTIONS.map((solution, index) => {
            const text = solutionText(solution.slug, language);
            /* Les rangees alternent le cote de la photo : six blocs identiques
               empiles se liraient comme une seule masse. */
            const flipped = index % 2 === 1;
            return (
            <Reveal key={solution.slug}>
              <article
                id={solution.slug}
                className="grid scroll-mt-24 grid-cols-1 items-stretch overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-2"
              >
                {/* La photo va jusqu'au bord de la carte : un visuel flottant
                    dans du remplissage n'aurait pas le meme poids. */}
                <div
                  className={cn(
                    'relative min-h-[220px] overflow-hidden lg:min-h-[300px]',
                    flipped && 'lg:order-2',
                  )}
                >
                  <img
                    src={SOLUTION_PHOTO[solution.slug]}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover"
                  />
                </div>
                <div className="flex flex-col justify-center p-8 lg:p-10">
                  <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                    {text.name}
                  </h2>
                  <p className="mt-2 text-muted-foreground">{text.copy}</p>
                  {/* Les points redeviennent une liste : ils etaient promus en
                      boites grises pour remplir la moitie vide de la rangee. */}
                  <ul className="mt-5 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                    {text.points.map((point) => (
                      <li key={point} className="flex items-start gap-2 text-sm">
                        <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-success" />
                        {point}
                      </li>
                    ))}
                  </ul>
                  <Button className="mt-6 self-start" variant="outline" asChild>
                    <SiteAcquisitionLink to="/demo">
                      {m.cta} <ArrowRightIcon />
                    </SiteAcquisitionLink>
                  </Button>
                </div>
              </article>
            </Reveal>
            );
          })}
        </div>
      </section>
    </>
  );
}
