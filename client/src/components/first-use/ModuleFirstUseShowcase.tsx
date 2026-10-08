import { lazy, Suspense, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, SparklesIcon } from '../../icons/glyphs';
import { Button } from '../ui';
import { NightStage, StageFoot, StageRail, useStageScene, type RailStep } from '../baitly/NightStage';
import { useTranslation } from '../../hooks/useTranslation';
import { propertiesListKeys } from '../../hooks/usePropertiesList';
import { demoKind, FIRST_USE_IMAGES, type FirstUseModule } from './catalog';
import ModuleFirstUseDemo from './ModuleFirstUseDemo';
import './moduleFirstUse.css';

const ImportDialog = lazy(() => import('../../modules/settings/components/ChannexMappingDialog'));
const STEPS = [0, 1, 2] as const;

/**
 * Première visite d'un module (réservations, interventions, devis, messagerie,
 * contrats, finances, rapports) : même scène bleu nuit que le reste de
 * l'application — le titre, deux gestes, un schéma qui bouge, trois étapes en
 * images. Les deux gestes sont ceux du vrai parcours de démarrage ; l'espace
 * réel reste accessible d'un clic en pied de scène.
 */
export default function ModuleFirstUseShowcase({ module, screen, title, onOpenWorkspace }: {
  module: FirstUseModule;
  screen: string;
  title: string;
  onOpenWorkspace: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const id = useId();
  const stage = useStageScene(STEPS.length, 5600);
  const [importOpen, setImportOpen] = useState(false);
  const prefix = `moduleFirstUse.screens.${module}.${screen}`;
  const images = FIRST_USE_IMAGES[`${module}.${screen}`] ?? FIRST_USE_IMAGES['reports.overview'];

  const steps: RailStep[] = STEPS.map((step) => ({ key: `${screen}-${step}`, image: images[step], label: t(`${prefix}.steps.${step}`) }));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-5 pb-10 sm:px-6 sm:pt-7">
      <NightStage
        headingId={`${id}-title`}
        icon={<SparklesIcon aria-hidden />}
        eyebrow={title}
        title={t(`${prefix}.title`)}
        actions={
          <>
            <Button size="lg" onClick={() => navigate('/properties/new')}>{t('propertiesFirstUse.add')}</Button>
            <Button size="lg" variant="outline" onClick={() => setImportOpen(true)}>{t('propertiesFirstUse.import')}</Button>
          </>
        }
        visual={
          <div role="group" aria-label={t('moduleFirstUse.preview', { title })}>
            <ModuleFirstUseDemo kind={demoKind(module, screen)} prefix={prefix} scene={stage.scene} onSelect={stage.select} />
          </div>
        }
        onVisualFocus={stage.takeOver}
        rail={<StageRail steps={steps} scene={stage} label={t('moduleFirstUse.preview', { title })} />}
      />
      <StageFoot note={t('propertiesFirstUse.note')}>
        <Button className="h-auto whitespace-normal px-0 text-start" variant="link" onClick={onOpenWorkspace}>
          {t('moduleFirstUse.openWorkspace')}<ArrowRight className="size-4 shrink-0 rtl:rotate-180" aria-hidden />
        </Button>
      </StageFoot>
      {importOpen && (
        <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">{t('common.loading')}</p>}>
          <ImportDialog open guided onClose={() => { setImportOpen(false); void queryClient.invalidateQueries({ queryKey: propertiesListKeys.all }); }} />
        </Suspense>
      )}
    </div>
  );
}
