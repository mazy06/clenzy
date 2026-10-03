import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SiteLanguageProvider } from '../lib/siteLanguage';
import { AGENTS_DEMO_MESSAGES } from '../lib/messages/baitlyAgentsDemo';
import { Bar, PlanningScene, RESAS } from './AnimatedPlanningMockup';
import { AgentsScene } from './BaitlyAgentsPlanningDemo';
import { ScheduleModal } from './baitlyAgentsDemoBoard';

afterEach(cleanup);
const noop = () => {};
const scene = {
  active: false,
  reduced: true,
  clockRef: { current: () => 0 },
  onNarrate: noop,
  onAnnotationChange: noop,
  onCycleEnd: noop,
};

describe('Arabic planning demos', () => {
  it('keeps the scripted intervention date while displaying the Hijri day', () => {
    const { container } = render(
      <SiteLanguageProvider initialLanguage="ar">
        <ScheduleModal m={AGENTS_DEMO_MESSAGES.ar} day={28} assigned={false} maxHeight={700} />
      </SiteLanguageProvider>,
    );
    expect(container.querySelector('[data-day="2026-09-28"]')).toHaveTextContent('١٧');
    expect(container.querySelector('[data-selected]')).toHaveAttribute('data-day', '2026-09-28');
    expect(container.querySelector('.bad-calendar-head')).toHaveTextContent('ربيع الآخر ١٤٤٨');
  });
  it.each(['planning', 'agents'])('%s uses the Arabic direction on its actual canvas', (mode) => {
    const { container } = render(
      <SiteLanguageProvider initialLanguage="ar">
        {mode === 'planning'
          ? <PlanningScene {...scene} onSceneChange={noop} />
          : <AgentsScene {...scene} m={AGENTS_DEMO_MESSAGES.ar} />}
      </SiteLanguageProvider>,
    );
    expect(container.querySelector('.bpm-planning-canvas')).toHaveAttribute('dir', 'rtl');
    expect(container.querySelector('.bpm-planning-canvas')).toHaveAttribute('lang', 'ar');
  });

  it('moves a booking toward later dates on the left and preserves the Latin name', () => {
    const { container } = render(
      <SiteLanguageProvider initialLanguage="ar">
        <Bar resa={RESAS.find(r => r.id === 'r9')!} shift={2} extra={0}
          muted={false} dragging={false} conflict={false} infoFilled={false} />
      </SiteLanguageProvider>,
    );
    expect(container.querySelector('[data-bar="r9"]')).toHaveStyle({ transform: 'translateX(-148px)' });
    expect(container.querySelector('[data-guest-name] bdi')).toHaveTextContent('Mia Andersson');
  });
});
