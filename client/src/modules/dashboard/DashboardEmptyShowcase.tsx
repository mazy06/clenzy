import { useId, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BrushIcon, CheckIcon, EuroIcon, LayoutDashboardIcon, LogInIcon, LogOutIcon, PlusIcon, TrendingUpIcon,
} from '../../icons/glyphs';
import { useTranslation } from '../../hooks/useTranslation';
import { Button } from '../../components/ui';
import { FirstUseStage, Packshot, StageCard, StageFoot, StageRail, useStageScene, type RailStep } from '../../components/baitly/FirstUseStage';
import { STAGE_IMAGES } from '../../components/baitly/stageImages';
import './dashboardEmpty.css';

/**
 * Premier usage de la vue gestionnaire, avant le premier logement ajouté ou importé.
 *
 * Même grammaire que les autres écrans de première arrivée : une promesse, deux
 * gestes, l'aperçu des vrais widgets sur la scène bleu nuit, et un rail de
 * quatre étapes en images. Les indicateurs reprennent les illustrations du vrai
 * tableau de bord (occupation, revenus, réservations), donc l'aperçu ressemble
 * à l'écran qu'il annonce.
 */

const SCENES = [
  { key: 'day', image: STAGE_IMAGES.departures },
  { key: 'performance', image: STAGE_IMAGES.revenue },
  { key: 'priorities', image: STAGE_IMAGES.taskAssigned },
  { key: 'customize', image: STAGE_IMAGES.automation },
] as const;
type Scene = typeof SCENES[number]['key'];
const REVENUE_BARS = [0.32, 0.48, 0.41, 0.66, 0.56, 0.83, 0.71, 0.94];

interface DashboardDemoProps {
  scene: Scene;
  onSelect: (index: number) => void;
}

