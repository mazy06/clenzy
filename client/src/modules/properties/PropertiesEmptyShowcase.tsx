import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckIcon, HomeIcon, TrendingUpIcon, TicketPercentIcon, BlocksIcon } from 'lucide-react';
import { Button } from '../../components/ui';
import { StoryPage } from '../../components/baitly/FeatureStory';
import { usePrefersReducedMotion } from '../../components/baitly/ShowcaseCycler';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';
import { PropertyDemo, PricingDemo, VoucherDemo, DevicesDemo } from './PropertyOnboardingDemos';
import './propertiesEmpty.css';

const PRESENTATIONS = {
  properties: { Demo: PropertyDemo, Icon: HomeIcon },
  pricing: { Demo: PricingDemo, Icon: TrendingUpIcon },
  vouchers: { Demo: VoucherDemo, Icon: TicketPercentIcon },
  'connected-objects': { Demo: DevicesDemo, Icon: BlocksIcon },
} as const;
export type PropertyIntroduction = keyof typeof PRESENTATIONS;
export function isPropertyIntroduction(key: string | undefined): key is PropertyIntroduction {
  return key !== undefined && Object.hasOwn(PRESENTATIONS, key);
}
const STEPS = [0, 1, 2, 3] as const;

/** Première visite seulement : le portefeuille réel reste la source de vérité. */
export default function PropertiesEmptyShowcase({ screen, onImport }: {
  screen: PropertyIntroduction;
  onImport: () => void;
}) {
  const { t, currentLanguage } = useTranslation();
  const navigate = useNavigate();
  const id = useId();
  const [scene, setScene] = useState(0);
  const [interacted, setInteracted] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const { Demo, Icon } = PRESENTATIONS[screen];
  const prefix = `propertiesFirstUse.${screen}`;

  useEffect(() => {
    if (reducedMotion || interacted) return;
    const timer = window.setInterval(() => setScene((current) => (current + 1) % STEPS.length), 6500);
    return () => window.clearInterval(timer);
  }, [reducedMotion, interacted]);

  const selectScene = (next: number) => { setInteracted(true); setScene(next); };

  return (
    <div className="pr-empty-showcase mx-auto w-full max-w-6xl px-4 pt-5 pb-10 sm:px-6 sm:pt-7">
      <StoryPage className="gap-7">
        <section className="pr-empty-intro grid items-start gap-8" aria-labelledby={`${id}-title`}>
          <div className="min-w-0">
            <h2 id={`${id}-title`} className="cn-font-heading m-0 text-2xl font-semibold leading-tight text-balance text-foreground sm:text-3xl xl:text-4xl">{t(`${prefix}.title`)}</h2>
            <p className="m-0 mt-4 text-base leading-relaxed text-muted-foreground">{t(`${prefix}.lede`)}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => navigate('/properties/new')}>{t('propertiesFirstUse.add')}</Button>
              <Button size="lg" variant="outline" onClick={onImport}>{t('propertiesFirstUse.import')}</Button>
            </div>
            <p className="m-0 mt-3 text-sm leading-relaxed text-muted-foreground">{t('propertiesFirstUse.activation')}</p>

            <section className="mt-7 border-t border-border pt-5" aria-labelledby={`${id}-setup`}>
              <h3 id={`${id}-setup`} className="m-0 text-base font-semibold text-foreground">{t('propertiesFirstUse.setupTitle')}</h3>
              <ol className="m-0 mt-4 flex list-none flex-col gap-5 p-0">
                {[0, 1, 2].map((step) => (
                  <li key={step} className="flex items-start gap-3">
                    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground">{(step + 1).toLocaleString(currentLanguage)}</span>
                    <div>
                      <h4 className="m-0 text-sm font-medium text-foreground">{t(`${prefix}.setup.${step}.title`)}</h4>
                      <p className="m-0 mt-1 text-sm leading-relaxed text-muted-foreground">{t(`${prefix}.setup.${step}.detail`)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <section className="min-w-0" aria-labelledby={`${id}-preview`} onFocusCapture={() => setInteracted(true)}>
            <h3 id={`${id}-preview`} className="m-0 mb-3 text-xs font-medium text-muted-foreground">{t(`${prefix}.preview`)}</h3>
            <div className="pr-empty-demo rounded-2xl bg-muted/60 p-3 sm:p-4" role="group" aria-label={t(`${prefix}.preview`)}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-2 font-medium text-foreground"><Icon className="size-4" aria-hidden />{t(`propertiesPage.tabs.${screen === 'connected-objects' ? 'connectedObjects' : screen}`)}</span>
                <span className="text-muted-foreground">{t('propertiesFirstUse.example')}</span>
              </div>
              <Demo scene={scene} onSelect={selectScene} />
            </div>
            <ol className="m-0 mt-4 flex list-none flex-col gap-1 p-0">
              {STEPS.map((step) => (
                <li key={step}>
                  <button type="button" onClick={() => selectScene(step)} aria-current={scene === step || undefined} aria-expanded={scene === step} aria-controls={`${id}-step-${step}`}
                    className={cn('flex w-full cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 text-start outline-none transition-colors duration-200 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring', scene === step && 'bg-accent')}>
                    <span className={cn('mt-px inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums', scene === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{(step + 1).toLocaleString(currentLanguage)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">{t(`${prefix}.scenes.${step}.title`)}</span>
                      <span id={`${id}-step-${step}`} hidden={scene !== step} className="pr-empty-detail"><span className="block pt-1 text-sm leading-relaxed text-muted-foreground">{t(`${prefix}.scenes.${step}.detail`)}</span></span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        </section>
        <p className="m-0 flex items-start gap-2 border-t border-border pt-5 text-sm leading-relaxed text-muted-foreground"><CheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />{t(`${prefix}.note`)}</p>
      </StoryPage>
    </div>
  );
}
