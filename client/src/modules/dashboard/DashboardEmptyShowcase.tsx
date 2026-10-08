import { useEffect, useId, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRightIcon, BrushIcon, CheckIcon, CircleCheckIcon, LayoutDashboardIcon,
  LogInIcon, LogOutIcon, PlusIcon, TrendingUpIcon,
} from '../../icons/glyphs';
import { useTranslation } from '../../hooks/useTranslation';
import { Button, Card } from '../../components/ui';
import { StoryPage, StorySection } from '../../components/baitly/FeatureStory';
import { usePrefersReducedMotion } from '../../components/baitly/ShowcaseCycler';
import { cn } from '../../utils/cn';
import './dashboardEmpty.css';

const SCENES = ['day', 'performance', 'priorities', 'customize'] as const;
type Scene = typeof SCENES[number];
const SETUP_STEPS = ['properties', 'bookings', 'widgets'] as const;
const SOURCES = ['stays', 'amounts', 'operations', 'reviews'] as const;
const REVENUE_BARS = [0.32, 0.48, 0.41, 0.66, 0.56, 0.83, 0.71, 0.94];

interface DashboardDemoProps {
  scene: Scene;
  onSelect: (scene: Scene) => void;
}

/** Aperçu isolé : aucune donnée ni action de cette démonstration ne touche le compte. */
function DashboardDemo({ scene, onSelect }: DashboardDemoProps) {
  const { t, currentLanguage } = useTranslation();
  const [resolved, setResolved] = useState(false);
  const [widgetAdded, setWidgetAdded] = useState(false);
  const number = (value: number) => value.toLocaleString(currentLanguage);
  const money = new Intl.NumberFormat(currentLanguage, {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(4860);

  return (
    <div className="db-empty-demo rounded-2xl bg-muted/60 p-3 sm:p-4" role="group" aria-label={t('dashboard.firstUse.demo.accessibleLabel')}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-2 font-medium text-foreground">
          <LayoutDashboardIcon className="size-4" aria-hidden />
          {t('dashboard.title')}
        </span>
        <span>{t('dashboard.firstUse.demo.example')}</span>
      </div>

      <Card className="db-empty-panel px-3 py-3" data-active={scene === 'performance'}>
        <dl className="m-0 grid grid-cols-3 gap-2">
          {[
            [t('dashboard.firstUse.demo.occupancy'), `${number(73)} %`],
            [t('dashboard.firstUse.demo.revenue'), money],
            [t('dashboard.firstUse.demo.bookings'), number(12)],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[11px] leading-snug text-muted-foreground">{label}</dt>
              <dd className="m-0 mt-1 text-base font-semibold tabular-nums text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="my-3 grid grid-cols-3 gap-2" aria-label={t('dashboard.firstUse.demo.today')}>
        {[
          { key: 'arrivals', icon: LogInIcon, count: 3 },
          { key: 'departures', icon: LogOutIcon, count: 2 },
          { key: 'cleaning', icon: BrushIcon, count: 2 },
        ].map(({ key, icon: Icon, count }) => (
          <button
            key={key}
            type="button"
            className="db-empty-day cursor-pointer rounded-lg px-2 py-2 text-start outline-none transition-colors duration-200 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            data-active={scene === 'day'}
            onClick={() => onSelect('day')}
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold tabular-nums text-foreground">
              <Icon className="size-3.5 shrink-0" aria-hidden />{number(count)}
            </span>
            <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">{t(`dashboard.firstUse.demo.${key}`)}</span>
          </button>
        ))}
      </div>

      <div className="db-empty-demo-grid grid gap-3">
        <Card className="db-empty-panel min-w-0 p-3" data-active={scene === 'performance'}>
          <button type="button" onClick={() => onSelect('performance')} className="db-empty-label">
            <TrendingUpIcon className="size-3.5 shrink-0" aria-hidden />
            {t('dashboard.firstUse.demo.trend')}
          </button>
          <div className="mt-4 flex h-20 items-end gap-1.5 border-b border-border pb-1" aria-hidden>
            {REVENUE_BARS.map((height, index) => (
              <div key={index} className="relative h-full min-w-0 flex-1">
                <span
                  className="db-empty-revenue-bar absolute inset-0 rounded-t-sm bg-success"
                  style={{ '--bar-height': height, '--bar-delay': `${index * 55}ms` } as CSSProperties}
                />
              </div>
            ))}
          </div>
          <p className="m-0 mt-2 text-[11px] text-muted-foreground">{t('dashboard.firstUse.demo.period')}</p>
        </Card>

        <Card className="db-empty-panel min-w-0 p-3" data-active={scene === 'priorities'}>
          <button type="button" onClick={() => onSelect('priorities')} className="db-empty-label">
            <CircleCheckIcon className="size-3.5 shrink-0" aria-hidden />
            {t('dashboard.firstUse.demo.priorities')}
            <span className="ms-auto tabular-nums">{number(resolved ? 1 : 2)}</span>
          </button>
          <div className="mt-3 text-xs leading-relaxed">
            <p className={cn('m-0', resolved ? 'text-success-ink' : 'text-foreground')} aria-live="polite">
              {resolved ? t('dashboard.firstUse.demo.assigned') : t('dashboard.firstUse.demo.assignCleaning')}
            </p>
            <button
              type="button"
              disabled={resolved}
              onClick={() => { onSelect('priorities'); setResolved(true); }}
              className="mt-1 inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-md px-1 text-xs font-medium text-primary underline underline-offset-4 outline-none transition-colors duration-200 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:text-success-ink disabled:no-underline"
            >
              {resolved ? <CheckIcon className="size-3.5" aria-hidden /> : <ArrowRightIcon className="size-3.5 rtl:rotate-180" aria-hidden />}
              {resolved ? t('dashboard.firstUse.demo.done') : t('dashboard.firstUse.demo.tryAction')}
            </button>
            <p className="m-0 mt-2 border-t border-border pt-2 text-muted-foreground">{t('dashboard.firstUse.demo.checkPayment')}</p>
          </div>
        </Card>
      </div>

      <Card className="db-empty-panel db-empty-bottom mt-3 min-w-0 p-3" data-active={scene === 'day' || scene === 'customize'}>
        {scene === 'customize' ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-foreground">{t('dashboard.firstUse.demo.yourWidgets')}</span>
              <button
                type="button"
                disabled={widgetAdded}
                onClick={() => { onSelect('customize'); setWidgetAdded(true); }}
                className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-xs font-medium text-primary outline-none transition-colors duration-200 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:text-success-ink"
              >
                {widgetAdded ? <CheckIcon className="size-3.5" aria-hidden /> : <PlusIcon className="size-3.5" aria-hidden />}
                {widgetAdded ? t('dashboard.firstUse.demo.widgetAdded') : t('dashboard.firstUse.demo.addWidget')}
              </button>
            </div>
            <div className="mt-2" aria-live="polite">
              {widgetAdded ? (
                <div className="db-empty-appear grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-xs">
                  <span className="text-muted-foreground">{t('dashboard.firstUse.demo.propertyOccupancy')}</span>
                  <span className="tabular-nums text-foreground">{number(73)} %</span>
                  <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <span className="block h-full w-[73%] rounded-full bg-primary" />
                  </span>
                </div>
              ) : <p className="m-0 text-xs leading-relaxed text-muted-foreground">{t('dashboard.firstUse.demo.addHint')}</p>}
            </div>
          </>
        ) : (
          <>
            <button type="button" onClick={() => onSelect('day')} className="db-empty-label">
              {t('dashboard.firstUse.demo.nextArrivals')}
              <ArrowRightIcon className="ms-auto size-3.5 rtl:rotate-180" aria-hidden />
            </button>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden>SL</span>
              <div className="min-w-0 flex-1">
                <span className="block font-medium text-foreground">Sofia L.</span>
                <span className="text-muted-foreground">{t('dashboard.firstUse.demo.sampleProperty')}</span>
              </div>
              <time className="font-medium tabular-nums text-foreground">15:00</time>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

export interface DashboardEmptyShowcaseProps {
  onConnect: () => void;
}

/** Premier usage de la vue gestionnaire, avant le premier logement ajouté ou importé. */
export default function DashboardEmptyShowcase({ onConnect }: DashboardEmptyShowcaseProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reducedMotion = usePrefersReducedMotion();
  const [scene, setScene] = useState<Scene>('day');
  const [interacted, setInteracted] = useState(false);
  const id = useId();

  useEffect(() => {
    if (reducedMotion || interacted) return;
    const timer = window.setInterval(() => {
      setScene((current) => SCENES[(SCENES.indexOf(current) + 1) % SCENES.length]);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [reducedMotion, interacted]);

  const selectScene = (next: Scene) => {
    setInteracted(true);
    setScene(next);
  };

  return (
    <div className="db-empty-showcase mx-auto w-full max-w-6xl px-4 pt-5 pb-10 sm:px-6 sm:pt-7">
      <StoryPage className="gap-10 sm:gap-12">
        <section className="db-empty-intro grid items-start gap-8" aria-labelledby={`${id}-title`}>
          <div className="min-w-0">
            <h2 id={`${id}-title`} className="cn-font-heading m-0 text-2xl font-semibold leading-tight text-balance text-foreground sm:text-3xl xl:text-4xl">
              {t('dashboard.firstUse.title')}
            </h2>
            <p className="m-0 mt-4 max-w-prose text-base leading-relaxed text-muted-foreground">{t('dashboard.firstUse.lede')}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => navigate('/properties/new')}>{t('dashboard.firstUse.addProperty')}</Button>
              <Button size="lg" variant="outline" onClick={onConnect}>{t('dashboard.firstUse.connectChannels')}</Button>
            </div>
            <p className="m-0 mt-3 text-sm leading-relaxed text-muted-foreground">{t('dashboard.firstUse.activationNote')}</p>

            <section className="mt-7 border-t border-border pt-5" aria-labelledby={`${id}-setup`}>
              <h3 id={`${id}-setup`} className="m-0 text-base font-semibold text-foreground">{t('dashboard.firstUse.setupTitle')}</h3>
              <ol className="m-0 mt-4 flex list-none flex-col gap-5 p-0">
                {SETUP_STEPS.map((step, index) => (
                  <li key={step} className="flex items-start gap-3">
                    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground">{index + 1}</span>
                    <div className="min-w-0">
                      <h4 className="m-0 text-sm font-medium text-foreground">{t(`dashboard.firstUse.setup.${step}.title`)}</h4>
                      <p className="m-0 mt-1 text-sm leading-relaxed text-muted-foreground">{t(`dashboard.firstUse.setup.${step}.detail`)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <section className="min-w-0" aria-labelledby={`${id}-demo`} onFocusCapture={() => setInteracted(true)}>
            <h3 id={`${id}-demo`} className="m-0 mb-3 text-xs font-medium text-muted-foreground">{t('dashboard.firstUse.demoTitle')}</h3>
            <DashboardDemo scene={scene} onSelect={selectScene} />
            <ol className="m-0 mt-4 flex list-none flex-col gap-1 p-0">
              {SCENES.map((key, index) => (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => selectScene(key)}
                    aria-current={scene === key || undefined}
                    aria-expanded={scene === key}
                    aria-controls={`${id}-${key}`}
                    className={cn('flex w-full cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 text-start outline-none transition-colors duration-200 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring', scene === key && 'bg-accent')}
                  >
                    <span className={cn('mt-px inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums', scene === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{index + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">{t(`dashboard.firstUse.scenes.${key}.title`)}</span>
                      <span id={`${id}-${key}`} hidden={scene !== key} className="db-empty-detail">
                        <span className="block pt-1 text-sm leading-relaxed text-muted-foreground">{t(`dashboard.firstUse.scenes.${key}.detail`)}</span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        </section>

        <StorySection title={t('dashboard.firstUse.sourcesTitle')} lede={t('dashboard.firstUse.sourcesLede')} className="border-t border-border pt-6">
          <dl className="db-empty-sources m-0 grid gap-x-10">
            {SOURCES.map((source) => (
              <div key={source} className="grid gap-1 border-b border-border py-4">
                <dt className="text-sm font-medium text-foreground">{t(`dashboard.firstUse.sources.${source}.title`)}</dt>
                <dd className="m-0 text-sm leading-relaxed text-muted-foreground">{t(`dashboard.firstUse.sources.${source}.detail`)}</dd>
              </div>
            ))}
          </dl>
          <p className="m-0 flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
            <CheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t('dashboard.firstUse.liveNote')}
          </p>
        </StorySection>
      </StoryPage>
    </div>
  );
}