/** Aperçu isolé : aucune donnée ni action de cette démonstration ne touche le compte. */
function DashboardDemo({ scene, onSelect }: DashboardDemoProps) {
  const { t, currentLanguage } = useTranslation();
  const [resolved, setResolved] = useState(false);
  const [widgetAdded, setWidgetAdded] = useState(false);
  const number = (value: number) => value.toLocaleString(currentLanguage);
  const money = new Intl.NumberFormat(currentLanguage, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(4860);
  const index = (key: Scene) => SCENES.findIndex((item) => item.key === key);

  return (
    <StageCard icon={<LayoutDashboardIcon />} title={t('dashboard.title')} className="db-card">
      <dl className="db-empty-kpis m-0" role="group" aria-label={t('dashboard.firstUse.demoTitle')}>
        {[
          { label: t('dashboard.firstUse.demo.occupancy'), value: `${number(73)} %`, image: STAGE_IMAGES.occupancy },
          { label: t('dashboard.firstUse.demo.revenue'), value: money, image: STAGE_IMAGES.revenue },
          { label: t('dashboard.firstUse.demo.bookings'), value: number(12), image: STAGE_IMAGES.bookings },
        ].map((kpi) => (
          <div key={kpi.label} className="db-kpi ns-hl" data-hl={scene === 'performance'}>
            <Packshot src={kpi.image} size="sm" bare />
            <div className="min-w-0">
              <dt className="truncate">{kpi.label}</dt>
              <dd className="truncate">{kpi.value}</dd>
            </div>
          </div>
        ))}
      </dl>

      <div className="db-split">
        <div className="db-panel ns-hl" data-hl={scene === 'performance'}>
          <button type="button" className="flex w-full items-center gap-1.5 text-start text-xs font-medium text-[var(--ns-soft)]" onClick={() => onSelect(index('performance'))}>
            <TrendingUpIcon className="size-3.5 shrink-0 text-[var(--ns-brass)]" aria-hidden />
            <span className="truncate">{t('dashboard.firstUse.demo.trend')}</span>
          </button>
          <div className="db-bars" aria-hidden>
            {REVENUE_BARS.map((height, i) => (
              <span key={`${scene === 'performance'}-${i}`}>
                <i style={{ '--bar-height': height, '--bar-delay': `${i * 55}ms` } as CSSProperties} />
              </span>
            ))}
          </div>
        </div>

        <div className="db-panel ns-hl" data-hl={scene === 'priorities'} data-active={scene === 'priorities'}>
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--ns-soft)]">
            <Packshot src={STAGE_IMAGES.taskAssigned} size="xs" bare />
            <span className="min-w-0 flex-1 truncate">{t('dashboard.firstUse.demo.priorities')}</span>
            <span className="ns-chip tabular-nums" aria-hidden>{number(resolved ? 1 : 2)}</span>
          </div>
          <div className="mt-2 flex flex-col gap-1.5" aria-live="polite">
            <div className="db-task">
              <span className="db-task-icon"><BrushIcon aria-hidden /></span>
              <span className="ns-bar" />
              <button type="button" className="db-go" disabled={resolved}
                aria-label={resolved ? t('dashboard.firstUse.demo.assigned') : t('dashboard.firstUse.demo.assignCleaning')}
                onClick={() => { onSelect(index('priorities')); setResolved(true); }}>
                {resolved ? <CheckIcon aria-hidden /> : <PlusIcon aria-hidden />}
              </button>
            </div>
            <div className="db-task">
              <span className="db-task-icon"><EuroIcon aria-hidden /></span>
              <span className="ns-bar" />
              <span className="ns-bar ns-bar--strong w-5 flex-none" />
            </div>
          </div>
        </div>
      </div>

      <div className="db-empty-today" role="group" aria-label={t('dashboard.firstUse.demo.today')}>
        {[
          { key: 'arrivals', icon: LogInIcon, count: 3 },
          { key: 'departures', icon: LogOutIcon, count: 2 },
          { key: 'cleaning', icon: BrushIcon, count: 2 },
        ].map(({ key, icon: Icon, count }) => (
          <button key={key} type="button" className="db-today-item ns-hl" data-hl={scene === 'day'} onClick={() => onSelect(index('day'))}>
            <Icon aria-hidden />
            <span>{number(count)}<small>{t(`dashboard.firstUse.demo.${key}`)}</small></span>
          </button>
        ))}
      </div>

      <div className="db-empty-widget ns-hl" data-hl={scene === 'customize'} data-filled={widgetAdded}>
        {widgetAdded ? (
          <>
            <Packshot src={STAGE_IMAGES.occupancy} size="xs" bare />
            <span className="db-empty-widget-track" role="img" aria-label={`${t('dashboard.firstUse.demo.propertyOccupancy')} ${number(73)} %`}><span /></span>
            <span className="tabular-nums text-[var(--ns-ink)]">{number(73)} %</span>
          </>
        ) : (
          <button type="button" className="db-go" aria-label={t('dashboard.firstUse.demo.addWidget')} onClick={() => { onSelect(index('customize')); setWidgetAdded(true); }}>
            <PlusIcon aria-hidden />
          </button>
        )}
        {!widgetAdded && <span className="ns-bar flex-1" aria-hidden />}
      </div>
    </StageCard>
  );
}

export interface DashboardEmptyShowcaseProps {
  onConnect: () => void;
}

export default function DashboardEmptyShowcase({ onConnect }: DashboardEmptyShowcaseProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const stage = useStageScene(SCENES.length, 5600);
  const id = useId();

  const steps: RailStep[] = SCENES.map(({ key, image }) => ({ key, image, label: t(`dashboard.firstUse.scenes.${key}`) }));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-5 pb-10 sm:px-6 sm:pt-7">
      <FirstUseStage
        headingId={`${id}-title`}
        icon={<LayoutDashboardIcon aria-hidden />}
        eyebrow={t('dashboard.title')}
        title={t('dashboard.firstUse.title')}
        lede={t('dashboard.firstUse.lede')}
        actions={
          <>
            <Button size="lg" onClick={() => navigate('/properties/new')}>{t('dashboard.firstUse.addProperty')}</Button>
            <Button size="lg" variant="outline" onClick={onConnect}>{t('dashboard.firstUse.connectChannels')}</Button>
          </>
        }
        visual={
          <div role="group" aria-label={t('dashboard.firstUse.demo.accessibleLabel')}>
            <DashboardDemo scene={SCENES[stage.scene].key} onSelect={stage.select} />
          </div>
        }
        onVisualFocus={stage.takeOver}
        rail={<StageRail steps={steps} scene={stage} label={t('dashboard.firstUse.demoTitle')} />}
      />
      <StageFoot note={t('dashboard.firstUse.liveNote')} />
    </div>
  );
}
