import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScrollGuideSection from './ScrollGuideSection';

vi.mock('../lib/siteLanguage', () => ({
  useSiteLanguage: () => ({ language: 'fr' }),
}));

let pageY = 0;
let phoneHeight = 367;
const pageScroll = vi.fn();
const phoneScroll = vi.fn();
const originalPhoneScroll = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'scrollTo',
);
const formPresent = () => !!document.querySelector('[data-guide-checkin]');
const contentTop = () => {
  const transform =
    document.querySelector<HTMLElement>('.bsg-phone-content')?.style.transform;
  return 200 + Number(transform?.match(/translateY\(([-\d.]+)px\)/)?.[1] ?? 0);
};

beforeEach(() => {
  pageY = 0;
  phoneHeight = 367;
  pageScroll.mockReset();
  phoneScroll.mockReset();
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('requestAnimationFrame', (fn: () => void) =>
    window.setTimeout(fn, 16),
  );
  vi.stubGlobal('cancelAnimationFrame', window.clearTimeout);
  vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => pageY);
  vi.stubGlobal('scrollTo', pageScroll);
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value: phoneScroll,
  });
  const computedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    element.classList.contains('bsg-stage')
      ? ({ top: '88px' } as CSSStyleDeclaration)
      : computedStyle(element),
  );
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(
    function () {
      if (this.classList.contains('bsg-track')) return 5000;
      if (this.classList.contains('bsg-stage')) return 720;
      return this.hasAttribute('data-guide-checkin') ? 284 : 0;
    },
  );
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(
    () => phoneHeight,
  );
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
    () => (formPresent() ? 1900 : 1600),
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function () {
      let top = contentTop();
      let height = 0;
      if (this.classList.contains('bsg-track')) top = 500 - pageY;
      if (this.hasAttribute('data-guide-checkin')) {
        top += 240;
        height = 284;
      }
      if (this.hasAttribute('data-guide-step')) {
        const index = Number(this.dataset.guideStep) - 1;
        top += [256, 420, 680, 1000][index] + (formPresent() ? 300 : 0);
      }
      return {
        top,
        bottom: top + height,
        height,
        width: 300,
        left: 0,
        right: 300,
        x: 0,
        y: top,
        toJSON: () => ({}),
      };
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (originalPhoneScroll)
    Object.defineProperty(
      HTMLElement.prototype,
      'scrollTo',
      originalPhoneScroll,
    );
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo');
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const scrollToProgress = (progress: number) => {
  pageY = 500 - 88 + progress * (5000 - 720);
  fireEvent.scroll(window);
  act(() => vi.advanceTimersByTime(16));
};

describe('Welcome guide scroll journey', () => {
  it('reveals check-in on a short phone, reaches the exact content end and rewinds', () => {
    const { container } = render(<ScrollGuideSection />);
    const content = container.querySelector<HTMLElement>('.bsg-phone-content')!;
    expect(formPresent()).toBe(true);
    scrollToProgress(0.3);
    // The check-in bottom (524) remains visible inside the 367px phone.
    expect(content.style.transform).toBe('translateY(-173px)');
    expect(
      screen.getByText('Informations complétées dans cet exemple.'),
    ).toBeTruthy();
    scrollToProgress(1);
    expect(formPresent()).toBe(false);
    // Re-measure after removing the 300px check-in, without a blank tail.
    expect(content.style.transform).toBe('translateY(-1233px)');
    expect(
      screen
        .getByRole('button', { name: /05\s*Expériences/ })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    scrollToProgress(0);
    expect(formPresent()).toBe(true);
    expect(content.style.transform).toBe('translateY(0px)');
    expect(
      screen
        .getByRole('button', { name: /01\s*Check-in/ })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('seeks to the same chapter before and after check-in disappears', () => {
    render(<ScrollGuideSection />);
    fireEvent.click(screen.getByRole('button', { name: /05\s*Expériences/ }));
    const first = pageScroll.mock.calls[0][0];
    scrollToProgress(0.5);
    expect(formPresent()).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /05\s*Expériences/ }));
    expect(pageScroll.mock.calls[1][0]).toEqual(first);
    expect(first.behavior).toBe('smooth');
  });

  it('keeps every chapter reachable without moving the page in reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const { container } = render(<ScrollGuideSection />);
    const phone = container.querySelector<HTMLElement>('.bsg-viewport')!;
    expect(phone.tabIndex).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: /05\s*Expériences/ }));
    expect(phoneScroll).toHaveBeenCalledWith({ top: 1280, behavior: 'auto' });
    expect(pageScroll).not.toHaveBeenCalled();
    fireEvent.scroll(phone, { target: { scrollTop: 1280 } });
    expect(
      screen
        .getByRole('button', { name: /05\s*Expériences/ })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      container.querySelector<HTMLElement>('.bsg-phone-content')!.style
        .transform,
    ).toBe('');
    expect(formPresent()).toBe(true);
  });
});
