import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ key: '', imports: vi.fn(), init: vi.fn(), capture: vi.fn(), identify: vi.fn(), group: vi.fn() }));
vi.mock('../../config/runtimeConfig', () => ({ runtimeEnv: () => mocks.key, runtimeEnvOr: (_: string, fallback: string) => fallback }));
vi.mock('posthog-js', () => {
  mocks.imports();
  return { default: { init: mocks.init, capture: mocks.capture, identify: mocks.identify, group: mocks.group } };
});
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); mocks.key = ''; });
afterEach(() => { vi.restoreAllMocks(); });

describe('analytics Baitly différées', () => {
  it('ne charge pas le SDK sans configuration et ignore les événements', async () => {
    const analytics = await import('../baitlyAnalytics');
    analytics.baitlyAnalytics.capture('test'); await analytics.startBaitlyAnalytics();
    expect(mocks.imports).not.toHaveBeenCalled(); expect(mocks.init).not.toHaveBeenCalled();
  });

  it('attend le démarrage explicite, initialise une seule fois et rejoue dans l’ordre', async () => {
    mocks.key = 'public-test-key';
    const analytics = await import('../baitlyAnalytics');
    analytics.baitlyAnalytics.identify('user'); analytics.baitlyAnalytics.capture('page_viewed');
    expect(mocks.imports).not.toHaveBeenCalled();
    await Promise.all([analytics.startBaitlyAnalytics(), analytics.startBaitlyAnalytics()]);
    expect(mocks.init).toHaveBeenCalledOnce(); expect(mocks.capture).not.toHaveBeenCalled();
    const options = mocks.init.mock.calls[0][1];
    options.loaded({ capture: mocks.capture, identify: mocks.identify });
    expect(mocks.identify).toHaveBeenCalledWith('user');
    expect(mocks.capture).toHaveBeenCalledWith('page_viewed');
    expect(mocks.identify.mock.invocationCallOrder[0]).toBeLessThan(mocks.capture.mock.invocationCallOrder[0]);
    expect(options).toMatchObject({ mask_all_text: true, mask_all_element_attributes: true,
      session_recording: { maskAllInputs: true, maskTextSelector: '*', recordCrossOriginIframes: false } });
    analytics.baitlyAnalytics.capture('later'); expect(mocks.capture).toHaveBeenLastCalledWith('later');
  });

  it('borne la file mémoire et ne propage pas un échec du SDK', async () => {
    mocks.key = 'public-test-key';
    const analytics = await import('../baitlyAnalytics');
    for (let i = 0; i < 250; i++) analytics.baitlyAnalytics.capture('event');
    await analytics.startBaitlyAnalytics();
    mocks.init.mock.calls[0][1].loaded({ capture: mocks.capture });
    expect(mocks.capture).toHaveBeenCalledTimes(200);
  });

  it('permet de retenter une initialisation échouée sans bloquer le produit', async () => {
    mocks.key = 'public-test-key'; mocks.init.mockImplementationOnce(() => { throw new Error('offline'); });
    const analytics = await import('../baitlyAnalytics');
    analytics.baitlyAnalytics.capture('obsolete');
    await expect(analytics.startBaitlyAnalytics()).resolves.toBeUndefined();
    await analytics.startBaitlyAnalytics();
    mocks.init.mock.calls[1][1].loaded({ capture: mocks.capture });
    expect(mocks.capture).not.toHaveBeenCalled();
  });
});
