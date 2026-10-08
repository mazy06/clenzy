import { lazy, Suspense, useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check } from '../../icons/glyphs';
import { Button } from '../ui';
import { StoryPage } from '../baitly/FeatureStory';
import { usePrefersReducedMotion } from '../baitly/ShowcaseCycler';
import { useTranslation } from '../../hooks/useTranslation';
import { propertiesListKeys } from '../../hooks/usePropertiesList';
import { cn } from '../../utils/cn';
import { demoKind, type FirstUseModule } from './catalog';
import ModuleFirstUseDemo from './ModuleFirstUseDemo';
import './moduleFirstUse.css';

const ImportDialog = lazy(() => import('../../modules/settings/components/ChannexMappingDialog'));
const STEPS = [0, 1, 2] as const;

export default function ModuleFirstUseShowcase({ module, screen, title, onOpenWorkspace }: {
  module: FirstUseModule;
  screen: string;
  title: string;
  onOpenWorkspace: () => void;
}) {
  const { t, currentLanguage } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const id = useId();
  const reducedMotion = usePrefersReducedMotion();
  const [scene, setScene] = useState(0);
  const [interacted, setInteracted] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const prefix = `moduleFirstUse.screens.${module}.${screen}`;

  useEffect(() => {
    if (reducedMotion || interacted) return;
    const timer = window.setInterval(() => setScene((current) => (current + 1) % STEPS.length), 6500);
    return () => window.clearInterval(timer);
  }, [reducedMotion, interacted]);

  const selectScene = (value: number) => { setInteracted(true); setScene(value); };
  return <div className="mu-first-use mx-auto w-full max-w-6xl px-4 pt-5 pb-10 sm:px-6 sm:pt-7">
    <StoryPage className="gap-8">
      <section className="mu-intro grid items-start gap-8" aria-labelledby={`${id}-title`}>
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="cn-font-heading m-0 text-2xl font-semibold leading-tight text-balance text-foreground sm:text-3xl xl:text-4xl">{t(`${prefix}.title`)}</h2>
          <p className="m-0 mt-4 max-w-prose text-base leading-relaxed text-muted-foreground">{t(`${prefix}.lede`)}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" onClick={() => navigate('/properties/new')}>{t('propertiesFirstUse.add')}</Button>
            <Button size="lg" variant="outline" onClick={() => setImportOpen(true)}>{t('propertiesFirstUse.import')}</Button>
          </div>
          <p className="m-0 mt-3 text-sm leading-relaxed text-muted-foreground">{t('moduleFirstUse.activation')}</p>
          <section className="mt-7 border-t border-border pt-5" aria-labelledby={`${id}-setup`}>
            <h3 id={`${id}-setup`} className="m-0 text-base font-semibold text-foreground">{t('moduleFirstUse.setupTitle')}</h3>
            <ol className="m-0 mt-4 flex list-none flex-col gap-4 p-0">
              {STEPS.map((step) => <li key={step} className="flex items-start gap-3">
                <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground">{(step + 1).toLocaleString(currentLanguage)}</span>
                <p className="m-0 text-sm leading-relaxed text-muted-foreground">{t(`moduleFirstUse.setup.${module}.${step}`)}</p>
              </li>)}
            </ol>
            <Button className="mt-4 h-auto whitespace-normal px-0 text-start" variant="link" onClick={onOpenWorkspace}>
              {t('moduleFirstUse.openWorkspace')}<ArrowRight className="size-4 shrink-0 rtl:rotate-180" aria-hidden />
            </Button>
          </section>
        </div>
        <section className="min-w-0" aria-labelledby={`${id}-preview`} onFocusCapture={() => setInteracted(true)}>
          <h3 id={`${id}-preview`} className="m-0 mb-3 text-xs font-medium text-muted-foreground">{t('moduleFirstUse.preview', { title })}</h3>
          <div className="rounded-2xl bg-muted/60 p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium text-foreground">{title}</span>
              <span className="text-muted-foreground">{t('moduleFirstUse.example')}</span>
            </div>
            <ModuleFirstUseDemo kind={demoKind(module, screen)} prefix={prefix} scene={scene} onSelect={selectScene} />
          </div>
          <ol className="m-0 mt-4 flex list-none flex-col gap-1 p-0">
            {STEPS.map((step) => <li key={step}>
              <button type="button" onClick={() => selectScene(step)} aria-current={scene === step || undefined} aria-expanded={scene === step} aria-controls={`${id}-step-${step}`}
                className={cn('flex w-full cursor-pointer items-start gap-3 rounded-lg px-3 py-3 text-start outline-none transition-colors duration-200 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring', scene === step && 'bg-accent')}>
                <span className={cn('inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums', scene === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{(step + 1).toLocaleString(currentLanguage)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{t(`${prefix}.steps.${step}.title`)}</span>
                  <span id={`${id}-step-${step}`} hidden={scene !== step} className="mu-reveal"><span className="block pt-1 text-sm leading-relaxed text-muted-foreground">{t(`${prefix}.steps.${step}.detail`)}</span></span>
                </span>
              </button>
            </li>)}
          </ol>
        </section>
      </section>
      <p className="m-0 flex items-start gap-2 border-t border-border pt-5 text-sm leading-relaxed text-muted-foreground"><Check className="mt-0.5 size-4 shrink-0" aria-hidden />{t('moduleFirstUse.safeDemo')}</p>
    </StoryPage>
    {importOpen && <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">{t('common.loading')}</p>}><ImportDialog open guided onClose={() => { setImportOpen(false); void queryClient.invalidateQueries({ queryKey: propertiesListKeys.all }); }} /></Suspense>}
  </div>;
}
