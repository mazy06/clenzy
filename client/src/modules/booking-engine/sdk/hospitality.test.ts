import { afterEach, describe, expect, it, vi } from 'vitest';
import { enhanceHospitality } from './hospitality';

const mounted: Array<() => void> = [];
afterEach(() => { mounted.splice(0).forEach((stop) => stop()); document.body.replaceChildren(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function fixture(reduced: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: reduced }));
  const site = document.createElement('main');
  site.setAttribute('data-baitly-template', 'baitly-atlas');
  site.innerHTML = '<section data-baitly-reveal="rise" data-baitly-speed="750"><h1>Une vraie page</h1></section><div data-baitly-gallery><button data-baitly-gallery-step="1">Suivant</button><div class="bt-photo-track"><a href="https://example.com/photo.jpg" data-baitly-image><img src="https://example.com/photo.jpg" alt="La maison"></a></div></div>';
  document.body.appendChild(site);
  const track = site.querySelector<HTMLElement>('.bt-photo-track')!;
  Object.defineProperty(track, 'clientWidth', { value: 500 });
  track.scrollBy = vi.fn();
  return { site, track };
}

describe('Native hospitality interactions', () => {
  it('allows Studio to enlarge the authenticated preview photo without changing the public link', () => {
    const { site } = fixture(true);
    HTMLDialogElement.prototype.showModal = vi.fn(function(this: HTMLDialogElement) { this.open = true; });
    HTMLDialogElement.prototype.close = vi.fn();
    const link = site.querySelector<HTMLAnchorElement>('[data-baitly-image]')!;
    mounted.push(enhanceHospitality(document, { imageSource: () => 'https://example.com/host-preview.jpg' }));
    link.click();
    expect(document.querySelector('dialog img')?.getAttribute('src')).toBe('https://example.com/host-preview.jpg');
    expect(link.href).toBe('https://example.com/photo.jpg');
  });
  it('remains visible without an observer and respects reduced motion for gallery navigation', () => {
    const { site, track } = fixture(true);
    const stop = enhanceHospitality(document);
    mounted.push(stop);
    site.querySelector('button')!.click();
    expect(track.scrollBy).toHaveBeenCalledWith({ left: 400, behavior: 'instant' });
    expect(site.querySelector('section')!.style.opacity).toBe('');
    expect(site.textContent).toContain('Une vraie page');
  });

  it('is idempotent and removes event handlers on unmount', () => {
    const { site, track } = fixture(false);
    const stop = enhanceHospitality(document);
    expect(enhanceHospitality(document)).toBe(stop);
    site.querySelector('button')!.click();
    expect(track.scrollBy).toHaveBeenCalledTimes(1);
    stop();
    site.querySelector('button')!.click();
    expect(track.scrollBy).toHaveBeenCalledTimes(1);
  });

  it('reveals each section once through the Web Animations API and cancels animations on cleanup', () => {
    const { site } = fixture(false);
    let notify: IntersectionObserverCallback = () => {};
    const disconnect = vi.fn();
    const unobserve = vi.fn();
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { notify = callback; }
      observe = vi.fn(); unobserve = unobserve; disconnect = disconnect;
    });
    const section = site.querySelector('section')!;
    const cancel = vi.fn();
    section.animate = vi.fn().mockReturnValue({ cancel });
    const stop = enhanceHospitality(document);
    notify([{ isIntersecting: true, target: section } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
    expect(section.animate).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ duration: 750 }));
    expect(unobserve).toHaveBeenCalledWith(section);
    expect(section.style.opacity).toBe('');
    stop();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('uses a native accessible image dialog and restores focus when it closes', () => {
    const { site } = fixture(true);
    HTMLDialogElement.prototype.showModal = vi.fn(function(this: HTMLDialogElement) { this.open = true; });
    HTMLDialogElement.prototype.close = vi.fn(function(this: HTMLDialogElement) { this.open = false; });
    const link = site.querySelector<HTMLAnchorElement>('[data-baitly-image]')!;
    mounted.push(enhanceHospitality(document));
    link.focus();
    link.click();
    const dialog = document.querySelector('dialog')!;
    expect(dialog.open).toBe(true);
    expect(dialog.getAttribute('aria-label')).toBe('La maison');
    expect(dialog.querySelector('img')!.src).toBe('https://example.com/photo.jpg');
    dialog.querySelector('button')!.click();
    expect(document.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(link);
  });
});
