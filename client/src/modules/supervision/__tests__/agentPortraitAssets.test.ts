import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const images: { src: string; onload: () => void; onerror: () => void; decode: ReturnType<typeof vi.fn> }[] = [];
beforeEach(() => {
  vi.resetModules();
  images.length = 0;
  vi.stubGlobal('Image', class {
    src = '';
    onload = () => {};
    onerror = () => {};
    decode = vi.fn().mockResolvedValue(undefined);
    constructor() { images.push(this); }
  });
});
afterEach(() => vi.unstubAllGlobals());

it('decodes only ten stills and shares their warmup across repeated openings', async () => {
  const { preloadAgentPortraits } = await import('../core/agentPortraitAssets');
  const first = preloadAgentPortraits();
  const second = preloadAgentPortraits();
  expect(images).toHaveLength(10);
  expect(images.every(image => image.src.endsWith('.webp') && !image.src.includes('-animated'))).toBe(true);
  images.forEach(image => image.onload());
  await Promise.all([first, second, preloadAgentPortraits()]);
  expect(images).toHaveLength(10);
  images.forEach(image => expect(image.decode).toHaveBeenCalledOnce());
});

it('retries an unavailable portrait without fetching the other nine again', async () => {
  const { preloadAgentPortraits } = await import('../core/agentPortraitAssets');
  const first = preloadAgentPortraits();
  images[0].onerror();
  images.slice(1).forEach(image => image.onload());
  await first;
  const retry = preloadAgentPortraits();
  expect(images).toHaveLength(11);
  expect(images[10].src).toBe(images[0].src);
  images[10].onload();
  await retry;
});
